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
} from 'drizzle-orm/pg-core';

// ============================================================================
// ENUMS
// ============================================================================

export const userRoleEnum = pgEnum('user_role', ['admin', 'staff']);

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

// ============================================================================
// TABLES
// ============================================================================

export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    role: userRoleEnum('role').notNull().default('staff'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const properties = pgTable('properties', {
    id: uuid('id').primaryKey().defaultRandom(),
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
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    payloadJson: jsonb('payload_json'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

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
