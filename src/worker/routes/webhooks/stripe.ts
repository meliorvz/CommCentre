/**
 * Stripe Webhook Handler
 * 
 * Handles Stripe webhook events for subscription lifecycle management.
 */

import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { Env } from '../../../types';
import { createDb, companies, subscriptionPlans, creditTransactions } from '../../../db';
import { addCredits } from '../../lib/credits';

const stripeWebhooks = new Hono<{ Bindings: Env }>();

// Stripe webhook event types we handle
interface StripeWebhookEvent {
    id: string;
    type: string;
    data: {
        object: any;
    };
}

// Verify Stripe webhook signature
async function verifyStripeSignature(
    payload: string,
    signature: string,
    secret: string
): Promise<boolean> {
    // Stripe signatures use HMAC-SHA256
    // Format: t=timestamp,v1=signature
    const parts = signature.split(',');
    const timestamp = parts.find(p => p.startsWith('t='))?.slice(2);
    const sig = parts.find(p => p.startsWith('v1='))?.slice(3);

    if (!timestamp || !sig) return false;

    // Check timestamp is within 5 minutes
    const ts = parseInt(timestamp);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - ts) > 300) return false;

    // Compute expected signature
    const signedPayload = `${timestamp}.${payload}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
    const expectedSig = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    return sig === expectedSig;
}

// POST /api/webhooks/stripe
stripeWebhooks.post('/', async (c) => {
    const webhookSecret = c.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.error('STRIPE_WEBHOOK_SECRET not configured');
        return c.json({ error: 'Webhook not configured' }, 500);
    }

    const signature = c.req.header('stripe-signature');
    if (!signature) {
        return c.json({ error: 'Missing signature' }, 400);
    }

    const payload = await c.req.text();

    // Verify signature
    const isValid = await verifyStripeSignature(payload, signature, webhookSecret);
    if (!isValid) {
        console.error('Invalid Stripe webhook signature');
        return c.json({ error: 'Invalid signature' }, 401);
    }

    const event: StripeWebhookEvent = JSON.parse(payload);
    const db = createDb(c.env.DATABASE_URL);

    console.log(`[Stripe] Received event: ${event.type}`);

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                const companyId = session.metadata?.companyId || session.client_reference_id;
                const customerId = session.customer;
                const subscriptionId = session.subscription;
                const isAnnual = session.metadata?.annual === 'true';

                if (!companyId) {
                    console.error('No companyId in checkout session');
                    break;
                }

                // Update company with Stripe IDs
                await db
                    .update(companies)
                    .set({
                        stripeCustomerId: customerId,
                        stripeSubscriptionId: subscriptionId,
                        subscriptionStatus: 'active',
                        isAnnual,
                        updatedAt: new Date(),
                    })
                    .where(eq(companies.id, companyId));

                console.log(`[Stripe] Company ${companyId} subscribed`);
                break;
            }

            case 'customer.subscription.updated': {
                const subscription = event.data.object;
                const companyId = subscription.metadata?.companyId;

                if (!companyId) {
                    // Try to find company by subscription ID
                    const [company] = await db
                        .select({ id: companies.id })
                        .from(companies)
                        .where(eq(companies.stripeSubscriptionId, subscription.id))
                        .limit(1);

                    if (!company) {
                        console.error('Could not find company for subscription:', subscription.id);
                        break;
                    }

                    // Update subscription details
                    await db
                        .update(companies)
                        .set({
                            stripePriceId: subscription.items.data[0]?.price?.id,
                            subscriptionStatus: subscription.status as any,
                            currentPeriodStart: new Date(subscription.current_period_start * 1000),
                            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                            updatedAt: new Date(),
                        })
                        .where(eq(companies.id, company.id));
                }
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object;

                // Find company by subscription ID
                const [company] = await db
                    .select({ id: companies.id })
                    .from(companies)
                    .where(eq(companies.stripeSubscriptionId, subscription.id))
                    .limit(1);

                if (company) {
                    await db
                        .update(companies)
                        .set({
                            subscriptionStatus: 'canceled',
                            updatedAt: new Date(),
                        })
                        .where(eq(companies.id, company.id));

                    console.log(`[Stripe] Company ${company.id} subscription canceled`);
                }
                break;
            }

            case 'invoice.paid': {
                const invoice = event.data.object;
                const subscriptionId = invoice.subscription;

                if (!subscriptionId) break;

                // Find company
                const [company] = await db
                    .select({
                        id: companies.id,
                        stripePriceId: companies.stripePriceId,
                    })
                    .from(companies)
                    .where(eq(companies.stripeSubscriptionId, subscriptionId))
                    .limit(1);

                if (!company) break;

                // Find the plan to get credit allocation
                let creditsToGrant = 0;
                if (company.stripePriceId) {
                    const [plan] = await db
                        .select({ credits: subscriptionPlans.creditsIncluded })
                        .from(subscriptionPlans)
                        .where(eq(subscriptionPlans.stripeMonthlyPriceId, company.stripePriceId))
                        .limit(1);

                    if (plan) {
                        creditsToGrant = plan.credits;
                    } else {
                        // Try annual price
                        const [annualPlan] = await db
                            .select({ credits: subscriptionPlans.creditsIncluded })
                            .from(subscriptionPlans)
                            .where(eq(subscriptionPlans.stripeAnnualPriceId, company.stripePriceId))
                            .limit(1);

                        if (annualPlan) {
                            creditsToGrant = annualPlan.credits;
                        }
                    }
                }

                if (creditsToGrant > 0) {
                    // Reset period credits and add monthly allocation
                    await db
                        .update(companies)
                        .set({
                            creditBalance: creditsToGrant,
                            monthlyCreditsAllocation: creditsToGrant,
                            periodCreditsUsed: 0,
                            subscriptionStatus: 'active',
                            updatedAt: new Date(),
                        })
                        .where(eq(companies.id, company.id));

                    // Log the transaction
                    await db.insert(creditTransactions).values({
                        companyId: company.id,
                        amount: creditsToGrant,
                        type: 'subscription_grant',
                        description: `Monthly subscription credits: ${creditsToGrant}`,
                        balanceAfter: creditsToGrant,
                    });

                    console.log(`[Stripe] Granted ${creditsToGrant} credits to company ${company.id}`);
                }
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object;
                const subscriptionId = invoice.subscription;

                if (!subscriptionId) break;

                // Mark as past_due
                await db
                    .update(companies)
                    .set({
                        subscriptionStatus: 'past_due',
                        updatedAt: new Date(),
                    })
                    .where(eq(companies.stripeSubscriptionId, subscriptionId));

                console.log(`[Stripe] Payment failed for subscription ${subscriptionId}`);
                break;
            }

            default:
                console.log(`[Stripe] Unhandled event type: ${event.type}`);
        }
    } catch (err: any) {
        console.error('[Stripe] Webhook handler error:', err);
        return c.json({ error: 'Webhook handler failed' }, 500);
    }

    return c.json({ received: true });
});

export default stripeWebhooks;
