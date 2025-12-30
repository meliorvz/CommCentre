#!/usr/bin/env node
/**
 * Multi-Tenant Migration Script (Step by Step)
 * 
 * Run with: DATABASE_URL=... node scripts/run-migration-v2.mjs
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
}

const sql = neon(DATABASE_URL);

async function run(query, description) {
    process.stdout.write(`${description}... `);
    try {
        await sql(query);
        console.log('✅');
        return true;
    } catch (err) {
        if (err.message.includes('already exists') || err.message.includes('duplicate')) {
            console.log('⏭️  (already exists)');
            return true;
        }
        console.log(`❌ ${err.message.substring(0, 100)}`);
        return false;
    }
}

async function runMigration() {
    console.log('🚀 Starting multi-tenant migration (v2)...\n');

    // Step 1: Add enum values
    console.log('📦 Step 1: Updating user_role enum...');
    await run(`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin'`, 'Add super_admin');
    await run(`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'company_admin'`, 'Add company_admin');
    await run(`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'property_manager'`, 'Add property_manager');

    // Step 2: Create company_status enum
    console.log('\n📦 Step 2: Creating company_status enum...');
    await run(`CREATE TYPE company_status AS ENUM ('active', 'suspended', 'trial')`, 'Create company_status');

    // Step 3: Create credit_transaction_type enum
    console.log('\n📦 Step 3: Creating credit_transaction_type enum...');
    await run(`
        CREATE TYPE credit_transaction_type AS ENUM (
            'purchase', 'sms_usage', 'sms_manual_usage', 'email_usage', 
            'email_manual_usage', 'phone_rental', 'email_rental', 
            'trial_grant', 'adjustment', 'refund'
        )
    `, 'Create credit_transaction_type');

    // Step 4: Create companies table
    console.log('\n📦 Step 4: Creating companies table...');
    await run(`
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
        )
    `, 'Create companies table');

    // Step 5: Create credit_transactions table
    console.log('\n📦 Step 5: Creating credit_transactions table...');
    await run(`
        CREATE TABLE IF NOT EXISTS credit_transactions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            amount INTEGER NOT NULL,
            type credit_transaction_type NOT NULL,
            reference_id UUID,
            reference_type TEXT,
            description TEXT,
            balance_after INTEGER NOT NULL,
            created_by UUID,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `, 'Create credit_transactions table');

    // Step 6: Create company_phone_numbers table
    console.log('\n📦 Step 6: Creating company_phone_numbers table...');
    await run(`
        CREATE TABLE IF NOT EXISTS company_phone_numbers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            phone_e164 TEXT NOT NULL UNIQUE,
            twilio_sid TEXT,
            monthly_credits INTEGER NOT NULL DEFAULT 50,
            is_active BOOLEAN NOT NULL DEFAULT true,
            allocated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_billed_at TIMESTAMPTZ
        )
    `, 'Create company_phone_numbers table');

    // Step 7: Create company_email_addresses table
    console.log('\n📦 Step 7: Creating company_email_addresses table...');
    await run(`
        CREATE TABLE IF NOT EXISTS company_email_addresses (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            email TEXT NOT NULL UNIQUE,
            monthly_credits INTEGER NOT NULL DEFAULT 20,
            is_active BOOLEAN NOT NULL DEFAULT true,
            allocated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_billed_at TIMESTAMPTZ
        )
    `, 'Create company_email_addresses table');

    // Step 8: Create credit_config table
    console.log('\n📦 Step 8: Creating credit_config table...');
    await run(`
        CREATE TABLE IF NOT EXISTS credit_config (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            key TEXT NOT NULL UNIQUE,
            value INTEGER NOT NULL,
            estimated_cost_cents INTEGER,
            description TEXT,
            updated_by UUID,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `, 'Create credit_config table');

    // Step 9: Create platform_settings table
    console.log('\n📦 Step 9: Creating platform_settings table...');
    await run(`
        CREATE TABLE IF NOT EXISTS platform_settings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            key TEXT NOT NULL UNIQUE,
            value TEXT NOT NULL,
            description TEXT,
            updated_by UUID,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `, 'Create platform_settings table');

    // Step 10: Add company_id to users
    console.log('\n📦 Step 10: Adding company_id to users table...');
    await run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE`, 'Add company_id to users');

    // Step 11: Add company_id to properties
    console.log('\n📦 Step 11: Adding company_id to properties table...');
    await run(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE`, 'Add company_id to properties');

    // Step 12: Add company_id to audit_log
    console.log('\n📦 Step 12: Adding company_id to audit_log table...');
    await run(`ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE`, 'Add company_id to audit_log');

    // Step 13: Add credits_deducted to messages
    console.log('\n📦 Step 13: Adding credits_deducted to messages table...');
    await run(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS credits_deducted INTEGER`, 'Add credits_deducted to messages');

    // Step 14: Create default company
    console.log('\n📦 Step 14: Creating default company...');
    const companies = await sql`SELECT id FROM companies WHERE slug = 'paradise-stayz' LIMIT 1`;

    let companyId;
    if (companies.length === 0) {
        const result = await sql`
            INSERT INTO companies (name, slug, status, credit_balance, trial_credits_granted)
            VALUES ('Paradise Stayz', 'paradise-stayz', 'active', 1000, 1000)
            RETURNING id
        `;
        companyId = result[0].id;
        console.log(`   Created company with ID: ${companyId}`);
    } else {
        companyId = companies[0].id;
        console.log(`   Company already exists with ID: ${companyId}`);
    }

    // Step 15: Associate existing users with default company
    console.log('\n📦 Step 15: Associating existing users with default company...');
    await run(`UPDATE users SET company_id = '${companyId}' WHERE company_id IS NULL`, 'Update users');

    // Step 16: Associate existing properties with default company  
    console.log('\n📦 Step 16: Associating existing properties with default company...');
    await run(`UPDATE properties SET company_id = '${companyId}' WHERE company_id IS NULL`, 'Update properties');

    // Step 17: Make first admin a super_admin
    console.log('\n📦 Step 17: Upgrading first admin to super_admin...');
    const firstAdmin = await sql`SELECT id, email FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1`;
    if (firstAdmin.length > 0) {
        await run(`UPDATE users SET role = 'super_admin' WHERE id = '${firstAdmin[0].id}'`, `Upgrade ${firstAdmin[0].email} to super_admin`);
    }

    // Step 18: Insert default credit config
    console.log('\n📦 Step 18: Inserting default credit configuration...');
    const configs = [
        { key: 'sms_ai_cost', value: 2, cost: 5, desc: 'Credits per SMS AI reply' },
        { key: 'sms_manual_cost', value: 1, cost: 3, desc: 'Credits per SMS manual reply' },
        { key: 'email_ai_cost', value: 2, cost: 2, desc: 'Credits per email AI reply' },
        { key: 'email_manual_cost', value: 1, cost: 1, desc: 'Credits per email manual reply' },
        { key: 'phone_monthly_cost', value: 50, cost: 200, desc: 'Credits per phone number per month' },
        { key: 'email_monthly_cost', value: 20, cost: 50, desc: 'Credits per email address per month' },
        { key: 'trial_credits', value: 200, cost: 1000, desc: 'Credits granted to new companies' },
    ];

    for (const c of configs) {
        await run(`
            INSERT INTO credit_config (key, value, estimated_cost_cents, description)
            VALUES ('${c.key}', ${c.value}, ${c.cost}, '${c.desc}')
            ON CONFLICT (key) DO NOTHING
        `, `Insert ${c.key}`);
    }

    // Step 19: Insert default platform settings
    console.log('\n📦 Step 19: Inserting default platform settings...');
    const settings = [
        { key: 'credit_exhaustion_reminder_enabled', value: 'true', desc: 'Send reminders when credits are low' },
        { key: 'credit_exhaustion_threshold', value: '50', desc: 'Credits threshold for warning' },
        { key: 'auto_suspend_on_zero', value: 'true', desc: 'Suspend companies when credits hit zero' },
        { key: 'stripe_integration_enabled', value: 'false', desc: 'Enable Stripe self-service (hidden for now)' },
    ];

    for (const s of settings) {
        await run(`
            INSERT INTO platform_settings (key, value, description)
            VALUES ('${s.key}', '${s.value}', '${s.desc}')
            ON CONFLICT (key) DO NOTHING
        `, `Insert ${s.key}`);
    }

    // Step 20: Create indexes
    console.log('\n📦 Step 20: Creating indexes...');
    await run(`CREATE INDEX IF NOT EXISTS idx_credit_transactions_company ON credit_transactions(company_id)`, 'Index credit_transactions');
    await run(`CREATE INDEX IF NOT EXISTS idx_credit_transactions_created ON credit_transactions(created_at)`, 'Index credit_transactions created');
    await run(`CREATE INDEX IF NOT EXISTS idx_company_phone_numbers_company ON company_phone_numbers(company_id)`, 'Index company_phone_numbers');
    await run(`CREATE INDEX IF NOT EXISTS idx_company_email_addresses_company ON company_email_addresses(company_id)`, 'Index company_email_addresses');
    await run(`CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id)`, 'Index users');
    await run(`CREATE INDEX IF NOT EXISTS idx_properties_company ON properties(company_id)`, 'Index properties');

    // Verification
    console.log('\n🔍 Verifying migration...');

    const companyCount = await sql`SELECT COUNT(*) as count FROM companies`;
    console.log(`   ✅ companies: ${companyCount[0].count} rows`);

    const configCount = await sql`SELECT COUNT(*) as count FROM credit_config`;
    console.log(`   ✅ credit_config: ${configCount[0].count} rows`);

    const settingsCount = await sql`SELECT COUNT(*) as count FROM platform_settings`;
    console.log(`   ✅ platform_settings: ${settingsCount[0].count} rows`);

    const users = await sql`SELECT email, role, company_id FROM users LIMIT 5`;
    console.log(`   ✅ users with company_id:`);
    for (const u of users) {
        console.log(`      - ${u.email}: role=${u.role}, company_id=${u.company_id}`);
    }

    console.log('\n✨ Migration complete!');
}

runMigration().catch(err => {
    console.error('💥 Migration failed:', err);
    process.exit(1);
});
