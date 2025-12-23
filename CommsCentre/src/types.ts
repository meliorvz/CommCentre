import { z } from 'zod';

// ============================================================================
// Environment Types
// ============================================================================

export interface Env {
    // Durable Objects
    THREAD_DO: DurableObjectNamespace;
    SCHEDULER_DO: DurableObjectNamespace;
    CONFIG_DO: DurableObjectNamespace;

    // KV
    KV: KVNamespace;

    // Secrets
    DATABASE_URL: string;
    TWILIO_ACCOUNT_SID: string;
    TWILIO_AUTH_TOKEN: string;
    TWILIO_FROM_NUMBER: string;
    MAILCHANNELS_API_KEY: string;
    OPENROUTER_API_KEY: string;
    TELEGRAM_BOT_TOKEN: string;
    TELEGRAM_CHAT_ID: string;
    JWT_SECRET: string;

    // Config
    ENVIRONMENT: string;
}

// ============================================================================
// LLM Response Contract
// ============================================================================

export const llmResponseSchema = z.object({
    intent: z.enum([
        'checkin_info',
        'wifi',
        'parking',
        'late_checkout',
        'complaint',
        'refund',
        'payment',
        'other',
        'unknown',
    ]),
    confidence: z.number().min(0).max(1),
    needs_human: z.boolean(),
    auto_reply_ok: z.boolean(),
    reply_channel: z.enum(['sms', 'email']),
    reply_subject: z.string().nullable(),
    reply_text: z.string(),
    internal_note: z.string(),
});

export type LLMResponse = z.infer<typeof llmResponseSchema>;

// ============================================================================
// API Request/Response Types
// ============================================================================

export const loginRequestSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

export const createPropertySchema = z.object({
    name: z.string().min(1),
    timezone: z.string().default('Australia/Sydney'),
    addressText: z.string().optional(),
    supportPhoneE164: z.string().optional(),
    supportEmail: z.string().email().optional(),
});

export const updatePropertySchema = createPropertySchema.partial();

export const createStaySchema = z.object({
    propertyId: z.string().uuid(),
    guestName: z.string().min(1),
    guestPhoneE164: z.string().optional(),
    guestEmail: z.string().email().optional(),
    checkinAt: z.string().datetime(),
    checkoutAt: z.string().datetime(),
    preferredChannel: z.enum(['sms', 'email', 'both']).default('sms'),
    notesInternal: z.string().optional(),
});

export const updateStaySchema = createStaySchema.partial();

export const manualReplySchema = z.object({
    channel: z.enum(['sms', 'email']),
    body: z.string().min(1),
    subject: z.string().optional(),
});

// ============================================================================
// Config Types (stored in KV)
// ============================================================================

export interface GlobalSettings {
    autoReplyEnabled: boolean;
    confidenceThreshold: number;
    quietHoursStart: string; // HH:mm
    quietHoursEnd: string;
    escalationIntents: string[];
}

export interface PropertySettings {
    autoReplyEnabled: boolean;
    smsEnabled: boolean;
    emailEnabled: boolean;
    scheduleT3Time: string; // HH:mm
    scheduleT1Time: string;
    scheduleDayOfTime: string;
}

export interface ConfigVersions {
    prompt: number;
    templates: number;
    settings: number;
}

// ============================================================================
// Twilio Webhook Types
// ============================================================================

export interface TwilioSmsWebhook {
    MessageSid: string;
    AccountSid: string;
    From: string;
    To: string;
    Body: string;
    NumMedia?: string;
}

export interface TwilioVoiceWebhook {
    CallSid: string;
    AccountSid: string;
    From: string;
    To: string;
    CallStatus: string;
}

// ============================================================================
// MailChannels Types
// ============================================================================

export interface MailChannelsInboundEmail {
    from: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
    messageId: string;
}

// ============================================================================
// JWT Payload
// ============================================================================

export interface JWTPayload {
    sub: string; // user ID
    email: string;
    role: 'admin' | 'staff';
    exp: number;
    iat: number;
}
