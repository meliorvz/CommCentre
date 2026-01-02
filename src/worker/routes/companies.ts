/**
 * Companies Routes
 * 
 * Super admin endpoints for managing company accounts.
 */

import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { Env } from '../../types';
import { createDb, companies, users, properties, creditTransactions, companyPhoneNumbers, companyEmailAddresses } from '../../db';
import { authMiddleware, superAdminMiddleware } from '../middleware/auth';
import { grantTrialCredits, addCredits, getCreditUsageSummary, estimateTrialCreditsCost } from '../lib/credits';
import { z } from 'zod';

const companiesRouter = new Hono<{ Bindings: Env }>();

// Password hashing (matches auth.ts)
async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// All routes require super admin
companiesRouter.use('*', authMiddleware);
companiesRouter.use('*', superAdminMiddleware);

// Validation schemas
const createCompanySchema = z.object({
    name: z.string().min(1),
    slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
    escalationPhone: z.string().optional(),
    escalationEmail: z.string().email().optional(),
    allowNegativeBalance: z.boolean().optional().default(false),
    grantTrialCredits: z.boolean().optional().default(true),
    // Optional initial admin user
    adminEmail: z.string().email().optional(),
    adminPassword: z.string().min(8).optional(),
}).refine(
    (data) => (data.adminEmail && data.adminPassword) || (!data.adminEmail && !data.adminPassword),
    { message: 'Both adminEmail and adminPassword must be provided together, or neither' }
);

const updateCompanySchema = z.object({
    name: z.string().min(1).optional(),
    slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
    status: z.enum(['active', 'suspended', 'trial']).optional(),
    escalationPhone: z.string().optional(),
    escalationEmail: z.string().email().optional(),
    allowNegativeBalance: z.boolean().optional(),
});

const addCreditsSchema = z.object({
    amount: z.number().int().positive(),
    description: z.string().optional(),
});

// List all companies
companiesRouter.get('/', async (c) => {
    const db = createDb(c.env.DATABASE_URL);

    const allCompanies = await db
        .select({
            id: companies.id,
            name: companies.name,
            slug: companies.slug,
            status: companies.status,
            creditBalance: companies.creditBalance,
            allowNegativeBalance: companies.allowNegativeBalance,
            trialCreditsGranted: companies.trialCreditsGranted,
            escalationPhone: companies.escalationPhone,
            escalationEmail: companies.escalationEmail,
            createdAt: companies.createdAt,
            updatedAt: companies.updatedAt,
        })
        .from(companies)
        .orderBy(companies.createdAt);

    // Get counts for each company
    const companiesWithCounts = await Promise.all(
        allCompanies.map(async (company) => {
            const [userCount] = await db
                .select({ count: users.id })
                .from(users)
                .where(eq(users.companyId, company.id));

            const [propertyCount] = await db
                .select({ count: properties.id })
                .from(properties)
                .where(eq(properties.companyId, company.id));

            return {
                ...company,
                userCount: userCount?.count ? 1 : 0, // This is a simplification
                propertyCount: propertyCount?.count ? 1 : 0,
            };
        })
    );

    return c.json({ companies: companiesWithCounts });
});

// Get single company with details
companiesRouter.get('/:id', async (c) => {
    const { id } = c.req.param();
    const db = createDb(c.env.DATABASE_URL);

    const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, id))
        .limit(1);

    if (!company) {
        return c.json({ error: 'Company not found' }, 404);
    }

    // Get users
    const companyUsers = await db
        .select({
            id: users.id,
            email: users.email,
            role: users.role,
            createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.companyId, id));

    // Get properties
    const companyProperties = await db
        .select({
            id: properties.id,
            name: properties.name,
            status: properties.status,
        })
        .from(properties)
        .where(eq(properties.companyId, id));

    // Get phone numbers
    const phoneNumbers = await db
        .select()
        .from(companyPhoneNumbers)
        .where(eq(companyPhoneNumbers.companyId, id));

    // Get email addresses
    const emailAddresses = await db
        .select()
        .from(companyEmailAddresses)
        .where(eq(companyEmailAddresses.companyId, id));

    // Get usage summary
    const usageSummary = await getCreditUsageSummary(c.env.DATABASE_URL, id);

    return c.json({
        company,
        users: companyUsers,
        properties: companyProperties,
        phoneNumbers,
        emailAddresses,
        usageSummary,
    });
});

// Create new company
companiesRouter.post('/', async (c) => {
    const body = await c.req.json();
    const parsed = createCompanySchema.safeParse(body);

    if (!parsed.success) {
        return c.json({ error: 'Invalid request', details: parsed.error.issues }, 400);
    }

    const db = createDb(c.env.DATABASE_URL);

    // Check if slug is unique
    const [existing] = await db
        .select({ id: companies.id })
        .from(companies)
        .where(eq(companies.slug, parsed.data.slug))
        .limit(1);

    if (existing) {
        return c.json({ error: 'A company with this slug already exists' }, 400);
    }

    try {
        const [newCompany] = await db
            .insert(companies)
            .values({
                name: parsed.data.name,
                slug: parsed.data.slug,
                status: 'trial',
                creditBalance: 0,
                allowNegativeBalance: parsed.data.allowNegativeBalance,
                escalationPhone: parsed.data.escalationPhone,
                escalationEmail: parsed.data.escalationEmail,
            })
            .returning();

        // Create admin user if credentials provided
        if (parsed.data.adminEmail && parsed.data.adminPassword) {
            // Check if email is already in use
            const [existingUser] = await db
                .select({ id: users.id })
                .from(users)
                .where(eq(users.email, parsed.data.adminEmail))
                .limit(1);

            if (existingUser) {
                // Rollback: delete the company we just created
                await db.delete(companies).where(eq(companies.id, newCompany.id));
                return c.json({ error: 'A user with this email already exists' }, 400);
            }

            const passwordHash = await hashPassword(parsed.data.adminPassword);
            await db.insert(users).values({
                email: parsed.data.adminEmail,
                passwordHash,
                role: 'company_admin',
                companyId: newCompany.id,
            });
        }

        // Grant trial credits if requested
        if (parsed.data.grantTrialCredits) {
            await grantTrialCredits(c.env.DATABASE_URL, newCompany.id);
        }

        // Refresh to get updated balance
        const [updated] = await db
            .select()
            .from(companies)
            .where(eq(companies.id, newCompany.id))
            .limit(1);

        return c.json({ company: updated }, 201);
    } catch (err: any) {
        console.error('Failed to create company:', err);
        return c.json({ error: 'Failed to create company', details: err.message }, 500);
    }
});

// Update company
companiesRouter.patch('/:id', async (c) => {
    const { id } = c.req.param();
    const body = await c.req.json();
    const parsed = updateCompanySchema.safeParse(body);

    if (!parsed.success) {
        return c.json({ error: 'Invalid request', details: parsed.error.issues }, 400);
    }

    const db = createDb(c.env.DATABASE_URL);

    // Check company exists
    const [existing] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, id))
        .limit(1);

    if (!existing) {
        return c.json({ error: 'Company not found' }, 404);
    }

    // Check slug uniqueness if being updated
    if (parsed.data.slug && parsed.data.slug !== existing.slug) {
        const [slugExists] = await db
            .select({ id: companies.id })
            .from(companies)
            .where(eq(companies.slug, parsed.data.slug))
            .limit(1);

        if (slugExists) {
            return c.json({ error: 'A company with this slug already exists' }, 400);
        }
    }

    const updateData: Record<string, any> = {
        updatedAt: new Date(),
    };

    if (parsed.data.name) updateData.name = parsed.data.name;
    if (parsed.data.slug) updateData.slug = parsed.data.slug;
    if (parsed.data.status) updateData.status = parsed.data.status;
    if (parsed.data.escalationPhone !== undefined) updateData.escalationPhone = parsed.data.escalationPhone;
    if (parsed.data.escalationEmail !== undefined) updateData.escalationEmail = parsed.data.escalationEmail;
    if (parsed.data.allowNegativeBalance !== undefined) updateData.allowNegativeBalance = parsed.data.allowNegativeBalance;

    const [updated] = await db
        .update(companies)
        .set(updateData)
        .where(eq(companies.id, id))
        .returning();

    return c.json({ company: updated });
});

// Delete company (dangerous!)
companiesRouter.delete('/:id', async (c) => {
    const { id } = c.req.param();
    const db = createDb(c.env.DATABASE_URL);

    const [existing] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, id))
        .limit(1);

    if (!existing) {
        return c.json({ error: 'Company not found' }, 404);
    }

    // Check if company has data
    const [hasUsers] = await db
        .select({ count: users.id })
        .from(users)
        .where(eq(users.companyId, id))
        .limit(1);

    if (hasUsers?.count) {
        return c.json({
            error: 'Cannot delete company with users. Remove all users first.',
            hasUsers: true,
        }, 400);
    }

    await db.delete(companies).where(eq(companies.id, id));

    return c.json({ success: true });
});

// Add credits to company
companiesRouter.post('/:id/credits', async (c) => {
    const { id } = c.req.param();
    const user = c.get('user');
    const body = await c.req.json();
    const parsed = addCreditsSchema.safeParse(body);

    if (!parsed.success) {
        return c.json({ error: 'Invalid request', details: parsed.error.issues }, 400);
    }

    const result = await addCredits(
        c.env.DATABASE_URL,
        id,
        parsed.data.amount,
        user.sub,
        parsed.data.description
    );

    if (!result.success) {
        return c.json({ error: result.error }, 400);
    }

    return c.json({
        success: true,
        newBalance: result.newBalance,
        credited: parsed.data.amount,
    });
});

// Get credit transactions for company
companiesRouter.get('/:id/transactions', async (c) => {
    const { id } = c.req.param();
    const { limit = '100', offset = '0' } = c.req.query();
    const db = createDb(c.env.DATABASE_URL);

    const transactions = await db
        .select()
        .from(creditTransactions)
        .where(eq(creditTransactions.companyId, id))
        .orderBy(creditTransactions.createdAt)
        .limit(parseInt(limit))
        .offset(parseInt(offset));

    return c.json({ transactions });
});

// Get trial credits cost estimate
companiesRouter.get('/config/trial-cost', async (c) => {
    const estimate = await estimateTrialCreditsCost(c.env.DATABASE_URL);

    return c.json({
        trialCredits: estimate.credits,
        estimatedCostCents: estimate.estimatedCostCents,
        estimatedCostFormatted: `$${(estimate.estimatedCostCents / 100).toFixed(2)}`,
    });
});

export default companiesRouter;
