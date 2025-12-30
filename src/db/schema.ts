import {
    pgTable,
    uuid,
    text,
    timestamp,
    pgEnum,
    integer,
    jsonb,
    uniqueIndex,
    boolean,
    numeric,
} from 'drizzle-orm/pg-core';

// ============================================================================
// ENUMS
// ============================================================================

// Updated user role enum with super_admin for platform-level access
export const userRoleEnum = pgEnum('user_role', ['super_admin', 'company_admin', 'property_manager', 'staff']);

export const propertyStatusEnum = pgEnum('property_status', ['active', 'inactive']);

export const stayStatusEnum = pgEnum('stay_status', [
    'booked',
    'checked_in',
    'checked_out',
    'cancelled',
]);

export const preferredChannelEnum = pgEnum('preferred_channel', ['sms', 'email', 'both']);

export const threadStatusEnum = pgEnum('thread_status', ['open', 'needs_human', 'closed']);

export const channelEnum = pgEnum('channel', ['sms', 'email']);

export const messageDirectionEnum = pgEnum('message_direction', ['inbound', 'outbound']);

export const providerEnum = pgEnum('provider', ['twilio', 'mailchannels']);

export const messageStatusEnum = pgEnum('message_status', [
    'received',
    'queued',
    'sent',
    'delivered',
    'failed',
]);

export const jobStatusEnum = pgEnum('job_status', ['queued', 'sent', 'cancelled', 'failed']);

export const ruleKeyEnum = pgEnum('rule_key', ['T_MINUS_3', 'T_MINUS_1', 'DAY_OF']);

// Integration enums
export const integrationLogStatusEnum = pgEnum('integration_log_status', ['success', 'partial', 'failed']);

// New enums for multi-tenancy
export const companyStatusEnum = pgEnum('company_status', ['active', 'suspended', 'trial']);

export const creditTransactionTypeEnum = pgEnum('credit_transaction_type', [
    'purchase',           // Admin adds credits
    'sms_usage',          // Deducted for SMS AI reply
    'sms_manual_usage',   // Deducted for manual SMS reply
    'email_usage',        // Deducted for email AI reply
    'email_manual_usage', // Deducted for manual email reply
    'phone_rental',       // Monthly phone number fee
    'email_rental',       // Monthly email address fee
    'trial_grant',        // Initial trial credits
    'adjustment',         // Manual adjustment
    'refund',             // Refund credits
]);

// ============================================================================
// NEW TABLES - Multi-Tenant Support
// ============================================================================

// Companies table - top-level tenant entity
export const companies = pgTable('companies', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(), // For URLs/subdomains
    status: companyStatusEnum('status').notNull().default('trial'),
    creditBalance: integer('credit_balance').notNull().default(0),
    allowNegativeBalance: boolean('allow_negative_balance').notNull().default(false),
    trialCreditsGranted: integer('trial_credits_granted').notNull().default(0),
    // Escalation contacts for credit exhaustion warnings
    escalationPhone: text('escalation_phone'),
    escalationEmail: text('escalation_email'),
    // Stripe integration (hidden for now)
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    // Feature flags
    featuresEnabled: jsonb('features_enabled').$type<{ integrations?: boolean }>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Credit transactions - audit log for all credit movements
export const creditTransactions = pgTable('credit_transactions', {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
        .notNull()
        .references(() => companies.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(), // Positive = add, negative = usage
    type: creditTransactionTypeEnum('type').notNull(),
    referenceId: uuid('reference_id'), // Link to message, phone number, etc.
    referenceType: text('reference_type'), // 'message', 'phone_number', 'email_address'
    description: text('description'),
    balanceAfter: integer('balance_after').notNull(), // Running balance
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Phone numbers allocated to companies
export const companyPhoneNumbers = pgTable('company_phone_numbers', {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
        .notNull()
        .references(() => companies.id, { onDelete: 'cascade' }),
    phoneE164: text('phone_e164').notNull().unique(),
    twilioSid: text('twilio_sid'),
    monthlyCredits: integer('monthly_credits').notNull().default(50),
    isActive: boolean('is_active').notNull().default(true),
    allocatedAt: timestamp('allocated_at', { withTimezone: true }).notNull().defaultNow(),
    lastBilledAt: timestamp('last_billed_at', { withTimezone: true }),
});

// Email addresses allocated to companies
export const companyEmailAddresses = pgTable('company_email_addresses', {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
        .notNull()
        .references(() => companies.id, { onDelete: 'cascade' }),
    email: text('email').notNull().unique(),
    monthlyCredits: integer('monthly_credits').notNull().default(20),
    isActive: boolean('is_active').notNull().default(true),
    allocatedAt: timestamp('allocated_at', { withTimezone: true }).notNull().defaultNow(),
    lastBilledAt: timestamp('last_billed_at', { withTimezone: true }),
});

// Platform-wide credit configuration (super admin configurable)
export const creditConfig = pgTable('credit_config', {
    id: uuid('id').primaryKey().defaultRandom(),
    key: text('key').notNull().unique(), // e.g., 'sms_ai_cost', 'email_ai_cost'
    value: integer('value').notNull(),   // Credit amount
    estimatedCostCents: integer('estimated_cost_cents'), // Your actual cost in cents
    description: text('description'),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Platform settings (super admin only)
export const platformSettings = pgTable('platform_settings', {
    id: uuid('id').primaryKey().defaultRandom(),
    key: text('key').notNull().unique(),
    value: text('value').notNull(),
    description: text('description'),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// INTEGRATIONS - External automation API
// ============================================================================

// Integration configurations (per-company)
export const integrationConfigs = pgTable('integration_configs', {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
        .notNull()
        .references(() => companies.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    apiKeyHash: text('api_key_hash').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    // Channel configuration
    channelsAllowed: text('channels_allowed').array().notNull().default(['email']),
    allowedSenders: text('allowed_senders').array().notNull().default([]),
    defaultRecipients: text('default_recipients').array().notNull().default([]),
    // Rate limiting
    rateLimitPerMin: integer('rate_limit_per_min').notNull().default(60),
    // Notification settings
    notifyOnSuccess: boolean('notify_on_success').notNull().default(false),
    notifyOnFailure: boolean('notify_on_failure').notNull().default(true),
    notifyTelegramId: text('notify_telegram_id'),
    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
    companySlugIdx: uniqueIndex('integration_company_slug_idx').on(table.companyId, table.slug),
}));

// Integration audit logs
export const integrationLogs = pgTable('integration_logs', {
    id: uuid('id').primaryKey().defaultRandom(),
    configId: uuid('config_id')
        .notNull()
        .references(() => integrationConfigs.id, { onDelete: 'cascade' }),
    channels: text('channels').array().notNull(),
    recipients: text('recipients').array().notNull(),
    status: integrationLogStatusEnum('status').notNull(),
    results: jsonb('results').$type<Array<{
        channel: string;
        status: string;
        messageId?: string;
        error?: string;
    }>>().notNull(),
    errorMessage: text('error_message'),
    metadata: jsonb('metadata').$type<{
        subject?: string;
        hasAttachments?: boolean;
        attachmentCount?: number;
        from?: string;
    }>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// MODIFIED TABLES - Multi-Tenant Support
// ============================================================================

export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    role: userRoleEnum('role').notNull().default('staff'),
    // NULL for super_admin (platform-level), set for all other roles
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const properties = pgTable('properties', {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
        .notNull()
        .references(() => companies.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    timezone: text('timezone').notNull().default('Australia/Sydney'),
    addressText: text('address_text'),
    supportPhoneE164: text('support_phone_e164'),
    supportEmail: text('support_email'),
    status: propertyStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const stays = pgTable('stays', {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id')
        .notNull()
        .references(() => properties.id, { onDelete: 'cascade' }),
    guestName: text('guest_name').notNull(),
    guestPhoneE164: text('guest_phone_e164'),
    guestEmail: text('guest_email'),
    checkinAt: timestamp('checkin_at', { withTimezone: true }).notNull(),
    checkoutAt: timestamp('checkout_at', { withTimezone: true }).notNull(),
    status: stayStatusEnum('status').notNull().default('booked'),
    preferredChannel: preferredChannelEnum('preferred_channel').notNull().default('sms'),
    notesInternal: text('notes_internal'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const threads = pgTable('threads', {
    id: uuid('id').primaryKey().defaultRandom(),
    stayId: uuid('stay_id')
        .notNull()
        .unique()
        .references(() => stays.id, { onDelete: 'cascade' }),
    status: threadStatusEnum('status').notNull().default('open'),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    lastChannel: channelEnum('last_channel'),
    assignedUserId: uuid('assigned_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable(
    'messages',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        threadId: uuid('thread_id')
            .notNull()
            .references(() => threads.id, { onDelete: 'cascade' }),
        direction: messageDirectionEnum('direction').notNull(),
        channel: channelEnum('channel').notNull(),
        fromAddr: text('from_addr').notNull(),
        toAddr: text('to_addr').notNull(),
        subject: text('subject'),
        bodyText: text('body_text').notNull(),
        provider: providerEnum('provider').notNull(),
        providerMessageId: text('provider_message_id'),
        status: messageStatusEnum('status').notNull().default('received'),
        // Track credits deducted for this message (for refunds/auditing)
        creditsDeducted: integer('credits_deducted'),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => ({
        providerMessageIdIdx: uniqueIndex('provider_message_id_idx').on(table.providerMessageId),
    })
);

export const messageJobs = pgTable(
    'message_jobs',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        stayId: uuid('stay_id')
            .notNull()
            .references(() => stays.id, { onDelete: 'cascade' }),
        threadId: uuid('thread_id').references(() => threads.id, { onDelete: 'set null' }),
        channel: channelEnum('channel').notNull(),
        ruleKey: ruleKeyEnum('rule_key').notNull(),
        templateVersionId: text('template_version_id'),
        sendAt: timestamp('send_at', { withTimezone: true }).notNull(),
        status: jobStatusEnum('status').notNull().default('queued'),
        attempts: integer('attempts').notNull().default(0),
        lastError: text('last_error'),
        idempotencyKey: text('idempotency_key').notNull().unique(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => ({
        idempotencyIdx: uniqueIndex('idempotency_key_idx').on(table.idempotencyKey),
    })
);

export const auditLog = pgTable('audit_log', {
    id: uuid('id').primaryKey().defaultRandom(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    payloadJson: jsonb('payload_json'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// New types
export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type NewCreditTransaction = typeof creditTransactions.$inferInsert;
export type CompanyPhoneNumber = typeof companyPhoneNumbers.$inferSelect;
export type NewCompanyPhoneNumber = typeof companyPhoneNumbers.$inferInsert;
export type CompanyEmailAddress = typeof companyEmailAddresses.$inferSelect;
export type NewCompanyEmailAddress = typeof companyEmailAddresses.$inferInsert;
export type CreditConfig = typeof creditConfig.$inferSelect;
export type NewCreditConfig = typeof creditConfig.$inferInsert;
export type PlatformSetting = typeof platformSettings.$inferSelect;
export type NewPlatformSetting = typeof platformSettings.$inferInsert;

// Existing types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Property = typeof properties.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;
export type Stay = typeof stays.$inferSelect;
export type NewStay = typeof stays.$inferInsert;
export type Thread = typeof threads.$inferSelect;
export type NewThread = typeof threads.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type MessageJob = typeof messageJobs.$inferSelect;
export type NewMessageJob = typeof messageJobs.$inferInsert;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;
