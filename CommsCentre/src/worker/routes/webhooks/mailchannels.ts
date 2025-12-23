import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { Env, MailChannelsInboundEmail } from '../../../types';
import { createDb, stays, threads, properties } from '../../../db';

const mailchannelsWebhooks = new Hono<{ Bindings: Env }>();

// Inbound email webhook
// Note: You'll need to configure Cloudflare Email Routing to forward to this worker
// or use a custom inbound email processing solution
mailchannelsWebhooks.post('/inbound', async (c) => {
    const body = await c.req.json() as MailChannelsInboundEmail;

    // Extract sender email
    const fromEmail = body.from.match(/<(.+)>/)?.[1] || body.from;

    if (!fromEmail || !body.text) {
        return c.json({ error: 'Invalid email' }, 400);
    }

    // Find matching stay by email
    const db = createDb(c.env.DATABASE_URL);

    const [matchingStay] = await db
        .select({
            stay: stays,
            thread: threads,
            property: properties,
        })
        .from(stays)
        .leftJoin(threads, eq(threads.stayId, stays.id))
        .leftJoin(properties, eq(stays.propertyId, properties.id))
        .where(eq(stays.guestEmail, fromEmail))
        .limit(1);

    let threadId: string;

    if (matchingStay?.thread) {
        threadId = matchingStay.thread.id;
    } else {
        // Create unmatched stay + thread
        const [newStay] = await db
            .insert(stays)
            .values({
                propertyId: '00000000-0000-0000-0000-000000000000',
                guestName: `Unknown (${fromEmail})`,
                guestEmail: fromEmail,
                checkinAt: new Date(),
                checkoutAt: new Date(),
                status: 'booked',
            })
            .returning();

        const [newThread] = await db
            .insert(threads)
            .values({
                stayId: newStay.id,
                status: 'needs_human',
            })
            .returning();

        threadId = newThread.id;
    }

    // Forward to ThreadDO for async processing
    const threadDO = c.env.THREAD_DO.get(c.env.THREAD_DO.idFromName(threadId));

    c.executionCtx.waitUntil(
        threadDO.fetch('http://internal/inbound', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                channel: 'email',
                providerMessageId: body.messageId,
                from: fromEmail,
                to: body.to,
                subject: body.subject,
                body: body.text,
                threadId,
                stayId: matchingStay?.stay?.id,
                propertyId: matchingStay?.property?.id,
            }),
        })
    );

    return c.json({ success: true }, 200);
});

export default mailchannelsWebhooks;
