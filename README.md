# Paradise Comms Centre

AI-powered guest communication platform for short-term rental property managers. Automates SMS and Email responses while providing seamless escalation to human operators.

## Features

- **AI-Powered Responses**: Automatically draft and send guest replies using OpenRouter LLMs
- **Multi-Channel Support**: Email (Gmail) and SMS (Twilio) in a unified inbox
- **Telegram Escalations**: Real-time notifications for messages requiring human review
- **Multi-Tenant Architecture**: Manage multiple companies with credit-based billing
- **Integrations API**: External automation for cleaning reports, notifications, and more

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | Cloudflare Workers (Hono) |
| Database | Neon PostgreSQL + Drizzle ORM |
| Admin UI | React + Vite + shadcn/ui |
| Auth | JWT (cookie-based sessions) |
| SMS | Twilio |
| Email | Gmail API (OAuth) |
| AI | OpenRouter API |
| Notifications | Telegram Bot API |

## Project Structure

```
├── src/
│   ├── worker/           # Cloudflare Worker backend
│   │   ├── routes/       # API route handlers
│   │   ├── lib/          # Utility libraries (gmail, twilio, telegram)
│   │   └── middleware/   # Auth and validation middleware
│   ├── db/               # Drizzle ORM schema and migrations
│   └── types.ts          # Shared TypeScript types
├── admin-ui/             # React frontend
│   ├── src/
│   │   ├── pages/        # Page components
│   │   ├── components/   # UI components
│   │   └── lib/          # API client and helpers
│   └── public/           # Static assets
├── scripts/              # Database and utility scripts
└── wrangler.toml         # Cloudflare Worker config
```

## Getting Started

### Prerequisites

- Node.js 18+
- Cloudflare account (for Workers/Pages)
- Neon database
- Twilio account (for SMS)
- Gmail OAuth credentials (for email)
- Telegram bot token (for notifications)

### Environment Variables

Set via `wrangler secret put`:

```bash
# Database
DATABASE_URL="postgresql://..."

# Auth
JWT_SECRET="your-secret"

# Twilio
TWILIO_ACCOUNT_SID="..."
TWILIO_AUTH_TOKEN="..."
TWILIO_PHONE_NUMBER="+61..."

# Gmail
GMAIL_CLIENT_ID="..."
GMAIL_CLIENT_SECRET="..."
GMAIL_REFRESH_TOKEN="..."
GMAIL_FROM_ADDRESS="your@email.com"

# Telegram
TELEGRAM_BOT_TOKEN="..."
TELEGRAM_CHAT_ID="..."

# AI
OPENROUTER_API_KEY="..."
```

### Development

```bash
# Install dependencies
npm install
cd admin-ui && npm install

# Run backend locally
npm run dev

# Run frontend locally
cd admin-ui && npm run dev
```

### Deployment

```bash
# Deploy Worker
npm run deploy

# Build and deploy Admin UI
npm run admin:build
npx wrangler pages deploy admin-ui/dist --project-name comms
```

## API Reference

### Integrations API

Send automated messages from external systems.

**Endpoint**: `POST /api/integrations/v1/send`

**Headers**:
```
x-integration-key: sk_live_xxxx...
Content-Type: application/json
```

**Body**:
```json
{
  "channels": ["email"],
  "to": ["recipient@example.com"],
  "subject": "Report",
  "body": "Plain text message",
  "html": "<h1>HTML version</h1>",
  "attachments": [
    {
      "filename": "file.pdf",
      "content": "<base64>",
      "contentType": "application/pdf"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "status": "success",
  "results": [
    { "channel": "email", "status": "sent", "messageId": "..." }
  ]
}
```

## License

Proprietary - Paradise Stayz Pty Ltd
