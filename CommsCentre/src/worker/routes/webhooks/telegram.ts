import { Hono } from 'hono';
import { Env } from '../../../types';
import { sendTelegramMessage } from '../../lib/telegram';

const telegramWebhooks = new Hono<{ Bindings: Env }>();

telegramWebhooks.post('/', async (c) => {
    const update = await c.req.json();

    // Handle button clicks
    if (update.callback_query) {
        const query = update.callback_query;
        const data = query.data; // e.g., "send:thread-uuid"
        const [action, threadId] = data.split(':');

        const threadDO = c.env.THREAD_DO.get(c.env.THREAD_DO.idFromName(threadId));

        if (action === 'send') {
            const resp = await threadDO.fetch('http://internal/telegram-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'send' }),
            });

            if (resp.ok) {
                await sendTelegramMessage(c.env, '✅ Message sent to guest!');
            } else {
                await sendTelegramMessage(c.env, '❌ Failed to send message.');
            }
        } else if (action === 'ignore') {
            const resp = await threadDO.fetch('http://internal/telegram-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'ignore' }),
            });

            if (resp.ok) {
                await sendTelegramMessage(c.env, '❌ Escalation ignored.');
            }
        } else if (action === 'edit') {
            await sendTelegramMessage(c.env, `📝 Please reply to THIS message with the new text for the guest. (Thread: ${threadId})`, {
                force_reply: true,
                selective: true,
            });
        }

        // Answer callback query to stop the loading spinner
        await fetch(`https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: query.id }),
        });

        return c.text('OK');
    }

    // Handle replies (for editing)
    if (update.message && update.message.reply_to_message) {
        const replyTo = update.message.reply_to_message;
        const text = update.message.text;

        // Extract threadId from our previous message
        const match = replyTo.text?.match(/\(Thread: (.*)\)/);
        if (match) {
            const threadId = match[1];
            const threadDO = c.env.THREAD_DO.get(c.env.THREAD_DO.idFromName(threadId));

            // Update draft and show preview
            const resp = await threadDO.fetch('http://internal/telegram-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update_draft', text }),
            });

            if (resp.ok) {
                const keyboard = {
                    inline_keyboard: [
                        [
                            { text: 'Confirm & Send ✅', callback_data: `send:${threadId}` },
                            { text: 'Cancel ❌', callback_data: `ignore:${threadId}` },
                        ],
                    ],
                };
                await sendTelegramMessage(c.env, `📝 *Preview of new message:*\n\n${text}`, keyboard);
            }
        }
    }

    return c.text('OK');
});

export default telegramWebhooks;
