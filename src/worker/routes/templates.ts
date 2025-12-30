import { Hono } from 'hono';
import { Env } from '../../types';
import { authMiddleware, adminOnlyMiddleware } from '../middleware/auth';
import { AI_AGENT_NAME } from '@shared/constants';

interface Template {
    channel: 'sms' | 'email';
    ruleKey: string;
    subject?: string;
    body: string;
    version: number;
}

const templatesRouter = new Hono<{ Bindings: Env }>();

templatesRouter.use('*', authMiddleware);

// Get all templates
templatesRouter.get('/', async (c) => {
    const templates: Record<string, Template> = {};

    // List template keys
    const keys = [
        'templates:sms:T_MINUS_3',
        'templates:sms:T_MINUS_1',
        'templates:sms:DAY_OF',
        'templates:email:T_MINUS_3',
        'templates:email:T_MINUS_1',
        'templates:email:DAY_OF',
    ];

    for (const key of keys) {
        const template = await c.env.KV.get(key, 'json');
        if (template) {
            templates[key] = template as Template;
        }
    }

    return c.json({ templates });
});

// Get single template
templatesRouter.get('/:channel/:ruleKey', async (c) => {
    const { channel, ruleKey } = c.req.param();
    const key = `templates:${channel}:${ruleKey}`;

    const template = await c.env.KV.get(key, 'json');

    if (!template) {
        // Return default template
        const defaults: Record<string, Template> = {
            'templates:sms:T_MINUS_3': {
                channel: 'sms',
                ruleKey: 'T_MINUS_3',
                body: `Hi {{guest_name}}! Your stay at {{property_name}} is coming up in 3 days. We look forward to hosting you! - ${AI_AGENT_NAME}`,
                version: 1,
            },
            'templates:sms:T_MINUS_1': {
                channel: 'sms',
                ruleKey: 'T_MINUS_1',
                body: `Hi {{guest_name}}! Just a reminder that your check-in at {{property_name}} is tomorrow. Check-in time is {{checkin_time}}. See you soon! - ${AI_AGENT_NAME}`,
                version: 1,
            },
            'templates:sms:DAY_OF': {
                channel: 'sms',
                ruleKey: 'DAY_OF',
                body: `Good morning {{guest_name}}! Today is your check-in day at {{property_name}}. The property code is {{property_code}}. Safe travels! - ${AI_AGENT_NAME}`,
                version: 1,
            },
            'templates:email:T_MINUS_3': {
                channel: 'email',
                ruleKey: 'T_MINUS_3',
                subject: 'Your upcoming stay at {{property_name}}',
                body: `Hi {{guest_name}},

We're excited to host you at {{property_name}} in 3 days!

Here are a few things to know:
- Check-in time: {{checkin_time}}
- Address: {{property_address}}

If you have any questions, just reply to this email.

Warm regards,
${AI_AGENT_NAME}`,
                version: 1,
            },
            'templates:email:T_MINUS_1': {
                channel: 'email',
                ruleKey: 'T_MINUS_1',
                subject: 'Check-in reminder for {{property_name}}',
                body: `Hi {{guest_name}},

Just a friendly reminder that your check-in is tomorrow!

- Property: {{property_name}}
- Check-in time: {{checkin_time}}
- Address: {{property_address}}

We'll send your access details tomorrow morning.

See you soon,
${AI_AGENT_NAME}`,
                version: 1,
            },
            'templates:email:DAY_OF': {
                channel: 'email',
                ruleKey: 'DAY_OF',
                subject: 'Welcome! Your check-in details for {{property_name}}',
                body: `Good morning {{guest_name}},

Welcome! Here are your check-in details:

**Property:** {{property_name}}
**Address:** {{property_address}}
**Check-in time:** {{checkin_time}}
**Access code:** {{property_code}}

**Wi-Fi:**
- Network: {{wifi_name}}
- Password: {{wifi_password}}

If you need anything during your stay, just reply to this email or text us.

Enjoy your stay!
${AI_AGENT_NAME}`,
                version: 1,
            },
        };

        return c.json({ template: defaults[key] || null });
    }

    return c.json({ template });
});

// Update template (admin only)
templatesRouter.put('/:channel/:ruleKey', adminOnlyMiddleware, async (c) => {
    const { channel, ruleKey } = c.req.param();
    const body = await c.req.json();
    const key = `templates:${channel}:${ruleKey}`;

    // Get current version
    const existing = await c.env.KV.get(key, 'json') as Template | null;
    const version = (existing?.version || 0) + 1;

    const template: Template = {
        channel: channel as 'sms' | 'email',
        ruleKey,
        subject: body.subject,
        body: body.body,
        version,
    };

    await c.env.KV.put(key, JSON.stringify(template));

    // Invalidate ConfigDO cache
    const configDO = c.env.CONFIG_DO.get(c.env.CONFIG_DO.idFromName('global'));
    await configDO.fetch('http://internal/invalidate', { method: 'POST' });

    return c.json({ template });
});

export default templatesRouter;
