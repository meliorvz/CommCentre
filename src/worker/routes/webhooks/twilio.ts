import { Hono } from 'hono';
import { Env, TwilioSmsWebhook, TwilioVoiceWebhook, GlobalSettings } from '../../../types';
import { createDb, stays, threads, properties } from '../../../db';
import { eq, or } from 'drizzle-orm';

const twilioWebhooks = new Hono<{ Bindings: Env }>();

// Inbound SMS webhook
twilioWebhooks.post('/sms', async (c) => {
    // Parse form data (Twilio sends as x-www-form-urlencoded)
    const formData = await c.req.formData();
    const webhook: TwilioSmsWebhook = {
        MessageSid: formData.get('MessageSid') as string,
        AccountSid: formData.get('AccountSid') as string,
        From: formData.get('From') as string,
        To: formData.get('To') as string,
        Body: formData.get('Body') as string,
        NumMedia: formData.get('NumMedia') as string,
    };

    // Basic validation
    if (!webhook.MessageSid || !webhook.From || !webhook.Body) {
        return c.text('Bad Request', 400);
    }

    // TODO: Validate Twilio signature for production
    // const signature = c.req.header('X-Twilio-Signature');
    // if (!validateTwilioSignature(signature, c.env.TWILIO_AUTH_TOKEN, url, params)) {
    //   return c.text('Forbidden', 403);
    // }

    // Find matching stay by phone number
    const db = createDb(c.env.DATABASE_URL);

    // First try to find by phone (exact match)
    let [matchingStay] = await db
        .select({
            stay: stays,
            thread: threads,
            property: properties,
        })
        .from(stays)
        .leftJoin(threads, eq(threads.stayId, stays.id))
        .leftJoin(properties, eq(stays.propertyId, properties.id))
        .where(eq(stays.guestPhoneE164, webhook.From))
        .limit(1);

    let threadId: string;

    if (matchingStay?.thread) {
        threadId = matchingStay.thread.id;
        console.log(`[SMS Inbound] Found existing thread ${threadId} for phone ${webhook.From}`);
    } else if (matchingStay?.stay) {
        // Stay exists but no thread - create one
        const [newThread] = await db
            .insert(threads)
            .values({
                stayId: matchingStay.stay.id,
                status: 'open',
            })
            .returning();

        threadId = newThread.id;
        console.log(`[SMS Inbound] Created new thread ${threadId} for stay with phone ${webhook.From}`);
    } else {
        // No match by phone - create unmatched stay + thread for unknown caller
        console.log(`[SMS Inbound] Unknown caller ${webhook.From}, creating system thread`);
        const [newStay] = await db
            .insert(stays)
            .values({
                propertyId: '00000000-0000-0000-0000-000000000000', // System property
                guestName: `Unknown (${webhook.From})`,
                guestPhoneE164: webhook.From,
                checkinAt: new Date(),
                checkoutAt: new Date(),
                status: 'booked',
            })
            .returning();

        const [newThread] = await db
            .insert(threads)
            .values({
                stayId: newStay.id,
                status: 'needs_human', // Unknown callers need human attention
            })
            .returning();

        threadId = newThread.id;
        matchingStay = { stay: newStay, thread: newThread, property: null };
    }

    // Forward to ThreadDO for async processing
    const threadDO = c.env.THREAD_DO.get(c.env.THREAD_DO.idFromName(threadId));

    // Fire and forget - don't await
    c.executionCtx.waitUntil(
        threadDO.fetch('http://internal/inbound', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                channel: 'sms',
                providerMessageId: webhook.MessageSid,
                from: webhook.From,
                to: webhook.To,
                body: webhook.Body,
                threadId,
                stayId: matchingStay?.stay?.id,
                propertyId: matchingStay?.property?.id,
            }),
        })
    );

    // Return empty TwiML to prevent Twilio from sending a reply
    return c.text('<Response></Response>', 200, {
        'Content-Type': 'text/xml',
    });
});

// Inbound voice webhook
twilioWebhooks.post('/voice', async (c) => {
    const formData = await c.req.formData();
    const webhook: TwilioVoiceWebhook = {
        CallSid: formData.get('CallSid') as string,
        AccountSid: formData.get('AccountSid') as string,
        From: formData.get('From') as string,
        To: formData.get('To') as string,
        CallStatus: formData.get('CallStatus') as string,
    };

    // Get property by the called number logic is flawed for forwarding
    // Instead, we use the global call forwarding setting or fallback to E164 match

    const db = createDb(c.env.DATABASE_URL);

    // Get global settings for forwarding number
    const configDO = c.env.CONFIG_DO.get(c.env.CONFIG_DO.idFromName('global'));
    const configResp = await configDO.fetch('http://internal/config');
    const { settings } = await configResp.json() as { settings: GlobalSettings };

    // Priority:
    // 1. Global Call Forwarding Setting
    // 2. Fallback to property support phone (legacy behavior, but risky for loops)
    // 3. Environment variable TWILIO_FROM_NUMBER (failsafe)

    let forwardTo = settings.callForwardingNumber;

    if (!forwardTo) {
        // Fallback: try to find property by support phone (legacy match)
        // Note: This matches the *called* number to find a property, 
        // asking "which property owns this number?"
        const [property] = await db
            .select()
            .from(properties)
            .where(eq(properties.supportPhoneE164, webhook.To))
            .limit(1);

        // If we found a property, we might want to forward to a specific number
        // BUT the existing logic was circular: forwardTo = property.supportPhoneE164
        // which just loops back to this webhook.
        // So we only fallback to env var if explicit forwarding isn't set.
        forwardTo = c.env.TWILIO_FROM_NUMBER;
    }

    if (!forwardTo) {
        // No forwarding number configured - play a message and hang up
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Sorry, this number is not configured to receive calls. Please try again later.</Say>
  <Hangup/>
</Response>`;
        return c.text(twiml, 200, {
            'Content-Type': 'text/xml',
        });
    }

    // Return TwiML for call forwarding
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${webhook.To}">
    <Number>${forwardTo}</Number>
  </Dial>
</Response>`;

    return c.text(twiml, 200, {
        'Content-Type': 'text/xml',
    });
});

// SMS delivery status callback
twilioWebhooks.post('/sms/status', async (c) => {
    const formData = await c.req.formData();
    const messageSid = formData.get('MessageSid') as string;
    const messageStatus = formData.get('MessageStatus') as string;

    // Update message status in database
    const db = createDb(c.env.DATABASE_URL);

    // Map Twilio status to our status
    const statusMap: Record<string, string> = {
        queued: 'queued',
        sent: 'sent',
        delivered: 'delivered',
        failed: 'failed',
        undelivered: 'failed',
    };

    const status = statusMap[messageStatus] || 'sent';

    // Update message by provider_message_id
    // Note: This is a fire-and-forget operation
    c.executionCtx.waitUntil(
        db.execute(
            `UPDATE messages SET status = '${status}' WHERE provider_message_id = '${messageSid}'`
        )
    );

    return c.text('OK', 200);
});

export default twilioWebhooks;
