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
-- Starter Plan
('Starter', 'price_1SkJDlRv2SiPmGlJDOVp7l1i', 'price_1SkJDlRv2SiPmGlJVAcTXf6R', 2900, 27800, 200, 20, false, 1, true),

-- Growth Plan
('Growth', 'price_1SkJEKRv2SiPmGlJjWCYV6jd', 'price_1SkJF3Rv2SiPmGlJn6BKcYSx', 7900, 75800, 600, 18, false, 2, true),

-- Pro Plan
('Pro', 'price_1SkJFnRv2SiPmGlJpiIeJ3N6', 'price_1SkJGGRv2SiPmGlJv9yM2tZv', 19900, 191100, 2000, 15, true, 3, true)
ON CONFLICT DO NOTHING;
