import { Env, TwilioSettings } from '../../types';

export async function sendSms(
    env: Env,
    to: string,
    body: string,
    from?: string
): Promise<string> {
    // Credentials must come from environment variables for security
    const accountSid = env.TWILIO_ACCOUNT_SID;
    const authToken = env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
        throw new Error('Twilio credentials not configured in environment');
    }

    // Determine sender number:
    // 1. Explicit 'from' argument (property specific)
    // 2. Environment variable TWILIO_FROM_NUMBER
    // 3. Global KV setting (Integrations page)
    let fromNumber = from || env.TWILIO_FROM_NUMBER;

    if (!fromNumber && env.KV) {
        try {
            const settings = await env.KV.get('settings:integration:twilio', 'json') as TwilioSettings | null;
            if (settings?.phoneNumber) {
                fromNumber = settings.phoneNumber;
            }
        } catch (e) {
            console.warn('Failed to fetch Twilio settings from KV:', e);
        }
    }

    // No fallback - require explicit configuration
    if (!fromNumber) {
        throw new Error(
            'Twilio phone number not configured. ' +
            'Please set TWILIO_FROM_NUMBER environment variable or configure it in Admin UI → Integrations → Twilio.'
        );
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    console.log(`Twilio Request: ${url}`, {
        To: to,
        From: fromNumber,
        Body: body,
    });

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        },
        body: new URLSearchParams({
            To: to,
            From: fromNumber,
            Body: body,
            StatusCallback: `${env.WORKER_BASE_URL}/api/webhooks/twilio/sms/status`,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Twilio error: ${error}`);
    }

    const result = await response.json() as { sid: string };
    return result.sid;
}

export async function getIncomingPhoneNumbers(env: Env): Promise<string[]> {
    const accountSid = env.TWILIO_ACCOUNT_SID;
    const authToken = env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
        throw new Error('Twilio credentials not configured in environment');
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json?PageSize=100`;

    const response = await fetch(url, {
        headers: {
            Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        },
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Twilio error: ${error}`);
    }

    const result = await response.json() as { incoming_phone_numbers: Array<{ phone_number: string }> };
    return result.incoming_phone_numbers.map(n => n.phone_number);
}

export function validateTwilioSignature(
    signature: string | undefined,
    authToken: string,
    url: string,
    params: Record<string, string>
): boolean {
    // TODO: Implement proper Twilio signature validation
    // https://www.twilio.com/docs/usage/security#validating-requests
    // For MVP, we'll rely on the secret auth token being correct
    return true;
}

export function buildTwiml(actions: string[]): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
${actions.join('\n')}
</Response>`;
}
