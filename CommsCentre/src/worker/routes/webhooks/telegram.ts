import { Hono } from 'hono';
import { Env } from '../../../types';
import { sendTelegramMessage } from '../../lib/telegram';

const telegramWebhooks = new Hono<{ Bindings: Env }>();

telegramWebhooks.post('/', async (c) => {
    const update = await c.req.json();
    console.log('[TELEGRAM WEBHOOK] Received update:', JSON.stringify(update, null, 2));

    // Handle button clicks
    if (update.callback_query) {
        const query = update.callback_query;
        const data = query.data; // e.g., "send:thread-uuid"
        const [action, threadId] = data.split(':');
        console.log('[TELEGRAM WEBHOOK] Callback query:', action, threadId);

        // CRITICAL: Answer callback query IMMEDIATELY to stop the loading spinner
        // This must happen before any potentially slow operations (DB, external APIs)
        // Telegram times out after ~30 seconds if we don't answer
        await fetch(`https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: query.id }),
        });

        try {
            const threadDO = c.env.THREAD_DO.get(c.env.THREAD_DO.idFromName(threadId));

            if (action === 'send') {
                console.log('[TELEGRAM WEBHOOK] Sending message for thread:', threadId);
                const resp = await threadDO.fetch('http://internal/telegram-action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'send' }),
                });

                if (resp.ok) {
                    await sendTelegramMessage(c.env, '✅ Message sent to guest!');
                } else {
                    const errorText = await resp.text();
                    console.error('[TELEGRAM WEBHOOK] Send failed:', errorText);
                    await sendTelegramMessage(c.env, `❌ Failed to send message: ${errorText}`);
                }
            } else if (action === 'ignore') {
                console.log('[TELEGRAM WEBHOOK] Ignoring thread:', threadId);
                const resp = await threadDO.fetch('http://internal/telegram-action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'ignore' }),
                });

                if (resp.ok) {
                    await sendTelegramMessage(c.env, '❌ Escalation ignored.');
                }
            } else if (action === 'edit') {
                console.log('[TELEGRAM WEBHOOK] Edit requested for thread:', threadId);
                await sendTelegramMessage(c.env, `📝 Please reply to THIS message with the new text for the guest.\n\n(Thread: ${threadId})`, {
                    force_reply: true,
                    selective: true,
                });
            }
        } catch (error: any) {
            console.error('[TELEGRAM WEBHOOK] Action failed:', error);
            await sendTelegramMessage(c.env, `❌ Action failed: ${error.message || 'Unknown error'}`);
        }

        return c.text('OK');
    }

    // Handle replies (for editing)
    if (update.message && update.message.reply_to_message) {
        const replyTo = update.message.reply_to_message;
        const text = update.message.text;
        console.log('[TELEGRAM WEBHOOK] Reply detected. Reply-to text:', replyTo.text);
        console.log('[TELEGRAM WEBHOOK] User text:', text);

        // Extract threadId from our previous message
        const match = replyTo.text?.match(/\(Thread: ([a-f0-9-]+)\)/);
        console.log('[TELEGRAM WEBHOOK] Regex match result:', match);

        if (match) {
            const threadId = match[1];
            console.log('[TELEGRAM WEBHOOK] Updating draft for thread:', threadId);
            const threadDO = c.env.THREAD_DO.get(c.env.THREAD_DO.idFromName(threadId));

            // Update draft and show preview
            const resp = await threadDO.fetch('http://internal/telegram-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update_draft', text }),
            });

            console.log('[TELEGRAM WEBHOOK] Update draft response:', resp.status);

            if (resp.ok) {
                const keyboard = {
                    inline_keyboard: [
                        [
                            { text: 'Confirm & Send ✅', callback_data: `send:${threadId}` },
                            { text: 'Cancel ❌', callback_data: `ignore:${threadId}` },
                        ],
                    ],
                };
                // Use HTML for the preview (escaping user text)
                const escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                await sendTelegramMessage(c.env, `📝 <b>Preview of new message:</b>\n\n${escapedText}`, keyboard);
            } else {
                const errorText = await resp.text();
                console.error('[TELEGRAM WEBHOOK] Update draft failed:', errorText);
                await sendTelegramMessage(c.env, `❌ Failed to update draft: ${errorText}`);
            }
        } else {
            console.log('[TELEGRAM WEBHOOK] No thread ID found in reply-to message');
        }
    }

    return c.text('OK');
});

export default telegramWebhooks;
