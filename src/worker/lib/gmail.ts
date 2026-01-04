import { Env } from '../../types';
import { getIntegration, storeIntegration, GmailCredentials, deactivateIntegration } from './integration-tokens';

interface Attachment {
    filename: string;
    content: string; // Base64 encoded content
    contentType: string;
}

interface SendEmailParams {
    to: string;
    from: string;
    subject: string;
    text: string;
    html?: string;
    cc?: string | string[];  // Single email, comma-separated, or array
    bcc?: string | string[]; // Single email, comma-separated, or array
    // Email threading headers
    inReplyTo?: string;      // Message-ID of the email we're replying to
    references?: string;      // Chain of Message-IDs in the thread
    attachments?: Attachment[];
}

interface GmailTokenResponse {
    access_token: string;
    expires_in: number;
    token_type: string;
    refresh_token?: string; // Google may return a new refresh token on rotation
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

// Per-company access token cache (keyed by companyId)
const companyTokenCache = new Map<string, { accessToken: string; expiresAt: number }>();

/**
 * Refresh Gmail tokens for a specific company and store the new access token
 */
async function refreshCompanyGmailToken(
    env: Env,
    companyId: string,
    credentials: GmailCredentials
): Promise<string> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: env.GMAIL_CLIENT_ID!,
            client_secret: env.GMAIL_CLIENT_SECRET!,
            refresh_token: credentials.refreshToken,
            grant_type: 'refresh_token',
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        console.error(`[Gmail] Token refresh failed for company ${companyId}:`, error);
        // Mark integration as having an error
        await deactivateIntegration(env, companyId, 'gmail', `Token refresh failed: ${error}`);
        throw new Error(`Failed to refresh Gmail access token: ${error}`);
    }

    const data = await response.json() as GmailTokenResponse;
    const newExpiresAt = Date.now() + (data.expires_in * 1000);

    // Update stored credentials with new access token
    // IMPORTANT: If Google returns a new refresh token (rotation), we MUST save it
    const updatedCredentials: GmailCredentials = {
        ...credentials,
        accessToken: data.access_token,
        expiresAt: newExpiresAt,
        refreshToken: data.refresh_token || credentials.refreshToken, // Update if new one provided
    };

    await storeIntegration(
        env,
        companyId,
        'gmail',
        updatedCredentials,
        credentials.fromAddress // Keep the account identifier
    );

    // Update in-memory cache
    companyTokenCache.set(companyId, {
        accessToken: data.access_token,
        expiresAt: newExpiresAt,
    });

    console.log(`[Gmail] Refreshed token for company ${companyId}`);
    return data.access_token;
}

/**
 * Get Gmail access token for a specific company
 * Uses encrypted per-company tokens from database, with automatic refresh
 * Falls back to global env var tokens if no per-company config exists
 */
async function getAccessTokenForCompany(env: Env, companyId: string): Promise<string> {
    // Check in-memory cache first
    const cached = companyTokenCache.get(companyId);
    if (cached && Date.now() < cached.expiresAt - 60000) {
        return cached.accessToken;
    }

    // Fetch per-company credentials from encrypted storage
    const credentials = await getIntegration<GmailCredentials>(env, companyId, 'gmail');

    if (credentials) {
        // Check if stored access token is still valid (with 1 min buffer)
        if (credentials.accessToken && credentials.expiresAt && Date.now() < credentials.expiresAt - 60000) {
            // Update memory cache
            companyTokenCache.set(companyId, {
                accessToken: credentials.accessToken,
                expiresAt: credentials.expiresAt,
            });
            return credentials.accessToken;
        }

        // Need to refresh
        return refreshCompanyGmailToken(env, companyId, credentials);
    }

    // Fallback to global tokens (deprecated)
    console.warn(`[Gmail] Company ${companyId} using deprecated global Gmail tokens - please connect company Gmail`);
    return getAccessToken(env);
}

// Helper to normalize recipients to comma-separated string
function normalizeRecipients(recipients: string | string[] | undefined): string | undefined {
    if (!recipients) return undefined;
    if (Array.isArray(recipients)) {
        return recipients.filter(r => r && r.trim()).join(', ');
    }
    return recipients.trim() || undefined;
}

function createRawEmail(params: SendEmailParams): string {
    const { to, from, subject, text, html, cc, bcc, inReplyTo, references, attachments } = params;

    const boundary = `boundary_${Date.now().toString(16)}`;
    const ccHeader = normalizeRecipients(cc);
    const bccHeader = normalizeRecipients(bcc);

    let email = '';
    email += `From: ${from}\r\n`;
    email += `To: ${to}\r\n`;
    if (ccHeader) {
        email += `Cc: ${ccHeader}\r\n`;
    }
    if (bccHeader) {
        email += `Bcc: ${bccHeader}\r\n`;
    }
    email += `Subject: ${subject}\r\n`;

    // Threading headers
    if (inReplyTo) {
        const normalizedInReplyTo = inReplyTo.startsWith('<') ? inReplyTo : `<${inReplyTo}>`;
        email += `In-Reply-To: ${normalizedInReplyTo}\r\n`;
    }
    if (references) {
        const normalizedReferences = references.startsWith('<') ? references : `<${references}>`;
        email += `References: ${normalizedReferences}\r\n`;
    }
    email += `MIME-Version: 1.0\r\n`;
    email += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n`;
    email += `\r\n`;

    // Body part
    const altBoundary = `alt_boundary_${Date.now().toString(16)}`;
    email += `--${boundary}\r\n`;
    email += `Content-Type: multipart/alternative; boundary="${altBoundary}"\r\n`;
    email += `\r\n`;

    // Text part
    email += `--${altBoundary}\r\n`;
    email += `Content-Type: text/plain; charset="UTF-8"\r\n`;
    email += `\r\n`;
    email += `${text}\r\n`;

    // HTML part
    if (html) {
        email += `--${altBoundary}\r\n`;
        email += `Content-Type: text/html; charset="UTF-8"\r\n`;
        email += `\r\n`;
        email += `${html}\r\n`;
    }
    email += `--${altBoundary}--\r\n`;

    // Attachments
    if (attachments && attachments.length > 0) {
        for (const attachment of attachments) {
            email += `--${boundary}\r\n`;
            email += `Content-Type: ${attachment.contentType}; name="${attachment.filename}"\r\n`;
            email += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n`;
            email += `Content-Transfer-Encoding: base64\r\n`;
            email += `\r\n`;
            // Ensure base64 lines are chunked at 76 chars for safety (though not strictly required by all parsers, good practice)
            const chunked = attachment.content.match(/.{1,76}/g)?.join('\r\n') || attachment.content;
            email += `${chunked}\r\n`;
        }
    }

    email += `--${boundary}--\r\n`;

    // Base64url encode the email
    // Use standard btoa implementation
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

// Helper to merge CC addresses - combines request cc with environment default
function mergeCcAddresses(requestCc: string | string[] | undefined, envCc: string | undefined): string[] | undefined {
    const ccList: string[] = [];

    // Add request CC addresses
    if (requestCc) {
        if (Array.isArray(requestCc)) {
            ccList.push(...requestCc.filter(c => c && c.trim()));
        } else if (requestCc.trim()) {
            ccList.push(...requestCc.split(',').map(c => c.trim()).filter(c => c));
        }
    }

    // Add environment CC if not already in list
    if (envCc && !ccList.includes(envCc)) {
        ccList.push(envCc);
    }

    return ccList.length > 0 ? ccList : undefined;
}

// Wrapper that maintains the same interface as the old sendEmail function
// Automatically applies GMAIL_FROM_ADDRESS and GMAIL_CC_ADDRESS from env if not provided
export async function sendEmail(env: Env, params: SendEmailParams): Promise<string> {
    // Handle 'null' string value (from Cloudflare UI) as undefined
    const envCcAddress = env.GMAIL_CC_ADDRESS && env.GMAIL_CC_ADDRESS !== 'null' ? env.GMAIL_CC_ADDRESS : undefined;

    // Use configured from address if not explicitly provided (empty string counts as not provided)
    const fromAddress = params.from && params.from.trim() !== ''
        ? params.from
        : env.GMAIL_FROM_ADDRESS;

    if (!fromAddress) {
        throw new Error('No sender email configured. Set GMAIL_FROM_ADDRESS environment variable.');
    }

    // Merge request CC with environment CC
    const mergedCc = mergeCcAddresses(params.cc, envCcAddress);

    const finalParams: SendEmailParams = {
        ...params,
        from: fromAddress,
        cc: mergedCc,
        bcc: params.bcc,
    };

    const ccDisplay = normalizeRecipients(finalParams.cc) || 'none';
    const bccDisplay = normalizeRecipients(finalParams.bcc) || 'none';
    console.log(`[Gmail] Sending email from: ${finalParams.from}, to: ${finalParams.to}, cc: ${ccDisplay}, bcc: ${bccDisplay}`);

    return sendEmailViaGmail(env, finalParams);
}

/**
 * Send email using per-company Gmail credentials
 * Uses encrypted per-company tokens from database, with automatic refresh
 * Falls back to global env var tokens if no per-company config exists
 * 
 * @param env - Environment with DATABASE_URL, ENCRYPTION_MASTER_KEY, and GMAIL_CLIENT_ID/SECRET
 * @param companyId - Company UUID to send email for
 * @param params - Email parameters (to, from, subject, text, etc.)
 */
export async function sendEmailForCompany(
    env: Env,
    companyId: string,
    params: SendEmailParams
): Promise<string> {
    // Get access token for this specific company (or fallback to global)
    const accessToken = await getAccessTokenForCompany(env, companyId);

    // Get company's from address from stored credentials (if available)
    const credentials = await getIntegration<GmailCredentials>(env, companyId, 'gmail');

    // Determine from address
    const fromAddress = params.from && params.from.trim() !== ''
        ? params.from
        : credentials?.fromAddress || env.GMAIL_FROM_ADDRESS;

    if (!fromAddress) {
        throw new Error(`No sender email configured for company ${companyId}. Connect Gmail or set GMAIL_FROM_ADDRESS environment variable.`);
    }

    const finalParams: SendEmailParams = {
        ...params,
        from: fromAddress,
    };

    const rawEmail = createRawEmail(finalParams);

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
        console.error(`[Gmail] API error for company ${companyId}:`, error);
        throw new Error(`Gmail API error: ${error}`);
    }

    const result = await response.json() as { id: string; threadId: string };
    console.log(`[Gmail] Email sent for company ${companyId}. Message ID: ${result.id}, from: ${fromAddress}`);

    return result.id;
}

/**
 * Check if a company has Gmail connected
 */
export async function hasGmailConnected(env: Env, companyId: string): Promise<boolean> {
    const credentials = await getIntegration<GmailCredentials>(env, companyId, 'gmail');
    return credentials !== null;
}

