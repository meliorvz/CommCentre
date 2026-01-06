/**
 * Style Learning Routes - T-039
 * Endpoints for learning and managing company communication style
 */

import { Hono } from 'hono';
import { Env } from '../../types';
import { authMiddleware, adminOnlyMiddleware } from '../middleware/auth';
import { getIntegration, GmailCredentials } from '../lib/integration-tokens';
import { analyzeCompanyStyle } from '../lib/style-analyzer';
import { createDb, companyProfile } from '../../db';
import { eq } from 'drizzle-orm';

type Variables = {
    user: {
        id: string;
        email: string;
        role: string;
        companyId: string | null;
    };
};

const styleRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// All style routes require authentication
styleRoutes.use('*', authMiddleware);

/**
 * Helper to get company ID from user context
 */
function getCompanyId(c: { get: (key: 'user') => Variables['user'] }): string | null {
    const user = c.get('user');
    return user.companyId;
}

/**
 * POST /api/style/learn
 * Fetch sent emails from Gmail, analyze them, and store the learned style guide
 * Only company admins can trigger style learning
 */
styleRoutes.post('/learn', adminOnlyMiddleware, async (c) => {
    const companyId = getCompanyId(c);
    if (!companyId) {
        return c.json({ error: 'Company context required' }, 400);
    }

    // Get Gmail credentials for this company
    const credentials = await getIntegration<GmailCredentials>(c.env, companyId, 'gmail');

    if (!credentials) {
        return c.json({
            error: 'Gmail not connected',
            message: 'Please connect Gmail in Settings > Integrations before learning style',
        }, 400);
    }

    // Check if access token is valid, refresh if needed
    const accessToken = credentials.accessToken;
    if (!accessToken || !credentials.expiresAt || Date.now() >= credentials.expiresAt - 60000) {
        // Token needs refresh - use the getAccessTokenForCompany logic
        // For simplicity, we'll import it dynamically or just tell user to reconnect
        return c.json({
            error: 'Gmail token expired',
            message: 'Please reconnect Gmail to refresh your access token',
        }, 400);
    }

    try {
        // Analyze sent emails
        const maxEmails = parseInt(c.req.query('maxEmails') || '50');
        const analysis = await analyzeCompanyStyle(c.env, accessToken, Math.min(maxEmails, 100));

        // Store the style guide in the database
        const db = createDb(c.env.DATABASE_URL);
        const now = new Date();

        // Check if profile exists
        const [existingProfile] = await db
            .select()
            .from(companyProfile)
            .where(eq(companyProfile.companyId, companyId))
            .limit(1);

        if (existingProfile) {
            // Update existing profile
            await db
                .update(companyProfile)
                .set({
                    styleGuide: analysis.styleGuide,
                    styleGuideUpdatedAt: now,
                    updatedAt: now,
                })
                .where(eq(companyProfile.companyId, companyId));
        } else {
            // Create new profile with style guide
            await db
                .insert(companyProfile)
                .values({
                    companyId,
                    styleGuide: analysis.styleGuide,
                    styleGuideUpdatedAt: now,
                });
        }

        console.log(`[Style] Learned style for company ${companyId} from ${analysis.emailsAnalyzed} emails`);

        // Invalidate ConfigDO cache so new prompts include the style
        try {
            const configId = c.env.CONFIG_DO.idFromName('global');
            const configStub = c.env.CONFIG_DO.get(configId);
            await configStub.fetch(new Request('https://internal/invalidate', { method: 'POST' }));
        } catch (e) {
            console.warn('[Style] Failed to invalidate ConfigDO cache:', e);
        }

        return c.json({
            success: true,
            emailsAnalyzed: analysis.emailsAnalyzed,
            traits: analysis.traits,
            examplePhrases: analysis.examplePhrases,
            message: 'Style guide learned successfully! AI responses will now match your communication style.',
        });
    } catch (error) {
        console.error('[Style] Learn error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return c.json({ error: 'Style learning failed', message }, 500);
    }
});

/**
 * GET /api/style/current
 * Get the current style guide for the company
 */
styleRoutes.get('/current', async (c) => {
    const companyId = getCompanyId(c);
    if (!companyId) {
        return c.json({ error: 'Company context required' }, 400);
    }

    const db = createDb(c.env.DATABASE_URL);
    const [profile] = await db
        .select({
            styleGuide: companyProfile.styleGuide,
            styleGuideUpdatedAt: companyProfile.styleGuideUpdatedAt,
        })
        .from(companyProfile)
        .where(eq(companyProfile.companyId, companyId))
        .limit(1);

    if (!profile || !profile.styleGuide) {
        return c.json({
            hasStyle: false,
            styleGuide: null,
            updatedAt: null,
            message: 'No style guide learned yet. Use POST /api/style/learn to analyze your sent emails.',
        });
    }

    return c.json({
        hasStyle: true,
        styleGuide: profile.styleGuide,
        updatedAt: profile.styleGuideUpdatedAt,
    });
});

/**
 * PUT /api/style/update
 * Manually update the style guide (for fine-tuning)
 * Only company admins can update
 */
styleRoutes.put('/update', adminOnlyMiddleware, async (c) => {
    const companyId = getCompanyId(c);
    if (!companyId) {
        return c.json({ error: 'Company context required' }, 400);
    }

    const body = await c.req.json() as { styleGuide: string };

    if (!body.styleGuide || typeof body.styleGuide !== 'string') {
        return c.json({ error: 'styleGuide is required and must be a string' }, 400);
    }

    if (body.styleGuide.length > 10000) {
        return c.json({ error: 'styleGuide must be under 10,000 characters' }, 400);
    }

    const db = createDb(c.env.DATABASE_URL);
    const now = new Date();

    // Check if profile exists
    const [existingProfile] = await db
        .select()
        .from(companyProfile)
        .where(eq(companyProfile.companyId, companyId))
        .limit(1);

    if (existingProfile) {
        await db
            .update(companyProfile)
            .set({
                styleGuide: body.styleGuide,
                styleGuideUpdatedAt: now,
                updatedAt: now,
            })
            .where(eq(companyProfile.companyId, companyId));
    } else {
        await db
            .insert(companyProfile)
            .values({
                companyId,
                styleGuide: body.styleGuide,
                styleGuideUpdatedAt: now,
            });
    }

    // Invalidate ConfigDO cache
    try {
        const configId = c.env.CONFIG_DO.idFromName('global');
        const configStub = c.env.CONFIG_DO.get(configId);
        await configStub.fetch(new Request('https://internal/invalidate', { method: 'POST' }));
    } catch (e) {
        console.warn('[Style] Failed to invalidate ConfigDO cache:', e);
    }

    console.log(`[Style] Manually updated style for company ${companyId}`);

    return c.json({
        success: true,
        message: 'Style guide updated successfully',
    });
});

/**
 * DELETE /api/style
 * Clear the style guide
 * Only company admins can delete
 */
styleRoutes.delete('/', adminOnlyMiddleware, async (c) => {
    const companyId = getCompanyId(c);
    if (!companyId) {
        return c.json({ error: 'Company context required' }, 400);
    }

    const db = createDb(c.env.DATABASE_URL);

    await db
        .update(companyProfile)
        .set({
            styleGuide: null,
            styleGuideUpdatedAt: null,
            updatedAt: new Date(),
        })
        .where(eq(companyProfile.companyId, companyId));

    // Invalidate ConfigDO cache
    try {
        const configId = c.env.CONFIG_DO.idFromName('global');
        const configStub = c.env.CONFIG_DO.get(configId);
        await configStub.fetch(new Request('https://internal/invalidate', { method: 'POST' }));
    } catch (e) {
        console.warn('[Style] Failed to invalidate ConfigDO cache:', e);
    }

    console.log(`[Style] Cleared style for company ${companyId}`);

    return c.json({
        success: true,
        message: 'Style guide cleared',
    });
});

export default styleRoutes;
