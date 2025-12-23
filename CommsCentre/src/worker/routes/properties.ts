import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { Env, createPropertySchema, updatePropertySchema } from '../../types';
import { createDb, properties } from '../../db';
import { authMiddleware } from '../middleware/auth';

const propertiesRouter = new Hono<{ Bindings: Env }>();

propertiesRouter.use('*', authMiddleware);

// List all properties
propertiesRouter.get('/', async (c) => {
    const db = createDb(c.env.DATABASE_URL);
    const allProperties = await db.select().from(properties).orderBy(properties.name);
    return c.json({ properties: allProperties });
});

// Get single property
propertiesRouter.get('/:id', async (c) => {
    const { id } = c.req.param();
    const db = createDb(c.env.DATABASE_URL);

    const [property] = await db.select().from(properties).where(eq(properties.id, id)).limit(1);

    if (!property) {
        return c.json({ error: 'Property not found' }, 404);
    }

    return c.json({ property });
});

// Create property
propertiesRouter.post('/', async (c) => {
    const body = await c.req.json();
    const parsed = createPropertySchema.safeParse(body);

    if (!parsed.success) {
        return c.json({ error: 'Invalid request', details: parsed.error.issues }, 400);
    }

    const db = createDb(c.env.DATABASE_URL);

    const [newProperty] = await db.insert(properties).values(parsed.data).returning();

    return c.json({ property: newProperty }, 201);
});

// Update property
propertiesRouter.patch('/:id', async (c) => {
    const { id } = c.req.param();
    const body = await c.req.json();
    const parsed = updatePropertySchema.safeParse(body);

    if (!parsed.success) {
        return c.json({ error: 'Invalid request', details: parsed.error.issues }, 400);
    }

    const db = createDb(c.env.DATABASE_URL);

    const [updated] = await db
        .update(properties)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(properties.id, id))
        .returning();

    if (!updated) {
        return c.json({ error: 'Property not found' }, 404);
    }

    return c.json({ property: updated });
});

// Delete property
propertiesRouter.delete('/:id', async (c) => {
    const { id } = c.req.param();
    const db = createDb(c.env.DATABASE_URL);

    const [deleted] = await db.delete(properties).where(eq(properties.id, id)).returning();

    if (!deleted) {
        return c.json({ error: 'Property not found' }, 404);
    }

    return c.json({ success: true });
});

export default propertiesRouter;
