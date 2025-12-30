import { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import * as jose from 'jose';
import { Env, JWTPayload } from '../../types';

// Extended JWT payload with company info
export interface ExtendedJWTPayload extends JWTPayload {
    companyId?: string;
    companyName?: string;
}

declare module 'hono' {
    interface ContextVariableMap {
        user: ExtendedJWTPayload;
    }
}

export type UserRole = 'super_admin' | 'company_admin' | 'property_manager' | 'staff';

/**
 * Main authentication middleware
 * Validates JWT and sets user context including company info
 */
export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
    const token = getCookie(c, 'session');

    if (!token) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    try {
        const secret = new TextEncoder().encode(c.env.JWT_SECRET);
        const { payload } = await jose.jwtVerify(token, secret);

        c.set('user', payload as unknown as ExtendedJWTPayload);
        await next();
    } catch (err) {
        console.error('JWT verification failed:', err);
        return c.json({ error: 'Invalid session' }, 401);
    }
}

/**
 * Super admin only middleware - for platform-level operations
 */
export async function superAdminMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
    const user = c.get('user');

    if (user.role !== 'super_admin') {
        return c.json({ error: 'Forbidden: super admin access required' }, 403);
    }

    await next();
}

/**
 * Admin middleware - allows super_admin or company_admin
 */
export async function adminOnlyMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
    const user = c.get('user');

    if (user.role !== 'super_admin' && user.role !== 'company_admin' && user.role !== 'admin') {
        return c.json({ error: 'Forbidden: admin access required' }, 403);
    }

    await next();
}

/**
 * Company scoped middleware - ensures user has access to the company
 * Super admins can access any company, others only their own
 */
export async function companyScopedMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
    const user = c.get('user');
    const requestedCompanyId = c.req.param('companyId') || c.req.query('companyId');

    // Super admin can access any company
    if (user.role === 'super_admin') {
        await next();
        return;
    }

    // Others can only access their own company
    if (requestedCompanyId && requestedCompanyId !== user.companyId) {
        return c.json({ error: 'Forbidden: cannot access other company data' }, 403);
    }

    await next();
}

/**
 * Get the effective company ID for the current request
 * Super admins can specify any company, others use their own
 */
export function getEffectiveCompanyId(c: Context<{ Bindings: Env }>): string | null {
    const user = c.get('user');

    // Super admin can specify a company via query param
    if (user.role === 'super_admin') {
        const specifiedCompanyId = c.req.query('companyId');
        return specifiedCompanyId || null;
    }

    return user.companyId || null;
}

/**
 * Require a company context - fails if no company can be determined
 */
export function requireCompanyId(c: Context<{ Bindings: Env }>): string {
    const companyId = getEffectiveCompanyId(c);

    if (!companyId) {
        throw new Error('Company context required');
    }

    return companyId;
}

/**
 * Create a session token with extended payload including company info
 */
export async function createSessionToken(
    env: Env,
    userId: string,
    email: string,
    role: UserRole | 'admin' | 'staff',
    companyId?: string,
    companyName?: string
): Promise<string> {
    const secret = new TextEncoder().encode(env.JWT_SECRET);

    const payload: Record<string, any> = {
        sub: userId,
        email,
        role,
    };

    if (companyId) {
        payload.companyId = companyId;
    }

    if (companyName) {
        payload.companyName = companyName;
    }

    const token = await new jose.SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('14d')
        .sign(secret);

    return token;
}

/**
 * Check if user has at least the specified role level
 * Role hierarchy: super_admin > company_admin > property_manager > staff
 */
export function hasRoleLevel(userRole: UserRole | string, requiredRole: UserRole): boolean {
    const roleHierarchy: Record<string, number> = {
        'super_admin': 100,
        'company_admin': 80,
        'admin': 80, // Legacy support
        'property_manager': 60,
        'staff': 40,
    };

    const userLevel = roleHierarchy[userRole] ?? 0;
    const requiredLevel = roleHierarchy[requiredRole] ?? 0;

    return userLevel >= requiredLevel;
}

/**
 * Can user manage (create/edit/delete) other users?
 */
export function canManageUsers(userRole: UserRole | string): boolean {
    return hasRoleLevel(userRole, 'company_admin');
}

/**
 * Can user manage properties?
 */
export function canManageProperties(userRole: UserRole | string): boolean {
    return hasRoleLevel(userRole, 'property_manager');
}

/**
 * Can user view billing/credits?
 */
export function canViewBilling(userRole: UserRole | string): boolean {
    return hasRoleLevel(userRole, 'company_admin');
}

/**
 * Can user respond to messages?
 */
export function canRespondToMessages(userRole: UserRole | string): boolean {
    return hasRoleLevel(userRole, 'staff');
}
