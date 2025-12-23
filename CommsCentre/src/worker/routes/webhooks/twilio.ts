import { Hono } from 'hono';
import { Env, TwilioSmsWebhook, TwilioVoiceWebhook } from '../../../types';
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

    const [matchingStay] = await db
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
    } else {
        // Create unmatched stay + thread for unknown caller
        const [newStay] = await db
            .insert(stays)
            .values({
                propertyId: '00000000-0000-0000-0000-000000000000', // Placeholder
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
                status: 'needs_human',
            })
            .returning();

        threadId = newThread.id;
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

    // Return 200 immediately (Twilio expects quick response)
    return c.text('OK', 200);
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

    // Get property by the called number to find forwarding number
    const db = createDb(c.env.DATABASE_URL);

    const [property] = await db
        .select()
        .from(properties)
        .where(eq(properties.supportPhoneE164, webhook.To))
        .limit(1);

    // Forward to support phone (default to a fallback)
    const forwardTo = property?.supportPhoneE164 || '+61400000000';

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
