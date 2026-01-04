#!/usr/bin/env node
/**
 * Sync Phone Numbers Migration
 * 
 * One-time script to populate company_phone_numbers from existing properties.supportPhoneE164
 * This ensures call forwarding credits are properly charged.
 * 
 * Usage: DATABASE_URL=<connection_string> node scripts/sync-phone-numbers.mjs
 */

import postgres from 'postgres';

async function main() {
    const DATABASE_URL = process.env.DATABASE_URL;
    if (!DATABASE_URL) {
        console.error('DATABASE_URL is required');
        process.exit(1);
    }

    const sql = postgres(DATABASE_URL);

    try {
        console.log('Fetching properties with phone numbers...');

        // Get all properties that have supportPhoneE164 set
        const propertiesWithPhones = await sql`
            SELECT DISTINCT p.company_id, p.support_phone_e164
            FROM properties p
            WHERE p.support_phone_e164 IS NOT NULL
              AND p.support_phone_e164 != ''
        `;

        console.log(`Found ${propertiesWithPhones.length} properties with phone numbers`);

        let inserted = 0;
        let skipped = 0;

        for (const prop of propertiesWithPhones) {
            try {
                await sql`
                    INSERT INTO company_phone_numbers (company_id, phone_e164, is_active)
                    VALUES (${prop.company_id}, ${prop.support_phone_e164}, true)
                    ON CONFLICT (phone_e164) DO UPDATE SET
                        company_id = EXCLUDED.company_id,
                        is_active = true
                `;
                inserted++;
                console.log(`  ✓ Synced ${prop.support_phone_e164} -> Company ${prop.company_id}`);
            } catch (err) {
                console.error(`  ✗ Failed to sync ${prop.support_phone_e164}:`, err.message);
                skipped++;
            }
        }

        console.log('\n--- Summary ---');
        console.log(`Total properties with phones: ${propertiesWithPhones.length}`);
        console.log(`Successfully synced: ${inserted}`);
        console.log(`Skipped/failed: ${skipped}`);

        // Show final state
        const phoneNumbers = await sql`SELECT * FROM company_phone_numbers`;
        console.log(`\nTotal entries in company_phone_numbers: ${phoneNumbers.length}`);
        for (const pn of phoneNumbers) {
            console.log(`  ${pn.phone_e164} -> Company ${pn.company_id}`);
        }

    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await sql.end();
    }
}

main();
