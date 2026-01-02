-- Manual migration for Stripe subscription integration
-- Must be run before drizzle-kit push due to existing enum values

-- Step 1: Convert old enum values to new ones (before changing enum type)
UPDATE credit_transactions SET type = 'sms_usage' WHERE type = 'sms_manual_usage';
UPDATE credit_transactions SET type = 'email_usage' WHERE type = 'email_manual_usage';

-- Step 2: Create subscription_status enum if not exists
DO $$ BEGIN
    CREATE TYPE subscription_status AS ENUM('none', 'trialing', 'active', 'past_due', 'canceled', 'unpaid');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Step 3: Create subscription_plans table if not exists
CREATE TABLE IF NOT EXISTS subscription_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    stripe_monthly_price_id text,
    stripe_annual_price_id text,
    monthly_price_cents integer NOT NULL,
    annual_price_cents integer NOT NULL,
    credits_included integer NOT NULL,
    overage_price_cents integer NOT NULL,
    allows_integrations boolean DEFAULT false,
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Step 4: Add new columns to companies table (if not exist)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS stripe_price_id text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_status subscription_status DEFAULT 'none';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS current_period_start timestamp with time zone;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS current_period_end timestamp with time zone;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS monthly_credits_allocation integer DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS period_credits_used integer DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_annual boolean DEFAULT false;

-- Step 5: Update credit_transaction_type enum
-- First convert column to text
ALTER TABLE credit_transactions ALTER COLUMN type TYPE text;

-- Drop old enum and create new one
DROP TYPE IF EXISTS credit_transaction_type;
CREATE TYPE credit_transaction_type AS ENUM(
    'purchase',
    'sms_usage',
    'email_usage',
    'integration_sms_usage',
    'integration_email_usage',
    'call_forward_usage',
    'phone_rental',
    'email_rental',
    'trial_grant',
    'subscription_grant',
    'overage_charge',
    'adjustment',
    'refund'
);

-- Convert column back to enum
ALTER TABLE credit_transactions ALTER COLUMN type TYPE credit_transaction_type USING type::credit_transaction_type;
