import { neon } from '@neondatabase/serverless';

const greenBush = 'postgresql://neondb_owner:npg_hlcxe4oRPpW2@ep-weathered-breeze-a7as8gm0.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
    const sql = neon(greenBush);
    console.log('Fetching users and companies from Green Bush...');

    try {
        const users = await sql`SELECT email, role, company_id FROM users`;
        console.log('Users:', JSON.stringify(users, null, 2));

        const companiesResult = await sql`SELECT id, name, features_enabled FROM companies`;
        console.log('Companies:', JSON.stringify(companiesResult, null, 2));

        if (companiesResult.length > 0) {
            for (const company of companiesResult) {
                const currentFeatures = company.features_enabled || {};
                const updatedFeatures = { ...currentFeatures, integrations: true };

                await sql`
                    UPDATE companies 
                    SET features_enabled = ${JSON.stringify(updatedFeatures)} 
                    WHERE id = ${company.id}
                `;
                console.log(`Enabled 'integrations' for company: ${company.name} (${company.id})`);
            }
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
}

main();
