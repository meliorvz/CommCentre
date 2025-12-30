import { Hono } from 'hono';
import { Env } from '../../types';
import { sendTelegramMessage } from '../lib/telegram';

const notificationsRoutes = new Hono<{ Bindings: Env }>();

// Middleware to check API Key
notificationsRoutes.use('*', async (c, next) => {
    const apiKey = c.req.header('x-api-key');
    if (!apiKey || apiKey !== c.env.NOTIFICATION_API_KEY) {
        return c.json({ error: 'Unauthorized: Invalid or missing API Key' }, 401);
    }
    await next();
});

// POST /api/notifications/telegram
// Helper for external automation scripts
notificationsRoutes.post('/telegram', async (c) => {
    try {
        const body = await c.req.json();
        const { text, chatId } = body;

        if (!text) {
            return c.json({ error: 'Missing "text" field' }, 400);
        }

        // Determine target chat ID
        // 1. Use provided chatId if present
        // 2. Fallback to default admin chat ID from env
        const targetChatId = chatId || c.env.TELEGRAM_CHAT_ID;

        // If specific chatId provided (or defaulting to it), send appropriately
        if (chatId && chatId !== c.env.TELEGRAM_CHAT_ID) {
            const url = `https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: text,
                    parse_mode: 'HTML',
                }),
            });

            if (!response.ok) {
                const error = await response.text();
                return c.json({ error: `Telegram API error: ${error}` }, 500);
            }
        } else {
            // Use the convenience function which uses the default env var
            // valid if chatId matches env var or if no chatId provided
            await sendTelegramMessage(c.env, text);
        }

        return c.json({ success: true, target: chatId ? 'specific' : 'default' });
    } catch (error: any) {
        console.error('Failed to send notification:', error);
        return c.json({ error: error.message || 'Internal server error' }, 500);
    }
});

export default notificationsRoutes;
