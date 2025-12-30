import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
}

const email = process.argv[2] || 'admin@example.com';
const password = process.argv[3] || 'admin123';

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function createAdminUser() {
    const sql = neon(DATABASE_URL);
    const passwordHash = await hashPassword(password);

    try {
        const result = await sql`
      INSERT INTO users (email, password_hash, role)
      VALUES (${email}, ${passwordHash}, 'admin')
      RETURNING id, email, role
    `;

        console.log('✅ Admin user created successfully:');
        console.log(`   Email: ${result[0].email}`);
        console.log(`   Role: ${result[0].role}`);
        console.log(`   ID: ${result[0].id}`);
        console.log(`\nYou can now login with:`);
        console.log(`   Email: ${email}`);
        console.log(`   Password: ${password}`);
    } catch (err) {
        if (err.message?.includes('unique constraint')) {
            console.log('⚠️  User already exists with that email');
        } else {
            console.error('❌ Failed to create user:', err.message);
        }
    }
}

createAdminUser();
