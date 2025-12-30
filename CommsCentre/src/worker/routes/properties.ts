import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { Env, createPropertySchema, updatePropertySchema } from '../../types';
import { createDb, properties } from '../../db';
import { authMiddleware, getEffectiveCompanyId, adminOnlyMiddleware } from '../middleware/auth';

const propertiesRouter = new Hono<{ Bindings: Env }>();

propertiesRouter.use('*', authMiddleware);

/**
 * Get the company filter for queries
 * Super admins can see all or filter by company, others only see their company
 */
function getCompanyFilter(c: any) {
    const user = c.get('user');
    const companyId = getEffectiveCompanyId(c);

    // Super admin without filter sees all
    if (user.role === 'super_admin' && !companyId) {
        return undefined;
    }

    // Everyone else (or filtered super admin) sees only their company
    if (companyId) {
        return eq(properties.companyId, companyId);
    }

    // Fallback - should have a company
    return undefined;
}

// List all properties (scoped by company)
propertiesRouter.get('/', async (c) => {
    const db = createDb(c.env.DATABASE_URL);
    const companyFilter = getCompanyFilter(c);

    const query = companyFilter
        ? db.select().from(properties).where(companyFilter).orderBy(properties.name)
        : db.select().from(properties).orderBy(properties.name);

    const allProperties = await query;
    return c.json({ properties: allProperties });
});

// Get single property
propertiesRouter.get('/:id', async (c) => {
    const { id } = c.req.param();
    const db = createDb(c.env.DATABASE_URL);
    const companyFilter = getCompanyFilter(c);

    const query = companyFilter
        ? db.select().from(properties).where(and(eq(properties.id, id), companyFilter)).limit(1)
        : db.select().from(properties).where(eq(properties.id, id)).limit(1);

    const [property] = await query;

    if (!property) {
        return c.json({ error: 'Property not found' }, 404);
    }

    return c.json({ property });
});

// Create property (requires admin role)
propertiesRouter.post('/', adminOnlyMiddleware, async (c) => {
    const user = c.get('user');
    const body = await c.req.json();
    const parsed = createPropertySchema.safeParse(body);

    if (!parsed.success) {
        return c.json({ error: 'Invalid request', details: parsed.error.issues }, 400);
    }

    const db = createDb(c.env.DATABASE_URL);

    // Determine companyId
    let companyId: string | undefined;
    if (user.role === 'super_admin') {
        // Super admin must specify company or use query param
        companyId = body.companyId || c.req.query('companyId');
        if (!companyId) {
            return c.json({ error: 'companyId required for super admin' }, 400);
        }
    } else {
        // Use user's company
        companyId = user.companyId;
        if (!companyId) {
            return c.json({ error: 'User has no associated company' }, 400);
        }
    }

    const [newProperty] = await db
        .insert(properties)
        .values({ ...parsed.data, companyId })
        .returning();

    return c.json({ property: newProperty }, 201);
});

// Update property
propertiesRouter.patch('/:id', adminOnlyMiddleware, async (c) => {
    const { id } = c.req.param();
    const body = await c.req.json();
    const parsed = updatePropertySchema.safeParse(body);

    if (!parsed.success) {
        return c.json({ error: 'Invalid request', details: parsed.error.issues }, 400);
    }

    const db = createDb(c.env.DATABASE_URL);
    const companyFilter = getCompanyFilter(c);

    // Check property exists and belongs to company
    const existsQuery = companyFilter
        ? db.select({ id: properties.id }).from(properties).where(and(eq(properties.id, id), companyFilter)).limit(1)
        : db.select({ id: properties.id }).from(properties).where(eq(properties.id, id)).limit(1);

    const [exists] = await existsQuery;
    if (!exists) {
        return c.json({ error: 'Property not found' }, 404);
    }

    const [updated] = await db
        .update(properties)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(properties.id, id))
        .returning();

    return c.json({ property: updated });
});

// Delete property
propertiesRouter.delete('/:id', adminOnlyMiddleware, async (c) => {
    const { id } = c.req.param();
    const db = createDb(c.env.DATABASE_URL);
    const companyFilter = getCompanyFilter(c);

    // Check property exists and belongs to company
    const existsQuery = companyFilter
        ? db.select({ id: properties.id }).from(properties).where(and(eq(properties.id, id), companyFilter)).limit(1)
        : db.select({ id: properties.id }).from(properties).where(eq(properties.id, id)).limit(1);

    const [exists] = await existsQuery;
    if (!exists) {
        return c.json({ error: 'Property not found' }, 404);
    }

    const [deleted] = await db.delete(properties).where(eq(properties.id, id)).returning();

    if (!deleted) {
        return c.json({ error: 'Property not found' }, 404);
    }

    return c.json({ success: true });
});

export default propertiesRouter;
