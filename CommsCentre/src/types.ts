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
    TWILIO_FROM_NUMBER?: string; // Optional - can be configured in Admin UI
    OPENROUTER_API_KEY: string;
    TELEGRAM_BOT_TOKEN: string;
    TELEGRAM_CHAT_ID: string;
    JWT_SECRET: string;

    // Gmail OAuth (optional - for email integration)
    GMAIL_CLIENT_ID?: string;
    GMAIL_CLIENT_SECRET?: string;
    GMAIL_REFRESH_TOKEN?: string;
    GMAIL_FROM_ADDRESS?: string; // e.g., mark@paradisestayz.com.au
    GMAIL_CC_ADDRESS?: string;   // e.g., service@paradisestayz.com.au

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
    callForwardingNumber?: string; // E.164 format - where to forward voice calls
}

// ============================================================================
// Setup Profile Types (stored in KV)
// ============================================================================

export interface SetupProfile {
    companyName: string;
    assistantName: string;
    businessType: 'holiday_rentals' | 'hotel' | 'serviced_apartments' | 'other';
    escalationPhone?: string;
    escalationEmail?: string;
    timezone: string;
}

export interface PropertyDefaults {
    checkinTime: string; // HH:mm
    checkoutTime: string;
    earlyCheckinPolicy?: string;
    lateCheckoutPolicy?: string;
    parkingInfo?: string;
    petPolicy?: string;
    smokingPolicy?: string;
    partyPolicy?: string;
    quietHours?: string;
}

export interface KnowledgeCategory {
    id: string;
    name: string;
    order: number;
    exampleQuestions?: string; // Shown as hints in UI
}

export interface KnowledgeItem {
    id: string;
    categoryId: string;
    question: string;
    answer: string;
    updatedAt: string;
}

export interface PropertySettings {
    timezone?: string;
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

export interface TwilioSettings {
    phoneNumber: string;
}

export interface GmailSettings {
    // Gmail is configured via OAuth env vars, not KV settings
    // This interface is kept for potential future configurable options
}

export interface OpenRouterSettings {
    apiKey: string;
}

export interface TelegramSettings {
    botToken: string;
    chatId: string;
}

export interface IntegrationSettings {
    twilio?: TwilioSettings;
    gmail?: GmailSettings;
    openrouter?: OpenRouterSettings;
    telegram?: TelegramSettings;
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
// JWT Payload
// ============================================================================

export interface JWTPayload {
    sub: string; // user ID
    email: string;
    role: 'admin' | 'staff';
    exp: number;
    iat: number;
}
