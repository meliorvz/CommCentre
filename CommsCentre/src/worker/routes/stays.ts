import { Hono } from 'hono';
import { eq, desc, and } from 'drizzle-orm';
import { Env, createStaySchema, updateStaySchema } from '../../types';
import { createDb, stays, threads, properties } from '../../db';
import { authMiddleware, getEffectiveCompanyId, adminOnlyMiddleware } from '../middleware/auth';

const staysRouter = new Hono<{ Bindings: Env }>();

staysRouter.use('*', authMiddleware);

/**
 * Get company filter for queries
 */
function getCompanyFilter(c: any) {
    const user = c.get('user');
    const companyId = getEffectiveCompanyId(c);

    if (user.role === 'super_admin' && !companyId) {
        return undefined; // No filter - see all
    }

    return companyId;
}

// List all stays with optional filters - scoped by company
staysRouter.get('/', async (c) => {
    const { propertyId, status } = c.req.query();
    const db = createDb(c.env.DATABASE_URL);
    const companyId = getCompanyFilter(c);

    // Join with properties to filter by company
    let result = await db
        .select({
            stay: stays,
            property: properties,
        })
        .from(stays)
        .leftJoin(properties, eq(stays.propertyId, properties.id))
        .where(
            and(
                propertyId ? eq(stays.propertyId, propertyId) : undefined,
                status ? eq(stays.status, status as any) : undefined,
                companyId ? eq(properties.companyId, companyId) : undefined
            )
        )
        .orderBy(desc(stays.checkinAt))
        .limit(100);

    return c.json({
        stays: result.map(r => ({
            ...r.stay,
            property: r.property,
        }))
    });
});

// Get single stay with property info
staysRouter.get('/:id', async (c) => {
    const { id } = c.req.param();
    const db = createDb(c.env.DATABASE_URL);
    const companyId = getCompanyFilter(c);

    const conditions = [eq(stays.id, id)];
    if (companyId) {
        conditions.push(eq(properties.companyId, companyId));
    }

    const result = await db
        .select()
        .from(stays)
        .leftJoin(properties, eq(stays.propertyId, properties.id))
        .leftJoin(threads, eq(threads.stayId, stays.id))
        .where(and(...conditions))
        .limit(1);

    if (!result[0]) {
        return c.json({ error: 'Stay not found' }, 404);
    }

    return c.json({
        stay: result[0].stays,
        property: result[0].properties,
        thread: result[0].threads,
    });
});

// Create stay
staysRouter.post('/', async (c) => {
    const body = await c.req.json();
    const parsed = createStaySchema.safeParse(body);

    if (!parsed.success) {
        return c.json({ error: 'Invalid request', details: parsed.error.issues }, 400);
    }

    const db = createDb(c.env.DATABASE_URL);
    const user = c.get('user');
    const companyId = getCompanyFilter(c);

    // Verify property belongs to user's company
    if (companyId) {
        const [propertyCheck] = await db
            .select({ id: properties.id })
            .from(properties)
            .where(and(
                eq(properties.id, parsed.data.propertyId),
                eq(properties.companyId, companyId)
            ))
            .limit(1);

        if (!propertyCheck) {
            return c.json({ error: 'Property not found or access denied' }, 404);
        }
    }

    // Create stay
    const [newStay] = await db
        .insert(stays)
        .values({
            ...parsed.data,
            checkinAt: new Date(parsed.data.checkinAt),
            checkoutAt: new Date(parsed.data.checkoutAt),
        })
        .returning();

    // Create associated thread
    const [newThread] = await db
        .insert(threads)
        .values({
            stayId: newStay.id,
            status: 'open',
        })
        .returning();

    // Notify SchedulerDO to create scheduled jobs
    const schedulerDO = c.env.SCHEDULER_DO.get(
        c.env.SCHEDULER_DO.idFromName(newStay.propertyId)
    );
    await schedulerDO.fetch('http://internal/schedule-stay', {
        method: 'POST',
        body: JSON.stringify({ stayId: newStay.id }),
    });

    return c.json({ stay: newStay, thread: newThread }, 201);
});

// Update stay
staysRouter.patch('/:id', async (c) => {
    const { id } = c.req.param();
    const body = await c.req.json();
    const parsed = updateStaySchema.safeParse(body);

    if (!parsed.success) {
        return c.json({ error: 'Invalid request', details: parsed.error.issues }, 400);
    }

    const db = createDb(c.env.DATABASE_URL);
    const companyId = getCompanyFilter(c);

    // Verify stay belongs to user's company
    if (companyId) {
        const [stayCheck] = await db
            .select({ id: stays.id })
            .from(stays)
            .leftJoin(properties, eq(stays.propertyId, properties.id))
            .where(and(
                eq(stays.id, id),
                eq(properties.companyId, companyId)
            ))
            .limit(1);

        if (!stayCheck) {
            return c.json({ error: 'Stay not found or access denied' }, 404);
        }
    }

    const updateData: any = { ...parsed.data, updatedAt: new Date() };
    if (parsed.data.checkinAt) updateData.checkinAt = new Date(parsed.data.checkinAt);
    if (parsed.data.checkoutAt) updateData.checkoutAt = new Date(parsed.data.checkoutAt);

    const [updated] = await db.update(stays).set(updateData).where(eq(stays.id, id)).returning();

    if (!updated) {
        return c.json({ error: 'Stay not found' }, 404);
    }

    // Re-schedule jobs if dates changed
    if (parsed.data.checkinAt || parsed.data.checkoutAt) {
        const schedulerDO = c.env.SCHEDULER_DO.get(
            c.env.SCHEDULER_DO.idFromName(updated.propertyId)
        );
        await schedulerDO.fetch('http://internal/reschedule-stay', {
            method: 'POST',
            body: JSON.stringify({ stayId: updated.id }),
        });
    }

    return c.json({ stay: updated });
});

// Cancel stay
staysRouter.post('/:id/cancel', async (c) => {
    const { id } = c.req.param();
    const db = createDb(c.env.DATABASE_URL);
    const companyId = getCompanyFilter(c);

    // Verify stay belongs to user's company
    if (companyId) {
        const [stayCheck] = await db
            .select({ id: stays.id })
            .from(stays)
            .leftJoin(properties, eq(stays.propertyId, properties.id))
            .where(and(
                eq(stays.id, id),
                eq(properties.companyId, companyId)
            ))
            .limit(1);

        if (!stayCheck) {
            return c.json({ error: 'Stay not found or access denied' }, 404);
        }
    }

    const [updated] = await db
        .update(stays)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(stays.id, id))
        .returning();

    if (!updated) {
        return c.json({ error: 'Stay not found' }, 404);
    }

    // Cancel scheduled jobs
    const schedulerDO = c.env.SCHEDULER_DO.get(
        c.env.SCHEDULER_DO.idFromName(updated.propertyId)
    );
    await schedulerDO.fetch('http://internal/cancel-stay', {
        method: 'POST',
        body: JSON.stringify({ stayId: updated.id }),
    });

    // Close thread
    await db
        .update(threads)
        .set({ status: 'closed', updatedAt: new Date() })
        .where(eq(threads.stayId, id));

    return c.json({ stay: updated });
});

// CSV Import - now requires admin role and validates properties against company
staysRouter.post('/import', adminOnlyMiddleware, async (c) => {
    const body = await c.req.json();
    const { rows, propertyId } = body;

    if (!Array.isArray(rows) || !propertyId) {
        return c.json({ error: 'Invalid import data' }, 400);
    }

    const db = createDb(c.env.DATABASE_URL);
    const companyId = getCompanyFilter(c);

    // Verify property belongs to user's company
    if (companyId) {
        const [propertyCheck] = await db
            .select({ id: properties.id })
            .from(properties)
            .where(and(
                eq(properties.id, propertyId),
                eq(properties.companyId, companyId)
            ))
            .limit(1);

        if (!propertyCheck) {
            return c.json({ error: 'Property not found or access denied' }, 404);
        }
    }

    const results = { success: 0, errors: [] as string[] };

    for (const row of rows) {
        try {
            const parsed = createStaySchema.safeParse({
                propertyId,
                guestName: row.guestName || row.guest_name,
                guestPhoneE164: row.guestPhoneE164 || row.guest_phone || row.phone,
                guestEmail: row.guestEmail || row.guest_email || row.email,
                checkinAt: row.checkinAt || row.checkin_at || row.checkin,
                checkoutAt: row.checkoutAt || row.checkout_at || row.checkout,
                preferredChannel: row.preferredChannel || row.preferred_channel || 'sms',
                notesInternal: row.notesInternal || row.notes,
            });

            if (!parsed.success) {
                results.errors.push(`Row ${results.success + results.errors.length + 1}: ${parsed.error.message}`);
                continue;
            }

            const [newStay] = await db.insert(stays).values({
                ...parsed.data,
                checkinAt: new Date(parsed.data.checkinAt),
                checkoutAt: new Date(parsed.data.checkoutAt),
            }).returning();

            // Create thread for imported stay
            await db.insert(threads).values({
                stayId: newStay.id,
                status: 'open',
            });

            results.success++;
        } catch (err) {
            results.errors.push(`Row ${results.success + results.errors.length + 1}: ${String(err)}`);
        }
    }

    return c.json(results);
});

export default staysRouter;
