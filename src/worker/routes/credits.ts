/**
 * Credits Routes
 * 
 * Credit balance and transaction viewing for companies.
 * Super admins can also update credit configuration.
 */

import { Hono } from 'hono';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import { Env } from '../../types';
import { createDb, companies, creditTransactions, creditConfig, platformSettings } from '../../db';
import { authMiddleware, superAdminMiddleware, adminOnlyMiddleware, requireCompanyId } from '../middleware/auth';
import { getCreditConfig, getCreditUsageSummary, invalidateCreditConfigCache } from '../lib/credits';
import { z } from 'zod';

const creditsRouter = new Hono<{ Bindings: Env }>();

creditsRouter.use('*', authMiddleware);

// Get current company's credit balance and recent transactions
creditsRouter.get('/', adminOnlyMiddleware, async (c) => {
    const user = c.get('user');
    const db = createDb(c.env.DATABASE_URL);

    // Super admins can query any company
    const companyId = user.role === 'super_admin'
        ? c.req.query('companyId')
        : user.companyId;

    if (!companyId) {
        return c.json({ error: 'Company ID required' }, 400);
    }

    const [company] = await db
        .select({
            id: companies.id,
            name: companies.name,
            creditBalance: companies.creditBalance,
            allowNegativeBalance: companies.allowNegativeBalance,
            status: companies.status,
            trialCreditsGranted: companies.trialCreditsGranted,
        })
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);

    if (!company) {
        return c.json({ error: 'Company not found' }, 404);
    }

    // Get recent transactions
    const recentTransactions = await db
        .select()
        .from(creditTransactions)
        .where(eq(creditTransactions.companyId, companyId))
        .orderBy(desc(creditTransactions.createdAt))
        .limit(20);

    // Get usage summary
    const usageSummary = await getCreditUsageSummary(c.env.DATABASE_URL, companyId);

    return c.json({
        balance: company.creditBalance,
        company: {
            id: company.id,
            name: company.name,
            status: company.status,
            allowNegativeBalance: company.allowNegativeBalance,
            trialCreditsGranted: company.trialCreditsGranted,
        },
        recentTransactions,
        usageSummary,
    });
});

// Get all transactions with pagination and filters
creditsRouter.get('/transactions', adminOnlyMiddleware, async (c) => {
    const user = c.get('user');
    const db = createDb(c.env.DATABASE_URL);

    const companyId = user.role === 'super_admin'
        ? c.req.query('companyId')
        : user.companyId;

    if (!companyId) {
        return c.json({ error: 'Company ID required' }, 400);
    }

    const {
        limit = '50',
        offset = '0',
        type,
        startDate,
        endDate,
    } = c.req.query();

    let query = db
        .select()
        .from(creditTransactions)
        .where(eq(creditTransactions.companyId, companyId))
        .orderBy(desc(creditTransactions.createdAt))
        .limit(parseInt(limit))
        .offset(parseInt(offset));

    const transactions = await query;

    // Get total count
    const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(creditTransactions)
        .where(eq(creditTransactions.companyId, companyId));

    return c.json({
        transactions,
        total: countResult?.count ?? 0,
        limit: parseInt(limit),
        offset: parseInt(offset),
    });
});

// Get usage report with breakdown by type
creditsRouter.get('/usage', adminOnlyMiddleware, async (c) => {
    const user = c.get('user');
    const db = createDb(c.env.DATABASE_URL);

    const companyId = user.role === 'super_admin'
        ? c.req.query('companyId')
        : user.companyId;

    if (!companyId) {
        return c.json({ error: 'Company ID required' }, 400);
    }

    const { startDate, endDate } = c.req.query();

    // Get usage by type
    const usageByType = await db
        .select({
            type: creditTransactions.type,
            count: sql<number>`count(*)`,
            totalCredits: sql<number>`SUM(ABS(${creditTransactions.amount}))`,
        })
        .from(creditTransactions)
        .where(and(
            eq(creditTransactions.companyId, companyId),
            sql`${creditTransactions.amount} < 0` // Only usage (negative)
        ))
        .groupBy(creditTransactions.type);

    // Get daily usage for chart
    const dailyUsage = await db
        .select({
            date: sql<string>`DATE(${creditTransactions.createdAt})`,
            totalCredits: sql<number>`SUM(ABS(${creditTransactions.amount}))`,
        })
        .from(creditTransactions)
        .where(and(
            eq(creditTransactions.companyId, companyId),
            sql`${creditTransactions.amount} < 0`
        ))
        .groupBy(sql`DATE(${creditTransactions.createdAt})`)
        .orderBy(sql`DATE(${creditTransactions.createdAt})`);

    return c.json({
        usageByType,
        dailyUsage,
    });
});

// ============================================================================
// Super Admin Only - Credit Configuration
// ============================================================================

// Get credit configuration (pricing)
creditsRouter.get('/config', superAdminMiddleware, async (c) => {
    const db = createDb(c.env.DATABASE_URL);

    const configs = await db
        .select()
        .from(creditConfig)
        .orderBy(creditConfig.key);

    const settings = await db
        .select()
        .from(platformSettings)
        .orderBy(platformSettings.key);

    // Also calculate current estimated cost per new customer
    const trialConfig = configs.find(cfg => cfg.key === 'trial_credits');
    const estimatedNewCustomerCost = trialConfig
        ? {
            credits: trialConfig.value,
            costCents: trialConfig.estimatedCostCents ?? 0,
            formatted: `$${((trialConfig.estimatedCostCents ?? 0) / 100).toFixed(2)}`
        }
        : null;

    return c.json({
        creditPricing: configs,
        platformSettings: settings,
        estimatedNewCustomerCost,
    });
});

// Update credit configuration
const updateCreditConfigSchema = z.object({
    key: z.string(),
    value: z.number().int(),
    estimatedCostCents: z.number().int().optional(),
    description: z.string().optional(),
});

creditsRouter.patch('/config/:key', superAdminMiddleware, async (c) => {
    const { key } = c.req.param();
    const user = c.get('user');
    const body = await c.req.json();
    const parsed = updateCreditConfigSchema.safeParse({ ...body, key });

    if (!parsed.success) {
        return c.json({ error: 'Invalid request', details: parsed.error.issues }, 400);
    }

    const db = createDb(c.env.DATABASE_URL);

    const [updated] = await db
        .update(creditConfig)
        .set({
            value: parsed.data.value,
            estimatedCostCents: parsed.data.estimatedCostCents,
            description: parsed.data.description,
            updatedBy: user.sub,
            updatedAt: new Date(),
        })
        .where(eq(creditConfig.key, key))
        .returning();

    if (!updated) {
        // Create if doesn't exist
        const [created] = await db
            .insert(creditConfig)
            .values({
                key,
                value: parsed.data.value,
                estimatedCostCents: parsed.data.estimatedCostCents,
                description: parsed.data.description,
                updatedBy: user.sub,
            })
            .returning();

        invalidateCreditConfigCache();
        return c.json({ config: created }, 201);
    }

    invalidateCreditConfigCache();
    return c.json({ config: updated });
});

// Update platform setting
const updateSettingSchema = z.object({
    value: z.string(),
    description: z.string().optional(),
});

creditsRouter.patch('/settings/:key', superAdminMiddleware, async (c) => {
    const { key } = c.req.param();
    const user = c.get('user');
    const body = await c.req.json();
    const parsed = updateSettingSchema.safeParse(body);

    if (!parsed.success) {
        return c.json({ error: 'Invalid request', details: parsed.error.issues }, 400);
    }

    const db = createDb(c.env.DATABASE_URL);

    const [updated] = await db
        .update(platformSettings)
        .set({
            value: parsed.data.value,
            description: parsed.data.description,
            updatedBy: user.sub,
            updatedAt: new Date(),
        })
        .where(eq(platformSettings.key, key))
        .returning();

    if (!updated) {
        // Create if doesn't exist
        const [created] = await db
            .insert(platformSettings)
            .values({
                key,
                value: parsed.data.value,
                description: parsed.data.description,
                updatedBy: user.sub,
            })
            .returning();

        return c.json({ setting: created }, 201);
    }

    return c.json({ setting: updated });
});

export default creditsRouter;
