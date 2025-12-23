import { DurableObject } from 'cloudflare:workers';
import { Env, LLMResponse, GlobalSettings } from '../types';
import { createDb, messages, threads, stays, properties } from '../db';
import { eq } from 'drizzle-orm';
import { callLLM, buildConversationContext } from '../worker/lib/openrouter';
import { sendSms } from '../worker/lib/twilio';
import { sendEmail } from '../worker/lib/mailchannels';
import { sendTelegramEscalation } from '../worker/lib/telegram';

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

        // Store event
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

        // Get conversation history
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

        // Build context for LLM
        const contextMessages = buildConversationContext(history);

        // Add current message context
        const systemPromptWithContext = `${config.prompt}

## Current Context
- Guest: ${stay?.guestName || 'Unknown'}
- Property: ${property?.name || 'Unknown'}
- Channel: ${event.channel}
- Check-in: ${stay?.checkinAt ? new Date(stay.checkinAt).toLocaleDateString() : 'Unknown'}
- Check-out: ${stay?.checkoutAt ? new Date(stay.checkoutAt).toLocaleDateString() : 'Unknown'}

Respond to the latest guest message.`;

        // Call LLM
        let llmResponse: LLMResponse;
        try {
            llmResponse = await callLLM(this.env, systemPromptWithContext, contextMessages);
        } catch (err) {
            console.error('LLM error:', err);
            // Escalate on LLM failure
            llmResponse = {
                intent: 'unknown',
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
        llmResponse.reply_text = interpolateTemplate(llmResponse.reply_text, stay, property);
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
            config.settings.escalationIntents.includes(llmResponse.intent);

        if (shouldEscalate) {
            // Mark thread as needs_human
            await db
                .update(threads)
                .set({ status: 'needs_human', updatedAt: new Date() })
                .where(eq(threads.id, event.threadId));

            // Send Telegram escalation
            try {
                await sendTelegramEscalation(this.env, {
                    guestName: stay?.guestName || 'Unknown',
                    guestContact: event.from,
                    propertyName: property?.name || 'Unknown',
                    dates: stay
                        ? `${new Date(stay.checkinAt).toLocaleDateString()} - ${new Date(stay.checkoutAt).toLocaleDateString()}`
                        : 'Unknown',
                    lastMessage: event.body,
                    intent: llmResponse.intent,
                    confidence: llmResponse.confidence,
                    suggestedReply: llmResponse.reply_text,
                    threadId: event.threadId,
                    adminUrl: 'https://mark-admin.pages.dev',
                });
            } catch (err) {
                console.error('Telegram escalation failed:', err);
            }
        } else if (llmResponse.auto_reply_ok && config.settings.autoReplyEnabled) {
            // Auto-reply
            try {
                let providerMessageId: string;

                if (llmResponse.reply_channel === 'sms' && stay?.guestPhoneE164) {
                    providerMessageId = await sendSms(this.env, stay.guestPhoneE164, llmResponse.reply_text, property?.supportPhoneE164 || undefined);
                } else if (llmResponse.reply_channel === 'email' && stay?.guestEmail) {
                    providerMessageId = await sendEmail(this.env, {
                        to: stay.guestEmail,
                        from: property?.supportEmail || 'noreply@mark.local',
                        subject: llmResponse.reply_subject || 'Re: Your inquiry',
                        text: llmResponse.reply_text,
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
                    toAddr:
                        llmResponse.reply_channel === 'sms' ? stay.guestPhoneE164 : stay.guestEmail,
                    subject: llmResponse.reply_subject || null,
                    bodyText: llmResponse.reply_text,
                    provider: llmResponse.reply_channel === 'sms' ? 'twilio' : 'mailchannels',
                    providerMessageId,
                    status: 'sent',
                });
            } catch (err) {
                console.error('Auto-reply failed:', err);
                // Escalate on send failure
                await db
                    .update(threads)
                    .set({ status: 'needs_human', updatedAt: new Date() })
                    .where(eq(threads.id, event.threadId));
            }
        }

        return new Response('OK', { status: 200 });
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
