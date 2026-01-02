import { Hono } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import { eq } from 'drizzle-orm';
import { Env, loginRequestSchema } from '../../types';
import { createDb, users, companies } from '../../db';
import { createSessionToken } from '../middleware/auth';

const auth = new Hono<{ Bindings: Env }>();

// Simple password verification (using Web Crypto for Argon2id-like hashing)
// In production, consider using a proper Argon2id implementation
async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
    const passwordHash = await hashPassword(password);
    return passwordHash === hash;
}

auth.post('/login', async (c) => {
    const body = await c.req.json();
    const parsed = loginRequestSchema.safeParse(body);

    if (!parsed.success) {
        return c.json({ error: 'Invalid request', details: parsed.error.issues }, 400);
    }

    const { email, password } = parsed.data;
    const db = createDb(c.env.DATABASE_URL);

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user) {
        return c.json({ error: 'Invalid email or password' }, 401);
    }

    const isValid = await verifyPassword(password, user.passwordHash);

    if (!isValid) {
        return c.json({ error: 'Invalid email or password' }, 401);
    }

    // Get company info if user has a company
    let companyName: string | undefined;
    if (user.companyId) {
        const [company] = await db
            .select({ name: companies.name })
            .from(companies)
            .where(eq(companies.id, user.companyId))
            .limit(1);
        companyName = company?.name;
    }

    const token = await createSessionToken(
        c.env,
        user.id,
        user.email,
        user.role,
        user.companyId || undefined,
        companyName
    );

    setCookie(c, 'session', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'None', // Required for cross-site requests (frontend on pages.dev, backend on workers.dev)
        maxAge: 60 * 60 * 24 * 14, // 14 days
        path: '/',
    });

    return c.json({
        user: {
            id: user.id,
            email: user.email,
            role: user.role,
            companyId: user.companyId,
            companyName,
        },
    });
});

auth.post('/logout', async (c) => {
    deleteCookie(c, 'session');
    return c.json({ success: true });
});

auth.get('/me', async (c) => {
    const token = c.req.header('Cookie')?.match(/session=([^;]+)/)?.[1];

    if (!token) {
        return c.json({ user: null });
    }

    try {
        const secret = new TextEncoder().encode(c.env.JWT_SECRET);
        const { payload } = await (await import('jose')).jwtVerify(token, secret);

        return c.json({
            user: {
                id: payload.sub,
                email: payload.email,
                role: payload.role,
                companyId: payload.companyId,
                companyName: payload.companyName,
            },
        });
    } catch {
        return c.json({ user: null });
    }
});

// Admin-only: Create user (legacy - use /api/users instead)


export default auth;
