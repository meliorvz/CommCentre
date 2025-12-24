import { Hono } from 'hono';
import { Env } from '../../types';

const oauthRoutes = new Hono<{ Bindings: Env }>();

// OAuth callback handler - exchanges code for tokens
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
