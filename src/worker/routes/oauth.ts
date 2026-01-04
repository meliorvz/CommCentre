import { Hono } from 'hono';
import { Env } from '../../types';
import { storeIntegration, deleteIntegration, getIntegrationStatus, GmailCredentials } from '../lib/integration-tokens';
import { authMiddleware } from '../middleware/auth';

type Variables = {
    user: {
        id: string;
        email: string;
        role: string;
        companyId: string | null;
    };
};

const oauthRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// ============================================================================
// GMAIL OAUTH FLOW - Company-Aware
// ============================================================================

/**
 * Generate a secure state token containing company and user context
 * Format: base64url({ companyId, userId, csrf, exp })
 */
async function generateOAuthState(
    env: Env,
    companyId: string,
    userId: string
): Promise<string> {
    const state = {
        companyId,
        userId,
        csrf: crypto.randomUUID(),
        exp: Date.now() + 5 * 60 * 1000, // 5 minute expiry
    };

    const stateJson = JSON.stringify(state);
    const stateBase64 = btoa(stateJson);

    // Store in KV for verification (prevents replay attacks)
    if (env.KV) {
        await env.KV.put(`oauth_state:${state.csrf}`, stateJson, { expirationTtl: 300 });
    }

    return stateBase64;
}

/**
 * Verify and decode OAuth state token
 */
async function verifyOAuthState(
    env: Env,
    stateBase64: string
): Promise<{ companyId: string; userId: string } | null> {
    try {
        const stateJson = atob(stateBase64);
        const state = JSON.parse(stateJson) as {
            companyId: string;
            userId: string;
            csrf: string;
            exp: number;
        };

        // Check expiry
        if (Date.now() > state.exp) {
            console.log('[OAuth] State token expired');
            return null;
        }

        // Verify against KV if available
        if (env.KV) {
            const stored = await env.KV.get(`oauth_state:${state.csrf}`);
            if (!stored) {
                console.log('[OAuth] State token not found in KV (possible replay attack)');
                return null;
            }
            // Delete used state to prevent replay
            await env.KV.delete(`oauth_state:${state.csrf}`);
        }

        return { companyId: state.companyId, userId: state.userId };
    } catch (e) {
        console.error('[OAuth] Failed to verify state:', e);
        return null;
    }
}

/**
 * GET /oauth/gmail/connect
 * Initiates Gmail OAuth flow for the authenticated user's company
 * Requires JWT authentication
 */
oauthRoutes.get('/gmail/connect', authMiddleware, async (c) => {
    const user = c.get('user');

    if (!user.companyId) {
        return c.json({ error: 'User must belong to a company to connect Gmail' }, 403);
    }

    // Only company admins can connect Gmail
    if (user.role !== 'company_admin' && user.role !== 'super_admin') {
        return c.json({ error: 'Only company admins can connect Gmail' }, 403);
    }

    const clientId = c.env.GMAIL_CLIENT_ID;
    if (!clientId) {
        return c.json({ error: 'Gmail OAuth not configured (missing GMAIL_CLIENT_ID)' }, 500);
    }

    // Generate state token with company context
    const state = await generateOAuthState(c.env, user.companyId, user.id);

    // Build redirect URI
    const url = new URL(c.req.url);
    const redirectUri = `${url.protocol}//${url.host}/oauth/gmail/callback`;

    // Build Google OAuth URL
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email');
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent'); // Force consent to get refresh token
    authUrl.searchParams.set('state', state);

    return c.redirect(authUrl.toString());
});

/**
 * GET /oauth/gmail/callback
 * Handles Google OAuth callback, stores tokens per-company
 */
oauthRoutes.get('/gmail/callback', async (c) => {
    const code = c.req.query('code');
    const state = c.req.query('state');
    const error = c.req.query('error');

    // Get the frontend URL for redirect
    let frontendUrl = c.env.FRONTEND_URL;

    // In development, fallback to localhost
    if (!frontendUrl && c.env.ENVIRONMENT !== 'production') {
        frontendUrl = 'http://localhost:5173';
    }

    if (!frontendUrl) {
        console.error('[OAuth] FRONTEND_URL not configured (required in production)');
        return c.text('Configuration Error: FRONTEND_URL not set', 500);
    }

    if (error) {
        console.error('[OAuth] Google returned error:', error);
        return c.redirect(`${frontendUrl}/settings/integrations?gmail=error&message=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
        return c.redirect(`${frontendUrl}/settings/integrations?gmail=error&message=missing_params`);
    }

    // Verify state token
    const stateData = await verifyOAuthState(c.env, state);
    if (!stateData) {
        return c.redirect(`${frontendUrl}/settings/integrations?gmail=error&message=invalid_state`);
    }

    const { companyId, userId } = stateData;

    // Check required credentials
    const clientId = c.env.GMAIL_CLIENT_ID;
    const clientSecret = c.env.GMAIL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        return c.redirect(`${frontendUrl}/settings/integrations?gmail=error&message=oauth_not_configured`);
    }

    // Build redirect URI (must match what was used in /connect)
    const url = new URL(c.req.url);
    const redirectUri = `${url.protocol}//${url.host}/oauth/gmail/callback`;

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
        }),
    });

    const tokens = await tokenResponse.json() as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        error?: string;
        error_description?: string;
    };

    if (tokens.error || !tokens.refresh_token) {
        console.error('[OAuth] Token exchange failed:', tokens.error, tokens.error_description);
        return c.redirect(`${frontendUrl}/settings/integrations?gmail=error&message=token_exchange_failed`);
    }

    // Get user's email address for display
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const userInfo = await userInfoResponse.json() as { email?: string };
    const connectedEmail = userInfo.email || 'unknown';

    // Store tokens encrypted per-company
    const credentials: GmailCredentials = {
        refreshToken: tokens.refresh_token,
        accessToken: tokens.access_token,
        expiresAt: Date.now() + (tokens.expires_in! * 1000),
        fromAddress: connectedEmail,
    };

    await storeIntegration(
        c.env,
        companyId,
        'gmail',
        credentials,
        connectedEmail,
        userId
    );

    console.log(`[OAuth] Gmail connected for company ${companyId}: ${connectedEmail}`);

    return c.redirect(`${frontendUrl}/settings/integrations?gmail=connected&email=${encodeURIComponent(connectedEmail)}`);
});

/**
 * DELETE /oauth/gmail
 * Disconnects Gmail for the authenticated user's company
 * Requires JWT authentication
 */
oauthRoutes.delete('/gmail', authMiddleware, async (c) => {
    const user = c.get('user');

    if (!user.companyId) {
        return c.json({ error: 'User must belong to a company' }, 403);
    }

    // Only company admins can disconnect Gmail
    if (user.role !== 'company_admin' && user.role !== 'super_admin') {
        return c.json({ error: 'Only company admins can disconnect Gmail' }, 403);
    }

    await deleteIntegration(c.env, user.companyId, 'gmail', user.id);

    console.log(`[OAuth] Gmail disconnected for company ${user.companyId}`);

    return c.json({ success: true, message: 'Gmail disconnected' });
});

/**
 * GET /oauth/gmail/status
 * Get Gmail connection status for the authenticated user's company
 * Requires JWT authentication
 */
oauthRoutes.get('/gmail/status', authMiddleware, async (c) => {
    const user = c.get('user');

    if (!user.companyId) {
        return c.json({ error: 'User must belong to a company' }, 403);
    }

    const status = await getIntegrationStatus(c.env, user.companyId, 'gmail');

    if (!status) {
        return c.json({
            connected: false,
            email: null,
            lastUsedAt: null,
            error: null,
        });
    }

    return c.json({
        connected: status.active,
        email: status.accountIdentifier,
        lastUsedAt: status.lastUsedAt,
        error: status.lastError,
    });
});

// ============================================================================
// LEGACY CALLBACK (for manual setup / backward compatibility)
// ============================================================================

// OAuth callback handler - exchanges code for tokens (legacy - shows token for manual setup)
oauthRoutes.get('/callback', async (c) => {
    const code = c.req.query('code');
    const error = c.req.query('error');

    // Get the redirect URI dynamically from the request
    const url = new URL(c.req.url);
    const redirectUri = `${url.protocol}//${url.host}/oauth/callback`;

    if (error) {
        return c.html(`
            <html>
                <body style="font-family: system-ui; padding: 40px; max-width: 600px; margin: 0 auto;">
                    <h1>❌ Authorization Failed</h1>
                    <p>Error: ${error}</p>
                    <p>${c.req.query('error_description') || ''}</p>
                </body>
            </html>
        `);
    }

    if (!code) {
        return c.html(`
            <html>
                <body style="font-family: system-ui; padding: 40px; max-width: 600px; margin: 0 auto;">
                    <h1>❌ No Authorization Code</h1>
                    <p>No authorization code was provided.</p>
                </body>
            </html>
        `);
    }

    // Check if we have the necessary secrets
    const clientId = c.env.GMAIL_CLIENT_ID;
    const clientSecret = c.env.GMAIL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        return c.html(`
            <html>
                <body style="font-family: system-ui; padding: 40px; max-width: 600px; margin: 0 auto;">
                    <h1>✅ Authorization Code Received</h1>
                    <p>Copy this code and exchange it manually (GMAIL_CLIENT_ID/SECRET not configured):</p>
                    <code style="background: #f0f0f0; padding: 10px; display: block; word-break: break-all;">${code}</code>
                    <h2>Exchange Command:</h2>
                    <pre style="background: #f0f0f0; padding: 10px; overflow-x: auto;">
curl -X POST https://oauth2.googleapis.com/token \\
  -d "code=${code}" \\
  -d "client_id=YOUR_CLIENT_ID" \\
  -d "client_secret=YOUR_CLIENT_SECRET" \\
  -d "redirect_uri=${redirectUri}" \\
  -d "grant_type=authorization_code"
                    </pre>
                </body>
            </html>
        `);
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
        }),
    });

    const tokens = await tokenResponse.json() as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        error?: string;
        error_description?: string;
    };

    if (tokens.error) {
        return c.html(`
            <html>
                <body style="font-family: system-ui; padding: 40px; max-width: 600px; margin: 0 auto;">
                    <h1>❌ Token Exchange Failed</h1>
                    <p>Error: ${tokens.error}</p>
                    <p>${tokens.error_description || ''}</p>
                </body>
            </html>
        `);
    }

    // Show the refresh token - user needs to save this as a secret
    return c.html(`
        <html>
            <body style="font-family: system-ui; padding: 40px; max-width: 600px; margin: 0 auto;">
                <h1>✅ Authorization Successful!</h1>
                <p>Save this <strong>refresh token</strong> as a Cloudflare secret:</p>
                <code style="background: #f0f0f0; padding: 10px; display: block; word-break: break-all; margin: 20px 0;">${tokens.refresh_token}</code>
                <h2>Run this command:</h2>
                <pre style="background: #f0f0f0; padding: 10px; overflow-x: auto;">
CLOUDFLARE_ACCOUNT_ID=c0d9c96e45a93917e2d7cbeed2636e4a \\
npx wrangler secret put GMAIL_REFRESH_TOKEN
                </pre>
                <p>Then paste the refresh token above when prompted.</p>
                <p style="color: #666; margin-top: 30px;">
                    ⚠️ Keep this token secure. It provides access to send emails from your account.
                </p>
            </body>
        </html>
    `);
});

export default oauthRoutes;
