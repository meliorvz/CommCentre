import { Hono } from 'hono';
import { Env, GlobalSettings, PropertySettings } from '../../types';
import { authMiddleware, adminOnlyMiddleware } from '../middleware/auth';

const settingsRouter = new Hono<{ Bindings: Env }>();

settingsRouter.use('*', authMiddleware);

// Get global settings
settingsRouter.get('/global', async (c) => {
    const settings = await c.env.KV.get('settings:global', 'json');

    const defaults: GlobalSettings = {
        autoReplyEnabled: true,
        confidenceThreshold: 0.7,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
        escalationIntents: ['refund', 'payment', 'complaint'],
    };

    return c.json({ settings: settings || defaults });
});

// Update global settings (admin only)
settingsRouter.put('/global', adminOnlyMiddleware, async (c) => {
    const body = await c.req.json();

    await c.env.KV.put('settings:global', JSON.stringify(body));

    // Invalidate ConfigDO cache
    const configDO = c.env.CONFIG_DO.get(c.env.CONFIG_DO.idFromName('global'));
    await configDO.fetch('http://internal/invalidate', { method: 'POST' });

    return c.json({ success: true });
});

// Get property-specific settings
settingsRouter.get('/property/:id', async (c) => {
    const { id } = c.req.param();
    const settings = await c.env.KV.get(`settings:property:${id}`, 'json');

    const defaults: PropertySettings = {
        autoReplyEnabled: true,
        smsEnabled: true,
        emailEnabled: true,
        scheduleT3Time: '10:00',
        scheduleT1Time: '16:00',
        scheduleDayOfTime: '09:00',
    };

    return c.json({ settings: settings || defaults });
});

// Update property settings (admin only)
settingsRouter.put('/property/:id', adminOnlyMiddleware, async (c) => {
    const { id } = c.req.param();
    const body = await c.req.json();

    await c.env.KV.put(`settings:property:${id}`, JSON.stringify(body));

    // Invalidate ConfigDO cache
    const configDO = c.env.CONFIG_DO.get(c.env.CONFIG_DO.idFromName('global'));
    await configDO.fetch('http://internal/invalidate', { method: 'POST' });

    return c.json({ success: true });
});

export default settingsRouter;
