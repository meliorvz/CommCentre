import { Hono } from 'hono';
import { Env } from '../../../types';
import { createDb, stays, threads, properties } from '../../../db';
import { eq, or } from 'drizzle-orm';

const emailWebhooks = new Hono<{ Bindings: Env }>();

interface InboundEmailPayload {
    from: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
    messageId?: string;
}

// Inbound email webhook
// This endpoint receives forwarded emails from Gmail or other sources
// Gmail can be configured to forward certain emails to a webhook service like Pipedream/Zapier
// which then calls this endpoint
emailWebhooks.post('/inbound', async (c) => {
    const body = await c.req.json() as InboundEmailPayload;

    console.log('[Email Inbound] Received email:', {
        from: body.from,
        to: body.to,
        subject: body.subject,
        bodyLength: body.text?.length,
    });

    // Extract email address from "Name <email>" format
    const fromEmail = extractEmail(body.from);

    if (!fromEmail || !body.text) {
        return c.json({ error: 'Invalid email payload' }, 400);
    }

    const db = createDb(c.env.DATABASE_URL);

    // Strategy: Try to find existing thread/stay by email OR phone (for thread merging)
    // 1. First, try to find by email address
    // 2. If found, use that thread (multi-channel merging)

    let matchingStay: any = null;
    let existingThread: any = null;

    // Find by email
    const [emailMatch] = await db
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

    if (emailMatch?.stay) {
        matchingStay = emailMatch;
        existingThread = emailMatch.thread;
    }

    let threadId: string;

    if (existingThread) {
        // Use existing thread (could be from SMS or previous email)
        threadId = existingThread.id;
        console.log(`[Email Inbound] Found existing thread ${threadId} for ${fromEmail}`);
    } else if (matchingStay?.stay) {
        // Stay exists but no thread yet - create thread
        const [newThread] = await db
            .insert(threads)
            .values({
                stayId: matchingStay.stay.id,
                status: 'open',
            })
            .returning();

        threadId = newThread.id;
        console.log(`[Email Inbound] Created new thread ${threadId} for existing stay`);
    } else {
        // Unknown sender - create "System" stay + thread (same pattern as SMS)
        console.log(`[Email Inbound] Unknown sender ${fromEmail}, creating system thread`);

        const [newStay] = await db
            .insert(stays)
            .values({
                propertyId: '00000000-0000-0000-0000-000000000000', // System property
                guestName: extractName(body.from) || `Unknown (${fromEmail})`,
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
                status: 'needs_human', // Unknown senders need human attention
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
                providerMessageId: body.messageId || `email-${Date.now()}`,
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

    return c.json({ success: true, threadId });
});

// Helper: Extract email from "Name <email>" format
function extractEmail(from: string): string | null {
    const match = from.match(/<([^>]+)>/) || from.match(/([^\s<]+@[^\s>]+)/);
    return match ? match[1].toLowerCase() : null;
}

// Helper: Extract name from "Name <email>" format
function extractName(from: string): string | null {
    const match = from.match(/^([^<]+)</);
    return match ? match[1].trim() : null;
}

export default emailWebhooks;
