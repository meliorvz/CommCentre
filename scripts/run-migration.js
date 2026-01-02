// Run migration using @neondatabase/serverless
// Usage: node scripts/run-migration.js

import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigration() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error('DATABASE_URL environment variable not set');
        process.exit(1);
    }

    const sql = neon(databaseUrl);

    const migrationPath = path.join(__dirname, '../src/db/migrations/manual_stripe_migration.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    // Split by statement and run each
    const statements = migrationSql
        .split(/;[\s]*(?=--|CREATE|ALTER|UPDATE|DROP|DO)/)
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`Running ${statements.length} SQL statements...`);

    for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        const preview = stmt.slice(0, 60).replace(/\n/g, ' ');
        console.log(`[${i + 1}/${statements.length}] ${preview}...`);

        try {
            await sql(stmt);
            console.log('  ✓ OK');
        } catch (err) {
            console.error('  ✗ Error:', err.message);
            // Continue with other statements
        }
    }

    console.log('\nMigration complete!');
}

runMigration().catch(console.error);
