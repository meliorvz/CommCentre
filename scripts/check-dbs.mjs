import { neon } from '@neondatabase/serverless';

async function check(url, label) {
    console.log(`--- Checking ${label} ---`);
    try {
        const sql = neon(url);
        const tables = await sql`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `;
        console.log('Tables:', tables.map(t => t.table_name).join(', '));

        const userCount = await sql`SELECT count(*) FROM users`;
        console.log('User count:', userCount[0].count);

        if (tables.map(t => t.table_name).includes('integration_configs')) {
            const intCount = await sql`SELECT count(*) FROM integration_configs`;
            console.log('Integration config count:', intCount[0].count);
        } else {
            console.log('integration_configs table NOT found');
        }
    } catch (err) {
        console.error(`Error checking ${label}:`, err.message);
    }
}

const luckyProd = 'postgresql://neondb_owner:npg_GUQVr6uqhd1C@ep-gentle-wind-a79sop8o.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';
const luckyDev = 'postgresql://neondb_owner:npg_GUQVr6uqhd1C@ep-gentle-wind-a79sop8o.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';
const greenBush = 'postgresql://neondb_owner:npg_hlcxe4oRPpW2@ep-weathered-breeze-a7as8gm0.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
    await check(luckyProd, 'Lucky Mode (Prod/Dev - same endpoint)');
    await check(greenBush, 'Green Bush (comms-centre project)');
}

main();
