import { Env } from '../../types';

interface TelegramEscalationParams {
    guestName: string;
    guestContact: string;
    propertyName: string;
    dates: string;
    lastMessage: string;
    intent: string;
    confidence: number;
    suggestedReply: string;
    threadId: string;
    adminUrl: string;
}

export async function sendTelegramEscalation(
    env: Env,
    params: TelegramEscalationParams
): Promise<void> {
    const {
        guestName,
        guestContact,
        propertyName,
        dates,
        lastMessage,
        intent,
        confidence,
        suggestedReply,
        threadId,
        adminUrl,
    } = params;

    const message = `🔔 *Escalation Required*

*Guest:* ${escapeMarkdown(guestName)}
*Contact:* ${escapeMarkdown(guestContact)}
*Property:* ${escapeMarkdown(propertyName)}
*Dates:* ${escapeMarkdown(dates)}

*Last Message:*
> ${escapeMarkdown(lastMessage.slice(0, 200))}${lastMessage.length > 200 ? '...' : ''}

*Intent:* ${intent} (${Math.round(confidence * 100)}% confidence)

*Suggested Reply:*
\`\`\`
${suggestedReply.slice(0, 300)}${suggestedReply.length > 300 ? '...' : ''}
\`\`\`

[Open in Admin](${adminUrl}/inbox/${threadId})`;

    await sendTelegramMessage(env, message);
}

export async function sendTelegramMessage(env: Env, text: string): Promise<void> {
    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: env.TELEGRAM_CHAT_ID,
            text,
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('Telegram error:', error);
        throw new Error(`Telegram error: ${response.status}`);
    }
}

function escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}
