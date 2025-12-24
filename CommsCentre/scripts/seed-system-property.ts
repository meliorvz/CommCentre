import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../src/db/schema';

const SYSTEM_PROPERTY_ID = '00000000-0000-0000-0000-000000000000';

async function seed() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error('DATABASE_URL is not set');
        process.exit(1);
    }

    const sql = neon(databaseUrl);
    const db = drizzle(sql, { schema });

    console.log('Seeding System Property...');

    try {
        await db.insert(schema.properties).values({
            id: SYSTEM_PROPERTY_ID,
            name: 'System / Unassigned',
            addressText: 'N/A',
            timezone: 'Australia/Sydney',
            status: 'active',
        }).onConflictDoUpdate({
            target: schema.properties.id,
            set: { name: 'System / Unassigned' }
        });

        console.log('System Property seeded successfully.');
    } catch (error) {
        console.error('Error seeding System Property:', error);
        process.exit(1);
    }
}

seed();
