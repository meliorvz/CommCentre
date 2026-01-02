/**
 * Credit Management Utilities
 * 
 * Handles credit checking, deduction, and transaction logging for the multi-tenant system.
 */

import { eq, sql, and } from 'drizzle-orm';
import { createDb, companies, creditTransactions, creditConfig, platformSettings } from '../../db';

export type CreditType =
    | 'sms_usage'
    | 'email_usage'
    | 'integration_sms_usage'    // SMS via integrations API
    | 'integration_email_usage'  // Email via integrations API
    | 'call_forward_usage'       // Call forwarding
    | 'phone_rental'
    | 'email_rental'
    | 'trial_grant'
    | 'subscription_grant'       // Monthly credits from subscription
    | 'overage_charge'           // Period-end overage billing
    | 'adjustment'
    | 'refund'
    | 'purchase';

export interface CreditConfig {
    smsCost: number;             // All SMS = 2 credits (simplified)
    emailCost: number;           // All Email = 1 credit (simplified)
    callForwardCost: number;     // Per forwarded call
    phoneMonthly: number;
    emailMonthly: number;
    trialCredits: number;
    // Legacy fields for backwards compatibility
    smsAiCost: number;
    smsManualCost: number;
    emailAiCost: number;
    emailManualCost: number;
}

// Cache credit config in memory (10 min TTL)
let cachedCreditConfig: CreditConfig | null = null;
let configCacheTime = 0;
const CONFIG_TTL_MS = 10 * 60 * 1000;

/**
 * Get credit configuration from database
 */
export async function getCreditConfig(databaseUrl: string): Promise<CreditConfig> {
    const now = Date.now();
    if (cachedCreditConfig && now - configCacheTime < CONFIG_TTL_MS) {
        return cachedCreditConfig;
    }

    const db = createDb(databaseUrl);
    const configs = await db.select().from(creditConfig);

    const configMap = new Map(configs.map(c => [c.key, c.value]));

    // New unified costs (defaults: SMS=2, Email=1)
    const smsCost = configMap.get('sms_cost') ?? 2;
    const emailCost = configMap.get('email_cost') ?? 1;

    cachedCreditConfig = {
        smsCost,
        emailCost,
        callForwardCost: configMap.get('call_forward_cost') ?? 1,
        phoneMonthly: configMap.get('phone_monthly_cost') ?? 50,
        emailMonthly: configMap.get('email_monthly_cost') ?? 20,
        trialCredits: configMap.get('trial_credits') ?? 200,
        // Legacy: return same as unified cost for backwards compatibility
        smsAiCost: smsCost,
        smsManualCost: smsCost,
        emailAiCost: emailCost,
        emailManualCost: emailCost,
    };
    configCacheTime = now;

    return cachedCreditConfig;
}

/**
 * Invalidate credit config cache (call after admin updates)
 */
export function invalidateCreditConfigCache(): void {
    cachedCreditConfig = null;
    configCacheTime = 0;
}

/**
 * Get the credit cost for a specific action type
 */
export async function getCreditCost(
    databaseUrl: string,
    type: 'sms' | 'email' | 'call_forward' | 'sms_ai' | 'sms_manual' | 'email_ai' | 'email_manual' | 'phone_rental' | 'email_rental'
): Promise<number> {
    const config = await getCreditConfig(databaseUrl);

    switch (type) {
        // New unified costs
        case 'sms': return config.smsCost;
        case 'email': return config.emailCost;
        case 'call_forward': return config.callForwardCost;
        // Legacy compatibility (maps to unified costs)
        case 'sms_ai': return config.smsCost;
        case 'sms_manual': return config.smsCost;
        case 'email_ai': return config.emailCost;
        case 'email_manual': return config.emailCost;
        case 'phone_rental': return config.phoneMonthly;
        case 'email_rental': return config.emailMonthly;
        default: return 0;
    }
}

export interface CompanyCredits {
    balance: number;
    allowNegative: boolean;
    status: 'active' | 'suspended' | 'trial';
}

/**
 * Get company credit balance and settings
 */
export async function getCompanyCredits(
    databaseUrl: string,
    companyId: string
): Promise<CompanyCredits | null> {
    const db = createDb(databaseUrl);

    const [company] = await db
        .select({
            balance: companies.creditBalance,
            allowNegative: companies.allowNegativeBalance,
            status: companies.status,
        })
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);

    if (!company) return null;

    return {
        balance: company.balance,
        allowNegative: company.allowNegative,
        status: company.status,
    };
}

/**
 * Check if company has sufficient credits for an action
 */
export async function checkCredits(
    databaseUrl: string,
    companyId: string,
    amount: number
): Promise<{ allowed: boolean; balance: number; reason?: string }> {
    const company = await getCompanyCredits(databaseUrl, companyId);

    if (!company) {
        return { allowed: false, balance: 0, reason: 'Company not found' };
    }

    if (company.status === 'suspended') {
        return { allowed: false, balance: company.balance, reason: 'Account suspended' };
    }

    if (company.balance >= amount) {
        return { allowed: true, balance: company.balance };
    }

    if (company.allowNegative) {
        return { allowed: true, balance: company.balance };
    }

    return {
        allowed: false,
        balance: company.balance,
        reason: `Insufficient credits. Balance: ${company.balance}, Required: ${amount}`
    };
}

/**
 * Deduct credits from a company and log the transaction
 */
export async function deductCredits(
    databaseUrl: string,
    companyId: string,
    type: CreditType,
    amount: number,
    referenceId?: string,
    referenceType?: string,
    description?: string
): Promise<{ success: boolean; newBalance: number; error?: string }> {
    const db = createDb(databaseUrl);

    // Use a transaction to ensure atomicity
    try {
        // Check current balance
        const [company] = await db
            .select({
                balance: companies.creditBalance,
                allowNegative: companies.allowNegativeBalance,
                status: companies.status,
            })
            .from(companies)
            .where(eq(companies.id, companyId))
            .limit(1);

        if (!company) {
            return { success: false, newBalance: 0, error: 'Company not found' };
        }

        if (company.status === 'suspended') {
            return { success: false, newBalance: company.balance, error: 'Account suspended' };
        }

        const newBalance = company.balance - amount;

        if (newBalance < 0 && !company.allowNegative) {
            return {
                success: false,
                newBalance: company.balance,
                error: `Insufficient credits. Balance: ${company.balance}, Required: ${amount}`
            };
        }

        // Deduct credits
        await db
            .update(companies)
            .set({
                creditBalance: newBalance,
                updatedAt: new Date(),
            })
            .where(eq(companies.id, companyId));

        // Log transaction
        await db
            .insert(creditTransactions)
            .values({
                companyId,
                amount: -amount, // Negative for deductions
                type,
                referenceId,
                referenceType,
                description,
                balanceAfter: newBalance,
            });

        // Check if we need to send low balance warning
        if (newBalance < 50 && newBalance >= 0) {
            console.log(`[CREDITS] Low balance warning for company ${companyId}: ${newBalance} credits remaining`);
            // TODO: Trigger low balance notification
        }

        // Check if we need to suspend (zero balance, no negative allowed)
        if (newBalance <= 0 && !company.allowNegative) {
            console.log(`[CREDITS] Suspending company ${companyId} due to zero balance`);
            await db
                .update(companies)
                .set({ status: 'suspended' })
                .where(eq(companies.id, companyId));
        }

        return { success: true, newBalance };
    } catch (err: any) {
        console.error('[CREDITS] Deduction failed:', err);
        return { success: false, newBalance: 0, error: err.message };
    }
}

/**
 * Add credits to a company (admin action)
 */
export async function addCredits(
    databaseUrl: string,
    companyId: string,
    amount: number,
    adminUserId: string,
    description?: string,
    type: CreditType = 'purchase'
): Promise<{ success: boolean; newBalance: number; error?: string }> {
    const db = createDb(databaseUrl);

    try {
        const [company] = await db
            .select({ balance: companies.creditBalance })
            .from(companies)
            .where(eq(companies.id, companyId))
            .limit(1);

        if (!company) {
            return { success: false, newBalance: 0, error: 'Company not found' };
        }

        const newBalance = company.balance + amount;

        // Update balance
        await db
            .update(companies)
            .set({
                creditBalance: newBalance,
                updatedAt: new Date(),
                // Reactivate if was suspended and now has positive balance
                status: newBalance > 0 ? 'active' : undefined,
            })
            .where(eq(companies.id, companyId));

        // Log transaction
        await db
            .insert(creditTransactions)
            .values({
                companyId,
                amount, // Positive for additions
                type,
                description: description || `Admin credit top-up: ${amount} credits`,
                balanceAfter: newBalance,
                createdBy: adminUserId,
            });

        return { success: true, newBalance };
    } catch (err: any) {
        console.error('[CREDITS] Add credits failed:', err);
        return { success: false, newBalance: 0, error: err.message };
    }
}

/**
 * Get credit usage summary for a company
 */
export async function getCreditUsageSummary(
    databaseUrl: string,
    companyId: string,
    startDate?: Date,
    endDate?: Date
): Promise<{
    totalUsed: number;
    totalAdded: number;
    byType: Record<string, number>;
}> {
    const db = createDb(databaseUrl);

    let query = db
        .select({
            type: creditTransactions.type,
            totalAmount: sql<number>`SUM(${creditTransactions.amount})`.as('total_amount'),
        })
        .from(creditTransactions)
        .where(eq(creditTransactions.companyId, companyId))
        .groupBy(creditTransactions.type);

    const results = await query;

    let totalUsed = 0;
    let totalAdded = 0;
    const byType: Record<string, number> = {};

    for (const row of results) {
        byType[row.type] = Math.abs(row.totalAmount);
        if (row.totalAmount < 0) {
            totalUsed += Math.abs(row.totalAmount);
        } else {
            totalAdded += row.totalAmount;
        }
    }

    return { totalUsed, totalAdded, byType };
}

/**
 * Estimate cost of trial credits for new customer acquisition cost reporting
 */
export async function estimateTrialCreditsCost(
    databaseUrl: string
): Promise<{ credits: number; estimatedCostCents: number }> {
    const db = createDb(databaseUrl);

    const [trialConfig] = await db
        .select({
            value: creditConfig.value,
            costCents: creditConfig.estimatedCostCents,
        })
        .from(creditConfig)
        .where(eq(creditConfig.key, 'trial_credits'))
        .limit(1);

    if (!trialConfig) {
        return { credits: 200, estimatedCostCents: 1000 }; // Default fallback
    }

    return {
        credits: trialConfig.value,
        estimatedCostCents: trialConfig.costCents ?? 1000,
    };
}

/**
 * Grant trial credits to a new company
 */
export async function grantTrialCredits(
    databaseUrl: string,
    companyId: string
): Promise<{ success: boolean; creditsGranted: number; error?: string }> {
    const db = createDb(databaseUrl);

    try {
        const config = await getCreditConfig(databaseUrl);
        const trialCredits = config.trialCredits;

        // Update company balance and mark trial credits as granted
        await db
            .update(companies)
            .set({
                creditBalance: sql`${companies.creditBalance} + ${trialCredits}`,
                trialCreditsGranted: trialCredits,
                updatedAt: new Date(),
            })
            .where(eq(companies.id, companyId));

        // Get updated balance
        const [company] = await db
            .select({ balance: companies.creditBalance })
            .from(companies)
            .where(eq(companies.id, companyId))
            .limit(1);

        // Log transaction
        await db
            .insert(creditTransactions)
            .values({
                companyId,
                amount: trialCredits,
                type: 'trial_grant',
                description: `Trial credits granted: ${trialCredits}`,
                balanceAfter: company?.balance ?? trialCredits,
            });

        return { success: true, creditsGranted: trialCredits };
    } catch (err: any) {
        console.error('[CREDITS] Grant trial credits failed:', err);
        return { success: false, creditsGranted: 0, error: err.message };
    }
}
