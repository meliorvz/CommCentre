import { Env } from '../../types';

export async function sendSms(
    env: Env,
    to: string,
    body: string,
    from?: string
): Promise<string> {
    const accountSid = env.TWILIO_ACCOUNT_SID;
    const authToken = env.TWILIO_AUTH_TOKEN;

    // Use the first number from the account or a configured default
    const fromNumber = from || env.TWILIO_FROM_NUMBER; // Should be configured per property

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
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Twilio error: ${error}`);
    }

    const result = await response.json() as { sid: string };
    return result.sid;
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
