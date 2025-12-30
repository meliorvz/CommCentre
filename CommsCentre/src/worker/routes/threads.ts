import { Hono } from 'hono';
import { eq, desc, and, or, sql } from 'drizzle-orm';
import { Env, manualReplySchema } from '../../types';
import { createDb, threads, messages, stays, properties } from '../../db';
import { authMiddleware, getEffectiveCompanyId } from '../middleware/auth';
import { sendSms } from '../lib/twilio';
import { sendEmail } from '../lib/gmail';
import { checkCredits, deductCredits, getCreditCost } from '../lib/credits';

const threadsRouter = new Hono<{ Bindings: Env }>();

threadsRouter.use('*', authMiddleware);

/**
 * Get company filter for queries
 * Super admins can see all or filter by company, others only see their company
 */
function getCompanyFilter(c: any) {
    const user = c.get('user');
    const companyId = getEffectiveCompanyId(c);

    if (user.role === 'super_admin' && !companyId) {
        return undefined; // No filter - see all
    }

    return companyId;
}

// List threads (inbox) - scoped by company
threadsRouter.get('/', async (c) => {
    const { status, limit = '50' } = c.req.query();
    const db = createDb(c.env.DATABASE_URL);
    const companyId = getCompanyFilter(c);

    // Build query with optional company filter
    let baseQuery = db
        .select({
            thread: threads,
            stay: stays,
            property: properties,
        })
        .from(threads)
        .leftJoin(stays, eq(threads.stayId, stays.id))
        .leftJoin(properties, eq(stays.propertyId, properties.id));

    // Apply filters
    const conditions = [];
    if (status) {
        conditions.push(eq(threads.status, status as any));
    }
    if (companyId) {
        conditions.push(eq(properties.companyId, companyId));
    }

    const result = await baseQuery
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(
            sql`CASE 
                WHEN ${threads.status} = 'needs_human' THEN 0 
                WHEN ${threads.status} = 'open' THEN 1 
                ELSE 2 
            END ASC`,
            desc(threads.lastMessageAt)
        )
        .limit(parseInt(limit));

    return c.json({
        threads: result.map((r) => ({
            ...r.thread,
            stay: r.stay,
            property: r.property,
        })),
    });
});

// Get single thread with messages
threadsRouter.get('/:id', async (c) => {
    const { id } = c.req.param();
    const db = createDb(c.env.DATABASE_URL);
    const companyId = getCompanyFilter(c);

    // Build query
    let baseQuery = db
        .select({
            thread: threads,
            stay: stays,
            property: properties,
        })
        .from(threads)
        .leftJoin(stays, eq(threads.stayId, stays.id))
        .leftJoin(properties, eq(stays.propertyId, properties.id));

    const conditions = [eq(threads.id, id)];
    if (companyId) {
        conditions.push(eq(properties.companyId, companyId));
    }

    const [threadData] = await baseQuery.where(and(...conditions)).limit(1);

    if (!threadData) {
        return c.json({ error: 'Thread not found' }, 404);
    }

    const threadMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.threadId, id))
        .orderBy(messages.createdAt);

    return c.json({
        thread: threadData.thread,
        stay: threadData.stay,
        property: threadData.property,
        messages: threadMessages,
    });
});

// Update thread status
threadsRouter.patch('/:id', async (c) => {
    const { id } = c.req.param();
    const body = await c.req.json();
    const { status, assignedUserId } = body;

    const db = createDb(c.env.DATABASE_URL);
    const companyId = getCompanyFilter(c);

    // Verify thread belongs to company
    if (companyId) {
        const [threadCheck] = await db
            .select({ id: threads.id })
            .from(threads)
            .leftJoin(stays, eq(threads.stayId, stays.id))
            .leftJoin(properties, eq(stays.propertyId, properties.id))
            .where(and(eq(threads.id, id), eq(properties.companyId, companyId)))
            .limit(1);

        if (!threadCheck) {
            return c.json({ error: 'Thread not found' }, 404);
        }
    }

    const updateData: any = { updatedAt: new Date() };
    if (status) updateData.status = status;
    if (assignedUserId !== undefined) updateData.assignedUserId = assignedUserId;

    const [updated] = await db.update(threads).set(updateData).where(eq(threads.id, id)).returning();

    if (!updated) {
        return c.json({ error: 'Thread not found' }, 404);
    }

    return c.json({ thread: updated });
});

// Manual reply - with credit checking
threadsRouter.post('/:id/reply', async (c) => {
    const { id } = c.req.param();
    const body = await c.req.json();
    const parsed = manualReplySchema.safeParse(body);

    if (!parsed.success) {
        return c.json({ error: 'Invalid request', details: parsed.error.issues }, 400);
    }

    const db = createDb(c.env.DATABASE_URL);
    const userCompanyId = getCompanyFilter(c);

    // Get thread with stay and property
    let baseQuery = db
        .select({
            thread: threads,
            stay: stays,
            property: properties,
        })
        .from(threads)
        .leftJoin(stays, eq(threads.stayId, stays.id))
        .leftJoin(properties, eq(stays.propertyId, properties.id));

    const conditions = [eq(threads.id, id)];
    if (userCompanyId) {
        conditions.push(eq(properties.companyId, userCompanyId));
    }

    const [threadData] = await baseQuery.where(and(...conditions)).limit(1);

    if (!threadData || !threadData.stay) {
        return c.json({ error: 'Thread not found' }, 404);
    }

    const { channel, body: messageBody, subject } = parsed.data;
    const stay = threadData.stay;
    const property = threadData.property;

    // Check credits before sending
    const companyId = property?.companyId;
    if (companyId) {
        const creditType = channel === 'sms' ? 'sms_manual' : 'email_manual';
        const creditCost = await getCreditCost(c.env.DATABASE_URL, creditType);
        const creditCheck = await checkCredits(c.env.DATABASE_URL, companyId, creditCost);

        if (!creditCheck.allowed) {
            return c.json({
                error: 'Insufficient credits',
                details: creditCheck.reason,
                balance: creditCheck.balance,
                required: creditCost,
            }, 402);
        }
    }

    let providerMessageId: string | undefined;

    console.log(`Sending manual reply - Channel: ${channel}, To: ${channel === 'sms' ? stay.guestPhoneE164 : stay.guestEmail}, From: ${channel === 'sms' ? property?.supportPhoneE164 : property?.supportEmail}`);

    try {
        if (channel === 'sms') {
            if (!stay.guestPhoneE164) {
                return c.json({ error: 'Guest has no phone number' }, 400);
            }
            providerMessageId = await sendSms(c.env, stay.guestPhoneE164, messageBody, property?.supportPhoneE164 || undefined);
        } else {
            if (!stay.guestEmail) {
                return c.json({ error: 'Guest has no email address' }, 400);
            }

            // Get the last inbound email's Message-ID for threading
            const [lastInboundEmail] = await db
                .select({ providerMessageId: messages.providerMessageId })
                .from(messages)
                .where(and(
                    eq(messages.threadId, id),
                    eq(messages.direction, 'inbound'),
                    eq(messages.channel, 'email')
                ))
                .orderBy(desc(messages.createdAt))
                .limit(1);

            const inReplyTo = lastInboundEmail?.providerMessageId || undefined;

            // For proper threading, use the original subject with Re: prefix if no explicit subject given
            let replySubject = subject;
            if (!replySubject) {
                // Try to get the original subject from the last inbound email
                const [lastInboundWithSubject] = await db
                    .select({ subject: messages.subject })
                    .from(messages)
                    .where(and(
                        eq(messages.threadId, id),
                        eq(messages.direction, 'inbound'),
                        eq(messages.channel, 'email')
                    ))
                    .orderBy(desc(messages.createdAt))
                    .limit(1);

                const originalSubject = lastInboundWithSubject?.subject || 'Your inquiry';
                replySubject = originalSubject.startsWith('Re:')
                    ? originalSubject
                    : `Re: ${originalSubject}`;
            }

            providerMessageId = await sendEmail(c.env, {
                to: stay.guestEmail,
                from: property?.supportEmail || '', // gmail.ts will use GMAIL_FROM_ADDRESS as default
                subject: replySubject,
                text: messageBody,
                inReplyTo,
                references: inReplyTo, // For simple threading, references = in-reply-to
            });
        }

        // Deduct credits after successful send
        let creditsDeducted = 0;
        if (companyId) {
            const creditType = channel === 'sms' ? 'sms_manual' : 'email_manual';
            const creditCost = await getCreditCost(c.env.DATABASE_URL, creditType);
            const transactionType = channel === 'sms' ? 'sms_manual_usage' : 'email_manual_usage';

            const deductResult = await deductCredits(
                c.env.DATABASE_URL,
                companyId,
                transactionType as any,
                creditCost,
                id, // Thread ID as reference
                'thread',
                `Manual ${channel} reply via Admin UI`
            );

            if (deductResult.success) {
                creditsDeducted = creditCost;
            }
            console.log(`[CREDITS] Manual reply - deducted ${creditCost}: ${deductResult.success ? 'OK' : deductResult.error}`);
        }

        // Log message
        const [newMessage] = await db
            .insert(messages)
            .values({
                threadId: id,
                direction: 'outbound',
                channel,
                fromAddr: channel === 'sms' ? 'system' : (property?.supportEmail || 'system'),
                toAddr: channel === 'sms' ? stay.guestPhoneE164! : stay.guestEmail!,
                subject: subject || null,
                bodyText: messageBody,
                provider: channel === 'sms' ? 'twilio' : 'mailchannels',
                providerMessageId,
                status: 'sent',
                creditsDeducted,
            })
            .returning();

        // Update thread
        await db
            .update(threads)
            .set({
                lastMessageAt: new Date(),
                lastChannel: channel,
                status: 'open',
                updatedAt: new Date(),
            })
            .where(eq(threads.id, id));

        return c.json({ message: newMessage });
    } catch (err: any) {
        console.error('Failed to send message:', err);
        return c.json({
            error: 'Failed to send message',
            details: err.message,
            stack: err.stack
        }, 500);
    }
});

// Get suggested LLM reply (for preview)
threadsRouter.get('/:id/ai-analysis', async (c) => {
    const { id } = c.req.param();

    // Forward to ThreadDO for LLM processing
    const threadDO = c.env.THREAD_DO.get(c.env.THREAD_DO.idFromName(id));

    const response = await threadDO.fetch('http://internal/suggest', {
        method: 'GET',
    });

    if (!response.ok) {
        return c.json({ error: 'Failed to get suggestion' }, 500);
    }

    return c.json(await response.json());
});

export default threadsRouter;
