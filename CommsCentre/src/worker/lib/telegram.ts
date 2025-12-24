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
    errorDetails?: string;
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
        errorDetails,
    } = params;

    let message = `🔔 <b>Escalation Required</b>

<b>Guest:</b> ${escapeHtml(guestName)}
<b>Contact:</b> ${escapeHtml(guestContact)}
<b>Property:</b> ${escapeHtml(propertyName)}
<b>Dates:</b> ${escapeHtml(dates)}

<b>Last Message:</b>
<blockquote>${escapeHtml(lastMessage.slice(0, 200))}${lastMessage.length > 200 ? '...' : ''}</blockquote>

<b>Intent:</b> ${intent} (${Math.round(confidence * 100)}% confidence)`;

    if (errorDetails) {
        message += `\n\n⚠️ <b>Error:</b> ${escapeHtml(errorDetails)}`;
    }

    message += `\n\n<b>Suggested Reply:</b>
<pre>${escapeHtml(suggestedReply.slice(0, 300))}${suggestedReply.length > 300 ? '...' : ''}</pre>

<a href="${adminUrl}/inbox/${threadId}">Open in Admin</a>`;

    const keyboard = {
        inline_keyboard: [
            [
                { text: 'Send ✅', callback_data: `send:${threadId}` },
                { text: 'Edit 📝', callback_data: `edit:${threadId}` },
                { text: 'Ignore ❌', callback_data: `ignore:${threadId}` },
            ],
        ],
    };

    await sendTelegramMessage(env, message, keyboard);
}

export async function sendTelegramMessage(env: Env, text: string, reply_markup?: any): Promise<void> {
    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: env.TELEGRAM_CHAT_ID,
            text,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            reply_markup,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('Telegram error:', error);
        throw new Error(`Telegram error: ${response.status}`);
    }
}

interface TelegramAutoReplyParams {
    guestName: string;
    guestContact: string;
    propertyName: string;
    guestMessage: string;
    replySent: string;
    replyChannel: string;
    threadId: string;
    adminUrl: string;
}

export async function sendTelegramAutoReplyNotification(
    env: Env,
    params: TelegramAutoReplyParams
): Promise<void> {
    const {
        guestName,
        guestContact,
        propertyName,
        guestMessage,
        replySent,
        replyChannel,
        threadId,
        adminUrl,
    } = params;

    const message = `🤖 <b>Auto-Reply Sent</b>

<b>Guest:</b> ${escapeHtml(guestName)}
<b>Contact:</b> ${escapeHtml(guestContact)}
<b>Property:</b> ${escapeHtml(propertyName)}
<b>Channel:</b> ${replyChannel.toUpperCase()}

<b>Guest Message:</b>
<blockquote>${escapeHtml(guestMessage.slice(0, 200))}${guestMessage.length > 200 ? '...' : ''}</blockquote>

<b>Reply Sent:</b>
<pre>${escapeHtml(replySent.slice(0, 300))}${replySent.length > 300 ? '...' : ''}</pre>

<a href="${adminUrl}/inbox/${threadId}">Open in Admin</a>`;

    await sendTelegramMessage(env, message);
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
