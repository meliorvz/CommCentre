// Run seed using @neondatabase/serverless
// Usage: node scripts/seed-plans.js

import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runSeed() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error('DATABASE_URL environment variable not set');
        process.exit(1);
    }

    const sql = neon(databaseUrl);

    const seedPath = path.join(__dirname, '../src/db/seeds/plans.sql');
    const seedSql = fs.readFileSync(seedPath, 'utf8');

    console.log('Running seed...');

    try {
        await sql(seedSql);
        console.log('✓ Plans inserted successfully');
    } catch (err) {
        console.error('✗ Error seeding plans:', err.message);
        process.exit(1);
    }
}

runSeed().catch(console.error);
