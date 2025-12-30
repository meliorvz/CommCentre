-- Multi-Tenant Credit System Migration
-- Run this against your Neon database

-- ============================================================================
-- NEW ENUMS
-- ============================================================================

-- Update user_role enum to include new roles
-- Note: PostgreSQL doesn't allow easy enum modification, so we create a new one
DO $$
BEGIN
    -- Check if new roles already exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role' AND EXISTS (
        SELECT 1 FROM pg_enum WHERE enumtypid = pg_type.oid AND enumlabel = 'super_admin'
    )) THEN
        -- Add new enum values
        ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin' BEFORE 'admin';
        ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'company_admin' AFTER 'admin';
        ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'property_manager' AFTER 'company_admin';
    END IF;
END$$;

-- Company status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'company_status') THEN
        CREATE TYPE company_status AS ENUM ('active', 'suspended', 'trial');
    END IF;
END$$;

-- Credit transaction type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credit_transaction_type') THEN
        CREATE TYPE credit_transaction_type AS ENUM (
            'purchase',
            'sms_usage',
            'sms_manual_usage',
            'email_usage',
            'email_manual_usage',
            'phone_rental',
            'email_rental',
            'trial_grant',
            'adjustment',
            'refund'
        );
    END IF;
END$$;

-- ============================================================================
-- NEW TABLES
-- ============================================================================

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    status company_status NOT NULL DEFAULT 'trial',
    credit_balance INTEGER NOT NULL DEFAULT 0,
    allow_negative_balance BOOLEAN NOT NULL DEFAULT false,
    trial_credits_granted INTEGER NOT NULL DEFAULT 0,
    escalation_phone TEXT,
    escalation_email TEXT,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Credit transactions table
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    type credit_transaction_type NOT NULL,
    reference_id UUID,
    reference_type TEXT,
    description TEXT,
    balance_after INTEGER NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Company phone numbers table
CREATE TABLE IF NOT EXISTS company_phone_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    phone_e164 TEXT NOT NULL UNIQUE,
    twilio_sid TEXT,
    monthly_credits INTEGER NOT NULL DEFAULT 50,
    is_active BOOLEAN NOT NULL DEFAULT true,
    allocated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_billed_at TIMESTAMPTZ
);

-- Company email addresses table
CREATE TABLE IF NOT EXISTS company_email_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    monthly_credits INTEGER NOT NULL DEFAULT 20,
    is_active BOOLEAN NOT NULL DEFAULT true,
    allocated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_billed_at TIMESTAMPTZ
);

-- Credit configuration table (platform-wide pricing)
CREATE TABLE IF NOT EXISTS credit_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value INTEGER NOT NULL,
    estimated_cost_cents INTEGER,
    description TEXT,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Platform settings table
CREATE TABLE IF NOT EXISTS platform_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- MODIFY EXISTING TABLES
-- ============================================================================

-- Add company_id to users (nullable for super_admin)
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Add company_id to properties (required)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Add company_id to audit_log
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Add credits_deducted to messages for auditing
ALTER TABLE messages ADD COLUMN IF NOT EXISTS credits_deducted INTEGER;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_credit_transactions_company ON credit_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created ON credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_phone_numbers_company ON company_phone_numbers(company_id);
CREATE INDEX IF NOT EXISTS idx_company_email_addresses_company ON company_email_addresses(company_id);
CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_properties_company ON properties(company_id);

-- ============================================================================
-- DEFAULT CREDIT CONFIGURATION
-- ============================================================================

INSERT INTO credit_config (key, value, estimated_cost_cents, description)
VALUES 
    ('sms_ai_cost', 2, 5, 'Credits per AI-generated SMS reply'),
    ('sms_manual_cost', 1, 3, 'Credits per human SMS reply'),
    ('email_ai_cost', 2, 2, 'Credits per AI-generated email reply'),
    ('email_manual_cost', 1, 1, 'Credits per human email reply'),
    ('phone_monthly_cost', 50, 200, 'Monthly credits per phone number'),
    ('email_monthly_cost', 20, 50, 'Monthly credits per email address'),
    ('trial_credits', 200, 1000, 'Credits granted to new trial accounts')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- PLATFORM SETTINGS DEFAULTS
-- ============================================================================

INSERT INTO platform_settings (key, value, description)
VALUES 
    ('credit_exhaustion_reminder_enabled', 'true', 'Send reminders when company credits are low'),
    ('credit_exhaustion_threshold', '50', 'Credit balance threshold for warnings'),
    ('auto_suspend_on_zero', 'true', 'Automatically suspend companies with zero credits (unless allowNegative)'),
    ('stripe_integration_enabled', 'false', 'Enable Stripe self-service credit purchase')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- MIGRATION: CREATE DEFAULT COMPANY FOR EXISTING DATA
-- ============================================================================

-- Create default company "Paradise Stayz" for existing data migration
INSERT INTO companies (id, name, slug, status, credit_balance, allow_negative_balance)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Paradise Stayz',
    'paradise-stayz',
    'active',
    10000,  -- Give existing company plenty of credits to start
    true    -- Allow negative balance for existing customer
)
ON CONFLICT DO NOTHING;

-- Associate existing properties with default company
UPDATE properties 
SET company_id = 'a0000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

-- Associate existing users with default company (except we'll make one super_admin)
-- First, identify the first admin user and make them super_admin
WITH first_admin AS (
    SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1
)
UPDATE users 
SET role = 'super_admin', company_id = NULL
FROM first_admin
WHERE users.id = first_admin.id;

-- Associate remaining users with default company
UPDATE users 
SET company_id = 'a0000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL AND role != 'super_admin';

-- Update remaining admins to company_admin
UPDATE users 
SET role = 'company_admin'
WHERE role = 'admin' AND company_id IS NOT NULL;

-- ============================================================================
-- MAKE company_id NOT NULL on properties (after migration)
-- ============================================================================

-- This should be run AFTER verifying all properties have a company_id
-- ALTER TABLE properties ALTER COLUMN company_id SET NOT NULL;

COMMIT;
