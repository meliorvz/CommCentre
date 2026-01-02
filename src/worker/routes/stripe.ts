/**
 * Stripe Routes
 * 
 * Handles subscription management, checkout sessions, and customer portal.
 */

import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { Env } from '../../types';
import { createDb, companies, subscriptionPlans } from '../../db';
import { authMiddleware, adminOnlyMiddleware, superAdminMiddleware } from '../middleware/auth';

const stripeRoutes = new Hono<{ Bindings: Env }>();

// All routes require authentication
stripeRoutes.use('*', authMiddleware);

// ============================================================================
// Plan Information (Public to authenticated users)
// ============================================================================

// GET /api/stripe/plans - List available subscription plans
stripeRoutes.get('/plans', async (c) => {
    const db = createDb(c.env.DATABASE_URL);

    const plans = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.isActive, true))
        .orderBy(subscriptionPlans.displayOrder);

    return c.json({ plans });
});

// ============================================================================
// Subscription Management (Admin only)
// ============================================================================

// GET /api/stripe/subscription - Get current company's subscription status
stripeRoutes.get('/subscription', adminOnlyMiddleware, async (c) => {
    const user = c.get('user');
    const db = createDb(c.env.DATABASE_URL);

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
            stripeCustomerId: companies.stripeCustomerId,
            stripeSubscriptionId: companies.stripeSubscriptionId,
            stripePriceId: companies.stripePriceId,
            subscriptionStatus: companies.subscriptionStatus,
            currentPeriodStart: companies.currentPeriodStart,
            currentPeriodEnd: companies.currentPeriodEnd,
            monthlyCreditsAllocation: companies.monthlyCreditsAllocation,
            periodCreditsUsed: companies.periodCreditsUsed,
            isAnnual: companies.isAnnual,
            creditBalance: companies.creditBalance,
        })
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);

    if (!company) {
        return c.json({ error: 'Company not found' }, 404);
    }

    // Get the plan details if subscribed
    let plan = null;
    if (company.stripePriceId) {
        const [matchingPlan] = await db
            .select()
            .from(subscriptionPlans)
            .where(eq(subscriptionPlans.stripeMonthlyPriceId, company.stripePriceId))
            .limit(1);

        if (!matchingPlan) {
            // Try annual price
            const [annualPlan] = await db
                .select()
                .from(subscriptionPlans)
                .where(eq(subscriptionPlans.stripeAnnualPriceId, company.stripePriceId))
                .limit(1);
            plan = annualPlan || null;
        } else {
            plan = matchingPlan;
        }
    }

    return c.json({
        subscription: {
            status: company.subscriptionStatus,
            currentPeriodStart: company.currentPeriodStart,
            currentPeriodEnd: company.currentPeriodEnd,
            isAnnual: company.isAnnual,
            creditsAllocation: company.monthlyCreditsAllocation,
            creditsUsed: company.periodCreditsUsed,
            creditsRemaining: (company.monthlyCreditsAllocation || 0) - (company.periodCreditsUsed || 0),
        },
        plan,
        company: {
            id: company.id,
            name: company.name,
            creditBalance: company.creditBalance,
        },
    });
});

// POST /api/stripe/checkout - Create a Stripe Checkout Session
stripeRoutes.post('/checkout', adminOnlyMiddleware, async (c) => {
    const user = c.get('user');
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();

    const { priceId, annual = false } = body;

    if (!priceId) {
        return c.json({ error: 'priceId is required' }, 400);
    }

    const companyId = user.companyId;
    if (!companyId) {
        return c.json({ error: 'User must belong to a company' }, 400);
    }

    // Get company
    const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);

    if (!company) {
        return c.json({ error: 'Company not found' }, 404);
    }

    // Create Stripe Checkout Session
    const stripeSecretKey = c.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
        return c.json({ error: 'Stripe not configured' }, 500);
    }

    const successUrl = `${c.req.header('origin') || 'https://comms.paradisestayz.com.au'}/billing?success=true`;
    const cancelUrl = `${c.req.header('origin') || 'https://comms.paradisestayz.com.au'}/billing?canceled=true`;

    // Build checkout session params
    const params = new URLSearchParams();
    params.append('mode', 'subscription');
    params.append('success_url', successUrl);
    params.append('cancel_url', cancelUrl);
    params.append('line_items[0][price]', priceId);
    params.append('line_items[0][quantity]', '1');
    params.append('client_reference_id', companyId);
    params.append('metadata[companyId]', companyId);
    params.append('metadata[annual]', annual ? 'true' : 'false');
    params.append('subscription_data[metadata][companyId]', companyId);

    // If company already has Stripe customer, use it
    if (company.stripeCustomerId) {
        params.append('customer', company.stripeCustomerId);
    } else {
        params.append('customer_email', user.email);
    }

    try {
        const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${stripeSecretKey}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('Stripe checkout error:', error);
            return c.json({ error: 'Failed to create checkout session' }, 500);
        }

        const session = await response.json() as { id: string; url: string };

        return c.json({
            sessionId: session.id,
            url: session.url,
        });
    } catch (err: any) {
        console.error('Stripe API error:', err);
        return c.json({ error: 'Stripe API error' }, 500);
    }
});

// POST /api/stripe/portal - Create a Stripe Customer Portal Session
stripeRoutes.post('/portal', adminOnlyMiddleware, async (c) => {
    const user = c.get('user');
    const db = createDb(c.env.DATABASE_URL);

    const companyId = user.companyId;
    if (!companyId) {
        return c.json({ error: 'User must belong to a company' }, 400);
    }

    // Get company
    const [company] = await db
        .select({
            stripeCustomerId: companies.stripeCustomerId,
        })
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);

    if (!company?.stripeCustomerId) {
        return c.json({ error: 'No active subscription' }, 400);
    }

    const stripeSecretKey = c.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
        return c.json({ error: 'Stripe not configured' }, 500);
    }

    const returnUrl = `${c.req.header('origin') || 'https://comms.paradisestayz.com.au'}/billing`;

    const params = new URLSearchParams();
    params.append('customer', company.stripeCustomerId);
    params.append('return_url', returnUrl);

    try {
        const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${stripeSecretKey}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('Stripe portal error:', error);
            return c.json({ error: 'Failed to create portal session' }, 500);
        }

        const session = await response.json() as { url: string };

        return c.json({ url: session.url });
    } catch (err: any) {
        console.error('Stripe API error:', err);
        return c.json({ error: 'Stripe API error' }, 500);
    }
});

// ============================================================================
// Super Admin - Plan Management
// ============================================================================

// POST /api/stripe/plans - Create a new plan (SuperAdmin only)
stripeRoutes.post('/plans', superAdminMiddleware, async (c) => {
    const body = await c.req.json();
    const db = createDb(c.env.DATABASE_URL);

    const { name, monthlyPriceCents, creditsIncluded, overagePriceCents, allowsIntegrations = false } = body;

    if (!name || !monthlyPriceCents || !creditsIncluded || !overagePriceCents) {
        return c.json({ error: 'Missing required fields' }, 400);
    }

    // Calculate annual price (20% discount)
    const annualPriceCents = Math.round(monthlyPriceCents * 12 * 0.8);

    const [plan] = await db
        .insert(subscriptionPlans)
        .values({
            name,
            monthlyPriceCents,
            annualPriceCents,
            creditsIncluded,
            overagePriceCents,
            allowsIntegrations,
        })
        .returning();

    return c.json({ plan }, 201);
});

// PATCH /api/stripe/plans/:id - Update a plan (SuperAdmin only)
stripeRoutes.patch('/plans/:id', superAdminMiddleware, async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const db = createDb(c.env.DATABASE_URL);

    const updateData: any = {};
    if (body.name) updateData.name = body.name;
    if (body.stripeMonthlyPriceId !== undefined) updateData.stripeMonthlyPriceId = body.stripeMonthlyPriceId;
    if (body.stripeAnnualPriceId !== undefined) updateData.stripeAnnualPriceId = body.stripeAnnualPriceId;
    if (body.monthlyPriceCents) {
        updateData.monthlyPriceCents = body.monthlyPriceCents;
        updateData.annualPriceCents = Math.round(body.monthlyPriceCents * 12 * 0.8);
    }
    if (body.creditsIncluded) updateData.creditsIncluded = body.creditsIncluded;
    if (body.overagePriceCents) updateData.overagePriceCents = body.overagePriceCents;
    if (typeof body.allowsIntegrations === 'boolean') updateData.allowsIntegrations = body.allowsIntegrations;
    if (typeof body.isActive === 'boolean') updateData.isActive = body.isActive;
    if (typeof body.displayOrder === 'number') updateData.displayOrder = body.displayOrder;

    updateData.updatedAt = new Date();

    const [updated] = await db
        .update(subscriptionPlans)
        .set(updateData)
        .where(eq(subscriptionPlans.id, id))
        .returning();

    if (!updated) {
        return c.json({ error: 'Plan not found' }, 404);
    }

    return c.json({ plan: updated });
});

// GET /api/stripe/plans/all - Get all plans including inactive (SuperAdmin only)
stripeRoutes.get('/plans/all', superAdminMiddleware, async (c) => {
    const db = createDb(c.env.DATABASE_URL);

    const plans = await db
        .select()
        .from(subscriptionPlans)
        .orderBy(subscriptionPlans.displayOrder);

    return c.json({ plans });
});

export default stripeRoutes;
