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
import usersRoutes from './routes/users';
import companiesRoutes from './routes/companies';
import creditsRoutes from './routes/credits';
import twilioWebhooks from './routes/webhooks/twilio';
import telegramWebhooks from './routes/webhooks/telegram';
import emailWebhooks from './routes/webhooks/email';
import oauthRoutes from './routes/oauth';

// Durable Object exports
export { ThreadDO } from '../do/ThreadDO';
export { SchedulerDO } from '../do/SchedulerDO';
export { ConfigDO } from '../do/ConfigDO';

const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', logger());
app.use('/api/*', cors({
    origin: (origin) => {
        // Allow localhost on any port for development
        if (origin.startsWith('http://localhost:')) return origin;
        // Allow production domain
        if (origin === 'https://comms.paradisestayz.com.au') return origin;
        // Default to safe origin if no match
        return 'https://comms.paradisestayz.com.au';
    },
    credentials: true,
}));

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Webhooks (no auth required, signature validation instead)
app.route('/api/webhooks/twilio', twilioWebhooks);
app.route('/api/webhooks/telegram', telegramWebhooks);
app.route('/api/webhooks/email', emailWebhooks);

// API routes
app.route('/api/auth', authRoutes);
app.route('/api/properties', propertiesRoutes);
app.route('/api/stays', staysRoutes);
app.route('/api/threads', threadsRoutes);
app.route('/api/settings', settingsRoutes);
app.route('/api/templates', templatesRoutes);
app.route('/api/prompt', promptRoutes);
app.route('/api/users', usersRoutes);
app.route('/api/companies', companiesRoutes);
app.route('/api/credits', creditsRoutes);

// OAuth (public, no auth required)
app.route('/oauth', oauthRoutes);

// 404 handler
app.notFound((c) => c.json({ error: 'Not found' }, 404));

// Error handler
app.onError((err, c) => {
    console.error('Unhandled error:', err);
    return c.json({ error: 'Internal server error' }, 500);
});

// Import email handler for Cloudflare Email Routing
import { handleEmail } from './email-handler';

// Export the worker with email handler
export default {
    fetch: app.fetch,
    // Cloudflare Email Routing handler
    email: handleEmail,
};

