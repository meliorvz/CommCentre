/**
 * Integration Token Storage Service
 *
 * Provides secure storage and retrieval of per-company integration credentials
 * using envelope encryption. All access is logged for audit purposes.
 */

import { eq, and } from 'drizzle-orm';
import { createDb, companyIntegrations, integrationTokenAccessLog } from '../../db';
import { encryptCredentials, decryptCredentials } from './encryption';
import { Env } from '../../types';

export type IntegrationType = 'gmail' | 'twilio' | 'telegram';
export type TokenAccessAction = 'read' | 'write' | 'delete';

// Type for integration credentials - varies by type
export interface GmailCredentials {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    fromAddress?: string;
}

export interface TwilioCredentials {
    accountSid: string;
    authToken: string;
    fromNumber?: string;
}

export interface TelegramCredentials {
    botToken: string;
    chatId?: string;
}

export type IntegrationCredentials = GmailCredentials | TwilioCredentials | TelegramCredentials;

/**
 * Log access to integration tokens for audit purposes
 */
async function logAccess(
    db: ReturnType<typeof createDb>,
    companyId: string,
    type: IntegrationType,
    action: TokenAccessAction,
    actorUserId?: string,
    actorIp?: string
): Promise<void> {
    await db.insert(integrationTokenAccessLog).values({
        companyId,
        integrationType: type,
        action,
        actorUserId: actorUserId || null,
        actorIp: actorIp || null,
    });
}

/**
 * Store integration credentials securely
 *
 * @param env - Environment with database URL and encryption key
 * @param companyId - Company UUID
 * @param type - Integration type (gmail, twilio, telegram)
 * @param credentials - Credentials object to encrypt and store
 * @param accountIdentifier - Optional display identifier (email, phone number)
 * @param actorUserId - Optional user ID for audit log
 * @param actorIp - Optional IP address for audit log
 */
export async function storeIntegration(
    env: Env,
    companyId: string,
    type: IntegrationType,
    credentials: IntegrationCredentials,
    accountIdentifier?: string,
    actorUserId?: string,
    actorIp?: string
): Promise<void> {
    const db = createDb(env.DATABASE_URL);
    const credentialsJson = JSON.stringify(credentials);

    // Encrypt credentials using envelope encryption
    const { encryptedCredentials, encryptedDataKey } = await encryptCredentials(
        env.ENCRYPTION_MASTER_KEY,
        credentialsJson
    );

    // Upsert - insert or update if exists
    await db.insert(companyIntegrations).values({
        companyId,
        integrationType: type,
        encryptedCredentials: Buffer.from(encryptedCredentials),
        dataKeyEncrypted: Buffer.from(encryptedDataKey),
        accountIdentifier,
    }).onConflictDoUpdate({
        target: [companyIntegrations.companyId, companyIntegrations.integrationType],
        set: {
            encryptedCredentials: Buffer.from(encryptedCredentials),
            dataKeyEncrypted: Buffer.from(encryptedDataKey),
            accountIdentifier,
            isActive: true,
            lastError: null,
            updatedAt: new Date(),
        },
    });

    // Log the write access
    await logAccess(db, companyId, type, 'write', actorUserId, actorIp);
}

/**
 * Retrieve and decrypt integration credentials
 *
 * @param env - Environment with database URL and encryption key
 * @param companyId - Company UUID
 * @param type - Integration type (gmail, twilio, telegram)
 * @param actorUserId - Optional user ID for audit log
 * @param actorIp - Optional IP address for audit log
 * @returns Decrypted credentials or null if not found
 */
export async function getIntegration<T extends IntegrationCredentials>(
    env: Env,
    companyId: string,
    type: IntegrationType,
    actorUserId?: string,
    actorIp?: string
): Promise<T | null> {
    const db = createDb(env.DATABASE_URL);

    const [integration] = await db.select()
        .from(companyIntegrations)
        .where(and(
            eq(companyIntegrations.companyId, companyId),
            eq(companyIntegrations.integrationType, type),
            eq(companyIntegrations.isActive, true)
        ))
        .limit(1);

    if (!integration) return null;

    // Log the read access
    await logAccess(db, companyId, type, 'read', actorUserId, actorIp);

    // Update last used timestamp
    await db.update(companyIntegrations)
        .set({ lastUsedAt: new Date() })
        .where(eq(companyIntegrations.id, integration.id));

    // Decrypt credentials
    const credentialsJson = await decryptCredentials(
        env.ENCRYPTION_MASTER_KEY,
        new Uint8Array(integration.encryptedCredentials),
        new Uint8Array(integration.dataKeyEncrypted)
    );

    return JSON.parse(credentialsJson) as T;
}

/**
 * Delete integration credentials
 *
 * @param env - Environment with database URL
 * @param companyId - Company UUID
 * @param type - Integration type
 * @param actorUserId - Optional user ID for audit log
 * @param actorIp - Optional IP address for audit log
 */
export async function deleteIntegration(
    env: Env,
    companyId: string,
    type: IntegrationType,
    actorUserId?: string,
    actorIp?: string
): Promise<void> {
    const db = createDb(env.DATABASE_URL);

    // Log access before deletion
    await logAccess(db, companyId, type, 'delete', actorUserId, actorIp);

    await db.delete(companyIntegrations)
        .where(and(
            eq(companyIntegrations.companyId, companyId),
            eq(companyIntegrations.integrationType, type)
        ));
}

/**
 * Deactivate integration without deleting (soft delete)
 */
export async function deactivateIntegration(
    env: Env,
    companyId: string,
    type: IntegrationType,
    error?: string
): Promise<void> {
    const db = createDb(env.DATABASE_URL);

    await db.update(companyIntegrations)
        .set({
            isActive: false,
            lastError: error || null,
            updatedAt: new Date(),
        })
        .where(and(
            eq(companyIntegrations.companyId, companyId),
            eq(companyIntegrations.integrationType, type)
        ));
}

/**
 * Reactivate a deactivated integration
 */
export async function reactivateIntegration(
    env: Env,
    companyId: string,
    type: IntegrationType
): Promise<void> {
    const db = createDb(env.DATABASE_URL);

    await db.update(companyIntegrations)
        .set({
            isActive: true,
            lastError: null,
            updatedAt: new Date(),
        })
        .where(and(
            eq(companyIntegrations.companyId, companyId),
            eq(companyIntegrations.integrationType, type)
        ));
}

/**
 * Check if a company has a specific integration configured
 */
export async function hasIntegration(
    env: Env,
    companyId: string,
    type: IntegrationType
): Promise<boolean> {
    const db = createDb(env.DATABASE_URL);

    const [integration] = await db.select({ id: companyIntegrations.id })
        .from(companyIntegrations)
        .where(and(
            eq(companyIntegrations.companyId, companyId),
            eq(companyIntegrations.integrationType, type),
            eq(companyIntegrations.isActive, true)
        ))
        .limit(1);

    return !!integration;
}

/**
 * Get integration status (without credentials)
 */
export async function getIntegrationStatus(
    env: Env,
    companyId: string,
    type: IntegrationType
): Promise<{
    configured: boolean;
    active: boolean;
    accountIdentifier: string | null;
    lastUsedAt: Date | null;
    lastError: string | null;
} | null> {
    const db = createDb(env.DATABASE_URL);

    const [integration] = await db.select({
        isActive: companyIntegrations.isActive,
        accountIdentifier: companyIntegrations.accountIdentifier,
        lastUsedAt: companyIntegrations.lastUsedAt,
        lastError: companyIntegrations.lastError,
    })
        .from(companyIntegrations)
        .where(and(
            eq(companyIntegrations.companyId, companyId),
            eq(companyIntegrations.integrationType, type)
        ))
        .limit(1);

    if (!integration) return null;

    return {
        configured: true,
        active: integration.isActive,
        accountIdentifier: integration.accountIdentifier,
        lastUsedAt: integration.lastUsedAt,
        lastError: integration.lastError,
    };
}
