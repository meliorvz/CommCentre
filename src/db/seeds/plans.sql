-- Seed subscription plans
-- Prices in SGD

INSERT INTO subscription_plans (
    name, 
    stripe_monthly_price_id, 
    stripe_annual_price_id, 
    monthly_price_cents, 
    annual_price_cents, 
    credits_included, 
    overage_price_cents, 
    allows_integrations, 
    display_order,
    is_active
) VALUES 
-- Starter Plan (Production Stripe Price IDs)
('Starter', 'price_1SliTeRv2SiPmGlJYg2wDrb3', 'price_1SliTeRv2SiPmGlJnTzzRUzj', 2900, 27800, 200, 20, false, 1, true)
ON CONFLICT DO NOTHING;
