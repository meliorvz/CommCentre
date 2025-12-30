import { DurableObject } from 'cloudflare:workers';
import { Env, LLMResponse, GlobalSettings } from '../types';
import { createDb, messages, threads, stays, properties } from '../db';
import { eq } from 'drizzle-orm';
import { callLLM, buildConversationContext } from '../worker/lib/openrouter';
import { sendSms } from '../worker/lib/twilio';
import { sendEmail } from '../worker/lib/gmail';
import { sendTelegramEscalation, sendTelegramAutoReplyNotification } from '../worker/lib/telegram';

export function interpolateTemplate(
    template: string,
    stay: any,
    property: any
): string {
    const replacements: Record<string, string> = {
        '{{guest_name}}': stay?.guestName || 'Guest',
        '{{property_name}}': property?.name || 'the property',
        '{{property_address}}': property?.addressText || '',
        '{{checkin_time}}': '14:00', // TODO: Make configurable
        '{{checkout_time}}': '10:00',
        '{{property_code}}': '[See check-in instructions]',
        '{{wifi_name}}': '[WiFi details in property]',
        '{{wifi_password}}': '[WiFi details in property]',
    };

    let result = template;
    for (const [key, value] of Object.entries(replacements)) {
        result = result.replace(new RegExp(key, 'g'), value);
    }

    return result;
}

interface InboundEvent {
    channel: 'sms' | 'email';
    providerMessageId: string;
    from: string;
    to: string;
    subject?: string;
    body: string;
    threadId: string;
    stayId?: string;
    propertyId?: string;
}

interface CachedConfig {
    prompt: string;
    settings: GlobalSettings;
    lastFetched: number;
}

// Builds quoted email history for replies (like standard email clients)
function buildEmailQuote(lastMessage: { from: string; date?: Date; body: string }): {
    textQuote: string;
    htmlQuote: string;
} {
    const dateStr = lastMessage.date
        ? lastMessage.date.toLocaleString('en-AU', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
        : 'earlier';

    // Format as standard email quote
    const textQuote = `\n\nOn ${dateStr}, ${lastMessage.from} wrote:\n> ${lastMessage.body.replace(/\n/g, '\n> ')}`;

    const htmlQuote = `
<br><br>
<div style="border-left: 2px solid #ccc; padding-left: 12px; margin-left: 8px; color: #555;">
    <p style="margin: 0; font-size: 12px; color: #888;">On ${dateStr}, ${lastMessage.from} wrote:</p>
    <blockquote style="margin: 8px 0; padding: 0;">${lastMessage.body.replace(/\n/g, '<br>')}</blockquote>
</div>`;

    return { textQuote, htmlQuote };
}

const CONFIG_TTL_MS = 10 * 60 * 1000; // 10 minutes

export class ThreadDO extends DurableObject<Env> {
    private cachedConfig: CachedConfig | null = null;

    constructor(state: DurableObjectState, env: Env) {
        super(state, env);
        this.initializeStorage();
    }

    private async initializeStorage() {
        // Initialize SQLite tables if not exists
        await this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        channel TEXT NOT NULL,
        provider_message_id TEXT UNIQUE,
        from_addr TEXT,
        to_addr TEXT,
        subject TEXT,
        body TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS state (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS drafts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        llm_response TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS pending_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_json TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        if (url.pathname === '/inbound' && request.method === 'POST') {
            return this.handleInbound(request);
        }

        if (url.pathname === '/suggest' && request.method === 'GET') {
            return this.handleSuggest();
        }

        if (url.pathname === '/telegram-action' && request.method === 'POST') {
            return this.handleTelegramAction(request);
        }

        return new Response('Not found', { status: 404 });
    }

    private async handleInbound(request: Request): Promise<Response> {
        const event: InboundEvent = await request.json();

        // Dedupe check
        const existing = await this.ctx.storage.sql.exec(
            `SELECT id FROM events WHERE provider_message_id = ?`,
            event.providerMessageId
        );

        if (existing.toArray().length > 0) {
            return new Response('Duplicate', { status: 200 });
        }

        // Store event in events table (for history/deduplication)
        await this.ctx.storage.sql.exec(
            `INSERT INTO events (type, channel, provider_message_id, from_addr, to_addr, subject, body)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
            'inbound',
            event.channel,
            event.providerMessageId,
            event.from,
            event.to,
            event.subject || null,
            event.body
        );

        // Log to Neon
        const db = createDb(this.env.DATABASE_URL);

        await db.insert(messages).values({
            threadId: event.threadId,
            direction: 'inbound',
            channel: event.channel,
            fromAddr: event.from,
            toAddr: event.to,
            subject: event.subject || null,
            bodyText: event.body,
            provider: event.channel === 'sms' ? 'twilio' : 'mailchannels',
            providerMessageId: event.providerMessageId,
            status: 'received',
        });

        // Store threadId in DO state for later actions
        await this.ctx.storage.sql.exec(
            `INSERT OR REPLACE INTO state (key, value) VALUES (?, ?)`,
            'threadId',
            event.threadId
        );

        // Update thread last message
        await db
            .update(threads)
            .set({
                lastMessageAt: new Date(),
                lastChannel: event.channel,
                updatedAt: new Date(),
            })
            .where(eq(threads.id, event.threadId));

        // Get config
        const config = await this.getConfig();
        const delayMinutes = config.settings.responseDelayMinutes ?? 0;

        if (delayMinutes > 0) {
            // Delayed response mode: store pending event and set/reset alarm
            await this.ctx.storage.sql.exec(
                `INSERT INTO pending_events (event_json) VALUES (?)`,
                JSON.stringify(event)
            );

            // Set/reset alarm - each new message resets the timer
            const alarmTime = Date.now() + delayMinutes * 60 * 1000;
            await this.ctx.storage.setAlarm(alarmTime);
            console.log(`[DELAY] Alarm set for ${delayMinutes} minutes from now (thread: ${event.threadId})`);

            return new Response('OK', { status: 200 });
        }

        // Instant response mode (delay = 0): process immediately
        await this.processMessagesAndRespond(event, db);
        return new Response('OK', { status: 200 });
    }

    // Alarm handler - called when response delay expires
    async alarm(): Promise<void> {
        console.log('[ALARM] Alarm fired, processing pending messages');

        // Get all pending events
        const pendingRows = await this.ctx.storage.sql.exec(
            `SELECT id, event_json FROM pending_events ORDER BY id ASC`
        );
        const pending = pendingRows.toArray();

        if (pending.length === 0) {
            console.log('[ALARM] No pending events to process');
            return;
        }

        // Use the most recent event as the "primary" event for response
        // All messages are already in the database, so we just need the context
        const latestEvent: InboundEvent = JSON.parse(pending[pending.length - 1].event_json as string);

        const db = createDb(this.env.DATABASE_URL);

        // Process and respond
        await this.processMessagesAndRespond(latestEvent, db);

        // Clear all pending events
        await this.ctx.storage.sql.exec(`DELETE FROM pending_events`);
        console.log(`[ALARM] Processed ${pending.length} pending message(s), cleared queue`);
    }

    private async processMessagesAndRespond(
        event: InboundEvent,
        db: ReturnType<typeof createDb>
    ): Promise<void> {
        const config = await this.getConfig();

        // Get conversation history (includes all messages, even recent ones)
        const history = await db
            .select()
            .from(messages)
            .where(eq(messages.threadId, event.threadId))
            .orderBy(messages.createdAt);

        // Get stay and property info
        let stay: any = null;
        let property: any = null;

        if (event.stayId) {
            const [stayData] = await db
                .select({ stay: stays, property: properties })
                .from(stays)
                .leftJoin(properties, eq(stays.propertyId, properties.id))
                .where(eq(stays.id, event.stayId))
                .limit(1);

            stay = stayData?.stay;
            property = stayData?.property;
        }

        // Build context for LLM - includes ALL messages in the conversation
        const contextMessages = buildConversationContext(history);

        // Add current message context
        const systemPromptWithContext = `${config.prompt}

## Current Context
- Guest: ${stay?.guestName || 'Unknown'}
- Property: ${property?.name || 'Unknown'}
- Channel: ${event.channel}
- Check-in: ${stay?.checkinAt ? new Date(stay.checkinAt).toLocaleDateString() : 'Unknown'}
- Check-out: ${stay?.checkoutAt ? new Date(stay.checkoutAt).toLocaleDateString() : 'Unknown'}

Respond to the guest's message(s).`;

        // Generate reply (runs synchronously in alarm context)
        await this.generateReply(
            event,
            stay,
            property,
            config,
            systemPromptWithContext,
            contextMessages,
            db
        );
    }

    private async generateReply(
        event: InboundEvent,
        stay: any,
        property: any,
        config: CachedConfig,
        systemPromptWithContext: string,
        contextMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
        db: ReturnType<typeof createDb>
    ) {
        // Call LLM
        let llmResponse: LLMResponse;
        try {
            llmResponse = await callLLM(this.env, systemPromptWithContext, contextMessages);
        } catch (err) {
            console.error('LLM error:', err);
            // Escalate on LLM failure
            llmResponse = {
                category: 'other',
                intent_detail: 'llm_error',
                confidence: 0,
                needs_human: true,
                auto_reply_ok: false,
                reply_channel: event.channel,
                reply_subject: null,
                reply_text: '',
                internal_note: `LLM call failed: ${err}`,
            };
        }

        // Interpolate LLM response
        if (llmResponse.reply_text) {
            llmResponse.reply_text = interpolateTemplate(llmResponse.reply_text, stay, property);
        }
        if (llmResponse.reply_subject) {
            llmResponse.reply_subject = interpolateTemplate(llmResponse.reply_subject, stay, property);
        }

        // Store draft
        await this.ctx.storage.sql.exec(
            `INSERT INTO drafts (llm_response) VALUES (?)`,
            JSON.stringify(llmResponse)
        );

        // Check escalation conditions
        const shouldEscalate =
            llmResponse.needs_human ||
            llmResponse.confidence < config.settings.confidenceThreshold ||
            config.settings.escalationCategories.includes(llmResponse.category);

        if (shouldEscalate) {
            // Mark thread as needs_human
            await db
                .update(threads)
                .set({ status: 'needs_human', updatedAt: new Date() })
                .where(eq(threads.id, event.threadId));

            // Send Telegram escalation
            console.log('[ESCALATION] Attempting Telegram escalation (background) for thread:', event.threadId);
            try {
                await sendTelegramEscalation(this.env, {
                    guestName: stay?.guestName || 'Unknown',
                    guestContact: event.from,
                    propertyName: property?.name || 'Unknown',
                    dates: stay
                        ? `${new Date(stay.checkinAt).toLocaleDateString()} - ${new Date(stay.checkoutAt).toLocaleDateString()}`
                        : 'Unknown',
                    lastMessage: event.body,
                    category: llmResponse.category,
                    intentDetail: llmResponse.intent_detail,
                    confidence: llmResponse.confidence,
                    suggestedReply: llmResponse.reply_text,
                    threadId: event.threadId,
                    adminUrl: 'https://comms.paradisestayz.com.au',
                    errorDetails: llmResponse.internal_note,
                });
            } catch (err: any) {
                console.error('[ESCALATION] Telegram escalation failed:', err.message);
                await db.insert(messages).values({
                    threadId: event.threadId,
                    direction: 'outbound',
                    channel: 'telegram' as any,
                    fromAddr: 'system',
                    toAddr: 'admin',
                    bodyText: `Telegram escalation failed: ${err.message}`,
                    provider: 'telegram' as any,
                    status: 'failed',
                });
            }
        } else if (llmResponse.auto_reply_ok && config.settings.autoReplyEnabled) {
            // Auto-reply
            try {
                if (!llmResponse.reply_text) {
                    throw new Error('No reply text generated');
                }

                if (llmResponse.reply_channel === 'sms') {
                    if (!stay?.guestPhoneE164) {
                        throw new Error('No guest phone number');
                    }
                    await sendSms(this.env, stay.guestPhoneE164, llmResponse.reply_text, property?.supportPhoneE164 || undefined);
                } else if (llmResponse.reply_channel === 'email') {
                    if (!stay?.guestEmail) {
                        throw new Error('No guest email');
                    }

                    // CRITICAL: Use original subject with Re: prefix for email threading
                    // LLM-generated subjects break threading and trigger spam filters
                    const originalSubject = event.subject || `${stay.guestName} - ${property?.name || 'Your Stay'}`;
                    const replySubject = originalSubject.startsWith('Re:')
                        ? originalSubject
                        : `Re: ${originalSubject}`;

                    // Build quoted email history (like standard email clients)
                    const { textQuote, htmlQuote } = buildEmailQuote({
                        from: event.from,
                        date: new Date(),
                        body: event.body,
                    });

                    await sendEmail(this.env, {
                        to: stay.guestEmail,
                        subject: replySubject,
                        html: llmResponse.reply_text.replace(/\n/g, '<br>') + htmlQuote,
                        text: llmResponse.reply_text + textQuote,
                        from: property?.supportEmail || undefined,
                        // Threading headers to keep reply in same email thread
                        inReplyTo: event.providerMessageId,
                        references: event.providerMessageId,
                    });
                } else {
                    throw new Error('No contact method available');
                }

                // Log outbound message
                await db.insert(messages).values({
                    threadId: event.threadId,
                    direction: 'outbound',
                    channel: llmResponse.reply_channel,
                    fromAddr: 'mark',
                    toAddr: llmResponse.reply_channel === 'sms' ? stay.guestPhoneE164 : stay.guestEmail,
                    subject: llmResponse.reply_subject || null,
                    bodyText: llmResponse.reply_text,
                    provider: llmResponse.reply_channel === 'sms' ? 'twilio' : 'mailchannels',
                    status: 'sent',
                });

                // Update thread status to open after successful auto-reply
                await db
                    .update(threads)
                    .set({ status: 'open', updatedAt: new Date() })
                    .where(eq(threads.id, event.threadId));

                // Send Telegram notification for autoreply
                try {
                    await sendTelegramAutoReplyNotification(this.env, {
                        guestName: stay?.guestName || 'Unknown',
                        guestContact: event.from,
                        propertyName: property?.name || 'Unknown',
                        guestMessage: event.body,
                        replySent: llmResponse.reply_text,
                        replyChannel: llmResponse.reply_channel,
                        threadId: event.threadId,
                        adminUrl: 'https://comms.paradisestayz.com.au',
                    });
                } catch (err: any) {
                    console.error('[AUTOREPLY] Telegram notification failed:', err.message);
                }
            } catch (err) {
                console.error('Auto-reply failed:', err);
                // Escalate on send failure
                await db
                    .update(threads)
                    .set({ status: 'needs_human', updatedAt: new Date() })
                    .where(eq(threads.id, event.threadId));
            }
        }
    }

    private async handleSuggest(): Promise<Response> {
        // Get latest draft
        const drafts = await this.ctx.storage.sql.exec(
            `SELECT llm_response FROM drafts ORDER BY id DESC LIMIT 1`
        );

        const rows = drafts.toArray();
        if (rows.length === 0) {
            return Response.json({ suggestion: null });
        }

        const llmResponse = JSON.parse(rows[0].llm_response as string);
        return Response.json({ suggestion: llmResponse });
    }

    private async handleTelegramAction(request: Request): Promise<Response> {
        const { action, text } = await request.json() as { action: string; text?: string };
        const db = createDb(this.env.DATABASE_URL);

        // Get thread ID from the state (it's the name we used to create the DO)
        // Actually, we can just get the stayId from the events/state table in the DO
        // But let's first get the threadId by checking the database for this DO's identity
        // or just pass it in? No, the DO identity is enough.

        // Let's assume we can find the threadId by looking up which thread points to this DO.
        // Wait, the DO ID is deterministic based on threadId.
        // We can't easily go back from DO ID to name unless we stored it.
        // Let's store threadId in the DO state during initialization or inbound.

        // For now, let's just get the latest draft since that's what we need.
        const drafts = await this.ctx.storage.sql.exec(
            `SELECT llm_response FROM drafts ORDER BY id DESC LIMIT 1`
        );
        const rows = drafts.toArray();
        if (rows.length === 0 && action !== 'ignore') {
            console.error('[TELEGRAM ACTION] No draft found for send/edit action');
            return new Response('No draft found - the AI response may have expired. Please ask the guest to resend their message.', { status: 404 });
        }

        const llmResponse = rows.length > 0 ? JSON.parse(rows[0].llm_response as string) : null;

        // Find the thread and stay info
        const [threadData] = await db
            .select({
                thread: threads,
                stay: stays,
                property: properties,
            })
            .from(threads)
            .leftJoin(stays, eq(threads.stayId, stays.id))
            .leftJoin(properties, eq(stays.propertyId, properties.id))
            .where(eq(threads.id, this.ctx.id.toString())) // Wait, this.ctx.id is the internal ID
            // We need the threadId string. We should have stored it.
            // Let's find it by looking at the events table.
            .limit(1);

        // Hmm, I need the threadId. Let's get it from the events table in the DO.
        const eventRows = await this.ctx.storage.sql.exec(`SELECT body FROM events LIMIT 1`);
        // This is getting messy. Let's just pass threadId in the request if needed, 
        // OR better: the ThreadDO ID *is* the threadId if we used idFromName.
        // In index.ts: c.env.THREAD_DO.idFromName(threadId)
        // So this.ctx.id.toString() is NOT the threadId.
        // But we can get the threadId from the database where thread.id is ... something.

        // Actually, in Cloudflare, if you use idFromName(threadId), then the DO doesn't 
        // easily know 'threadId' unless you pass it or store it.

        // Let's just use the database and query by... wait, how do I find the thread?
        // I'll update handleInbound to store the threadId in the DO's state table.

        const threadIdState = await this.ctx.storage.sql.exec(`SELECT value FROM state WHERE key = 'threadId'`);
        const threadId = threadIdState.toArray()[0]?.value as string;

        if (!threadId) {
            console.error('[TELEGRAM ACTION] Thread ID not found in DO state');
            return new Response('Thread ID not found - this is a system error. Try using the Admin UI instead.', { status: 500 });
        }

        if (action === 'send') {
            console.log('[TELEGRAM ACTION] Processing send for thread:', threadId);
            console.log('[TELEGRAM ACTION] Draft reply_channel:', llmResponse?.reply_channel);
            const [data] = await db
                .select({
                    stay: stays,
                    property: properties,
                })
                .from(threads)
                .leftJoin(stays, eq(threads.stayId, stays.id))
                .leftJoin(properties, eq(stays.propertyId, properties.id))
                .where(eq(threads.id, threadId))
                .limit(1);

            const { stay, property } = data;

            try {
                let providerMessageId: string;
                if (llmResponse.reply_channel === 'sms' && stay?.guestPhoneE164) {
                    providerMessageId = await sendSms(this.env, stay.guestPhoneE164, llmResponse.reply_text, property?.supportPhoneE164 || undefined);
                } else if (llmResponse.reply_channel === 'email' && stay?.guestEmail) {
                    providerMessageId = await sendEmail(this.env, {
                        to: stay.guestEmail,
                        from: property?.supportEmail || '', // gmail.ts uses GMAIL_FROM_ADDRESS as default
                        subject: llmResponse.reply_subject || 'Re: Your inquiry',
                        text: llmResponse.reply_text,
                    });
                } else {
                    const reason = !llmResponse.reply_channel
                        ? 'No reply channel specified in AI response'
                        : llmResponse.reply_channel === 'sms' && !stay?.guestPhoneE164
                            ? 'Guest has no phone number on file'
                            : llmResponse.reply_channel === 'email' && !stay?.guestEmail
                                ? 'Guest has no email on file'
                                : 'Unknown reason';
                    throw new Error(`Cannot send: ${reason}`);
                }

                await db.insert(messages).values({
                    threadId: threadId,
                    direction: 'outbound',
                    channel: llmResponse.reply_channel,
                    fromAddr: 'mark',
                    toAddr: llmResponse.reply_channel === 'sms' ? stay!.guestPhoneE164! : stay!.guestEmail!,
                    subject: llmResponse.reply_subject || undefined,
                    bodyText: llmResponse.reply_text,
                    provider: llmResponse.reply_channel === 'sms' ? 'twilio' : 'mailchannels',
                    providerMessageId,
                    status: 'sent',
                });

                await db.update(threads).set({ status: 'closed', updatedAt: new Date() }).where(eq(threads.id, threadId));
                return new Response('OK');
            } catch (err: any) {
                console.error('[TELEGRAM ACTION] Manual send failed:', err);
                return new Response(`Send failed: ${err.message || 'Unknown error'}`, { status: 500 });
            }
        } else if (action === 'ignore') {
            await db.update(threads).set({ status: 'closed', updatedAt: new Date() }).where(eq(threads.id, threadId));
            return new Response('OK');
        } else if (action === 'update_draft') {
            if (!text) return new Response('Text required', { status: 400 });
            const newResponse = { ...llmResponse, reply_text: text, auto_reply_ok: true };
            await this.ctx.storage.sql.exec(
                `INSERT INTO drafts (llm_response) VALUES (?)`,
                JSON.stringify(newResponse)
            );
            return new Response('OK');
        }

        return new Response('Unknown action', { status: 400 });
    }

    private async getConfig(): Promise<CachedConfig> {
        const now = Date.now();

        if (this.cachedConfig && now - this.cachedConfig.lastFetched < CONFIG_TTL_MS) {
            return this.cachedConfig;
        }

        // Fetch from ConfigDO
        const configDO = this.env.CONFIG_DO.get(this.env.CONFIG_DO.idFromName('global'));
        const response = await configDO.fetch('http://internal/config');
        const config = await response.json() as { prompt: string; settings: GlobalSettings };

        this.cachedConfig = {
            prompt: config.prompt,
            settings: config.settings,
            lastFetched: now,
        };

        return this.cachedConfig;
    }
}
