# DevOps & Deployment Guide

This guide is written for maintainers of **Paradise Comms Centre**. It explains how to deploy updates, manage the environments, and handle secrets.

## 🌍 Environments

We have two completely separate environments:

1.  **Development (Dev)**
    *   **Purpose:** For testing changes, experimenting, and verifying fixes.
    *   **URL (App):** `https://dev.paradisestayz.com.au`
    *   **URL (API):** `https://comms-centre.ancient-fire-eaa9.workers.dev`
    *   **Data:** Uses "Development" database branch (fake/test data).

2.  **Production (Prod)**
    *   **Purpose:** The live system used by real customers.
    *   **URL (App):** `https://comms.paradisestayz.com.au`
    *   **URL (API):** `https://comms-centre-prod.ancient-fire-eaa9.workers.dev`
    *   **Data:** Uses "Production" database branch (real data).

---

## 🚀 How to Deploy

### 1. Deploying to Development
Use this when you have made code changes and want to test them.

```bash
# 1. Deploy the Backend (Worker)
npm run deploy

# 2. Deploy the Frontend (Admin UI)
npm run admin:build
npx wrangler pages deploy admin-ui/dist --project-name comms-dev
```

### 2. Deploying to Production
**⚠️ Caution: This updates the live system.**

```bash
# 1. Deploy the Backend (Worker)
npm run deploy -- --env production

# 2. Deploy the Frontend (Admin UI)
# Note: This builds specifically for production
VITE_API_URL=https://comms-centre-prod.ancient-fire-eaa9.workers.dev npm run admin:build
npx wrangler pages deploy admin-ui/dist --project-name comms-prod
```

### 3. Automated Deployment (GitHub)
We have set up automation so you don't always have to run commands manually.

*   **Push to `develop` branch**: Automatically deploys to **Development**.
*   **Push to `main` branch**: Automatically deploys to **Production**.

**Recommended Workflow:**
1.  Make changes on a new branch.
2.  Merge into `develop`.
3.  Wait for deployment -> Test on `dev.paradisestayz.com.au`.
4.  If good, merge `develop` into `main`.
5.  Wait for deployment -> Live on `comms.paradisestayz.com.au`.

---

## 🔑 Managing Secrets (API Keys)

Secrets are sensitive values (passwords, API keys) that are **never** stored in the code.

### Viewing Secrets
You cannot "view" a secret's value (for security), but you can see which ones exist.

```bash
# List Dev Secrets
npx wrangler secret list

# List Prod Secrets
npx wrangler secret list --env production
```

### Adding or Updating a Secret
If you need to update an API key (e.g., Stripe, OpenRouter):

**For Development:**
```bash
npx wrangler secret put SECRET_NAME_HERE
# Example: npx wrangler secret put STRIPE_SECRET_KEY
```

**For Production:**
```bash
npx wrangler secret put SECRET_NAME_HERE --env production
```

---

## 🛠 Troubleshooting

### "The app is broken!"
1.  **Check Logs:**
    *   **Dev:** `npx wrangler tail`
    *   **Prod:** `npx wrangler tail --env production`
    *   Keep the terminal open and reproduce the error to see failure messages.

2.  **Check Services:**
    *   Is Neon DB running? (Check Neon Console)
    *   Is Cloudflare down? (Check Cloudflare Status)

3.  **Rollback:**
    *   If a deployment broke Prod, you can rollback from the GitHub Action history or Cloudflare Dashboard (Workers > comms-centre-prod > Deployments).

---

## 📞 Key Contacts & Accounts

*   **Cloudflare:** DNS, Workers, Pages
*   **Neon:** Database
*   **Twilio:** SMS/Phone
*   **Stripe:** Payments
*   **OpenRouter:** AI Models
