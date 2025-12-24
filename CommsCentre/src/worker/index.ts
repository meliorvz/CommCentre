import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Env } from '../types';
import { createDb } from '../db';

// Route imports
import authRoutes from './routes/auth';
import propertiesRoutes from './routes/properties';
import staysRoutes from './routes/stays';
import threadsRoutes from './routes/threads';
import settingsRoutes from './routes/settings';
import templatesRoutes from './routes/templates';
import promptRoutes from './routes/prompt';
import twilioWebhooks from './routes/webhooks/twilio';
import mailchannelsWebhooks from './routes/webhooks/mailchannels';
import telegramWebhooks from './routes/webhooks/telegram';

// Durable Object exports
export { ThreadDO } from '../do/ThreadDO';
export { SchedulerDO } from '../do/SchedulerDO';
export { ConfigDO } from '../do/ConfigDO';

const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', logger());
app.use('/api/*', cors({
    origin: ['http://localhost:5173', 'https://comms-centre-admin.pages.dev', 'https://8cb49dc2.comms-centre-admin.pages.dev'],
    credentials: true,
}));

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Webhooks (no auth required, signature validation instead)
app.route('/api/webhooks/twilio', twilioWebhooks);
app.route('/api/webhooks/mailchannels', mailchannelsWebhooks);
app.route('/api/webhooks/telegram', telegramWebhooks);

// API routes
app.route('/api/auth', authRoutes);
app.route('/api/properties', propertiesRoutes);
app.route('/api/stays', staysRoutes);
app.route('/api/threads', threadsRoutes);
app.route('/api/settings', settingsRoutes);
app.route('/api/templates', templatesRoutes);
app.route('/api/prompt', promptRoutes);

// 404 handler
app.notFound((c) => c.json({ error: 'Not found' }, 404));

// Error handler
app.onError((err, c) => {
    console.error('Unhandled error:', err);
    return c.json({ error: 'Internal server error' }, 500);
});

export default app;
