import {
    pgTable,
    uuid,
    text,
    timestamp,
    time,
    pgEnum,
    integer,
    jsonb,
    uniqueIndex,
    index,
    boolean,
    numeric,
    customType,
    check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

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
export const integrationTypeEnum = pgEnum('integration_type', ['gmail', 'twilio', 'telegram']);
export const tokenAccessActionEnum = pgEnum('token_access_action', ['read', 'write', 'delete']);

// Comms events channel (includes telegram)
export const commsChannelEnum = pgEnum('comms_channel', ['sms', 'email', 'telegram']);

// New enums for multi-tenancy
export const companyStatusEnum = pgEnum('company_status', ['active', 'suspended', 'trial']);

export const subscriptionStatusEnum = pgEnum('subscription_status', [
    'none',           // No subscription
    'trialing',       // Trial period
    'active',         // Paid and active
    'past_due',       // Payment failed, grace period
    'canceled',       // Canceled but access until period end
    'unpaid',         // Payment failed, access revoked
]);

export const creditTransactionTypeEnum = pgEnum('credit_transaction_type', [
    'purchase',           // Admin adds credits
    'sms_usage',          // All SMS = 2 credits
    'email_usage',        // All Email = 1 credit
    'integration_sms_usage',   // SMS via integrations API
    'integration_email_usage', // Email via integrations API
    'call_forward_usage', // Per forwarded call
    'phone_rental',       // Monthly phone number fee
    'email_rental',       // Monthly email address fee
    'trial_grant',        // Initial trial credits
    'subscription_grant', // Monthly credits from subscription
    'overage_charge',     // Period-end overage billing
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
    // Stripe integration
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    stripePriceId: text('stripe_price_id'),
    subscriptionStatus: subscriptionStatusEnum('subscription_status').default('none'),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    monthlyCreditsAllocation: integer('monthly_credits_allocation').default(0),
    periodCreditsUsed: integer('period_credits_used').default(0),
    isAnnual: boolean('is_annual').default(false),
    // Feature flags
    featuresEnabled: jsonb('features_enabled').$type<{ integrations?: boolean }>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Subscription plans - configurable tiers (SuperAdmin managed)
export const subscriptionPlans = pgTable('subscription_plans', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),                              // "Starter", "Growth", "Pro"
    stripeMonthlyPriceId: text('stripe_monthly_price_id'),     // Stripe Price ID for monthly
    stripeAnnualPriceId: text('stripe_annual_price_id'),       // Stripe Price ID for annual
    monthlyPriceCents: integer('monthly_price_cents').notNull(),
    annualPriceCents: integer('annual_price_cents').notNull(), // 20% off monthly * 12
    creditsIncluded: integer('credits_included').notNull(),
    overagePriceCents: integer('overage_price_cents').notNull(), // Per credit overage cost
    allowsIntegrations: boolean('allows_integrations').default(false),
    isActive: boolean('is_active').default(true),
    displayOrder: integer('display_order').default(0),
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
// INTEGRATION TOKEN STORAGE - Per-Tenant Encrypted Credentials
// ============================================================================

// Custom bytea type for encrypted binary data
const bytea = customType<{ data: Buffer; notNull: true; default: false }>({
    dataType() {
        return 'bytea';
    },
    toDriver(value: Buffer): Buffer {
        return value;
    },
    fromDriver(value: unknown): Buffer {
        if (Buffer.isBuffer(value)) {
            return value;
        }
        if (value instanceof Uint8Array) {
            return Buffer.from(value);
        }
        // Handle hex string format from PostgreSQL
        if (typeof value === 'string' && value.startsWith('\\x')) {
            return Buffer.from(value.slice(2), 'hex');
        }
        throw new Error(`Unexpected bytea value type: ${typeof value}`);
    },
});

// Per-company integration credentials (envelope encrypted)
export const companyIntegrations = pgTable('company_integrations', {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
        .notNull()
        .references(() => companies.id, { onDelete: 'cascade' }),
    integrationType: integrationTypeEnum('integration_type').notNull(),

    // Encrypted credentials (envelope encryption)
    encryptedCredentials: bytea('encrypted_credentials').notNull(),
    dataKeyEncrypted: bytea('data_key_encrypted').notNull(),

    // Account identifier (not sensitive - for display purposes)
    accountIdentifier: text('account_identifier'),

    // Status
    isActive: boolean('is_active').notNull().default(true),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    lastError: text('last_error'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
    companyTypeIdx: uniqueIndex('company_integrations_company_type_idx').on(
        table.companyId,
        table.integrationType
    ),
}));

// Audit log for token access
export const integrationTokenAccessLog = pgTable('integration_token_access_log', {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
        .notNull()
        .references(() => companies.id, { onDelete: 'cascade' }),
    integrationType: integrationTypeEnum('integration_type').notNull(),
    action: tokenAccessActionEnum('action').notNull(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    actorIp: text('actor_ip'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
    accessLogIdx: index('integration_access_log_idx').on(table.companyId, table.createdAt),
}));

// ============================================================================
// TENANT-SCOPED CONFIGURATION TABLES
// ============================================================================

// Company profile (identity, brand settings)
export const companyProfile = pgTable('company_profile', {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
        .notNull()
        .references(() => companies.id, { onDelete: 'cascade' })
        .unique(),
    assistantName: text('assistant_name').notNull().default('Mark'),
    websiteUrl: text('website_url'),
    timezone: text('timezone').notNull().default('Australia/Sydney'),
    verticalId: text('vertical_id').default('hospitality'),
    // Style guide learned from sent emails (T-039)
    styleGuide: text('style_guide'),
    styleGuideUpdatedAt: timestamp('style_guide_updated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Company AI behavior configuration
export const companyAiConfig = pgTable('company_ai_config', {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
        .notNull()
        .references(() => companies.id, { onDelete: 'cascade' })
        .unique(),
    autoReplyEnabled: boolean('auto_reply_enabled').default(true),
    confidenceThreshold: numeric('confidence_threshold', { precision: 3, scale: 2 }).default('0.70'),
    quietHoursStart: time('quiet_hours_start').default('22:00'),
    quietHoursEnd: time('quiet_hours_end').default('08:00'),
    responseDelayMinutes: integer('response_delay_minutes').default(3),
    escalationCategories: text('escalation_categories').array().default(['refund', 'complaint', 'emergency']),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
    confidenceCheck: check('confidence_threshold_range', sql`${table.confidenceThreshold} >= 0 AND ${table.confidenceThreshold} <= 1`),
    delayCheck: check('response_delay_non_negative', sql`${table.responseDelayMinutes} >= 0`),
}));

// Company system prompts with version history
export const companyPrompts = pgTable('company_prompts', {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
        .notNull()
        .references(() => companies.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    version: integer('version').notNull(),
    isPublished: boolean('is_published').default(false),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    publishedBy: uuid('published_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
    companyVersionIdx: uniqueIndex('company_prompts_company_version_idx').on(table.companyId, table.version),
    publishedIdx: index('company_prompts_published_idx').on(table.companyId).where(sql`${table.isPublished} = true`),
    versionCheck: check('version_positive', sql`${table.version} > 0`),
}));

// Knowledge base categories per company
export const knowledgeCategories = pgTable('knowledge_categories', {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
        .notNull()
        .references(() => companies.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    displayOrder: integer('display_order').default(0),
    exampleQuestions: text('example_questions'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
    companySlugIdx: uniqueIndex('knowledge_categories_company_slug_idx').on(table.companyId, table.slug),
}));

// Knowledge base items (FAQs) per company
export const knowledgeItems = pgTable('knowledge_items', {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
        .notNull()
        .references(() => companies.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
        .references(() => knowledgeCategories.id, { onDelete: 'cascade' }),
    question: text('question').notNull(),
    answer: text('answer').notNull(),
    displayOrder: integer('display_order').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
    companyIdx: index('knowledge_items_company_idx').on(table.companyId),
}));

// Message templates per company
export const companyTemplates = pgTable('company_templates', {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
        .notNull()
        .references(() => companies.id, { onDelete: 'cascade' }),
    channel: channelEnum('channel').notNull(),
    ruleKey: ruleKeyEnum('rule_key').notNull(),
    subject: text('subject'),
    body: text('body').notNull(),
    version: integer('version').default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
    companyChannelRuleIdx: uniqueIndex('company_templates_company_channel_rule_idx').on(
        table.companyId,
        table.channel,
        table.ruleKey
    ),
}));

// Property-level settings (with company_id for RLS)
export const propertySettings = pgTable('property_settings', {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id')
        .notNull()
        .references(() => properties.id, { onDelete: 'cascade' })
        .unique(),
    companyId: uuid('company_id')
        .notNull()
        .references(() => companies.id, { onDelete: 'cascade' }),
    autoReplyEnabled: boolean('auto_reply_enabled').default(true),
    smsEnabled: boolean('sms_enabled').default(true),
    emailEnabled: boolean('email_enabled').default(true),
    scheduleT3Time: time('schedule_t3_time').default('10:00'),
    scheduleT1Time: time('schedule_t1_time').default('10:00'),
    scheduleDayOfTime: time('schedule_day_of_time').default('14:00'),
    checkinTime: time('checkin_time').default('15:00'),
    checkoutTime: time('checkout_time').default('10:00'),
    earlyCheckinPolicy: text('early_checkin_policy'),
    lateCheckoutPolicy: text('late_checkout_policy'),
    parkingInfo: text('parking_info'),
    petPolicy: text('pet_policy'),
    smokingPolicy: text('smoking_policy'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Communication events log for audit trail
export const commsEvents = pgTable('comms_events', {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
        .notNull()
        .references(() => companies.id, { onDelete: 'cascade' }),
    channel: commsChannelEnum('channel').notNull(),
    direction: messageDirectionEnum('direction').notNull(),
    fromAddr: text('from_addr').notNull(),
    toAddr: text('to_addr').notNull(),
    subject: text('subject'),
    bodyPreview: text('body_preview'),
    status: text('status').notNull(),
    providerMessageId: text('provider_message_id'),
    providerStatus: text('provider_status'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
    companyCreatedIdx: index('comms_events_company_created_idx').on(table.companyId, table.createdAt.desc()),
}));

// Webhook events for idempotency (prevent duplicate processing)
export const webhookEvents = pgTable('webhook_events', {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: text('provider').notNull(),
    eventId: text('event_id').notNull(),
    eventType: text('event_type').notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
    providerEventIdx: uniqueIndex('webhook_events_provider_event_idx').on(table.provider, table.eventId),
}));

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
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type NewSubscriptionPlan = typeof subscriptionPlans.$inferInsert;

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

// Integration token types
export type CompanyIntegration = typeof companyIntegrations.$inferSelect;
export type NewCompanyIntegration = typeof companyIntegrations.$inferInsert;
export type IntegrationTokenAccessLogEntry = typeof integrationTokenAccessLog.$inferSelect;
export type NewIntegrationTokenAccessLogEntry = typeof integrationTokenAccessLog.$inferInsert;

// Tenant-scoped configuration types
export type CompanyProfileRecord = typeof companyProfile.$inferSelect;
export type NewCompanyProfileRecord = typeof companyProfile.$inferInsert;
export type CompanyAiConfigRecord = typeof companyAiConfig.$inferSelect;
export type NewCompanyAiConfigRecord = typeof companyAiConfig.$inferInsert;
export type CompanyPrompt = typeof companyPrompts.$inferSelect;
export type NewCompanyPrompt = typeof companyPrompts.$inferInsert;
export type KnowledgeCategory = typeof knowledgeCategories.$inferSelect;
export type NewKnowledgeCategory = typeof knowledgeCategories.$inferInsert;
export type KnowledgeItem = typeof knowledgeItems.$inferSelect;
export type NewKnowledgeItem = typeof knowledgeItems.$inferInsert;
export type CompanyTemplate = typeof companyTemplates.$inferSelect;
export type NewCompanyTemplate = typeof companyTemplates.$inferInsert;
export type PropertySettingsRecord = typeof propertySettings.$inferSelect;
export type NewPropertySettingsRecord = typeof propertySettings.$inferInsert;
export type CommsEvent = typeof commsEvents.$inferSelect;
export type NewCommsEvent = typeof commsEvents.$inferInsert;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;
