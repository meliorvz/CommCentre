import { Hono } from 'hono';
import { Env } from '../../types';
import { createDb, users, companies } from '../../db';
import { authMiddleware, adminOnlyMiddleware, superAdminMiddleware, getEffectiveCompanyId } from '../middleware/auth';
import { eq, and } from 'drizzle-orm';

const usersRouter = new Hono<{ Bindings: Env }>();

usersRouter.use('*', authMiddleware);
usersRouter.use('*', adminOnlyMiddleware);

// Valid roles for company users (super_admin can only be assigned via database)
const VALID_COMPANY_ROLES = ['company_admin', 'property_manager', 'staff'];

// Hash password using SHA-256 (same as create-admin script)
async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get company filter for user queries
 */
function getCompanyFilter(c: any) {
    const user = c.get('user');
    const companyId = getEffectiveCompanyId(c);

    if (user.role === 'super_admin' && !companyId) {
        return undefined; // No filter - see all
    }

    return companyId;
}

// List all users (scoped by company)
usersRouter.get('/', async (c) => {
    const db = createDb(c.env.DATABASE_URL);
    const companyId = getCompanyFilter(c);

    const conditions = companyId ? eq(users.companyId, companyId) : undefined;

    const allUsers = await db
        .select({
            id: users.id,
            email: users.email,
            role: users.role,
            companyId: users.companyId,
            createdAt: users.createdAt,
        })
        .from(users)
        .where(conditions)
        .orderBy(users.createdAt);

    return c.json({ users: allUsers });
});

// Get single user
usersRouter.get('/:id', async (c) => {
    const { id } = c.req.param();
    const db = createDb(c.env.DATABASE_URL);
    const companyId = getCompanyFilter(c);

    const conditions = [eq(users.id, id)];
    if (companyId) {
        conditions.push(eq(users.companyId, companyId));
    }

    const [user] = await db
        .select({
            id: users.id,
            email: users.email,
            role: users.role,
            companyId: users.companyId,
            createdAt: users.createdAt,
        })
        .from(users)
        .where(and(...conditions))
        .limit(1);

    if (!user) {
        return c.json({ error: 'User not found' }, 404);
    }

    // Get company name if applicable
    let companyName: string | undefined;
    if (user.companyId) {
        const [company] = await db
            .select({ name: companies.name })
            .from(companies)
            .where(eq(companies.id, user.companyId))
            .limit(1);
        companyName = company?.name;
    }

    return c.json({ user: { ...user, companyName } });
});

// Create new user (assigns to current user's company by default)
usersRouter.post('/', async (c) => {
    const currentUser = c.get('user');
    const body = await c.req.json();
    const { email, password, role = 'staff', companyId: requestedCompanyId } = body;

    if (!email || !password) {
        return c.json({ error: 'Email and password are required' }, 400);
    }

    if (password.length < 8) {
        return c.json({ error: 'Password must be at least 8 characters' }, 400);
    }

    // Determine company ID
    let companyId: string | undefined;
    if (currentUser.role === 'super_admin') {
        // Super admin can specify any company
        companyId = requestedCompanyId;
        if (!companyId) {
            return c.json({ error: 'companyId required when creating users as super admin' }, 400);
        }
    } else {
        // Company admins can only add to their own company
        companyId = currentUser.companyId;
        if (!companyId) {
            return c.json({ error: 'You must belong to a company to create users' }, 400);
        }
    }

    // Validate role
    if (!VALID_COMPANY_ROLES.includes(role)) {
        return c.json({
            error: 'Invalid role',
            validRoles: VALID_COMPANY_ROLES
        }, 400);
    }

    // Company admins cannot create other company admins
    if (currentUser.role !== 'super_admin' && role === 'company_admin') {
        return c.json({ error: 'Only super admins can create company admins' }, 403);
    }

    const db = createDb(c.env.DATABASE_URL);

    // Check if email already exists
    const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

    if (existing) {
        return c.json({ error: 'A user with this email already exists' }, 400);
    }

    // Verify company exists
    const [company] = await db
        .select({ id: companies.id })
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);

    if (!company) {
        return c.json({ error: 'Company not found' }, 404);
    }

    const passwordHash = await hashPassword(password);

    try {
        const [newUser] = await db
            .insert(users)
            .values({
                email,
                passwordHash,
                role,
                companyId,
            })
            .returning({
                id: users.id,
                email: users.email,
                role: users.role,
                companyId: users.companyId,
                createdAt: users.createdAt,
            });

        return c.json({ user: newUser }, 201);
    } catch (err: any) {
        console.error('Failed to create user:', err);
        return c.json({ error: 'Failed to create user' }, 500);
    }
});

// Update user (change password or role)
usersRouter.patch('/:id', async (c) => {
    const { id } = c.req.param();
    const currentUser = c.get('user');
    const body = await c.req.json();
    const { password, role } = body;

    const db = createDb(c.env.DATABASE_URL);
    const companyId = getCompanyFilter(c);

    // Build query conditions
    const conditions = [eq(users.id, id)];
    if (companyId) {
        conditions.push(eq(users.companyId, companyId));
    }

    // Check user exists and is accessible
    const [existingUser] = await db
        .select()
        .from(users)
        .where(and(...conditions))
        .limit(1);

    if (!existingUser) {
        return c.json({ error: 'User not found' }, 404);
    }

    // Prevent company admins from promoting others to company_admin
    if (role === 'company_admin' && currentUser.role !== 'super_admin') {
        return c.json({ error: 'Only super admins can assign company admin role' }, 403);
    }

    // Prevent super_admin role assignment via API
    if (role === 'super_admin') {
        return c.json({ error: 'super_admin role cannot be assigned via API' }, 403);
    }

    const updates: Record<string, any> = {};

    if (password) {
        if (password.length < 8) {
            return c.json({ error: 'Password must be at least 8 characters' }, 400);
        }
        updates.passwordHash = await hashPassword(password);
    }

    if (role && [...VALID_COMPANY_ROLES, 'admin'].includes(role)) {
        updates.role = role;
    }

    if (Object.keys(updates).length === 0) {
        return c.json({ error: 'No valid updates provided' }, 400);
    }

    const [updatedUser] = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, id))
        .returning({
            id: users.id,
            email: users.email,
            role: users.role,
            companyId: users.companyId,
            createdAt: users.createdAt,
        });

    return c.json({ user: updatedUser });
});

// Delete user
usersRouter.delete('/:id', async (c) => {
    const { id } = c.req.param();
    const db = createDb(c.env.DATABASE_URL);
    const currentUser = c.get('user');
    const companyId = getCompanyFilter(c);

    // Prevent deleting yourself
    if (currentUser.sub === id) {
        return c.json({ error: 'You cannot delete your own account' }, 400);
    }

    // Build query conditions
    const conditions = [eq(users.id, id)];
    if (companyId) {
        conditions.push(eq(users.companyId, companyId));
    }

    // Check user exists
    const [existingUser] = await db
        .select()
        .from(users)
        .where(and(...conditions))
        .limit(1);

    if (!existingUser) {
        return c.json({ error: 'User not found' }, 404);
    }

    // Prevent deleting super_admin
    if (existingUser.role === 'super_admin') {
        return c.json({ error: 'Cannot delete super admin users' }, 403);
    }

    // Company admins cannot delete other company admins
    if (existingUser.role === 'company_admin' && currentUser.role !== 'super_admin') {
        return c.json({ error: 'Only super admins can delete company admins' }, 403);
    }

    await db.delete(users).where(eq(users.id, id));

    return c.json({ success: true });
});

export default usersRouter;
