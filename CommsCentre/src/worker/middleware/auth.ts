import { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import * as jose from 'jose';
import { Env, JWTPayload } from '../../types';

declare module 'hono' {
    interface ContextVariableMap {
        user: JWTPayload;
    }
}

export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
    const token = getCookie(c, 'session');

    if (!token) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    try {
        const secret = new TextEncoder().encode(c.env.JWT_SECRET);
        const { payload } = await jose.jwtVerify(token, secret);

        c.set('user', payload as unknown as JWTPayload);
        await next();
    } catch (err) {
        console.error('JWT verification failed:', err);
        return c.json({ error: 'Invalid session' }, 401);
    }
}

export async function adminOnlyMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
    const user = c.get('user');

    if (user.role !== 'admin') {
        return c.json({ error: 'Forbidden: admin access required' }, 403);
    }

    await next();
}

export async function createSessionToken(
    env: Env,
    userId: string,
    email: string,
    role: 'admin' | 'staff'
): Promise<string> {
    const secret = new TextEncoder().encode(env.JWT_SECRET);

    const token = await new jose.SignJWT({
        sub: userId,
        email,
        role,
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('14d')
        .sign(secret);

    return token;
}
