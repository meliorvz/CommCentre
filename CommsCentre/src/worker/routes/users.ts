import { Hono } from 'hono';
import { Env } from '../../types';
import { createDb, users } from '../../db';
import { authMiddleware, adminOnlyMiddleware } from '../middleware/auth';
import { eq } from 'drizzle-orm';

const usersRouter = new Hono<{ Bindings: Env }>();

usersRouter.use('*', authMiddleware);
usersRouter.use('*', adminOnlyMiddleware);

// Hash password using SHA-256 (same as create-admin script)
async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// List all users
usersRouter.get('/', async (c) => {
    const db = createDb(c.env.DATABASE_URL);

    const allUsers = await db
        .select({
            id: users.id,
            email: users.email,
            role: users.role,
            createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(users.createdAt);

    return c.json({ users: allUsers });
});

// Create new user
usersRouter.post('/', async (c) => {
    const body = await c.req.json();
    const { email, password, role = 'staff' } = body;

    if (!email || !password) {
        return c.json({ error: 'Email and password are required' }, 400);
    }

    if (password.length < 8) {
        return c.json({ error: 'Password must be at least 8 characters' }, 400);
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

    const passwordHash = await hashPassword(password);

    try {
        const [newUser] = await db
            .insert(users)
            .values({
                email,
                passwordHash,
                role,
            })
            .returning({
                id: users.id,
                email: users.email,
                role: users.role,
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
    const body = await c.req.json();
    const { password, role } = body;

    const db = createDb(c.env.DATABASE_URL);

    // Check user exists
    const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

    if (!existingUser) {
        return c.json({ error: 'User not found' }, 404);
    }

    const updates: Record<string, any> = {};

    if (password) {
        if (password.length < 8) {
            return c.json({ error: 'Password must be at least 8 characters' }, 400);
        }
        updates.passwordHash = await hashPassword(password);
    }

    if (role && ['admin', 'staff'].includes(role)) {
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
            createdAt: users.createdAt,
        });

    return c.json({ user: updatedUser });
});

// Delete user
usersRouter.delete('/:id', async (c) => {
    const { id } = c.req.param();
    const db = createDb(c.env.DATABASE_URL);

    // Prevent deleting yourself
    const currentUser = c.get('user' as never) as { userId: string };
    if (currentUser?.userId === id) {
        return c.json({ error: 'You cannot delete your own account' }, 400);
    }

    // Check user exists
    const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

    if (!existingUser) {
        return c.json({ error: 'User not found' }, 404);
    }

    await db.delete(users).where(eq(users.id, id));

    return c.json({ success: true });
});

export default usersRouter;
