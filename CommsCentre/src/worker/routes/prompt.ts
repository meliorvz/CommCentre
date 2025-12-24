import { Hono } from 'hono';
import { Env } from '../../types';
import { AI_AGENT_NAME } from '@shared/constants';
import { authMiddleware, adminOnlyMiddleware } from '../middleware/auth';

interface PromptVersion {
    content: string;
    version: number;
    publishedAt: string;
    publishedBy: string;
}

const promptRouter = new Hono<{ Bindings: Env }>();

promptRouter.use('*', authMiddleware);

// Get current published prompt (dynamically generated from ConfigDO)
promptRouter.get('/published', async (c) => {
    // First check for manual override
    const manualPrompt = await c.env.KV.get('prompt:business:published', 'json') as PromptVersion | null;

    // Fetch dynamic prompt from ConfigDO
    const configDO = c.env.CONFIG_DO.get(c.env.CONFIG_DO.idFromName('global'));
    const configRes = await configDO.fetch('http://internal/config');
    const config = await configRes.json() as { prompt: string };

    // If there's a manual override with content, return that with version info
    // Otherwise return the dynamic prompt
    if (manualPrompt?.content) {
        return c.json({ prompt: manualPrompt });
    }

    // Return dynamic prompt as version 0 (auto-generated)
    return c.json({
        prompt: {
            content: config.prompt,
            version: 0,
            publishedAt: new Date().toISOString(),
            publishedBy: 'system (auto-generated)',
        }
    });
});

// Get draft prompt
promptRouter.get('/draft', async (c) => {
    const draft = await c.env.KV.get('prompt:business:draft');
    return c.json({ draft: draft || '' });
});

// Save draft
promptRouter.put('/draft', adminOnlyMiddleware, async (c) => {
    const body = await c.req.json();
    const { content } = body;

    await c.env.KV.put('prompt:business:draft', content);

    return c.json({ success: true });
});

// Publish prompt (admin only)
promptRouter.post('/publish', adminOnlyMiddleware, async (c) => {
    const user = c.get('user');
    const body = await c.req.json();
    const { content } = body;

    // Get current version
    const current = await c.env.KV.get('prompt:business:published', 'json') as PromptVersion | null;
    const version = (current?.version || 0) + 1;

    const newPrompt: PromptVersion = {
        content,
        version,
        publishedAt: new Date().toISOString(),
        publishedBy: user.email,
    };

    // Save published version
    await c.env.KV.put('prompt:business:published', JSON.stringify(newPrompt));

    // Archive version
    await c.env.KV.put(`prompt:business:v${version}`, JSON.stringify(newPrompt));

    // Clear draft
    await c.env.KV.delete('prompt:business:draft');

    // Invalidate ConfigDO cache
    const configDO = c.env.CONFIG_DO.get(c.env.CONFIG_DO.idFromName('global'));
    await configDO.fetch('http://internal/invalidate', { method: 'POST' });

    return c.json({ prompt: newPrompt });
});

// Get version history
promptRouter.get('/versions', async (c) => {
    const versions: PromptVersion[] = [];

    // Get recent versions (up to 10)
    for (let i = 1; i <= 10; i++) {
        const version = await c.env.KV.get(`prompt:business:v${i}`, 'json') as PromptVersion | null;
        if (version) {
            versions.push(version);
        }
    }

    return c.json({ versions: versions.reverse() });
});

function getDefaultPrompt(): PromptVersion {
    return {
        content: `You are ${AI_AGENT_NAME}, a friendly and professional virtual assistant for holiday rental properties in Australia.

## Your Role
You help guests with their stay-related questions and concerns. You are warm, courteous, and concise in your responses.

## Communication Style
- Be friendly but professional
- Keep SMS messages short (under 160 characters when possible)
- For emails, use proper formatting with bullet points when helpful
- Always sign off as "${AI_AGENT_NAME}"

## Common Topics You Handle
- Check-in/check-out times and procedures
- Property access codes and lockbox locations
- Wi-Fi information
- Parking details
- Basic property amenities
- Local recommendations

## When to Escalate
Always escalate (set needs_human=true) for:
- Payment, refund, or billing issues
- Damage claims or reports
- Safety concerns or emergencies
- Legal matters or threats
- Complaints that require compensation
- When you're unsure how to help
- If the guest seems upset or frustrated

## Response Format
You must respond with valid JSON matching this schema:
{
  "intent": "checkin_info|checkout_info|wifi|parking|late_checkout|early_checkin|complaint|refund|payment|booking|amenities|directions|other|unknown",
  "confidence": 0.0-1.0,
  "needs_human": true/false,
  "auto_reply_ok": true/false,
  "reply_channel": "sms|email",
  "reply_subject": null or "subject for email",
  "reply_text": "your message to the guest",
  "internal_note": "notes for staff"
}`,
        version: 1,
        publishedAt: new Date().toISOString(),
        publishedBy: 'system',
    };
}

export default promptRouter;
