#!/usr/bin/env node
/**
 * Multi-Tenant Migration Script
 * 
 * Run with: DATABASE_URL=... node scripts/run-migration.mjs
 * Or set DATABASE_URL in environment
 */

import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    console.log('\nUsage: DATABASE_URL=... node scripts/run-migration.mjs');
    console.log('\nYou can get the DATABASE_URL from:');
    console.log('  1. Neon Console → Your Project → Connection Details');
    console.log('  2. Or from Cloudflare Dashboard → Workers → Your Worker → Settings → Variables');
    process.exit(1);
}

async function runMigration() {
    console.log('🚀 Starting multi-tenant migration...');
    console.log(`📡 Connecting to database: ${DATABASE_URL.substring(0, 40)}...`);

    const sql = neon(DATABASE_URL);

    // Read migration file
    const migrationPath = path.join(__dirname, 'migrate-multi-tenant.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Split into statements (simple split, handles most cases)
    // Remove comments and split by semicolons
    const statements = migrationSQL
        .split(/;[\s]*\n/)
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📋 Found ${statements.length} SQL statements to execute`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        if (!stmt || stmt.length < 5) continue;

        // Extract first line for logging
        const firstLine = stmt.split('\n')[0].substring(0, 60);
        process.stdout.write(`  [${i + 1}/${statements.length}] ${firstLine}... `);

        try {
            await sql(stmt);
            console.log('✅');
            successCount++;
        } catch (err) {
            // Ignore certain "already exists" errors
            if (err.message.includes('already exists') ||
                err.message.includes('duplicate key') ||
                err.message.includes('relation') && err.message.includes('does not exist')) {
                console.log('⏭️  (skipped - already exists)');
                successCount++;
            } else {
                console.log(`❌ ${err.message.substring(0, 80)}`);
                errorCount++;
            }
        }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);

    // Verify key tables exist
    console.log('\n🔍 Verifying migration...');

    try {
        const companies = await sql`SELECT COUNT(*) as count FROM companies`;
        console.log(`   ✅ companies table: ${companies[0].count} rows`);
    } catch (err) {
        console.log(`   ❌ companies table: ${err.message}`);
    }

    try {
        const creditConfig = await sql`SELECT COUNT(*) as count FROM credit_config`;
        console.log(`   ✅ credit_config table: ${creditConfig[0].count} rows`);
    } catch (err) {
        console.log(`   ❌ credit_config table: ${err.message}`);
    }

    try {
        const users = await sql`SELECT id, email, role, company_id FROM users LIMIT 3`;
        console.log(`   ✅ users table updated:`);
        for (const u of users) {
            console.log(`      - ${u.email}: role=${u.role}, company_id=${u.company_id || 'NULL'}`);
        }
    } catch (err) {
        console.log(`   ❌ users verification: ${err.message}`);
    }

    console.log('\n✨ Migration complete!');
}

runMigration().catch(err => {
    console.error('💥 Migration failed:', err);
    process.exit(1);
});
