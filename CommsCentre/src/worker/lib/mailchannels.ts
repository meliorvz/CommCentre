import { Env } from '../../types';
import { AI_AGENT_NAME } from '@shared/constants';

interface SendEmailParams {
    to: string;
    from: string;
    subject: string;
    text: string;
    html?: string;
}

export async function sendEmail(env: Env, params: SendEmailParams): Promise<string> {
    const { to, from, subject, text, html } = params;

    // MailChannels Email API
    const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': env.MAILCHANNELS_API_KEY,
        },
        body: JSON.stringify({
            personalizations: [
                {
                    to: [{ email: to }],
                },
            ],
            from: {
                email: from,
                name: AI_AGENT_NAME,
            },
            subject,
            content: [
                {
                    type: 'text/plain',
                    value: text,
                },
                ...(html
                    ? [
                        {
                            type: 'text/html',
                            value: html,
                        },
                    ]
                    : []),
            ],
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`MailChannels error: ${error}`);
    }

    // MailChannels returns message ID in response
    const result = await response.json() as { id?: string };
    return result.id || `mc-${Date.now()}`;
}

// For Cloudflare Email Workers integration (alternative approach)
export async function sendEmailViaWorker(
    message: {
        to: string;
        from: string;
        subject: string;
        text: string;
    }
): Promise<void> {
    // This would be used with Cloudflare Email Routing
    // when you have an EmailMessage binding
    // For now, we use the direct API approach above
}
