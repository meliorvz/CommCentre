/**
 * Seed Super Admin User Script
 * 
 * Creates the devops@melior.group super admin user for both dev and prod environments.
 * 
 * Usage:
 *   DATABASE_URL=<your-database-url> node scripts/seed-super-admin.js
 * 
 * The password will be prompted interactively to avoid it being stored in command history.
 * 
 * IMPORTANT: After running this script, immediately change the password through the UI
 * or by running this script again with the new password.
 */

import { neon } from '@neondatabase/serverless';
import * as readline from 'readline';
import { createHash } from 'crypto';

const SUPER_ADMIN_EMAIL = 'devops@melior.group';

// SHA-256 password hashing (matches the auth.ts implementation)
function hashPassword(password) {
    return createHash('sha256').update(password).digest('hex');
}

async function promptPassword(prompt) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        // Hide password input
        process.stdout.write(prompt);

        let password = '';
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf8');

        const inputHandler = (char) => {
            if (char === '\n' || char === '\r') {
                process.stdin.setRawMode(false);
                process.stdin.removeListener('data', inputHandler);
                process.stdout.write('\n');
                rl.close();
                resolve(password);
            } else if (char === '\u0003') {
                // Ctrl+C
                process.exit();
            } else if (char === '\u007F' || char === '\b') {
                // Backspace
                if (password.length > 0) {
                    password = password.slice(0, -1);
                    process.stdout.clearLine(0);
                    process.stdout.cursorTo(0);
                    process.stdout.write(prompt + '*'.repeat(password.length));
                }
            } else {
                password += char;
                process.stdout.write('*');
            }
        };

        process.stdin.on('data', inputHandler);
    });
}

async function seedSuperAdmin() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error('❌ DATABASE_URL environment variable not set');
        console.log('\nUsage: DATABASE_URL=<your-database-url> node scripts/seed-super-admin.js');
        process.exit(1);
    }

    console.log('='.repeat(60));
    console.log('  Paradise Comms Centre - Super Admin Seed Script');
    console.log('='.repeat(60));
    console.log(`\nEmail: ${SUPER_ADMIN_EMAIL}`);
    console.log('Role: super_admin (platform-wide access)\n');

    const sql = neon(databaseUrl);

    // Check if user already exists
    const existing = await sql`SELECT id, email FROM users WHERE email = ${SUPER_ADMIN_EMAIL}`;

    if (existing.length > 0) {
        console.log('⚠️  User already exists!');
        console.log(`   ID: ${existing[0].id}`);
        console.log(`   Email: ${existing[0].email}`);
        console.log('');

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const answer = await new Promise(resolve => {
            rl.question('Do you want to update the password? (y/N): ', resolve);
        });
        rl.close();

        if (answer.toLowerCase() !== 'y') {
            console.log('Aborted.');
            process.exit(0);
        }

        // Update password
        const password = await promptPassword('Enter new password: ');
        const confirmPassword = await promptPassword('Confirm password: ');

        if (password !== confirmPassword) {
            console.error('❌ Passwords do not match');
            process.exit(1);
        }

        if (password.length < 8) {
            console.error('❌ Password must be at least 8 characters');
            process.exit(1);
        }

        const passwordHash = hashPassword(password);

        await sql`UPDATE users SET password_hash = ${passwordHash} WHERE email = ${SUPER_ADMIN_EMAIL}`;
        console.log('\n✅ Password updated successfully!');

    } else {
        // Create new user
        console.log('Creating new super admin user...\n');

        const password = await promptPassword('Enter password: ');
        const confirmPassword = await promptPassword('Confirm password: ');

        if (password !== confirmPassword) {
            console.error('❌ Passwords do not match');
            process.exit(1);
        }

        if (password.length < 8) {
            console.error('❌ Password must be at least 8 characters');
            process.exit(1);
        }

        const passwordHash = hashPassword(password);

        try {
            const result = await sql`
                INSERT INTO users (email, password_hash, role, company_id)
                VALUES (${SUPER_ADMIN_EMAIL}, ${passwordHash}, 'super_admin', NULL)
                RETURNING id, email, role
            `;

            console.log('\n✅ Super admin user created successfully!');
            console.log(`   ID: ${result[0].id}`);
            console.log(`   Email: ${result[0].email}`);
            console.log(`   Role: ${result[0].role}`);
        } catch (err) {
            console.error('❌ Error creating user:', err.message);
            process.exit(1);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('  You can now login at:');
    console.log('  Dev:  https://dev.paradisestayz.com.au');
    console.log('  Prod: https://comms.paradisestayz.com.au');
    console.log('='.repeat(60) + '\n');
}

seedSuperAdmin().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
