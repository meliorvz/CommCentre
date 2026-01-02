# Infrastructure Documentation

This document describes the infrastructure setup for Paradise Comms Centre.

## Environments

| Environment | Purpose | Branch |
|-------------|---------|--------|
| **Development** | Testing, development work | `develop` |
| **Production** | Live customer traffic | `main` |

---

## Cloudflare Resources

### Workers

| Environment | Worker Name | URL |
|-------------|------------|-----|
| Development | `comms-centre` | `comms-centre.ancient-fire-eaa9.workers.dev` |
| Production | `comms-centre-prod` | `comms-centre-prod.ancient-fire-eaa9.workers.dev` |

### Pages (Admin UI)

| Environment | Project | Domain |
|-------------|---------|--------|
| Development | `comms-dev` | `dev.paradisestayz.com.au` |
| Production | `comms-prod` | `comms.paradisestayz.com.au` |

### KV Namespaces

| Environment | Binding | ID |
|-------------|---------|-----|
| Development | `KV` | `33d3fbab19b040dea42fa3f32fd6d7f6` |
| Production | `KV` | *(create in dashboard)* |

### Durable Objects

Shared across environments (SQLite-backed):
- `ThreadDO` - Conversation thread management
- `SchedulerDO` - Scheduled message jobs
- `ConfigDO` - Configuration caching

---

## Neon PostgreSQL

### Project: `comms-centre` (Green Bush)

| Environment | Branch | Endpoint |
|-------------|--------|----------|
| Development | `development` | `ep-billowing-shadow-a7p12eus` |
| Production | `production` | `ep-hidden-base-a7pjbzvk` |

> **Note:** The "Lucky Mode" endpoint (`ep-gentle-wind-a79sop8o`) is unused.

---

## External Services

### Twilio (SMS & Voice)

| Environment | Phone Number | Webhook Base URL |
|-------------|-------------|------------------|
| Development | *(current numbers)* | `https://comms-centre.ancient-fire-eaa9.workers.dev` |
| Production | *(new prod numbers)* | `https://comms-centre-prod.ancient-fire-eaa9.workers.dev` |

### Gmail (Email)

| Environment | Address | Notes |
|-------------|---------|-------|
| Development | *(current)* | Existing OAuth |
| Production | `hello@paradisestayz.com.au` | New OAuth credentials |

### Telegram (Notifications)

| Environment | Bot | Chat |
|-------------|-----|------|
| Development | *(current bot)* | *(current chat)* |
| Production | `@ParadiseCommsProdBot` | Paradise Comms Prod |

### Stripe (Billing)

| Environment | Mode | Key Prefix |
|-------------|------|------------|
| Development | Test | `sk_test_*`, `pk_test_*` |
| Production | Live | `sk_live_*`, `pk_live_*` |

### OpenRouter (AI)

Single API key used for both environments (usage-based billing).

---

## Secrets Reference

Secrets are set via `wrangler secret put <NAME>` (dev) or `wrangler secret put <NAME> --env production` (prod).

| Secret | Required | Notes |
|--------|----------|-------|
| `DATABASE_URL` | ✅ | Neon connection string |
| `JWT_SECRET` | ✅ | Auth token signing |
| `TWILIO_ACCOUNT_SID` | ✅ | Twilio account |
| `TWILIO_AUTH_TOKEN` | ✅ | Twilio auth |
| `TWILIO_FROM_NUMBER` | ⚙️ | Optional, can set in Admin UI |
| `OPENROUTER_API_KEY` | ✅ | AI/LLM |
| `TELEGRAM_BOT_TOKEN` | ✅ | Notifications |
| `TELEGRAM_CHAT_ID` | ✅ | Notification destination |
| `NOTIFICATION_API_KEY` | ✅ | Internal notifications |
| `GMAIL_CLIENT_ID` | ⚙️ | Email OAuth |
| `GMAIL_CLIENT_SECRET` | ⚙️ | Email OAuth |
| `GMAIL_REFRESH_TOKEN` | ⚙️ | Email OAuth |
| `GMAIL_FROM_ADDRESS` | ⚙️ | Sender address |
| `GMAIL_CC_ADDRESS` | ⚙️ | Auto-CC |
| `STRIPE_SECRET_KEY` | ⚙️ | Billing |
| `STRIPE_WEBHOOK_SECRET` | ⚙️ | Webhook verification |
| `STRIPE_PUBLISHABLE_KEY` | ⚙️ | Frontend Stripe.js |

---

## CI/CD (GitHub Actions)

| Branch | Deploys To |
|--------|-----------|
| `main` | Production |
| `develop` | Development |

Workflow: `.github/workflows/deploy.yml`

---

## Deployment Commands

```bash
# Development (default)
npm run deploy                    # Worker
npm run admin:build && npx wrangler pages deploy admin-ui/dist --project-name comms-dev

# Production
npm run deploy -- --env production
npm run admin:build && npx wrangler pages deploy admin-ui/dist --project-name comms-prod

# Set production secrets
wrangler secret put DATABASE_URL --env production
```

---

## Credentials Strategy

| Service | Strategy | Notes |
|---------|----------|-------|
| **Twilio** | Shared Account | Same Account SID/Token for both. Use different "From" numbers for separation. |
| **Gmail** | Shared OAuth App | Same Client ID/Secret. Use different Refresh Tokens (and Redirect URIs) for each env. |
| **Telegram** | Shared Account | Same Telegram account can own both bots. |
| **OpenRouter** | Shared Account | Same API key (usage-based billing). |
| **Stripe** | Shared Account | Same Stripe account, but use **Test Mode** API keys for Dev and **Live Mode** keys for Prod. |
| **Neon DB** | Shared Project | Same Neon project, but separate **Branches** (dev/prod). |

---

## Useful Links

- [Cloudflare Dashboard](https://dash.cloudflare.com/)
- [Neon Console](https://console.neon.tech/)
- [Twilio Console](https://console.twilio.com/)
- [Stripe Dashboard](https://dashboard.stripe.com/)
- [Google Cloud Console](https://console.cloud.google.com/) (Gmail OAuth)
