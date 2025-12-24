import { Env } from '../types';
import { createDb, stays, threads, properties } from '../db';
import { eq } from 'drizzle-orm';
import PostalMime from 'postal-mime';

// Cloudflare Email Worker handler
// This is called directly by Cloudflare Email Routing when emails arrive
export async function handleEmail(message: ForwardableEmailMessage, env: Env): Promise<void> {
    console.log('[Email Routing] Received email from:', message.from, 'to:', message.to);

    try {
        // Parse email content using postal-mime
        const rawEmail = await streamToArrayBuffer(message.raw);
        const parser = new PostalMime();
        const email = await parser.parse(rawEmail);

        const fromEmail = extractEmail(message.from);
        const subject = email.subject || '(No subject)';
        const body = email.text || email.html?.replace(/<[^>]*>/g, '') || '';

        if (!fromEmail) {
            console.error('[Email Routing] Could not extract email from:', message.from);
            return;
        }

        console.log('[Email Routing] Parsed email:', { from: fromEmail, subject, bodyLength: body.length });

        const db = createDb(env.DATABASE_URL);

        // Find matching stay by email address
        let matchingStay: any = null;
        let existingThread: any = null;

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
            // Use existing thread
            threadId = existingThread.id;
            console.log(`[Email Routing] Found existing thread ${threadId} for ${fromEmail}`);
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
            console.log(`[Email Routing] Created new thread ${threadId} for existing stay`);
        } else {
            // Unknown sender - create "System" stay + thread
            console.log(`[Email Routing] Unknown sender ${fromEmail}, creating system thread`);

            const [newStay] = await db
                .insert(stays)
                .values({
                    propertyId: '00000000-0000-0000-0000-000000000000', // System property
                    guestName: extractName(message.from) || `Unknown (${fromEmail})`,
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
            matchingStay = { stay: newStay, thread: newThread, property: null };
        }

        // Forward to ThreadDO for async processing
        const threadDO = env.THREAD_DO.get(env.THREAD_DO.idFromName(threadId));

        await threadDO.fetch('http://internal/inbound', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                channel: 'email',
                providerMessageId: message.headers.get('message-id') || `email-${Date.now()}`,
                from: fromEmail,
                to: message.to,
                subject: subject,
                body: body,
                threadId,
                stayId: matchingStay?.stay?.id,
                propertyId: matchingStay?.property?.id,
            }),
        });

        console.log(`[Email Routing] Forwarded to ThreadDO, thread: ${threadId}`);

    } catch (err) {
        console.error('[Email Routing] Error processing email:', err);
        // Don't throw - we don't want to reject the email
    }
}

// Helper: Convert ReadableStream to ArrayBuffer
async function streamToArrayBuffer(stream: ReadableStream<Uint8Array>): Promise<ArrayBuffer> {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;

    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }

    return result.buffer;
}

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

// Type for Cloudflare Email message
interface ForwardableEmailMessage {
    from: string;
    to: string;
    raw: ReadableStream<Uint8Array>;
    headers: Headers;
    rawSize: number;
    setReject(reason: string): void;
    forward(recipient: string): Promise<void>;
}
