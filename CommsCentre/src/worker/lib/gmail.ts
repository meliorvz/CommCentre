import { Env } from '../../types';

interface SendEmailParams {
    to: string;
    from: string;
    subject: string;
    text: string;
    html?: string;
    cc?: string;
    // Email threading headers
    inReplyTo?: string;      // Message-ID of the email we're replying to
    references?: string;      // Chain of Message-IDs in the thread
}

interface GmailTokenResponse {
    access_token: string;
    expires_in: number;
    token_type: string;
}

// Cache access token in memory (will reset on worker restart, but that's fine)
let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

async function getAccessToken(env: Env): Promise<string> {
    // Check if we have a valid cached token
    if (cachedAccessToken && Date.now() < tokenExpiresAt - 60000) {
        return cachedAccessToken;
    }

    // Refresh the access token
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: env.GMAIL_CLIENT_ID!,
            client_secret: env.GMAIL_CLIENT_SECRET!,
            refresh_token: env.GMAIL_REFRESH_TOKEN!,
            grant_type: 'refresh_token',
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to refresh Gmail access token: ${error}`);
    }

    const data = await response.json() as GmailTokenResponse;
    cachedAccessToken = data.access_token;
    tokenExpiresAt = Date.now() + (data.expires_in * 1000);

    return data.access_token;
}

function createRawEmail(params: SendEmailParams): string {
    const { to, from, subject, text, html, cc, inReplyTo, references } = params;

    const boundary = `boundary_${Date.now()}`;

    let email = '';
    email += `From: ${from}\r\n`;
    email += `To: ${to}\r\n`;
    if (cc) {
        email += `Cc: ${cc}\r\n`;
    }
    email += `Subject: ${subject}\r\n`;
    // Threading headers - critical for keeping replies in the same email thread
    if (inReplyTo) {
        email += `In-Reply-To: ${inReplyTo}\r\n`;
    }
    if (references) {
        email += `References: ${references}\r\n`;
    }
    email += `MIME-Version: 1.0\r\n`;

    if (html) {
        email += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n`;
        email += `\r\n`;
        email += `--${boundary}\r\n`;
        email += `Content-Type: text/plain; charset="UTF-8"\r\n`;
        email += `\r\n`;
        email += `${text}\r\n`;
        email += `--${boundary}\r\n`;
        email += `Content-Type: text/html; charset="UTF-8"\r\n`;
        email += `\r\n`;
        email += `${html}\r\n`;
        email += `--${boundary}--\r\n`;
    } else {
        email += `Content-Type: text/plain; charset="UTF-8"\r\n`;
        email += `\r\n`;
        email += `${text}\r\n`;
    }

    // Base64url encode the email
    const base64 = btoa(unescape(encodeURIComponent(email)));
    const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    return base64url;
}

export async function sendEmailViaGmail(env: Env, params: SendEmailParams): Promise<string> {
    // Check if Gmail is configured
    if (!env.GMAIL_CLIENT_ID || !env.GMAIL_CLIENT_SECRET || !env.GMAIL_REFRESH_TOKEN) {
        throw new Error('Gmail not configured. Missing GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, or GMAIL_REFRESH_TOKEN');
    }

    const accessToken = await getAccessToken(env);
    const rawEmail = createRawEmail(params);

    // Send via Gmail API
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            raw: rawEmail,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gmail API error: ${error}`);
    }

    const result = await response.json() as { id: string; threadId: string };
    console.log(`Email sent via Gmail. Message ID: ${result.id}`);

    return result.id;
}

// Wrapper that maintains the same interface as the old sendEmail function
// Automatically applies GMAIL_FROM_ADDRESS and GMAIL_CC_ADDRESS from env if not provided
export async function sendEmail(env: Env, params: SendEmailParams): Promise<string> {
    // Handle 'null' string value (from Cloudflare UI) as undefined
    const ccAddress = env.GMAIL_CC_ADDRESS && env.GMAIL_CC_ADDRESS !== 'null' ? env.GMAIL_CC_ADDRESS : undefined;

    // Use configured from address if not explicitly provided (empty string counts as not provided)
    const fromAddress = params.from && params.from.trim() !== ''
        ? params.from
        : env.GMAIL_FROM_ADDRESS;

    if (!fromAddress) {
        throw new Error('No sender email configured. Set GMAIL_FROM_ADDRESS environment variable.');
    }

    const finalParams: SendEmailParams = {
        ...params,
        from: fromAddress,
        cc: params.cc || ccAddress,
    };

    console.log(`[Gmail] Sending email from: ${finalParams.from}, to: ${finalParams.to}, cc: ${finalParams.cc || 'none'}`);

    return sendEmailViaGmail(env, finalParams);
}
