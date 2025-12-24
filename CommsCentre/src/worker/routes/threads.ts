import { Hono } from 'hono';
import { eq, desc, and, or } from 'drizzle-orm';
import { Env, manualReplySchema } from '../../types';
import { createDb, threads, messages, stays, properties } from '../../db';
import { authMiddleware } from '../middleware/auth';
import { sendSms } from '../lib/twilio';
import { sendEmail } from '../lib/gmail';

const threadsRouter = new Hono<{ Bindings: Env }>();

threadsRouter.use('*', authMiddleware);

// List threads (inbox)
threadsRouter.get('/', async (c) => {
    const { status, limit = '50' } = c.req.query();
    const db = createDb(c.env.DATABASE_URL);

    const result = await db
        .select({
            thread: threads,
            stay: stays,
            property: properties,
        })
        .from(threads)
        .leftJoin(stays, eq(threads.stayId, stays.id))
        .leftJoin(properties, eq(stays.propertyId, properties.id))
        .where(status ? eq(threads.status, status as any) : undefined)
        .orderBy(desc(threads.lastMessageAt))
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

    const [threadData] = await db
        .select({
            thread: threads,
            stay: stays,
            property: properties,
        })
        .from(threads)
        .leftJoin(stays, eq(threads.stayId, stays.id))
        .leftJoin(properties, eq(stays.propertyId, properties.id))
        .where(eq(threads.id, id))
        .limit(1);

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

    const updateData: any = { updatedAt: new Date() };
    if (status) updateData.status = status;
    if (assignedUserId !== undefined) updateData.assignedUserId = assignedUserId;

    const [updated] = await db.update(threads).set(updateData).where(eq(threads.id, id)).returning();

    if (!updated) {
        return c.json({ error: 'Thread not found' }, 404);
    }

    return c.json({ thread: updated });
});

// Manual reply
threadsRouter.post('/:id/reply', async (c) => {
    const { id } = c.req.param();
    const body = await c.req.json();
    const parsed = manualReplySchema.safeParse(body);

    if (!parsed.success) {
        return c.json({ error: 'Invalid request', details: parsed.error.issues }, 400);
    }

    const db = createDb(c.env.DATABASE_URL);

    // Get thread with stay and property
    const [threadData] = await db
        .select({
            thread: threads,
            stay: stays,
            property: properties,
        })
        .from(threads)
        .leftJoin(stays, eq(threads.stayId, stays.id))
        .leftJoin(properties, eq(stays.propertyId, properties.id))
        .where(eq(threads.id, id))
        .limit(1);

    if (!threadData || !threadData.stay) {
        return c.json({ error: 'Thread not found' }, 404);
    }

    const { channel, body: messageBody, subject } = parsed.data;
    const stay = threadData.stay;
    const property = threadData.property;

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
            providerMessageId = await sendEmail(c.env, {
                to: stay.guestEmail,
                from: property?.supportEmail || '', // gmail.ts will use GMAIL_FROM_ADDRESS as default
                subject: subject || 'Message from your host',
                text: messageBody,
            });
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
