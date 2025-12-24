import { Hono } from 'hono';
import { Env, GlobalSettings, PropertySettings, SetupProfile, PropertyDefaults, KnowledgeCategory, KnowledgeItem } from '../../types';
import { authMiddleware, adminOnlyMiddleware } from '../middleware/auth';
import { getIncomingPhoneNumbers } from '../lib/twilio';
import { sendTelegramMessage } from '../lib/telegram';

const settingsRouter = new Hono<{ Bindings: Env }>();

settingsRouter.use('*', authMiddleware);

// ============================================================================
// Default values
// ============================================================================

const DEFAULT_SETUP_PROFILE: SetupProfile = {
    companyName: 'Paradise Stayz',
    assistantName: 'Mark',
    businessType: 'holiday_rentals',
    timezone: 'Australia/Sydney',
};

const DEFAULT_PROPERTY_DEFAULTS: PropertyDefaults = {
    checkinTime: '15:00',
    checkoutTime: '10:00',
    earlyCheckinPolicy: 'Subject to availability, please contact us',
    lateCheckoutPolicy: 'Available until 12pm if requested 24 hours in advance',
    parkingInfo: '',
    petPolicy: 'No pets allowed',
    smokingPolicy: 'Strictly non-smoking property',
    partyPolicy: 'No parties or events permitted',
    quietHours: '10pm - 8am',
};

const DEFAULT_CATEGORIES: KnowledgeCategory[] = [
    { id: 'access', name: 'Access & Arrival', order: 0, exampleQuestions: 'Check-in time, early check-in, lockbox location, late arrival, door code' },
    { id: 'parking', name: 'Building & Parking', order: 1, exampleQuestions: 'Parking included, garage entry, visitor parking, lift access' },
    { id: 'wifi', name: 'Wi-Fi & Utilities', order: 2, exampleQuestions: 'Wi-Fi credentials, TV setup, AC controls, hot water' },
    { id: 'rules', name: 'House Rules', order: 3, exampleQuestions: 'Pets, smoking, parties, quiet hours, extra guests' },
    { id: 'stay', name: 'Stay Management', order: 4, exampleQuestions: 'Late checkout, luggage storage, extend stay, date changes' },
    { id: 'local', name: 'Local Area', order: 5, exampleQuestions: 'Nearest grocery, pharmacy, transport, recommendations' },
];

// Check integration status (verify env vars are set)
settingsRouter.get('/integration/status', async (c) => {
    const env = c.env;
    return c.json({
        twilio: !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN),
        gmail: !!(env.GMAIL_CLIENT_ID && env.GMAIL_REFRESH_TOKEN),
        openrouter: !!env.OPENROUTER_API_KEY,
        telegram: !!env.TELEGRAM_BOT_TOKEN,
    });
});

// Get global settings
settingsRouter.get('/global', async (c) => {
    const settings = await c.env.KV.get('settings:global', 'json');

    const defaults: GlobalSettings = {
        autoReplyEnabled: true,
        confidenceThreshold: 0.7,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
        escalationCategories: ['complaint', 'booking_change', 'payment'],
        callForwardingNumber: '',
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

// ============================================================================
// Setup Profile routes
// ============================================================================

settingsRouter.get('/setup/profile', async (c) => {
    const profile = await c.env.KV.get('setup:profile', 'json') as SetupProfile | null;
    return c.json({ profile: profile || DEFAULT_SETUP_PROFILE });
});

settingsRouter.put('/setup/profile', adminOnlyMiddleware, async (c) => {
    const body = await c.req.json() as Partial<SetupProfile>;
    const existing = await c.env.KV.get('setup:profile', 'json') as SetupProfile | null;
    const updated = { ...DEFAULT_SETUP_PROFILE, ...existing, ...body };

    await c.env.KV.put('setup:profile', JSON.stringify(updated));

    // Invalidate ConfigDO cache to regenerate prompt
    const configDO = c.env.CONFIG_DO.get(c.env.CONFIG_DO.idFromName('global'));
    await configDO.fetch('http://internal/invalidate', { method: 'POST' });

    return c.json({ profile: updated });
});

// ============================================================================
// Property Defaults routes
// ============================================================================

settingsRouter.get('/setup/defaults', async (c) => {
    const defaults = await c.env.KV.get('setup:property-defaults', 'json') as PropertyDefaults | null;
    return c.json({ defaults: defaults || DEFAULT_PROPERTY_DEFAULTS });
});

settingsRouter.put('/setup/defaults', adminOnlyMiddleware, async (c) => {
    const body = await c.req.json() as Partial<PropertyDefaults>;
    const existing = await c.env.KV.get('setup:property-defaults', 'json') as PropertyDefaults | null;
    const updated = { ...DEFAULT_PROPERTY_DEFAULTS, ...existing, ...body };

    await c.env.KV.put('setup:property-defaults', JSON.stringify(updated));

    // Invalidate ConfigDO cache
    const configDO = c.env.CONFIG_DO.get(c.env.CONFIG_DO.idFromName('global'));
    await configDO.fetch('http://internal/invalidate', { method: 'POST' });

    return c.json({ defaults: updated });
});

// ============================================================================
// Knowledge Base routes
// ============================================================================

// Get all categories
settingsRouter.get('/knowledge/categories', async (c) => {
    const categories = await c.env.KV.get('knowledge:categories', 'json') as KnowledgeCategory[] | null;
    return c.json({ categories: categories || DEFAULT_CATEGORIES });
});

// Save all categories (for reordering, adding, deleting)
settingsRouter.put('/knowledge/categories', adminOnlyMiddleware, async (c) => {
    const body = await c.req.json() as { categories: KnowledgeCategory[] };
    await c.env.KV.put('knowledge:categories', JSON.stringify(body.categories));

    // Invalidate ConfigDO cache
    const configDO = c.env.CONFIG_DO.get(c.env.CONFIG_DO.idFromName('global'));
    await configDO.fetch('http://internal/invalidate', { method: 'POST' });

    return c.json({ categories: body.categories });
});

// Get all knowledge items
settingsRouter.get('/knowledge/items', async (c) => {
    const items = await c.env.KV.get('knowledge:items', 'json') as KnowledgeItem[] | null;
    return c.json({ items: items || [] });
});

// Save a knowledge item (create or update)
settingsRouter.put('/knowledge/items/:id', adminOnlyMiddleware, async (c) => {
    const { id } = c.req.param();
    const body = await c.req.json() as Omit<KnowledgeItem, 'id' | 'updatedAt'>;
    const items = await c.env.KV.get('knowledge:items', 'json') as KnowledgeItem[] || [];

    const existingIndex = items.findIndex(item => item.id === id);
    const updatedItem: KnowledgeItem = {
        ...body,
        id,
        updatedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
        items[existingIndex] = updatedItem;
    } else {
        items.push(updatedItem);
    }

    await c.env.KV.put('knowledge:items', JSON.stringify(items));

    // Invalidate ConfigDO cache
    const configDO = c.env.CONFIG_DO.get(c.env.CONFIG_DO.idFromName('global'));
    await configDO.fetch('http://internal/invalidate', { method: 'POST' });

    return c.json({ item: updatedItem });
});

// Delete a knowledge item
settingsRouter.delete('/knowledge/items/:id', adminOnlyMiddleware, async (c) => {
    const { id } = c.req.param();
    const items = await c.env.KV.get('knowledge:items', 'json') as KnowledgeItem[] || [];

    const filtered = items.filter(item => item.id !== id);
    await c.env.KV.put('knowledge:items', JSON.stringify(filtered));

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
        timezone: 'Australia/Sydney',
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

// Get available Twilio numbers
settingsRouter.get('/integration/twilio/numbers', adminOnlyMiddleware, async (c) => {
    try {
        const numbers = await getIncomingPhoneNumbers(c.env);
        return c.json({ numbers });
    } catch (err: any) {
        console.error('Failed to fetch Twilio numbers:', err);
        return c.json({ error: err.message }, 500);
    }
});

// Get integration settings
settingsRouter.get('/integration/:key', async (c) => {
    const { key } = c.req.param();
    const settings = await c.env.KV.get(`settings:integration:${key}`, 'json');
    return c.json({ settings: settings || {} });
});

// Update integration settings (admin only)
settingsRouter.put('/integration/:key', adminOnlyMiddleware, async (c) => {
    const { key } = c.req.param();
    const body = await c.req.json();

    await c.env.KV.put(`settings:integration:${key}`, JSON.stringify(body));

    // Invalidate ConfigDO cache
    const configDO = c.env.CONFIG_DO.get(c.env.CONFIG_DO.idFromName('global'));
    await configDO.fetch('http://internal/invalidate', { method: 'POST' });

    return c.json({ success: true });
});

// Test Telegram connectivity
settingsRouter.post('/integration/telegram/test', adminOnlyMiddleware, async (c) => {
    try {
        await sendTelegramMessage(c.env, '🚀 Telegram integration test successful!');
        return c.json({ success: true });
    } catch (err: any) {
        console.error('Telegram test failed:', err);
        return c.json({ error: err.message }, 500);
    }
});

export default settingsRouter;
