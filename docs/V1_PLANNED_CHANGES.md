# Paradise Comms: v1.0 Planned Changes

> **Purpose**: This document defines the complete v1.0 architecture improvements for Paradise Comms, establishing a production-ready, scalable, multi-tenant foundation before implementing new user-facing features.
>
> **Target Audience**: Developers and technical stakeholders
>
> **Goals**: 
> - Production-grade architecture with proper multi-tenancy
> - Industry-standard data storage patterns
> - "Zero to Live in 15 Minutes" onboarding for end users

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Ideal State User Journey](#2-ideal-state-user-journey)
3. [Current State Analysis](#3-current-state-analysis)
4. [Gap Analysis](#4-gap-analysis)
5. [Multi-Vertical Architecture](#5-multi-vertical-architecture)
6. [Implementation Modules](#6-implementation-modules)
   - [Module 0: Data Architecture & Multi-Tenancy Foundation](#module-0-data-architecture--multi-tenancy-foundation) ⭐ NEW
   - [Module 1-10: Onboarding & Features](#module-1-welcome--value-proposition-step)
7. [API Permissions Requirements](#7-api-permissions-requirements)
8. [Database Schema Changes](#8-database-schema-changes)
9. [API Endpoints Required](#8-api-endpoints-required)
10. [Verification Strategy](#9-verification-strategy)
11. [Neon Production Configuration](#11-neon-production-configuration) ⭐ NEW

---

## 1. Executive Summary


### The Problem

Current onboarding requires users to:
- Configure Twilio credentials manually (technical)
- Set up Gmail via environment variables (requires developer)
- Navigate between Setup Wizard → Settings → Integrations (fragmented)
- Understand technical concepts like "E.164 format" and "OAuth credentials"

### The Solution

A unified, wizard-based onboarding flow where users:
1. Sign up and understand the value proposition
2. Set up their business profile (including website for AI context)
3. Connect email with one click (Gmail OAuth)
4. Subscribe via Stripe to unlock phone features
5. Provision a phone number from our platform
6. Configure escalation contacts with smart defaults
7. Go live immediately

### Business Model Integration

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SUBSCRIPTION TIERS                          │
├─────────────────────────────────────────────────────────────────────┤
│  FREE TRIAL          │  STARTER ($29/mo)    │  PRO ($79/mo)        │
│  - Email only        │  - Email             │  - Email             │
│  - 50 AI responses   │  - Phone (1 number)  │  - Phone (3 numbers) │
│  - Platform escal.   │  - SMS               │  - SMS               │
│  - 14 day trial      │  - Platform escal.   │  - Priority escal.   │
│                      │  - Call forwarding   │  - Call forwarding   │
│                      │                      │  - API integrations  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Ideal State User Journey

### Step-by-Step Wizard Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 1        STEP 2         STEP 3        STEP 4       STEP 5    │
│  Welcome  →   Business   →   Email    →   Subscribe  → Phone      │
│                Profile       (Gmail)      (Stripe)     Number      │
│                                                                     │
│  STEP 6        STEP 7         STEP 8                                │
│  Escalation → Policies   →   Success!                              │
│  Contacts     (Optional)     (Go Live)                              │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Step 1: Welcome & Value Proposition

**Purpose**: Set expectations, reduce anxiety, communicate value

```
┌─────────────────────────────────────────────────────────────────────┐
│  🏝️ Welcome to Paradise Comms!                                     │
│                                                                     │
│  In the next 10 minutes, you'll set up an AI assistant that:       │
│                                                                     │
│  ✓ Answers guest questions 24/7                                    │
│    (check-in times, WiFi passwords, directions)                    │
│                                                                     │
│  ✓ Reduces your response time from hours to seconds                │
│                                                                     │
│  ✓ Escalates urgent issues directly to you                         │
│    (complaints, emergencies, refund requests)                      │
│                                                                     │
│  ───────────────────────────────────────────────────────────────   │
│                                                                     │
│  Here's what we'll set up together:                                │
│                                                                     │
│  ○ Your business profile                                           │
│  ○ Email connection (takes 30 seconds)                             │
│  ○ Phone number for guests (optional, paid feature)                │
│  ○ How to reach you for urgent issues                              │
│                                                                     │
│                                          [ Get Started → ]          │
└─────────────────────────────────────────────────────────────────────┘
```

**Vertical Customization Points**:
- Icon/branding (🏝️ for hotels, 📸 for photographers)
- Value prop bullets tailored to vertical
- Example scenarios

---

### Step 2: Your Business Profile

**Purpose**: Gather essential context for AI personalization

```
┌─────────────────────────────────────────────────────────────────────┐
│  👋 Tell us about your business                                    │
│                                                                     │
│  Company Name *                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Paradise Stayz                                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  This appears in guest messages: "Hi, I'm Mark from Paradise Stayz"│
│                                                                     │
│  Assistant Name *                                                   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Mark                                                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  How the AI introduces itself: "Hi, I'm Mark"                       │
│                                                                     │
│  Website (optional but recommended)                                │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ https://paradisestayz.com.au                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  We'll use this to learn about your business and properties        │
│                                                                     │
│  Business Type                    Timezone                          │
│  ┌───────────────────────┐       ┌───────────────────────────┐     │
│  │ Holiday Rentals    ▼  │       │ Sydney (AEDT) - auto    ▼ │     │
│  └───────────────────────┘       └───────────────────────────────┘  │
│                                                                     │
│                                 [ ← Back ]  [ Continue → ]          │
└─────────────────────────────────────────────────────────────────────┘
```

**Data Captured**:
- `companyName` (required)
- `assistantName` (required)
- `websiteUrl` (optional) - NEW
- `businessType` (dropdown)
- `timezone` (auto-detected, editable)

**Future Enhancement**: When website is provided, trigger async job to scrape and extract:
- Property listings
- Contact information
- Policies and amenities
- FAQ content

---

### Step 3: Connect Your Email

**Purpose**: Enable AI to send/receive emails on behalf of the business

> [!IMPORTANT]
> This step comes BEFORE phone provisioning because:
> 1. It's free and available to all users
> 2. Lowest friction to get started
> 3. Users can test the service before committing to paid phone features

```
┌─────────────────────────────────────────────────────────────────────┐
│  📧 Connect Your Email                                              │
│                                                                     │
│  Allow Mark to respond to guest emails automatically.              │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │                                                                ││
│  │         [  🔵  Sign in with Google  ]                         ││
│  │                                                                ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  We'll use this email to:                                          │
│  • Receive guest booking inquiries                                 │
│  • Send AI-generated responses on your behalf                      │
│  • Forward urgent messages to you                                  │
│                                                                     │
│  💡 Tip: Use your main bookings email                              │
│     (e.g., bookings@yourbusiness.com)                              │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 🔒 Security: We only request permission to read and send     │  │
│  │    emails. We never access your contacts or other data.      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│                   [ Skip for now → ]  [ Continue → ]               │
└─────────────────────────────────────────────────────────────────────┘
```

**After Successful OAuth**:
```
┌─────────────────────────────────────────────────────────────────────┐
│  📧 Email Connected!                                               │
│                                                                     │
│  ✓ bookings@paradisestayz.com.au                    [ Disconnect ] │
│                                                                     │
│  Mark can now respond to emails sent to this address.              │
│                                                                     │
│  ───────────────────────────────────────────────────────────────   │
│                                                                     │
│  📨 Want to use a different "From" address?                        │
│                                                                     │
│  If you want replies to appear from a different address            │
│  (like info@paradisestayz.com.au), you can set up an alias.        │
│                                                                     │
│  [ Set up email alias (advanced) ]                                 │
│                                                                     │
│                                                                     │
│                                          [ Continue → ]             │
└─────────────────────────────────────────────────────────────────────┘
```

**Email Alias Setup (Expandable/Modal)**:
```
┌─────────────────────────────────────────────────────────────────────┐
│  📨 Email Alias Setup                                              │
│                                                                     │
│  This lets you send emails from a different address while using    │
│  your main inbox. For example, send as "info@..." while receiving  │
│  in "bookings@..."                                                 │
│                                                                     │
│  Step 1: In Gmail, go to Settings → See all settings               │
│  Step 2: Click "Accounts and Import" tab                           │
│  Step 3: Under "Send mail as", click "Add another email address"   │
│  Step 4: Enter your alias address and follow the prompts           │
│  Step 5: Come back here and enter the alias below                  │
│                                                                     │
│  Alias Address                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ info@paradisestayz.com.au                                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [ Save Alias ]                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Step 4: Choose Your Plan (Stripe Subscription)

**Purpose**: Gate phone features behind subscription, clear pricing

> [!NOTE]
> This step appears BEFORE phone provisioning. Phone numbers are only provisioned for paying subscribers.

```
┌─────────────────────────────────────────────────────────────────────┐
│  📱 Add Phone & SMS Support                                         │
│                                                                     │
│  Want guests to reach your AI assistant by phone or text?          │
│  Upgrade to get a dedicated business phone number.                 │
│                                                                     │
│  ┌────────────────────┐    ┌────────────────────┐                  │
│  │   STARTER          │    │   PRO ⭐            │                  │
│  │   $29/month        │    │   $79/month         │                  │
│  │                    │    │                     │                  │
│  │   ✓ Email (AI)     │    │   ✓ Everything in   │                  │
│  │   ✓ 1 Phone Number │    │     Starter         │                  │
│  │   ✓ SMS Replies    │    │   ✓ 3 Phone Numbers │                  │
│  │   ✓ Call Forwarding│    │   ✓ Priority Support│                  │
│  │   ✓ 500 AI credits │    │   ✓ API Access      │                  │
│  │                    │    │   ✓ 2000 AI credits │                  │
│  │  [ Subscribe ]     │    │   [ Subscribe ]     │                  │
│  └────────────────────┘    └────────────────────┘                  │
│                                                                     │
│  ───────────────────────────────────────────────────────────────   │
│                                                                     │
│  🎁 All plans include 14-day free trial. Cancel anytime.           │
│                                                                     │
│                                                                     │
│  [ Continue with Email Only (Free) → ]                             │
└─────────────────────────────────────────────────────────────────────┘
```

**After Stripe Checkout Success** → Proceed to Step 5 (Phone Provisioning)

**If user clicks "Continue with Email Only"** → Skip to Step 6 (Escalation)

---

### Step 5: Pick Your Phone Number

**Purpose**: Self-service phone number provisioning

> [!IMPORTANT]
> This step ONLY appears for users who have an active paid subscription.
> 
> Phone numbers are searched/previewed from Twilio's available inventory BEFORE purchase.
> Only purchased when user confirms selection.

```
┌─────────────────────────────────────────────────────────────────────┐
│  📱 Choose Your Business Phone Number                               │
│                                                                     │
│  This is the number your guests will use to reach you.             │
│  Include it on booking confirmations, listing descriptions, etc.   │
│                                                                     │
│  Country                          Area (optional)                   │
│  ┌───────────────────────┐       ┌───────────────────────────┐     │
│  │ Australia 🇦🇺       ▼  │       │ Sydney (02)            ▼  │     │
│  └───────────────────────┘       └───────────────────────────┘     │
│                                                                     │
│  Available Numbers:                                        [Refresh]│
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ○  +61 2 8005 1234    Sydney Local                         │   │
│  │  ○  +61 2 8005 5678    Sydney Local                         │   │
│  │  ●  +61 400 123 456    Mobile (recommended)                 │   │
│  │  ○  +61 3 9000 1111    Melbourne Local                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  💡 Mobile numbers are recommended - they work for both calls      │
│     and SMS, and guests recognize them as business numbers.        │
│                                                                     │
│  ───────────────────────────────────────────────────────────────   │
│                                                                     │
│  📞 Call Forwarding (Value Add!)                                   │
│                                                                     │
│  When guests call and the AI can't help, where should we           │
│  forward the call? This lets you receive calls on your own phone   │
│  while appearing professional with a dedicated business number.    │
│                                                                     │
│  Forward calls to:                                                  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ +61 412 345 678                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  Your personal or office phone number                              │
│                                                                     │
│                                          [ Provision Number → ]     │
└─────────────────────────────────────────────────────────────────────┘
```

**Behind the Scenes**:
1. `GET /api/twilio/available-numbers?country=AU&areaCode=02` → Searches Twilio inventory (no cost)
2. User selects a number
3. `POST /api/twilio/provision-number` → Purchases from Twilio, configures webhooks
4. Number added to `company_phone_numbers` table
5. Webhook URLs auto-configured:
   - Voice: `{WORKER_URL}/api/webhooks/twilio/voice`
   - SMS: `{WORKER_URL}/api/webhooks/twilio/sms`

**Success State**:
```
┌─────────────────────────────────────────────────────────────────────┐
│  ✅ Phone Number Activated!                                        │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                                                             │   │
│  │     +61 400 123 456                           [ Copy 📋 ]   │   │
│  │                                                             │   │
│  │     This is your new business number.                       │   │
│  │     Guests can call or text this number.                    │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  📋 Add this number to:                                            │
│  • Your Airbnb/Booking.com listings                                │
│  • Booking confirmation emails                                     │
│  • Google Business Profile                                         │
│  • Your website contact page                                       │
│                                                                     │
│                                          [ Continue → ]             │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Step 6: Escalation Contacts

**Purpose**: Configure where urgent issues are routed

```
┌─────────────────────────────────────────────────────────────────────┐
│  🚨 Who should we contact for urgent issues?                       │
│                                                                     │
│  When the AI encounters something it can't handle (refund          │
│  requests, complaints, emergencies), we'll notify you immediately. │
│                                                                     │
│  Your Mobile Number *                                               │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ +61 412 345 678                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 💬 How escalation alerts work:                               │  │
│  │                                                              │  │
│  │ When a guest message needs your attention, you'll receive:   │  │
│  │                                                              │  │
│  │ FROM: Paradise Comms (+61 400 000 001)                       │  │
│  │ ────────────────────────────────────────                     │  │
│  │ 🚨 ESCALATION: Paradise Stayz                                │  │
│  │                                                              │  │
│  │ Guest: John Smith (+61 423 456 789)                          │  │
│  │ Issue: Requesting refund for cancelled booking               │  │
│  │                                                              │  │
│  │ Suggested reply: "I understand your frustration..."          │  │
│  │                                                              │  │
│  │ Reply SEND to approve, or type your own response.            │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  Your Email                                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ owner@paradisestayz.com.au                                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  For non-urgent daily summaries                                    │
│                                                                     │
│  ───────────────────────────────────────────────────────────────   │
│                                                                     │
│  ⚡ Optional: Get instant alerts via Telegram                      │
│                                                                     │
│  Telegram is faster than SMS and allows inline editing.            │
│                                                                     │
│  [  📱 Connect Telegram  ]                                         │
│                                                                     │
│  Uses our bot @ParadiseCommsBot - no setup required on your end.   │
│                                                                     │
│                                          [ Continue → ]             │
└─────────────────────────────────────────────────────────────────────┘
```

**Platform Escalation Number**:
- Users WITHOUT a provisioned phone number receive escalations from a PLATFORM number
- e.g., `+61 400 000 001` (Paradise Comms system number)
- Message clearly identifies which business/property the escalation is for
- Users WITH provisioned numbers can optionally escalate from their own number

**Telegram Deep-Link Flow**:
1. User clicks "Connect Telegram"
2. Generate unique setup code: `setup_abc123xyz`
3. Open URL: `https://t.me/ParadiseCommsBot?start=setup_abc123xyz`
4. User's Telegram opens with the bot
5. User clicks "Start" → Bot receives `/start setup_abc123xyz`
6. Bot looks up code → Links `chat_id` to company
7. Webhook back to frontend confirms connection
8. UI updates to show "✓ Telegram Connected"

---

### Step 7: Property Defaults (Optional)

**Purpose**: Set default policies (can be customized later)

```
┌─────────────────────────────────────────────────────────────────────┐
│  🏠 Default Property Settings                                       │
│                                                                     │
│  These defaults apply to all your properties. You can customize    │
│  individual properties later.                                       │
│                                                                     │
│  Check-in Time              Check-out Time                          │
│  ┌───────────────────┐     ┌───────────────────┐                   │
│  │ 3:00 PM        ▼  │     │ 10:00 AM       ▼  │                   │
│  └───────────────────┘     └───────────────────┘                   │
│                                                                     │
│  [ + Add more policies (parking, pets, WiFi, etc.) ]               │
│                                                                     │
│  💡 You can add property-specific details and policies later       │
│     from the Properties page.                                       │
│                                                                     │
│                    [ Skip for now ]  [ Save & Continue → ]          │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Step 8: Success - You're Live!

**Purpose**: Celebrate completion, provide next steps

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                           🎉                                        │
│                                                                     │
│              You're Live!                                           │
│                                                                     │
│  Mark is ready to help your guests 24/7.                           │
│                                                                     │
│  ───────────────────────────────────────────────────────────────   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │   📧 Email                                                   │   │
│  │   bookings@paradisestayz.com.au                     ✓ Live  │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │   📱 Phone & SMS                                             │   │
│  │   +61 400 123 456                          [ Copy 📋 ]  ✓   │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │   🚨 Escalations                                             │   │
│  │   +61 412 345 678 (SMS)                             ✓ Set   │   │
│  │   @johndoe (Telegram)                               ✓ Set   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ───────────────────────────────────────────────────────────────   │
│                                                                     │
│  📝 Next Steps:                                                     │
│                                                                     │
│  1. Add your phone number to your listing descriptions             │
│  2. Update your booking confirmation emails                        │
│  3. Add your properties for personalized responses                 │
│                                                                     │
│                                                                     │
│  [ Send Test Message ]              [ Go to Dashboard → ]          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Current State Analysis

### Current Files & Components

| Component | File | Purpose |
|-----------|------|---------|
| Setup Wizard | `admin-ui/src/pages/SetupWizardPage.tsx` | 3-step wizard (Business, Defaults, Escalation) |
| Settings | `admin-ui/src/pages/SettingsPage.tsx` | Tabbed settings (Phone, Notify, Email, AI, Users) |
| Integrations | `admin-ui/src/pages/IntegrationsPage.tsx` | API key management for external integrations |

### Current Setup Wizard Steps

| Step | Current | Data Collected |
|------|---------|----------------|
| 1 | Business | companyName, assistantName, businessType, timezone |
| 2 | Property Defaults | checkinTime, checkoutTime, policies |
| 3 | Escalation | escalationPhone, escalationEmail + link to Telegram |

### Current Pain Points

| Issue | Current State | Impact |
|-------|--------------|--------|
| **Gmail Setup** | Requires setting env vars (`GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`) | Users cannot self-serve; requires developer |
| **Authentication** | Email/Password only; basic session cookie | No social login; higher friction |
| **Twilio Setup** | User must have pre-existing numbers | High barrier to entry |
| **Phone Selection** | Dropdown of existing numbers on Twilio account | No in-platform provisioning |
| **Telegram Setup** | Manual: "find Chat ID in web.telegram.org URL" | Confusing for non-technical users |
| **Fragmented Flow** | Wizard → Settings → Integrations | Users get lost |
| **Subscription Gate** | Subscription/Billing exists but disconnected from onboarding | Users can sign up without clear path to paid features |
| **Technical Jargon** | "E.164 format", "Webhook URL", "OAuth Credentials" | Intimidating for target audience |
| **No Website Input** | Missing field for company website | Can't auto-populate AI context |

---

## 4. Gap Analysis

### Ideal State vs Current State

| Feature | Ideal State | Current State | Gap |
|---------|-------------|---------------|-----|
| Authentication | Google Login (Unified) | Email/Password | **NEW** |
| Welcome/Value Prop | Step 1 with clear value messaging | None | **NEW** |
| Website Input | Captured in business profile | Not captured | **NEW** |
| Gmail OAuth | In-wizard OAuth popup | Env vars only | **NEW** |
| Email Alias | Guided setup after OAuth | Not supported | **NEW** |
| Stripe Subscription | Inline during onboarding | Separate Billing Page | **MODIFY** |
| Phone Provisioning | Search → Select → Purchase in-app | External Twilio account | **NEW** |
| Phone Preview | Show available numbers before payment | N/A | **NEW** |
| Call Forwarding | Configured during phone setup | Separate Settings tab | **MODIFY** |
| Telegram Setup | Deep-link with auto-capture | Manual Chat ID entry | **NEW** |
| Platform Escalation | SMS from platform number | Only user's own number | **NEW** |
| Onboarding State | Persistent checklist banner | None | **NEW** |
| Multi-Vertical | Configurable branding/messaging | Hardcoded for hotels | **NEW** |
| Style Learning | AI learns user's writing voice | None | **NEW** |

---

## 5. Multi-Vertical Architecture

### The Vision

Paradise Comms should support multiple industry verticals (hotels, wedding photographers, medical clinics) with:
- Shared core infrastructure
- Customizable branding and messaging
- Vertical-specific onboarding flows
- Different feature sets per vertical

### Architecture Pattern

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SHARED CORE                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Auth/Users   │  │ Email/SMS    │  │ AI Engine    │              │
│  │ Service      │  │ Service      │  │              │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Billing      │  │ Phone        │  │ Escalation   │              │
│  │ (Stripe)     │  │ Provisioning │  │ Engine       │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ HOSPITALITY     │  │ PHOTOGRAPHY     │  │ HEALTHCARE      │
│ VERTICAL        │  │ VERTICAL        │  │ VERTICAL        │
│                 │  │                 │  │                 │
│ • Paradise      │  │ • CaptureAssist │  │ • ClinicComms   │
│   Comms         │  │                 │  │                 │
│ • Hotel-        │  │ • Wedding/      │  │ • Appointment   │
│   specific      │  │   Event-        │  │   specific      │
│   intents       │  │   specific      │  │   intents       │
│ • Property      │  │   intents       │  │ • HIPAA         │
│   management    │  │ • Album/        │  │   compliant     │
│                 │  │   gallery       │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### Implementation Approach

#### Option A: Configuration-Based (Recommended for MVP)

Single codebase with configuration per vertical:

```typescript
// verticals/hospitality.ts
export const hospitalityConfig: VerticalConfig = {
  id: 'hospitality',
  name: 'Paradise Comms',
  tagline: 'AI-powered guest communication',
  icon: '🏝️',
  
  // Branding
  branding: {
    primaryColor: '#0F766E',
    logo: '/logos/paradise-comms.svg',
  },
  
  // Onboarding customization
  onboarding: {
    welcomeTitle: 'Welcome to Paradise Comms!',
    welcomeSubtitle: 'Your AI assistant for guest communications',
    valueProps: [
      'Answers guest questions 24/7',
      'Reduces response time to seconds',
      'Escalates urgent issues to you',
    ],
    businessTypes: [
      { value: 'holiday_rentals', label: 'Holiday Rentals' },
      { value: 'hotel', label: 'Hotel' },
      { value: 'serviced_apartments', label: 'Serviced Apartments' },
    ],
  },
  
  // Feature flags
  features: {
    properties: true,      // Property management
    stays: true,           // Guest stay tracking
    bookingIntegration: true,
    cleaningReports: true,
  },
  
  // AI customization
  ai: {
    systemPromptAdditions: `
      You are an assistant for a hospitality business.
      Common topics include: check-in/out times, amenities, directions, booking changes.
    `,
    escalationKeywords: ['refund', 'complaint', 'emergency', 'manager'],
  },
};
```

```typescript
// verticals/photography.ts
export const photographyConfig: VerticalConfig = {
  id: 'photography',
  name: 'CaptureAssist',
  tagline: 'AI-powered client communication for photographers',
  icon: '📸',
  
  onboarding: {
    welcomeTitle: 'Welcome to CaptureAssist!',
    valueProps: [
      'Responds to inquiries instantly',
      'Handles booking questions 24/7',
      'Sends gallery links automatically',
    ],
    businessTypes: [
      { value: 'wedding', label: 'Wedding Photography' },
      { value: 'portrait', label: 'Portrait Photography' },
      { value: 'event', label: 'Event Photography' },
    ],
  },
  
  features: {
    properties: false,
    stays: false,
    galleryLinks: true,
    contractSending: true,
  },
};
```

#### Option B: Separate Frontends (Future Scale)

When verticals diverge significantly:
```
admin-ui/              → Hospitality frontend
capture-ui/            → Photography frontend
clinic-ui/             → Healthcare frontend
shared-components/     → Shared UI library
backend/               → Single backend (multi-tenant)
```

### Recommendation

Start with **Option A** (configuration-based). Benefits:
- Single codebase to maintain
- Easy to add new verticals
- Shared infrastructure and bug fixes
- Switch to Option B only when UX requirements diverge significantly

---

## 6. Implementation Modules

> [!IMPORTANT]
> **Parallel Execution Model**: This plan is structured for a large team working in parallel. 
> - Pick any ticket where all blockers are ✅ DONE
> - Multiple tickets can be worked simultaneously
> - Update ticket status as you progress

---

### Module 0: Security & Multi-Tenancy Foundation

> [!CAUTION]
> **NO-GO for multi-tenant paid production** until all P0 tickets are complete.

---

## Ticket Execution Board

### Legend
- 🔴 **BLOCKED** - Cannot start, dependencies incomplete
- 🟡 **READY** - All blockers done, can be picked up
- 🟢 **IN PROGRESS** - Being worked on
- ✅ **DONE** - Complete and verified

---

## Dependency Graph

```
                    ┌─────────────────────────────────────────────────────────┐
                    │              IMMEDIATELY PARALLELIZABLE                  │
                    │  (No blockers - can start Day 1 with 100 people)        │
                    └─────────────────────────────────────────────────────────┘
                                              │
    ┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
    │              │              │              │              │              │
    ▼              ▼              ▼              ▼              ▼              ▼
┌───────┐    ┌───────┐    ┌───────┐    ┌───────┐    ┌───────┐    ┌───────┐
│ T-001 │    │ T-002 │    │ T-008 │    │ T-013 │    │ T-018 │    │ T-023 │
│Schema │    │ RLS   │    │Twilio │    │Stripe │    │Argon2 │    │Gmail  │
│Tables │    │Policies│   │ Sig   │    │Idempot│    │ Hash  │    │OAuth  │
└───┬───┘    └───┬───┘    └───┬───┘    └───┬───┘    └───┬───┘    └───┬───┘
    │            │            │            │            │            │
    │            │            │            │            │            │
    ▼            ▼            ▼            │            │            │
┌───────┐    ┌───────┐    ┌───────┐       │            │            │
│ T-003 │    │ T-004 │    │ T-009 │       │            │            │
│ConfigDO│   │ DB    │    │Email  │       │            │            │
│Per-Ten│    │Context│    │Sig    │       │            │            │
└───┬───┘    └───┬───┘    └───────┘       │            │            │
    │            │                         │            │            │
    └─────┬──────┘                         │            │            │
          │                                │            │            │
          ▼                                ▼            ▼            ▼
    ┌───────────┐                   ┌─────────────────────────────────────┐
    │  T-005    │                   │     SECOND WAVE (After T-001)       │
    │ Settings  │                   │   T-014, T-015, T-019, T-024       │
    │ Routes    │                   └─────────────────────────────────────┘
    └───────────┘
```

---

## P0 Tickets (Must Complete for Production)

---

### 🟡 T-001: Create Tenant-Scoped Database Tables

**Status**: 🟡 READY  
**Blockers**: None  
**Effort**: 4-6 hours  
**Assignee**: _____________

**Scope**: Create all new database tables for tenant isolation

**Files to Create**:
- `src/db/migrations/0030_tenant_isolation.sql`

**Files to Modify**:
- `src/db/schema.ts`

**Tables to Create**:
```sql
company_profile, company_ai_config, company_prompts, 
knowledge_categories, knowledge_items, company_templates, 
property_settings, comms_events, webhook_events
```

**Acceptance Criteria**:
- [ ] All tables have `company_id` foreign key with ON DELETE CASCADE
- [ ] TIME types used (not TEXT) for time fields
- [ ] CHECK constraints on numeric fields (confidence_threshold BETWEEN 0 AND 1)
- [ ] Unique constraints where specified
- [ ] Indexes on frequently queried columns
- [ ] Migration runs without errors: `npm run db:migrate`
- [ ] All tables visible in Neon console

**Definition of Done**:
- [ ] Code reviewed
- [ ] Migration tested on dev DB
- [ ] PR merged to main

---

### 🟡 T-002: Create Row-Level Security Policies

**Status**: 🟡 READY  
**Blockers**: None (can write SQL before T-001 merges)  
**Effort**: 4-6 hours  
**Assignee**: _____________

**Scope**: Write RLS policies for all tenant-scoped tables

**Files to Create**:
- `src/db/migrations/0031_row_level_security.sql`

**SQL Pattern**:
```sql
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON {table}
    USING (company_id = current_setting('app.company_id')::uuid);
CREATE POLICY super_admin_bypass ON {table}
    USING (current_setting('app.is_super_admin', true)::boolean = true);
```

**Tables to Cover**:
- company_profile, company_ai_config, company_prompts
- knowledge_categories, knowledge_items, company_templates
- property_settings, properties, stays, threads, messages
- comms_events

**Acceptance Criteria**:
- [ ] RLS enabled on all listed tables
- [ ] tenant_isolation policy on each table
- [ ] super_admin_bypass policy on each table
- [ ] Migration runs without errors
- [ ] Test: Query without setting app.company_id returns 0 rows

**Definition of Done**:
- [ ] Code reviewed
- [ ] Test case written and passing
- [ ] PR merged

---

### 🔴 T-003: Make ConfigDO Per-Tenant

**Status**: 🔴 BLOCKED  
**Blockers**: T-001 ✅  
**Effort**: 6-8 hours  
**Assignee**: _____________

**Scope**: Change ConfigDO from global singleton to per-company instance

**Files to Modify**:
- `src/do/ConfigDO.ts`
- `src/do/ThreadDO.ts`
- `src/do/SchedulerDO.ts`
- `src/worker/index.ts`

**Current (BAD)**:
```typescript
const configId = env.CONFIG_DO.idFromName('global');
```

**Target**:
```typescript
const configId = env.CONFIG_DO.idFromName(companyId);
```

**Acceptance Criteria**:
- [ ] ConfigDO constructor accepts companyId
- [ ] ConfigDO loads config from DB using companyId
- [ ] ThreadDO passes companyId when getting ConfigDO
- [ ] SchedulerDO passes companyId when getting ConfigDO
- [ ] Test: Create 2 companies with different prompts, verify isolation

**Definition of Done**:
- [ ] Code reviewed
- [ ] Integration test passing
- [ ] PR merged

---

### 🔴 T-004: Add Tenant Context to DB Connections

**Status**: 🔴 BLOCKED  
**Blockers**: T-002 ✅  
**Effort**: 3-4 hours  
**Assignee**: _____________

**Scope**: Set `app.company_id` on every database request for RLS

**Files to Create**:
- `src/worker/lib/db-tenant.ts`

**Files to Modify**:
- `src/worker/middleware/auth.ts`

**Implementation**:
```typescript
export async function getDbWithTenant(env: Env, companyId: string, isSuperAdmin: boolean) {
    const db = drizzle(env.DATABASE_URL);
    await db.execute(sql`SET LOCAL app.company_id = ${companyId}`);
    await db.execute(sql`SET LOCAL app.is_super_admin = ${isSuperAdmin}`);
    return db;
}
```

**Acceptance Criteria**:
- [ ] New `getDbWithTenant()` function exported
- [ ] Auth middleware sets tenant context after JWT validation
- [ ] All route handlers receive tenant-scoped DB
- [ ] Test: Direct SQL query without WHERE still returns only tenant's data

**Definition of Done**:
- [ ] Code reviewed
- [ ] RLS test passing
- [ ] PR merged

---

### 🔴 T-005: Migrate Settings Routes to DB

**Status**: 🔴 BLOCKED  
**Blockers**: T-001 ✅, T-003 ✅, T-004 ✅  
**Effort**: 8-10 hours  
**Assignee**: _____________

**Scope**: Replace all KV reads/writes in settings routes with DB

**Files to Modify**:
- `src/worker/routes/settings.ts`

**KV Keys to Remove**:
- `settings:global`
- `setup:profile`
- `setup:property-defaults`
- `knowledge:categories`
- `knowledge:items`
- `settings:property:{id}`

**Acceptance Criteria**:
- [ ] GET /api/settings/* reads from DB with company filter
- [ ] PUT /api/settings/* writes to DB with company filter
- [ ] Property settings verify property ownership before read/write
- [ ] No KV reads/writes remain for config data
- [ ] Test: Tenant A update doesn't affect Tenant B

**Definition of Done**:
- [ ] Code reviewed
- [ ] All settings tests passing
- [ ] PR merged

---

### 🔴 T-006: Migrate Templates Routes to DB

**Status**: 🔴 BLOCKED  
**Blockers**: T-001 ✅, T-004 ✅  
**Effort**: 4-6 hours  
**Assignee**: _____________

**Scope**: Replace KV template storage with DB

**Files to Modify**:
- `src/worker/routes/templates.ts`

**KV Keys to Remove**:
- `templates:sms:*`
- `templates:email:*`

**Acceptance Criteria**:
- [ ] Templates stored in `company_templates` table
- [ ] GET/PUT filter by companyId
- [ ] SchedulerDO reads templates from DB (coordinate with T-003)
- [ ] Test: Templates isolated per tenant

**Definition of Done**:
- [ ] Code reviewed
- [ ] PR merged

---

### 🔴 T-007: Migrate Prompt Routes to DB

**Status**: 🔴 BLOCKED  
**Blockers**: T-001 ✅, T-004 ✅  
**Effort**: 4-6 hours  
**Assignee**: _____________

**Scope**: Replace KV prompt storage with DB

**Files to Modify**:
- `src/worker/routes/prompt.ts`

**KV Keys to Remove**:
- `prompt:business:published`
- `prompt:business:draft`
- `prompt:business:v*`

**Acceptance Criteria**:
- [ ] Prompts stored in `company_prompts` table
- [ ] Version history preserved
- [ ] is_published flag works correctly
- [ ] ConfigDO reads published prompt from DB
- [ ] Test: Prompts isolated per tenant

**Definition of Done**:
- [ ] Code reviewed
- [ ] PR merged

---

### 🟡 T-008: Implement Twilio Signature Validation

**Status**: 🟡 READY  
**Blockers**: None  
**Effort**: 4-6 hours  
**Assignee**: _____________

**Scope**: Validate X-Twilio-Signature on all Twilio webhooks

**Files to Modify**:
- `src/worker/routes/webhooks/twilio.ts`

**Files to Create**:
- `src/worker/lib/twilio-signature.ts`

**Implementation**:
```typescript
function validateTwilioSignature(authToken, signature, url, params): boolean
```

**Endpoints to Protect**:
- POST /api/webhooks/twilio/sms
- POST /api/webhooks/twilio/sms/status
- POST /api/webhooks/twilio/voice
- POST /api/webhooks/twilio/voice/status

**Acceptance Criteria**:
- [ ] All Twilio webhooks check X-Twilio-Signature header
- [ ] Missing signature returns 403
- [ ] Invalid signature returns 403
- [ ] Valid signature proceeds to handler
- [ ] Test with real Twilio webhook and forged request

**Definition of Done**:
- [ ] Code reviewed
- [ ] Security test passing
- [ ] PR merged

---

### 🟡 T-009: Implement Email Webhook Validation

**Status**: 🟡 READY  
**Blockers**: None  
**Effort**: 2-3 hours  
**Assignee**: _____________

**Scope**: Add authentication to email inbound webhook

**Files to Modify**:
- `src/worker/routes/webhooks/email.ts`
- `src/worker/email-handler.ts`

**Options** (pick one):
1. Secret token in URL path
2. HMAC signature on payload
3. IP allowlist for email provider

**Acceptance Criteria**:
- [ ] Email webhook has authentication mechanism
- [ ] Invalid/missing auth returns 403
- [ ] Cloudflare Email Routing still works
- [ ] Test with valid and invalid requests

**Definition of Done**:
- [ ] Code reviewed
- [ ] PR merged

---

### 🟡 T-010: Implement Telegram Webhook Security

**Status**: 🟡 READY  
**Blockers**: None  
**Effort**: 2-3 hours  
**Assignee**: _____________

**Scope**: Secure Telegram webhook endpoint

**Files to Modify**:
- `src/worker/routes/webhooks/telegram.ts`

**Recommended Approach**:
Use `X-Telegram-Bot-Api-Secret-Token` header (set when registering webhook)

**Acceptance Criteria**:
- [ ] Webhook validates secret token header
- [ ] Invalid token returns 403
- [ ] Webhook registration script updated to set secret_token
- [ ] Test with valid and invalid requests

**Definition of Done**:
- [ ] Code reviewed
- [ ] PR merged

---

### 🔴 T-011: Fix Inbound SMS Tenant Routing

**Status**: 🔴 BLOCKED  
**Blockers**: T-008 ✅ (need signature validation first)  
**Effort**: 6-8 hours  
**Assignee**: _____________

**Scope**: Route inbound SMS to correct tenant based on To number

**Files to Modify**:
- `src/worker/routes/webhooks/twilio.ts`

**Current (BAD)**: Matches by guest phone only  
**Target**: Map To → company_phone_numbers.company_id, then filter stays by company

**Acceptance Criteria**:
- [ ] Inbound SMS extracts To number from webhook
- [ ] Lookup company from company_phone_numbers table
- [ ] Reject with 400 if To number not found
- [ ] Stay lookup filtered by company_id
- [ ] Test: Same guest in 2 tenants routes correctly

**Definition of Done**:
- [ ] Code reviewed
- [ ] Integration test passing
- [ ] PR merged

---

### 🔴 T-012: Fix Inbound Email Tenant Routing

**Status**: 🔴 BLOCKED  
**Blockers**: T-009 ✅  
**Effort**: 6-8 hours  
**Assignee**: _____________

**Scope**: Route inbound email to correct tenant based on To address

**Files to Modify**:
- `src/worker/email-handler.ts`
- `src/worker/routes/webhooks/email.ts`

**Current (BAD)**: Matches by guest email only  
**Target**: Map To → company_email_addresses.company_id, then filter stays

**Additional**:
- Add email loop protection (check Auto-Submitted, Precedence headers)

**Acceptance Criteria**:
- [ ] Inbound email extracts To address
- [ ] Lookup company from company_email_addresses table
- [ ] Reject silently if To address unknown
- [ ] Stay lookup filtered by company_id
- [ ] Loop protection for auto-replies, bounces
- [ ] Test: Same guest in 2 tenants routes correctly

**Definition of Done**:
- [ ] Code reviewed
- [ ] Integration test passing
- [ ] PR merged

---

### 🟡 T-013: Implement Stripe Webhook Idempotency

**Status**: 🟡 READY  
**Blockers**: None (can use existing webhook_events table from T-001, or create own)  
**Effort**: 4-6 hours  
**Assignee**: _____________

**Scope**: Prevent duplicate processing of Stripe events

**Files to Modify**:
- `src/worker/routes/webhooks/stripe.ts`

**Implementation**:
```typescript
// Check if already processed
const [existing] = await db.select().from(webhookEvents)
    .where(and(eq(webhookEvents.provider, 'stripe'), eq(webhookEvents.eventId, event.id)));
if (existing) return c.json({ received: true });

// Process event...

// Mark as processed
await db.insert(webhookEvents).values({ provider: 'stripe', eventId: event.id, eventType: event.type });
```

**Acceptance Criteria**:
- [ ] webhook_events table exists (or create in same PR)
- [ ] Duplicate event IDs are skipped with log
- [ ] First occurrence processes normally
- [ ] Test: Replay same event, verify no duplicate credits

**Definition of Done**:
- [ ] Code reviewed
- [ ] Test passing
- [ ] PR merged

---

### 🔴 T-014: Fix SQL Injection in SMS Status Callback

**Status**: 🔴 BLOCKED  
**Blockers**: T-008 ✅ (need signature validation to prevent exploitation)  
**Effort**: 1-2 hours  
**Assignee**: _____________

**Scope**: Replace raw SQL with parameterized query

**Files to Modify**:
- `src/worker/routes/webhooks/twilio.ts`

**Current (BAD)**:
```typescript
await db.execute(`UPDATE messages SET status = '${status}' WHERE provider_message_id = '${messageSid}'`);
```

**Target**:
```typescript
await db.update(messages).set({ status }).where(eq(messages.providerMessageId, messageSid));
```

**Acceptance Criteria**:
- [ ] No string interpolation in SQL
- [ ] Uses Drizzle parameterized query
- [ ] Status updates still work
- [ ] Test with valid status callback

**Definition of Done**:
- [ ] Code reviewed
- [ ] PR merged

---

### 🔴 T-015: Remove Dangerous Twilio From Number Fallback

**Status**: 🔴 BLOCKED  
**Blockers**: T-001 ✅ (need company_phone_numbers table)  
**Effort**: 6-8 hours  
**Assignee**: _____________

**Scope**: Validate from number belongs to company, remove global fallback

**Files to Modify**:
- `src/worker/lib/twilio.ts`

**Current (DANGEROUS)**:
```typescript
let fromNumber = from || env.TWILIO_FROM_NUMBER;
```

**Target**:
```typescript
export async function getValidatedFromNumber(env, companyId, preferredNumber?): Promise<string> {
    // 1. Lookup company's owned numbers from DB
    // 2. If preferredNumber specified, validate ownership
    // 3. Return first company-owned number
    // 4. Only fallback to PLATFORM_ESCALATION_NUMBER
    // 5. NEVER use arbitrary env.TWILIO_FROM_NUMBER
}
```

**Acceptance Criteria**:
- [ ] sendSms requires companyId parameter
- [ ] From number validated against company_phone_numbers
- [ ] Only PLATFORM_ESCALATION_NUMBER as fallback
- [ ] Error thrown if no valid number
- [ ] Test: Tenant A can't send from Tenant B's number

**Definition of Done**:
- [ ] Code reviewed
- [ ] Security test passing
- [ ] PR merged

---

### 🔴 T-016: Update All SMS/Email Callers to Pass companyId

**Status**: 🔴 BLOCKED  
**Blockers**: T-015 ✅  
**Effort**: 4-6 hours  
**Assignee**: _____________

**Scope**: Every call to sendSms/sendEmail must include companyId

**Files to Modify**:
- `src/do/ThreadDO.ts`
- `src/do/SchedulerDO.ts`
- `src/worker/routes/threads.ts`
- Any other files that call sendSms/sendEmail

**Acceptance Criteria**:
- [ ] All sendSms calls include companyId
- [ ] All sendEmail calls include companyId
- [ ] No default/global sender paths remain
- [ ] TypeScript compile errors if companyId missing

**Definition of Done**:
- [ ] Code reviewed
- [ ] All tests passing
- [ ] PR merged

---

### 🟡 T-017: Add Comms Events Logging

**Status**: 🟡 READY  
**Blockers**: None (can create table inline or wait for T-001)  
**Effort**: 4-6 hours  
**Assignee**: _____________

**Scope**: Log all inbound/outbound communications for audit trail

**Files to Create**:
- `src/worker/lib/comms-logger.ts`

**Files to Modify**:
- `src/worker/lib/twilio.ts`
- `src/worker/lib/gmail.ts`
- `src/worker/routes/webhooks/twilio.ts`
- `src/worker/email-handler.ts`

**Table**: `comms_events` (from T-001)

**Log on**:
- Every inbound SMS/email
- Every outbound SMS/email
- Include: channel, direction, from, to, status, provider_message_id

**Acceptance Criteria**:
- [ ] All inbound messages logged
- [ ] All outbound messages logged
- [ ] Body truncated to 500 chars (privacy)
- [ ] Queryable by company_id
- [ ] Test: Send message, verify log entry

**Definition of Done**:
- [ ] Code reviewed
- [ ] PR merged

---

### 🟡 T-018: Implement Argon2id Password Hashing

**Status**: 🟡 READY  
**Blockers**: None  
**Effort**: 4-6 hours  
**Assignee**: _____________

**Scope**: Replace SHA-256 with Argon2id, migrate existing passwords

**Files to Modify**:
- `src/worker/routes/auth.ts`
- `src/worker/routes/users.ts`
- `src/worker/routes/companies.ts`

**New Dependency**:
```bash
npm install @node-rs/argon2
```

**Implementation**:
- New registrations use Argon2id
- Login checks hash format (64 char hex = legacy SHA-256)
- Legacy hash migrated to Argon2id on successful login

**Acceptance Criteria**:
- [ ] New users get Argon2id hash
- [ ] Existing users can still login
- [ ] Legacy hashes migrated on login
- [ ] Hash comparison takes 100-500ms (not instant)
- [ ] Test: Register, login, verify hash format

**Definition of Done**:
- [ ] Code reviewed
- [ ] Auth tests passing
- [ ] PR merged

---

### 🟡 T-019: Add CSRF Protection

**Status**: 🟡 READY  
**Blockers**: None  
**Effort**: 4-6 hours  
**Assignee**: _____________

**Scope**: Protect state-changing routes from CSRF attacks

**Files to Modify**:
- `src/worker/routes/auth.ts`
- `src/worker/index.ts`
- `src/worker/middleware/auth.ts`

**Recommended Approach**: Double-submit cookie pattern or switch to Bearer token

**Acceptance Criteria**:
- [ ] State-changing routes require CSRF token OR use Bearer auth
- [ ] Cookie SameSite changed from None to Lax (if using cookies)
- [ ] Test: Cross-origin POST rejected

**Definition of Done**:
- [ ] Code reviewed
- [ ] Security test passing
- [ ] PR merged

---

### 🔴 T-020: Implement Pre-Send Credit Checks

**Status**: 🔴 BLOCKED  
**Blockers**: T-003 ✅ (SchedulerDO needs companyId)  
**Effort**: 4-6 hours  
**Assignee**: _____________

**Scope**: Check credits before sending, not after

**Files to Modify**:
- `src/do/SchedulerDO.ts`
- `src/worker/routes/integrations.ts`
- `src/worker/lib/credits.ts`

**Add checkCredits function**:
```typescript
export async function checkCredits(companyId, required): Promise<{hasCredits, balance}>
```

**Acceptance Criteria**:
- [ ] SchedulerDO checks credits before send
- [ ] Integration API checks credits before send
- [ ] Insufficient credits = message not sent + logged
- [ ] Test: 0 credits = scheduled message not sent

**Definition of Done**:
- [ ] Code reviewed
- [ ] Test passing
- [ ] PR merged

---

### 🟡 T-021: Add Usage Events Ledger

**Status**: 🟡 READY  
**Blockers**: None  
**Effort**: 4-6 hours  
**Assignee**: _____________

**Scope**: Track all billable usage for reporting

**Files to Create**:
- `src/db/migrations/0032_usage_ledger.sql` (if not in T-001)
- `src/worker/lib/usage.ts`

**Table**: `usage_events`
```sql
CREATE TABLE usage_events (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id),
    event_type TEXT NOT NULL, -- 'sms', 'email', 'llm_call'
    units INTEGER DEFAULT 1,
    cost_credits INTEGER NOT NULL,
    external_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Log When**:
- SMS sent
- Email sent
- LLM call made
- Call forwarded

**Acceptance Criteria**:
- [ ] All billable events logged
- [ ] Queryable by company and date range
- [ ] Test: Send SMS, verify usage_event created

**Definition of Done**:
- [ ] Code reviewed
- [ ] PR merged

---

### 🟡 T-022: Add Entitlements Table

**Status**: 🟡 READY  
**Blockers**: None  
**Effort**: 3-4 hours  
**Assignee**: _____________

**Scope**: Track plan limits per company

**Files to Create**:
- SQL in T-001 or separate migration

**Table**: `entitlements`
```sql
CREATE TABLE entitlements (
    company_id UUID REFERENCES companies(id) UNIQUE,
    plan_id UUID REFERENCES subscription_plans(id),
    included_credits INTEGER NOT NULL,
    reset_at TIMESTAMPTZ NOT NULL,
    overage_allowed BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'active'
);
```

**Acceptance Criteria**:
- [ ] Table created
- [ ] Populated on subscription creation
- [ ] Updated on plan change
- [ ] Used by credit check logic

**Definition of Done**:
- [ ] Code reviewed
- [ ] PR merged

---

### 🟡 T-023: Create Per-Tenant Integration Token Storage

**Status**: 🟡 READY  
**Blockers**: None  
**Effort**: 6-8 hours  
**Assignee**: _____________

**Scope**: Encrypted storage for per-tenant Gmail/Twilio/Telegram tokens

**Files to Create**:
- `src/db/migrations/0033_integration_tokens.sql`
- `src/worker/lib/encryption.ts`

**Table**: `company_integrations`
```sql
CREATE TABLE company_integrations (
    company_id UUID REFERENCES companies(id),
    integration_type TEXT NOT NULL,
    encrypted_credentials BYTEA NOT NULL,
    data_key_encrypted BYTEA NOT NULL,
    account_identifier TEXT,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(company_id, integration_type)
);
```

**Encryption**: Envelope encryption with master key in Worker secret

**Acceptance Criteria**:
- [ ] Table created with encryption columns
- [ ] encrypt/decrypt functions implemented
- [ ] Master key loaded from env.ENCRYPTION_KEY
- [ ] Test: Store and retrieve token, verify encryption

**Definition of Done**:
- [ ] Code reviewed
- [ ] Security review passed
- [ ] PR merged

---

### 🔴 T-024: Migrate Gmail to Per-Tenant Tokens

**Status**: 🔴 BLOCKED  
**Blockers**: T-023 ✅  
**Effort**: 8-10 hours  
**Assignee**: _____________

**Scope**: Store Gmail OAuth tokens per company, remove global tokens

**Files to Modify**:
- `src/worker/lib/gmail.ts`
- `src/worker/routes/oauth.ts`

**Current (BAD)**:
```typescript
const refreshToken = env.GMAIL_REFRESH_TOKEN; // Global!
```

**Target**: 
- OAuth callback stores tokens in company_integrations
- Gmail operations load tokens by companyId
- Global GMAIL_* env vars removed for tenant operations

**Acceptance Criteria**:
- [ ] OAuth stores tokens per company
- [ ] Gmail ops load from DB
- [ ] Token refresh updates DB
- [ ] Each company sees only their email
- [ ] Test: 2 companies with different Gmail accounts

**Definition of Done**:
- [ ] Code reviewed
- [ ] Integration test passing
- [ ] PR merged

---

### 🔴 T-025: Migrate Telegram to Per-Tenant Tokens

**Status**: 🔴 BLOCKED  
**Blockers**: T-023 ✅  
**Effort**: 4-6 hours  
**Assignee**: _____________

**Scope**: Store Telegram chat_id per company

**Files to Modify**:
- `src/worker/lib/telegram.ts`
- `src/worker/routes/webhooks/telegram.ts`

**Acceptance Criteria**:
- [ ] Telegram setup stores chat_id per company
- [ ] Escalations route to company's chat
- [ ] Global TELEGRAM_CHAT_ID removed
- [ ] Test: 2 companies with different Telegram chats

**Definition of Done**:
- [ ] Code reviewed
- [ ] PR merged

---

### 🟡 T-026: Implement Audit Logging

**Status**: 🟡 READY  
**Blockers**: None  
**Effort**: 6-8 hours  
**Assignee**: _____________

**Scope**: Log admin actions for security audit trail

**Files to Create**:
- `src/worker/lib/audit.ts`

**Files to Modify**:
- All settings routes
- All user management routes
- All company management routes

**Log Events**:
- User created/updated/deleted
- Settings changed
- Subscription changed
- Integration connected/disconnected

**Acceptance Criteria**:
- [ ] audit_log table populated (already exists in schema)
- [ ] actor_user_id, action, before/after captured
- [ ] Queryable by company and date
- [ ] Test: Change setting, verify audit entry

**Definition of Done**:
- [ ] Code reviewed
- [ ] PR merged

---

## Ticket Summary

### Immediately Parallelizable (No Blockers) - 12 tickets

| Ticket | Title | Effort |
|--------|-------|--------|
| T-001 | Create Tenant-Scoped DB Tables | 4-6h |
| T-002 | Create RLS Policies | 4-6h |
| T-008 | Twilio Signature Validation | 4-6h |
| T-009 | Email Webhook Validation | 2-3h |
| T-010 | Telegram Webhook Security | 2-3h |
| T-013 | Stripe Webhook Idempotency | 4-6h |
| T-017 | Comms Events Logging | 4-6h |
| T-018 | Argon2id Password Hashing | 4-6h |
| T-019 | CSRF Protection | 4-6h |
| T-021 | Usage Events Ledger | 4-6h |
| T-022 | Entitlements Table | 3-4h |
| T-023 | Integration Token Storage | 6-8h |
| T-026 | Audit Logging | 6-8h |

**Day 1 Parallelism**: All 12 tickets can start immediately.

### Second Wave (After T-001) - 7 tickets

| Ticket | Title | Blockers |
|--------|-------|----------|
| T-003 | ConfigDO Per-Tenant | T-001 |
| T-006 | Templates Routes to DB | T-001, T-004 |
| T-007 | Prompt Routes to DB | T-001, T-004 |
| T-015 | Remove Dangerous Fallback | T-001 |

### Third Wave - 7 tickets

| Ticket | Title | Blockers |
|--------|-------|----------|
| T-004 | Tenant DB Context | T-002 |
| T-011 | SMS Tenant Routing | T-008 |
| T-012 | Email Tenant Routing | T-009 |
| T-014 | SQL Injection Fix | T-008 |
| T-024 | Gmail Per-Tenant | T-023 |
| T-025 | Telegram Per-Tenant | T-023 |

### Final Wave

| Ticket | Title | Blockers |
|--------|-------|----------|
| T-005 | Settings Routes to DB | T-001, T-003, T-004 |
| T-016 | Update All SMS Callers | T-015 |
| T-020 | Pre-Send Credit Checks | T-003 |

---

## Total Effort: ~120-150 hours

With 100 people: **Theoretically 1-2 days** if all parallel paths utilized.  
Realistic with code review, testing, deployment: **3-5 days**.

---


#### Phase 0.1: Tenant Data Isolation (2-3 weeks)

> **Problem**: All companies share the same AI settings, knowledge base, templates, and prompts via global KV keys and a single ConfigDO instance.

##### Task 0.1.1: Create Tenant-Scoped Database Tables

**Files to Create**:
- `src/db/migrations/0030_tenant_isolation.sql`

**Files to Modify**:
- `src/db/schema.ts`

**New Tables** (with proper constraints per Friend 2's feedback):

```sql
-- Schema separation: profile vs AI behavior (per Friend 2)
CREATE TABLE company_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
    assistant_name TEXT NOT NULL DEFAULT 'Mark',
    website_url TEXT,
    timezone TEXT NOT NULL DEFAULT 'Australia/Sydney',
    vertical_id TEXT DEFAULT 'hospitality',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE company_ai_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
    auto_reply_enabled BOOLEAN DEFAULT true,
    confidence_threshold NUMERIC(3,2) DEFAULT 0.70 
        CHECK (confidence_threshold BETWEEN 0 AND 1),
    quiet_hours_start TIME DEFAULT '22:00',
    quiet_hours_end TIME DEFAULT '08:00',
    response_delay_minutes INTEGER DEFAULT 3 
        CHECK (response_delay_minutes >= 0),
    escalation_categories TEXT[] DEFAULT ARRAY['refund', 'complaint', 'emergency'],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE company_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    version INTEGER NOT NULL CHECK (version > 0),
    is_published BOOLEAN DEFAULT false,
    published_at TIMESTAMPTZ,
    published_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, version)
);
CREATE INDEX idx_company_prompts_published ON company_prompts(company_id, is_published) WHERE is_published = true;

CREATE TABLE knowledge_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    example_questions TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, slug)
);

CREATE TABLE knowledge_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    category_id UUID REFERENCES knowledge_categories(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_knowledge_items_company ON knowledge_items(company_id);

CREATE TABLE company_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('sms', 'email')),
    rule_key TEXT NOT NULL CHECK (rule_key IN ('T_MINUS_3', 'T_MINUS_1', 'DAY_OF')),
    subject TEXT,
    body TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, channel, rule_key)
);

-- Property settings with company_id for RLS (per Friend 2)
CREATE TABLE property_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE UNIQUE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE, -- Denormalized for RLS
    auto_reply_enabled BOOLEAN DEFAULT true,
    sms_enabled BOOLEAN DEFAULT true,
    email_enabled BOOLEAN DEFAULT true,
    schedule_t3_time TIME DEFAULT '10:00',
    schedule_t1_time TIME DEFAULT '10:00',
    schedule_day_of_time TIME DEFAULT '14:00',
    checkin_time TIME DEFAULT '15:00',
    checkout_time TIME DEFAULT '10:00',
    early_checkin_policy TEXT,
    late_checkout_policy TEXT,
    parking_info TEXT,
    pet_policy TEXT,
    smoking_policy TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log (already in schema but unused - per Friend 2, implement it)
-- comms_events for message tracking
CREATE TABLE comms_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'telegram')),
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    from_addr TEXT NOT NULL,
    to_addr TEXT NOT NULL,
    subject TEXT,
    body_preview TEXT, -- First 500 chars, not full body
    status TEXT NOT NULL,
    provider_message_id TEXT,
    provider_status TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_comms_events_company ON comms_events(company_id, created_at DESC);

-- Webhook events for idempotency
CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL, -- 'stripe', 'twilio', 'telegram'
    event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(provider, event_id)
);
```

**Acceptance Criteria**:
- [ ] All tables created with proper foreign keys
- [ ] TIME types used instead of TEXT for time fields
- [ ] CHECK constraints on numeric ranges
- [ ] Indexes on frequently queried columns
- [ ] company_id present on all tenant-scoped tables

##### Task 0.1.2: Implement Row-Level Security (RLS)

> **Why RLS?**: Per Friend 2: "Filtering in code is necessary but not sufficient. With 50 businesses, one missed WHERE clause becomes a breach."

**Files to Create**:
- `src/db/migrations/0031_row_level_security.sql`

**SQL**:
```sql
-- Enable RLS on tenant-scoped tables
ALTER TABLE company_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_ai_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE stays ENABLE ROW LEVEL SECURITY;
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE comms_events ENABLE ROW LEVEL SECURITY;

-- Create policies using app.company_id session variable
CREATE POLICY tenant_isolation ON company_profile
    USING (company_id = current_setting('app.company_id')::uuid);
CREATE POLICY tenant_isolation ON company_ai_config
    USING (company_id = current_setting('app.company_id')::uuid);
-- ... repeat for all tables

-- For properties, use direct company_id
CREATE POLICY tenant_isolation ON properties
    USING (company_id = current_setting('app.company_id')::uuid);

-- For stays, join through property
CREATE POLICY tenant_isolation ON stays
    USING (property_id IN (
        SELECT id FROM properties WHERE company_id = current_setting('app.company_id')::uuid
    ));

-- Super admin bypass policy
CREATE POLICY super_admin_bypass ON company_profile
    USING (current_setting('app.is_super_admin', true)::boolean = true);
```

**Files to Modify**:
- `src/worker/lib/db.ts` - Set `app.company_id` on every request

```typescript
export async function getDbWithTenant(env: Env, companyId: string, isSuperAdmin: boolean) {
    const db = drizzle(env.DATABASE_URL);
    await db.execute(sql`SET LOCAL app.company_id = ${companyId}`);
    await db.execute(sql`SET LOCAL app.is_super_admin = ${isSuperAdmin}`);
    return db;
}
```

**Acceptance Criteria**:
- [ ] RLS enabled on all tenant-scoped tables
- [ ] `app.company_id` set from JWT on every request
- [ ] Super admin can bypass with explicit flag
- [ ] Test: Tenant A cannot query Tenant B's data even with raw SQL

##### Task 0.1.3: Make ConfigDO Per-Tenant

**Files to Modify**:
- `src/do/ConfigDO.ts`
- `src/do/ThreadDO.ts`
- `src/do/SchedulerDO.ts`
- `src/worker/index.ts`

**Current (BAD)**:
```typescript
const configId = env.CONFIG_DO.idFromName('global');
```

**Fixed**:
```typescript
const configId = env.CONFIG_DO.idFromName(companyId);
```

**Acceptance Criteria**:
- [ ] ConfigDO instantiated with `companyId` as name
- [ ] ConfigDO loads data from DB (not KV) using `companyId`
- [ ] ThreadDO passes `companyId` to ConfigDO
- [ ] SchedulerDO passes `companyId` to ConfigDO
- [ ] Test: Two tenants have different prompts/settings

##### Task 0.1.4: Migrate Settings/Templates/Prompt Routes to DB

**Files to Modify**:
- `src/worker/routes/settings.ts` - Replace all KV reads/writes with DB
- `src/worker/routes/templates.ts` - Replace all KV reads/writes with DB
- `src/worker/routes/prompt.ts` - Replace all KV reads/writes with DB

**Current (BAD)**:
```typescript
const settings = await c.env.KV.get('settings:global', 'json');
```

**Fixed**:
```typescript
const companyId = c.get('companyId');
const [settings] = await db
    .select()
    .from(companyAiConfig)
    .where(eq(companyAiConfig.companyId, companyId));
```

**Acceptance Criteria**:
- [ ] All settings routes filter by `companyId`
- [ ] Property settings routes verify property ownership before read/write
- [ ] KV only used for caching (rate limits, temp data with TTL)
- [ ] Test: Tenant A's settings update doesn't affect Tenant B

---

#### Phase 0.2: Inbound Routing Safety (1-2 weeks)

> **Problem**: Inbound SMS/email routes by guest contact only, ignoring which tenant owns the receiving number/mailbox. A guest in multiple tenants gets routed to the wrong one.

##### Task 0.2.1: Fix Inbound SMS Routing

**Files to Modify**:
- `src/worker/routes/webhooks/twilio.ts`

**Current (BAD)**:
```typescript
// Finds stay by guest phone only - ignores which number was called
const [stay] = await db.select().from(stays)
    .where(eq(stays.guestPhoneE164, webhook.From));
```

**Fixed**:
```typescript
// Step 1: Map inbound "To" number to company
const [phoneRecord] = await db.select().from(companyPhoneNumbers)
    .where(eq(companyPhoneNumbers.phoneE164, webhook.To));

if (!phoneRecord) {
    console.error(`Inbound SMS to unknown number: ${webhook.To}`);
    return c.text('Unknown recipient', 400);
}

const companyId = phoneRecord.companyId;

// Step 2: Find stay within that company only
const [stay] = await db.select().from(stays)
    .innerJoin(properties, eq(stays.propertyId, properties.id))
    .where(and(
        eq(stays.guestPhoneE164, webhook.From),
        eq(properties.companyId, companyId)
    ));
```

**Acceptance Criteria**:
- [ ] Inbound SMS maps `To` → `company_phone_numbers.company_id`
- [ ] Stay lookup filtered by company
- [ ] Reject/log if `To` number not in DB
- [ ] Test: Same guest phone in 2 tenants routes to correct tenant based on which number was texted

##### Task 0.2.2: Fix Inbound Email Routing

**Files to Modify**:
- `src/worker/email-handler.ts`
- `src/worker/routes/webhooks/email.ts`

**Current (BAD)**:
```typescript
// Finds stay by guest email only
const [stay] = await db.select().from(stays)
    .where(eq(stays.guestEmail, fromEmail));
```

**Fixed**:
```typescript
// Step 1: Map inbound "To" address to company
const toAddress = message.to[0]; // e.g., bookings@tenant.paradisecomms.com
const [emailRecord] = await db.select().from(companyEmailAddresses)
    .where(eq(companyEmailAddresses.email, toAddress));

if (!emailRecord) {
    console.error(`Inbound email to unknown address: ${toAddress}`);
    return; // Drop or forward to catch-all
}

const companyId = emailRecord.companyId;

// Step 2: Find stay within that company only
const [stay] = await db.select().from(stays)
    .innerJoin(properties, eq(stays.propertyId, properties.id))
    .where(and(
        eq(stays.guestEmail, fromEmail),
        eq(properties.companyId, companyId)
    ));
```

**Acceptance Criteria**:
- [ ] Inbound email maps `To` → `company_email_addresses.company_id`
- [ ] Stay lookup filtered by company
- [ ] Add email loop protection (check `Auto-Submitted`, `Precedence` headers)
- [ ] Test: Same guest email in 2 tenants routes correctly

---

#### Phase 0.3: Outbound Sender Safety (1 week)

> **Problem**: Twilio "from" number fallback can send from another tenant's number. Per Friend 2: "Never fall back to any random number Twilio has on the account."

##### Task 0.3.1: Remove Dangerous Fallback in Twilio

**Files to Modify**:
- `src/worker/lib/twilio.ts`

**Current (DANGEROUS)**:
```typescript
// Falls back to env var or first available number - WRONG
let fromNumber = from || env.TWILIO_FROM_NUMBER;
if (!fromNumber && env.KV) {
    const settings = await env.KV.get('settings:integration:twilio', 'json');
    fromNumber = settings?.phoneNumber;
}
```

**Fixed**:
```typescript
export async function getValidatedFromNumber(
    env: Env, 
    companyId: string, 
    preferredNumber?: string
): Promise<string> {
    // 1. Look up company's owned numbers from DB
    const companyNumbers = await db.select().from(companyPhoneNumbers)
        .where(and(
            eq(companyPhoneNumbers.companyId, companyId),
            eq(companyPhoneNumbers.isActive, true)
        ));
    
    if (companyNumbers.length === 0) {
        // No company number - use PLATFORM escalation number only
        if (env.PLATFORM_ESCALATION_NUMBER) {
            console.warn(`Company ${companyId} has no numbers, using platform number`);
            return env.PLATFORM_ESCALATION_NUMBER;
        }
        throw new Error(`No valid phone number for company ${companyId}`);
    }
    
    // 2. If preferred number specified, validate it belongs to this company
    if (preferredNumber) {
        const isOwned = companyNumbers.some(n => n.phoneE164 === preferredNumber);
        if (isOwned) return preferredNumber;
        console.warn(`Preferred number ${preferredNumber} not owned by company ${companyId}`);
    }
    
    // 3. Return first company-owned number (NOT arbitrary Twilio number)
    return companyNumbers[0].phoneE164;
}
```

**Acceptance Criteria**:
- [ ] `sendSms` requires `companyId` parameter
- [ ] From number validated against `company_phone_numbers` table
- [ ] Fallback is ONLY to platform escalation number (explicit env var)
- [ ] NEVER fall back to `env.TWILIO_FROM_NUMBER` for tenant messages
- [ ] Test: Tenant A's message cannot send from Tenant B's number

##### Task 0.3.2: Update All Callers to Pass companyId

**Files to Modify**:
- `src/do/ThreadDO.ts` - Pass companyId to sendSms/sendEmail
- `src/do/SchedulerDO.ts` - Pass companyId to sendSms/sendEmail
- `src/worker/routes/threads.ts` - Manual reply routes

**Acceptance Criteria**:
- [ ] All SMS/email sends include `companyId`
- [ ] No global/default sender paths remain

---

#### Phase 0.4: Webhook Security & Idempotency (1-2 weeks)

> **Problem**: Webhooks lack signature validation. Anyone can POST to create messages. Stripe events can be replayed to double-credit.

##### Task 0.4.1: Implement Twilio Signature Validation

**Files to Modify**:
- `src/worker/routes/webhooks/twilio.ts`

**Implementation**:
```typescript
import crypto from 'crypto';

function validateTwilioSignature(
    authToken: string,
    signature: string,
    url: string,
    params: Record<string, string>
): boolean {
    const sortedParams = Object.keys(params).sort()
        .map(key => key + params[key]).join('');
    const expected = crypto
        .createHmac('sha1', authToken)
        .update(url + sortedParams)
        .digest('base64');
    return signature === expected;
}

twilioWebhooks.post('/sms', async (c) => {
    const signature = c.req.header('X-Twilio-Signature');
    if (!signature) return c.text('Missing signature', 403);
    
    const url = `${c.env.WORKER_BASE_URL}/api/webhooks/twilio/sms`;
    const params = await c.req.parseBody();
    
    if (!validateTwilioSignature(c.env.TWILIO_AUTH_TOKEN, signature, url, params)) {
        return c.text('Invalid signature', 403);
    }
    // ... rest of handler
});
```

**Acceptance Criteria**:
- [ ] All Twilio webhook routes validate `X-Twilio-Signature`
- [ ] Invalid signatures return 403
- [ ] Test with real Twilio and forged requests

##### Task 0.4.2: Implement Stripe Webhook Idempotency

**Files to Modify**:
- `src/worker/routes/webhooks/stripe.ts`

**Current (BAD)**:
```typescript
// No idempotency - replayed events re-grant credits
if (event.type === 'invoice.paid') {
    await addCredits(companyId, amount, 'subscription_grant');
}
```

**Fixed**:
```typescript
// Check if already processed
const [existing] = await db.select().from(webhookEvents)
    .where(and(
        eq(webhookEvents.provider, 'stripe'),
        eq(webhookEvents.eventId, event.id)
    ));

if (existing) {
    console.log(`Duplicate Stripe event ${event.id}, skipping`);
    return c.json({ received: true });
}

// Process event
if (event.type === 'invoice.paid') {
    await addCredits(companyId, amount, 'subscription_grant');
}

// Mark as processed
await db.insert(webhookEvents).values({
    provider: 'stripe',
    eventId: event.id,
    eventType: event.type,
});
```

**Acceptance Criteria**:
- [ ] Stripe events stored in `webhook_events` table with unique constraint
- [ ] Duplicate events are skipped with log message
- [ ] Test: Replay event, verify no duplicate credit grant

##### Task 0.4.3: Fix SQL Injection in SMS Status Callback

**Files to Modify**:
- `src/worker/routes/webhooks/twilio.ts`

**Current (BAD)**:
```typescript
await db.execute(`UPDATE messages SET status = '${status}' WHERE provider_message_id = '${messageSid}'`);
```

**Fixed**:
```typescript
await db.update(messages)
    .set({ status: status })
    .where(eq(messages.providerMessageId, messageSid));
```

**Acceptance Criteria**:
- [ ] All raw SQL replaced with parameterized Drizzle queries
- [ ] Signature validation prevents spoofed status updates

##### Task 0.4.4: Implement Telegram Webhook Security

**Files to Modify**:
- `src/worker/routes/webhooks/telegram.ts`

**Options**:
1. Secret token in webhook URL path (e.g., `/api/webhooks/telegram/{SECRET}`)
2. Verify `X-Telegram-Bot-Api-Secret-Token` header

**Acceptance Criteria**:
- [ ] Telegram webhook has authentication mechanism
- [ ] Invalid requests rejected

---

#### Phase 0.5: Authentication Hardening (1 week)

> **Problem**: Passwords are SHA-256 without salt. Cookie has SameSite=None.

##### Task 0.5.1: Migrate Password Hashing to Argon2id

**Files to Modify**:
- `src/worker/routes/auth.ts`
- `src/worker/routes/users.ts`
- `src/worker/routes/companies.ts`

**New Dependency**:
```bash
npm install @node-rs/argon2
```

**Implementation**:
```typescript
import { hash, verify } from '@node-rs/argon2';

// Register/Create
const passwordHash = await hash(password, {
    algorithm: 2, // Argon2id
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
});

// Login - with legacy migration
async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
    // Check if legacy SHA-256 hash (64 chars, no $)
    if (storedHash.length === 64 && !storedHash.includes('$')) {
        const sha256Hash = crypto.createHash('sha256').update(password).digest('hex');
        if (sha256Hash === storedHash) {
            // Migrate hash on successful login
            const newHash = await hash(password);
            await db.update(users).set({ passwordHash: newHash })
                .where(eq(users.passwordHash, storedHash));
            return true;
        }
        return false;
    }
    return verify(storedHash, password);
}
```

**Acceptance Criteria**:
- [ ] New users get Argon2id hashes
- [ ] Login works with both old and new hashes
- [ ] Old hashes migrated to Argon2id on successful login
- [ ] Test: Verify password comparison time is 100-500ms (not instant)

##### Task 0.5.2: Add CSRF Protection

**Files to Modify**:
- `src/worker/routes/auth.ts`
- `src/worker/index.ts`

**Options**:
1. Double-submit cookie pattern
2. Switch to `Authorization: Bearer` header (preferred for API)

**Acceptance Criteria**:
- [ ] State-changing routes protected from CSRF
- [ ] Cookie set with `SameSite=Lax` or CSRF token required

---

#### Phase 0.6: Integration Isolation (1-2 weeks)

> **Problem**: All tenants share one Gmail, Twilio account, and Telegram bot. Per-tenant tokens needed.

##### Task 0.6.1: Create Per-Tenant Integration Token Storage

**Files to Modify**:
- `src/db/schema.ts`

**New Table (with envelope encryption per Friend 2)**:
```sql
CREATE TABLE company_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    integration_type TEXT NOT NULL, -- 'gmail', 'twilio', 'telegram'
    
    -- Encrypted credentials (envelope encryption)
    encrypted_credentials BYTEA NOT NULL,
    data_key_encrypted BYTEA NOT NULL, -- Per-row key, encrypted with master key
    
    -- Metadata (not encrypted)
    account_identifier TEXT, -- e.g., email address, phone number
    scopes TEXT[],
    token_expires_at TIMESTAMPTZ,
    last_validated_at TIMESTAMPTZ,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(company_id, integration_type)
);

-- Audit access to integration tokens
CREATE TABLE integration_token_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id),
    integration_type TEXT NOT NULL,
    accessed_by UUID REFERENCES users(id),
    access_reason TEXT,
    accessed_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Acceptance Criteria**:
- [ ] Master key stored in Cloudflare Worker secret
- [ ] Per-row data key for each integration
- [ ] Token access logged for audit

##### Task 0.6.2: Migrate Gmail to Per-Tenant Tokens

**Files to Modify**:
- `src/worker/lib/gmail.ts`
- `src/worker/routes/oauth.ts`

**Current (BAD)**:
```typescript
const refreshToken = env.GMAIL_REFRESH_TOKEN; // Global!
```

**Fixed**:
```typescript
async function getGmailTokens(env: Env, companyId: string) {
    const [integration] = await db.select().from(companyIntegrations)
        .where(and(
            eq(companyIntegrations.companyId, companyId),
            eq(companyIntegrations.integrationType, 'gmail')
        ));
    
    if (!integration) throw new Error('Gmail not connected');
    
    const credentials = await decryptCredentials(
        env.ENCRYPTION_MASTER_KEY,
        integration.encryptedCredentials,
        integration.dataKeyEncrypted
    );
    
    // Log access
    await db.insert(integrationTokenAccessLog).values({
        companyId,
        integrationType: 'gmail',
        accessReason: 'send_email'
    });
    
    return credentials;
}
```

**Acceptance Criteria**:
- [ ] Gmail OAuth stores tokens per company
- [ ] Global `GMAIL_*` env vars removed for tenant operations
- [ ] Each company sees only their connected email

---

#### Phase 0.7: Billing Enforcement (1 week)

> **Problem**: Scheduled messages and integrations send without credit checks. SchedulerDO doesn't check balance.

##### Task 0.7.1: Pre-Send Credit Checks

**Files to Modify**:
- `src/do/SchedulerDO.ts`
- `src/worker/routes/integrations.ts`
- `src/worker/lib/credits.ts`

**Add checkCredits function**:
```typescript
export async function checkCredits(
    db: DrizzleClient,
    companyId: string,
    requiredCredits: number
): Promise<{ hasCredits: boolean; balance: number }> {
    const [company] = await db.select({ balance: companies.creditBalance })
        .from(companies)
        .where(eq(companies.id, companyId));
    
    return {
        hasCredits: company.balance >= requiredCredits,
        balance: company.balance
    };
}
```

**Modify SchedulerDO**:
```typescript
async sendScheduledMessage(job: ScheduledJob) {
    const creditCost = job.channel === 'sms' ? 2 : 1;
    const { hasCredits } = await checkCredits(db, job.companyId, creditCost);
    
    if (!hasCredits) {
        console.warn(`Skip scheduled job ${job.id}: insufficient credits`);
        await this.markJobFailed(job.id, 'INSUFFICIENT_CREDITS');
        return;
    }
    
    // Send message
    await sendSms(...);
    
    // Deduct credits
    await deductCredits(db, job.companyId, creditCost, 'sms_usage', job.id);
}
```

**Acceptance Criteria**:
- [ ] SchedulerDO checks credits before send
- [ ] Integration API checks credits before send
- [ ] Insufficient credits logged, not silently skipped
- [ ] Test: 0 credits = no scheduled message sent

##### Task 0.7.2: Add Usage Ledger Table (per Friend 2)

**Files to Create**:
- `src/db/migrations/0032_usage_ledger.sql`

```sql
CREATE TABLE usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'sms', 'email', 'llm_call', 'call_forward'
    units INTEGER NOT NULL DEFAULT 1,
    cost_credits INTEGER NOT NULL,
    external_id TEXT, -- message_id, thread_id, etc
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_usage_events_company ON usage_events(company_id, created_at DESC);

CREATE TABLE entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
    plan_id UUID REFERENCES subscription_plans(id),
    included_credits INTEGER NOT NULL,
    reset_at TIMESTAMPTZ NOT NULL,
    overage_allowed BOOLEAN DEFAULT false,
    status TEXT NOT NULL DEFAULT 'active'
);
```

**Acceptance Criteria**:
- [ ] All usage tracked in `usage_events`
- [ ] Entitlements table tracks plan limits
- [ ] Monthly reset logic implemented

---

#### Production Readiness Checklist

| Area | Status | Blocker? |
|------|--------|----------|
| Tenant data isolation (KV→DB) | ❌ Not started | **YES** |
| Row-Level Security | ❌ Not started | **YES** |
| ConfigDO per-tenant | ❌ Not started | **YES** |
| Inbound SMS routing | ❌ Not started | **YES** |
| Inbound email routing | ❌ Not started | **YES** |
| Outbound sender safety | ❌ Not started | **YES** |
| Twilio signature validation | ❌ Not started | **YES** |
| Stripe idempotency | ❌ Not started | **YES** |
| Password hashing | ❌ Not started | **YES** |
| CSRF protection | ❌ Not started | Medium |
| Per-tenant integrations | ❌ Not started | **YES** |
| Billing enforcement | ❌ Not started | **YES** |
| Usage ledger | ❌ Not started | Medium |
| Audit logging | ❌ Not started | Medium |
| Email loop protection | ❌ Not started | Medium |

**Go-Live Criteria**: All "Blocker: YES" items must be complete.

---



### Module 1: Welcome & Value Proposition Step


**Scope**: Add new Step 1 to onboarding wizard

**Files to Modify**:
- `admin-ui/src/pages/SetupWizardPage.tsx`

**Files to Create**:
- `admin-ui/src/components/onboarding/WelcomeStep.tsx`

**Effort**: Small (1-2 hours)

**Dependencies**: None

---

### Module 2: Business Profile Enhancement

**Scope**: Add website URL field, auto-detect timezone

**Files to Modify**:
- `admin-ui/src/pages/SetupWizardPage.tsx`
- `src/worker/routes/setup.ts`
- `src/db/schema.ts` (add `website_url` column)

**Files to Create**:
- `src/worker/lib/website-scraper.ts` (future: extract context)

**Effort**: Small (2-3 hours)

**Dependencies**: Database migration

---

### Module 3: Gmail OAuth Self-Service

**Scope**: Replace env-var configuration with in-app OAuth flow

**Files to Create**:
- `admin-ui/src/components/onboarding/GmailConnectStep.tsx`
- `admin-ui/src/components/email/GmailOAuthButton.tsx`
- `src/worker/routes/oauth/gmail.ts`
- `src/worker/routes/oauth/gmail-callback.ts`

**Files to Modify**:
- `src/db/schema.ts` (add per-company Gmail credentials)
- `src/worker/lib/gmail.ts` (use company credentials)

**Effort**: Medium (4-6 hours)

**Dependencies**: Google Cloud Console OAuth app setup

**Technical Notes**:
- OAuth scopes needed: `gmail.readonly`, `gmail.send`, `gmail.modify`
- Store refresh token encrypted per company
- Handle token refresh automatically

---

### Module 4: Stripe Subscription Integration

**Scope**: Inline subscription during onboarding, gate phone features

**Files to Create**:
- `admin-ui/src/components/onboarding/SubscriptionStep.tsx`
- `admin-ui/src/components/billing/PlanSelector.tsx`

**Files to Modify**:
- `src/worker/routes/stripe.ts` (embed Stripe checkout in wizard)
- `admin-ui/src/pages/SetupWizardPage.tsx` (add subscription step)

**Effort**: Medium (3-4 hours)

**Dependencies**: Existing Stripe integration

**Flow**:
1. User selects plan
2. Stripe Checkout opens (embedded or redirect)
3. Webhook confirms subscription
4. Wizard proceeds to phone provisioning (if paid plan)

---

### Module 5: Twilio Phone Provisioning

**Scope**: In-app phone number search and purchase

**Files to Create**:
- `admin-ui/src/components/onboarding/PhoneProvisioningStep.tsx`
- `admin-ui/src/components/phone/PhoneNumberPicker.tsx`
- `src/worker/routes/phone-numbers.ts`

**Files to Modify**:
- `src/worker/lib/twilio.ts` (add provisioning functions)
- `src/db/schema.ts` (company_phone_numbers already exists)

**Effort**: Medium-Large (6-8 hours)

**Dependencies**: Module 4 (Stripe) - must be subscribed before provisioning

**Technical Notes**:
- Use Twilio API to search available numbers: `client.availablePhoneNumbers(country).local.list()`
- Purchase number: `client.incomingPhoneNumbers.create()`
- Configure webhooks on purchase
- Handle number release on subscription cancellation

---

### Module 6: Telegram Deep-Link Setup

**Scope**: Replace manual Chat ID with automatic linking

**Files to Create**:
- `admin-ui/src/components/onboarding/TelegramConnectButton.tsx`
- `src/worker/routes/telegram-setup.ts`

**Files to Modify**:
- `src/worker/lib/telegram.ts` (handle `/start` with setup codes)
- `src/db/schema.ts` (telegram_setup_codes table)

**Effort**: Medium (3-4 hours)

**Dependencies**: Telegram bot must handle `/start <code>` commands

**Flow**:
1. Generate unique code, store in DB with company_id and expiry
2. Open `https://t.me/ParadiseCommsBot?start={code}`
3. Bot receives `/start {code}`, looks up code
4. Links chat_id to company
5. Sends confirmation message
6. Frontend polls for connection status

---

### Module 7: Platform Escalation Number

**Scope**: SMS escalations from platform number for free-tier users

**Files to Modify**:
- `src/worker/lib/escalation.ts`
- `src/worker/lib/twilio.ts`

**Configuration**:
- Add `PLATFORM_PHONE_NUMBER` env var
- Use for escalations when company has no provisioned number
- Message format clearly identifies the business

**Effort**: Small (2 hours)

**Dependencies**: Platform must own a Twilio number

---

### Module 8: Onboarding State Tracking

**Scope**: Persist onboarding progress, show completion banner

**Files to Create**:
- `admin-ui/src/components/onboarding/OnboardingChecklist.tsx`
- `admin-ui/src/contexts/OnboardingContext.tsx`

**Files to Modify**:
- `src/db/schema.ts` (add onboarding_state to companies)
- `src/worker/routes/setup.ts` (endpoints to get/update state)
- `admin-ui/src/layouts/MainLayout.tsx` (show banner)

**Schema**:
```typescript
interface OnboardingState {
  welcomeCompleted: boolean;       // Step 1
  businessProfileCompleted: boolean; // Step 2
  emailConnected: boolean;          // Step 3 (optional)
  subscriptionActive: boolean;      // Step 4
  phoneProvisioned: boolean;        // Step 5 (paid only)
  escalationConfigured: boolean;    // Step 6
  defaultsConfigured: boolean;      // Step 7 (optional)
  wizardCompleted: boolean;         // Step 8
  firstMessageSent: boolean;        // Post-wizard
}
```

**Effort**: Medium (4-5 hours)

**Dependencies**: None

---

### Module 9: "Respond As Me" Style Learning

**Scope**: Analyze user's sent emails to learn their writing style, create a style profile that shapes AI responses

**Purpose**: Instead of generic AI responses, the AI writes in the user's actual voice - their tone, phrases, greeting style, sign-off, etc.

**User Journey**:

```
┌─────────────────────────────────────────────────────────────────────┐
│  ✍️ Teach Mark Your Writing Style                                  │
│                                                                     │
│  We'll analyze your recent emails to learn how you communicate,    │
│  so Mark's responses sound like you wrote them.                    │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  📧 We found 47 sent emails. Here are 20 good examples:           │
│  (Select 10 that best represent how you'd respond to guests)       │
│                                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │ ✓ Selected  │ │ ✓ Selected  │ │   Email 3   │ │ ✓ Selected  │   │
│  │             │ │             │ │             │ │             │   │
│  │ "Hi Sarah,  │ │ "Thanks for │ │ "Dear Mr... │ │ "Hey! Great │   │
│  │  Thanks for │ │  reaching   │ │  We regret  │ │  to hear... │   │
│  │  your..."   │ │  out!..."   │ │  to inform" │ │             │   │
│  │             │ │             │ │             │ │             │   │
│  │ [View Full] │ │ [View Full] │ │ [View Full] │ │ [View Full] │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
│                                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │ ✓ Selected  │ │   Email 6   │ │ ✓ Selected  │ │   Email 8   │   │
│  │  ...        │ │   ...       │ │   ...       │ │   ...       │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
│                                                                     │
│  ... (more cards, 4 per row, scrollable)                           │
│                                                                     │
│  ┌─────────────┐                                                    │
│  │     ➕      │  Add your own example                              │
│  │  Add Email  │  (paste a message you've written)                 │
│  │             │                                                    │
│  └─────────────┘                                                    │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  📝 Additional Style Rules (optional)                               │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ - Always greet with "Hi [Name]," not "Dear"                 │   │
│  │ - Sign off with "Cheers, [Assistant Name]"                  │   │
│  │ - Keep responses under 3 paragraphs                         │   │
│  │ - Use emojis sparingly (only 😊 and 🏖️)                     │   │
│  │ - Never use "I apologize" - say "Sorry about that!"         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  10/10 examples selected                    [ Generate Style → ]   │
└─────────────────────────────────────────────────────────────────────┘
```

**After Style Generation**:
```
┌─────────────────────────────────────────────────────────────────────┐
│  ✅ Style Profile Created!                                         │
│                                                                     │
│  Based on your examples, here's what Mark learned:                 │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 🎨 YOUR COMMUNICATION STYLE                                  │   │
│  │                                                              │   │
│  │ Tone: Warm and friendly, professional but approachable      │   │
│  │                                                              │   │
│  │ Greeting: "Hi [Name]," or "Hey [Name]!"                      │   │
│  │                                                              │   │
│  │ Sign-off: "Cheers," followed by name                         │   │
│  │                                                              │   │
│  │ Patterns noticed:                                            │   │
│  │ • Uses exclamation marks for enthusiasm                      │   │
│  │ • Offers alternatives when declining requests                │   │
│  │ • Proactively provides next steps                            │   │
│  │ • Keeps paragraphs short (2-3 sentences max)                 │   │
│  │                                                              │   │
│  │ Phrases you often use:                                       │   │
│  │ • "Happy to help!"                                           │   │
│  │ • "Let me know if you need anything else"                    │   │
│  │ • "Looking forward to hosting you"                           │   │
│  │                                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [ Edit Style ]                              [ Continue → ]        │
└─────────────────────────────────────────────────────────────────────┘
```

**Technical Flow**:

1. **Fetch Sent Emails** (after Gmail OAuth)
   ```
   GET /api/gmail/sent-emails?limit=50
   ```
   - Fetch last 50 sent emails from Gmail API
   - Filter out automated/transactional emails (newsletters, receipts)
   - Return email body + subject + recipient info

2. **AI Pre-selection & Analysis** (backend)
   ```
   POST /api/style/analyze
   Body: { emails: [...50 emails] }
   ```
   - Use OpenRouter to:
     a) Score each email for "style representativeness" (0-100)
     b) Filter out non-conversational emails (forwards, one-liners)
     c) Return top 20 ranked by quality/variety
     d) Generate initial style annotations

3. **User Curation** (frontend)
   - Display 20 emails as cards (10 pre-selected)
   - User can:
     - Click to select/deselect
     - View full email in modal
     - Add custom example via paste
     - Add custom style rules/notes

4. **Style Profile Generation**
   ```
   POST /api/style/generate
   Body: { 
     selectedEmailIds: [...],
     customExamples: [...],
     userRules: "..."
   }
   ```
   - Send selected emails to OpenRouter
   - Prompt: "Analyze these emails and create a style guide..."
   - Generate structured style profile

5. **Store Style Profile**
   - Saved to `company_style_profiles` table
   - Appended to LLM system prompt for email responses

**Files to Create**:
- `admin-ui/src/pages/StyleProfilePage.tsx` (full page for editing)
- `admin-ui/src/components/onboarding/StyleLearningStep.tsx`
- `admin-ui/src/components/style/EmailCard.tsx`
- `admin-ui/src/components/style/StyleRulesEditor.tsx`
- `admin-ui/src/components/style/AddCustomEmailModal.tsx`
- `src/worker/routes/style.ts`
- `src/worker/lib/style-analyzer.ts`

**Files to Modify**:
- `src/db/schema.ts` (add style profile tables)
- `src/worker/lib/gmail.ts` (add fetch sent emails)
- `src/do/ThreadDO.ts` (inject style profile into prompt)
- `admin-ui/src/pages/SetupWizardPage.tsx` (add step after Gmail OAuth)

**Database Schema**:
```sql
-- Email examples for style learning
CREATE TABLE style_examples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    source TEXT NOT NULL, -- 'gmail' | 'custom'
    gmail_message_id TEXT, -- For fetched emails
    subject TEXT,
    body TEXT NOT NULL,
    recipient TEXT,
    sent_at TIMESTAMPTZ,
    is_selected BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated style profile
CREATE TABLE company_style_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
    
    -- Structured style data
    tone TEXT, -- 'formal' | 'friendly' | 'casual' | 'professional'
    greeting_style TEXT,
    signoff_style TEXT,
    common_phrases TEXT[], -- Array of frequently used phrases
    style_notes TEXT, -- Freeform LLM-generated observations
    
    -- User additions
    custom_rules TEXT, -- User's explicit rules
    
    -- For prompt injection
    prompt_addition TEXT, -- Full text to append to system prompt
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Prompt Injection Example**:
```
## Writing Style Guide

Write responses in the following style, matching how the business owner communicates:

**Tone**: Warm and friendly, professional but approachable
**Greeting**: Use "Hi [Name]," or "Hey [Name]!" - never "Dear"
**Sign-off**: End with "Cheers," followed by your name

**Patterns to follow**:
- Use exclamation marks to show enthusiasm
- When declining requests, always offer alternatives
- Keep paragraphs short (2-3 sentences max)
- Proactively provide next steps

**Phrases to use when appropriate**:
- "Happy to help!"
- "Let me know if you need anything else"
- "Looking forward to hosting you"

**Custom rules from business owner**:
- Never use "I apologize" - say "Sorry about that!" instead
- Use emojis sparingly (only 😊 and 🏖️)
```

**Effort**: Large (8-10 hours)

**Dependencies**: 
- Module 3 (Gmail OAuth) - Need access to sent emails
- OpenRouter integration (existing)

**When This Step Appears**:
- AFTER Gmail OAuth is complete
- OPTIONAL during onboarding (can skip and do later)
- Accessible from Settings page for editing anytime

---

### Module 10: Authentication & Unified Login

**Scope**: Implement "Sign in with Google" to replace/augment email+password login. Support "bundled" permissions (Login + Gmail Access) for a super-simple onboarding.

**Purpose**: Reduce friction. Users can sign up and connect their email assistant in one click.

**User Journey**:

```
┌─────────────────────────────────────────────────────────────────────┐
│  🏝️ Paradise Comms                                                 │
│                                                                     │
│  The AI Receptionist for your Vacation Rental                      │
│                                                                     │
│  [                                                               ] │
│  [      🔵  Sign in with Google                                  ] │
│  [                                                               ] │
│                                                                     │
│  ───────────────────────────────────────────────────────────────   │
│                                                                     │
│  Or sign in with email                                             │
│  [ Email ]                                                         │
│  [ Password ]                                                      │
│  [ Sign In ]                                                       │
│                                                                     │
│  Don't have an account? [ Sign Up ]                                │
└─────────────────────────────────────────────────────────────────────┘
```

**Unified Consent Flow**:
- When clicking "Sign in with Google", we request scopes:
  - `email`
  - `profile`
  - `openid`
  - `https://www.googleapis.com/auth/gmail.readonly` (Optional? No, we request upfront for "unified" feel)
  - `https://www.googleapis.com/auth/gmail.send` etc.

**Technical Strategy**:
1. **Unified Login**:
   - If user grants all permissions -> Account created AND Gmail connected immediately.
   - Onboarding Step 3 (Connect Email) detects connection and auto-completes/skips.
   
2. **Incremental Fallback**:
   - If user unchecks Gmail permissions?
   - We still create account (using `email` scope).
   - Onboarding Step 3 asks for permissions again ("connect your email to enable AI").

**Files to Create**:
- `admin-ui/src/pages/GoogleCallbackPage.tsx`
- `src/worker/routes/auth-google.ts`

**Files to Modify**:
- `admin-ui/src/pages/LoginPage.tsx`
- `src/worker/routes/auth.ts` (handle Google User creation)

**Effort**: Medium (4-5 hours)

**Dependencies**: Google Console Project Setup (same as Module 3)

---

## 7. API Permissions Requirements

> [!IMPORTANT]
> Before implementing these modules, ensure all required API permissions are configured. Missing permissions will block specific features.

### Gmail API Permissions

**Current State**: Uses OAuth refresh token from environment variables
**Current Scopes**: Only what was configured during initial OAuth setup (likely minimal)

**Required OAuth Scopes for Full Implementation**:

| Scope | Purpose | Module |
|-------|---------|--------|
| `gmail.send` | Send emails on behalf of user | 3 (existing) |
| `gmail.readonly` | Read incoming emails | 3 (existing) |
| `gmail.modify` | Mark emails as read, archive | 3 (existing) |
| `gmail.compose` | Create drafts | 3 (nice-to-have) |
| **`gmail.metadata`** | Read email metadata (for threading) | 3, 9 |

> [!CAUTION]
> **Module 9 (Style Learning) requires additional scope!**
> 
> To fetch sent emails, we need either:
> - `gmail.readonly` - Read access to all emails (including sent)
> - OR `https://www.googleapis.com/auth/gmail.send` + listing permission
>
> **Current setup may NOT have permission to list sent emails.** The existing `GMAIL_REFRESH_TOKEN` was likely obtained with minimal scopes. We'll need to re-authenticate users with expanded scopes.

**Google Cloud Console Setup Required**:
1. [ ] Enable Gmail API in GCP Console
2. [ ] Configure OAuth consent screen (production mode requires Google review)
3. [ ] Add required OAuth scopes to consent screen
4. [ ] Create OAuth 2.0 Client ID (Web application type)
5. [ ] Add authorized redirect URI: `{WORKER_URL}/api/oauth/gmail/callback`
6. [ ] If in production, submit for Google verification (required for `gmail.readonly`)

**For Module 9 Specifically**:
- Need to use `users.messages.list` with `q=in:sent` to fetch sent emails
- Requires scope: `https://www.googleapis.com/auth/gmail.readonly`
- This is a "sensitive" scope → requires Google verification for production

---

### Twilio API Permissions

**Current State**: Uses Account SID + Auth Token from environment variables
**Current Capabilities**: Send SMS, list owned phone numbers

**Required for Module 5 (Phone Provisioning)**:

| API Endpoint | Purpose | Permission Level |
|--------------|---------|------------------|
| `AvailablePhoneNumbers` | Search available numbers | Read |
| `IncomingPhoneNumbers.create` | Purchase phone number | **Write (costs money)** |
| `IncomingPhoneNumbers.update` | Configure webhooks | Write |
| `IncomingPhoneNumbers.delete` | Release number | Write |

> [!WARNING]
> **Phone provisioning costs real money!**
> - Each number purchase costs ~$1-2/month (varies by country/type)
> - Ensure Twilio account has billing configured
> - Platform assumes master Twilio account, not sub-accounts

**Current Twilio Permissions** ✅ **SUFFICIENT**:
- The existing `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` provide **full account access**
- Can search, purchase, and configure phone numbers
- No additional API keys or permissions needed

**Pre-requisites**:
1. [x] Twilio account with funds/billing configured
2. [ ] Enable phone number provisioning in Twilio console (if restricted)
3. [ ] For Australian numbers: May need A2P 10DLC registration for SMS

---

### Stripe API Permissions

**Current State**: Uses Secret Key + Webhook Secret from environment
**Current Capabilities**: Create checkout sessions, handle webhooks

**Required Permissions**:

| Feature | Permission | Current Status |
|---------|------------|----------------|
| Create Checkout Session | Write | ✅ Available |
| Create Customer | Write | ✅ Available |
| Create Subscription | Write | ✅ Available |
| Retrieve Subscription | Read | ✅ Available |
| Cancel Subscription | Write | ✅ Available |
| Create Portal Session | Write | ✅ Available |
| Webhook Events | N/A | ✅ Configured |

**Current Stripe Permissions** ✅ **SUFFICIENT**:
- `STRIPE_SECRET_KEY` provides full API access
- Webhook handler already configured at `/api/webhooks/stripe`

**Pre-requisites**:
1. [x] Stripe account with products/prices configured
2. [x] Webhook endpoint registered in Stripe Dashboard
3. [ ] Configure subscription plans in Stripe (Starter, Pro tiers)
4. [ ] Set up Customer Portal in Stripe Dashboard

---

### Telegram Bot Permissions

**Current State**: Uses Bot Token + hardcoded Chat ID
**Current Capabilities**: Send messages to configured chat

**Required for Module 6 (Deep-Link Setup)**:

| Capability | Current Status |
|------------|----------------|
| Send messages | ✅ Available |
| Receive updates (webhooks) | ⚠️ May need setup |
| `/start` command handling | ⚠️ Needs implementation |
| Get Chat ID from user click | ⚠️ Needs webhook |

> [!IMPORTANT]
> **Telegram bot needs webhook configuration!**
>
> For deep-link setup (`https://t.me/BotName?start=code`), the bot must:
> 1. Have a webhook configured: `setWebhook` API call
> 2. Receive the `/start {code}` message
> 3. Extract `chat_id` from the update
> 4. Link it to the company in database

**Pre-requisites**:
1. [x] Bot created via @BotFather
2. [x] `TELEGRAM_BOT_TOKEN` configured
3. [ ] Set webhook URL: `POST https://api.telegram.org/bot{TOKEN}/setWebhook?url={WORKER_URL}/api/webhooks/telegram`
4. [ ] Create webhook handler endpoint
5. [ ] Handle `/start {code}` command

---

### OpenRouter API Permissions

**Current State**: Uses API Key from environment
**Current Capabilities**: Chat completions

**Required for Module 9 (Style Learning)**:

| Feature | Required | Current Status |
|---------|----------|----------------|
| Chat completions | Yes | ✅ Available |
| Long context (for email analysis) | Recommended | ✅ Model-dependent |

**Current OpenRouter Permissions** ✅ **SUFFICIENT**:
- `OPENROUTER_API_KEY` provides access to chat completions
- Style analysis requires ~4K-8K context for 10 emails
- Each analysis call ~2-4K tokens (minor cost impact)

---

### Summary: Action Items Before Implementation

> [!IMPORTANT]
> **Blocking Issues (Must Fix)**

| Issue | Impact | Module | Action |
|-------|--------|--------|--------|
| Gmail OAuth scopes | ❌ Cannot fetch sent emails | 9 | Re-auth with `gmail.readonly` scope |
| OAuth consent screen | ❌ Users can't self-serve auth | 3, 9 | Configure in GCP Console |
| Telegram webhook | ❌ Can't auto-capture chat ID | 6 | Configure webhook endpoint |

> [!TIP]
> **Already Ready**

| Feature | Status | Module |
|---------|--------|--------|
| Twilio provisioning | ✅ Full access | 5 |
| Stripe subscriptions | ✅ Full access | 4 |
| OpenRouter AI | ✅ Full access | 9 |
| SMS sending | ✅ Working | - |
| Email sending | ✅ Working | - |

---

## 8. Database Schema Changes

### New Tables

```sql
-- Email alias configuration per company
CREATE TABLE email_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    alias_address TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Telegram setup codes (temporary, for linking)
CREATE TABLE telegram_setup_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    code TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    chat_id TEXT
);
```

### Schema Modifications

```sql
-- Add to companies table
ALTER TABLE companies ADD COLUMN website_url TEXT;
ALTER TABLE companies ADD COLUMN gmail_refresh_token TEXT; -- Encrypted
ALTER TABLE companies ADD COLUMN gmail_access_token TEXT;  -- Encrypted
ALTER TABLE companies ADD COLUMN gmail_token_expires_at TIMESTAMPTZ;
ALTER TABLE companies ADD COLUMN onboarding_state JSONB DEFAULT '{}';
```

---

## 8. API Endpoints Required

### New Endpoints

| Method | Endpoint | Purpose | Module |
|--------|----------|---------|--------|
| GET | `/api/oauth/gmail` | Initiate Gmail OAuth | 3 |
| GET | `/api/oauth/gmail/callback` | Handle OAuth callback | 3 |
| POST | `/api/oauth/gmail/disconnect` | Revoke Gmail access | 3 |
| GET | `/api/phone-numbers/available` | Search Twilio inventory | 5 |
| POST | `/api/phone-numbers/provision` | Purchase and configure | 5 |
| DELETE | `/api/phone-numbers/:id` | Release a number | 5 |
| POST | `/api/telegram/setup-code` | Generate setup code | 6 |
| GET | `/api/telegram/setup-status/:code` | Check if linked | 6 |
| GET | `/api/onboarding/state` | Get onboarding progress | 8 |
| PATCH | `/api/onboarding/state` | Update onboarding step | 8 |
| GET | `/api/gmail/sent-emails` | Fetch recent sent emails | 9 |
| POST | `/api/style/analyze` | AI pre-selection of style examples | 9 |
| POST | `/api/style/generate` | Generate style profile from examples | 9 |
| GET | `/api/style/profile` | Get company style profile | 9 |
| PATCH | `/api/style/profile` | Update style profile | 9 |

### Modified Endpoints

| Method | Endpoint | Changes | Module |
|--------|----------|---------|--------|
| PATCH | `/api/setup/profile` | Add website_url field | 2 |
| POST | `/api/stripe/checkout` | Support inline in wizard | 4 |

---

## 9. Verification Strategy

### Automated Tests

| Test | Type | Command |
|------|------|---------|
| Phone provisioning API | Integration | `npm run test:integration -- phone-numbers` |
| OAuth callback handling | Unit | `npm run test -- oauth` |
| Onboarding state updates | Unit | `npm run test -- onboarding` |

### Manual Verification Checklist

#### Gmail OAuth Flow
- [ ] Click "Connect with Google" opens OAuth popup
- [ ] Authorize permissions and redirect back
- [ ] UI shows connected email address
- [ ] Send a test email to verify credentials work
- [ ] Disconnect and re-connect works

#### Stripe Subscription Flow
- [ ] Plan selection shows correct pricing
- [ ] Stripe checkout opens successfully
- [ ] Webhook updates subscription status
- [ ] Phone step appears only for paid plans
- [ ] Free tier users skip to escalation

#### Phone Provisioning Flow
- [ ] Country selection shows available countries
- [ ] Area code filter works
- [ ] Available numbers load from Twilio
- [ ] Selecting a number provisions correctly
- [ ] Webhooks are auto-configured
- [ ] Number appears in Settings after setup

#### Telegram Deep-Link Flow
- [ ] "Connect Telegram" generates valid link
- [ ] Link opens Telegram with bot
- [ ] `/start <code>` links the account
- [ ] UI updates to show connected status
- [ ] Test escalation arrives in Telegram

#### Style Learning Flow
- [ ] After Gmail OAuth, sent emails are fetched
- [ ] AI pre-selects 10 of 20 displayed emails
- [ ] User can select/deselect email cards
- [ ] "View Full" shows complete email in modal
- [ ] "+" card allows pasting custom examples
- [ ] Style rules textarea accepts custom rules
- [ ] "Generate Style" creates style profile
- [ ] Style profile shows tone, greeting, sign-off, patterns
- [ ] Style profile is editable post-generation
- [ ] AI responses reflect the learned style

---

## 10. Implementation Priority & Roadmap

### Phase 1: Quick Wins (Week 1)
- Module 1: Welcome & Value Prop Step
- Module 2: Business Profile Enhancement (website URL)
- Module 8: Onboarding State Tracking

### Phase 2: Email Flow (Week 2)
- Module 3: Gmail OAuth Self-Service

### Phase 3: Paid Features (Week 3)
- Module 4: Stripe Subscription Integration
- Module 5: Twilio Phone Provisioning
- Module 7: Platform Escalation Number

### Phase 4: Polish & Style (Week 4)
- Module 6: Telegram Deep-Link Setup
- Module 9: "Respond As Me" Style Learning
- Multi-vertical config setup
- End-to-end testing

---

## Appendix: File Reference

### Current Files (to modify)

| File | Purpose |
|------|---------|
| `admin-ui/src/pages/SetupWizardPage.tsx` | Main onboarding wizard |
| `admin-ui/src/pages/SettingsPage.tsx` | Settings (phone, email, etc.) |
| `admin-ui/src/pages/IntegrationsPage.tsx` | API integrations |
| `admin-ui/src/pages/BillingPage.tsx` | Billing/subscription |
| `src/db/schema.ts` | Database schema |
| `src/worker/lib/twilio.ts` | Twilio utilities |
| `src/worker/lib/gmail.ts` | Gmail utilities |
| `src/worker/lib/telegram.ts` | Telegram utilities |

### Appendix A: Telegram Webhook Setup

To enable the deep-linking flow (Module 6), the Telegram bot must be configured to send updates to your Worker.

**Command to run (locally or in terminal):**

```bash
# Replace {BOT_TOKEN} and {WORKER_URL}
curl -F "url=https://your-worker-url.com/api/webhooks/telegram" \
     https://api.telegram.org/bot{BOT_TOKEN}/setWebhook
```

**Verify setup:**

```bash
curl https://api.telegram.org/bot{BOT_TOKEN}/getWebhookInfo
```

**Required Output:**
```json
{
  "ok": true,
  "result": {
    "url": "https://your-worker-url.com/api/webhooks/telegram",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

---

## 11. Neon Production Configuration

> [!IMPORTANT]
> These settings are critical for production performance. Neon's serverless architecture requires specific configuration for consistent latency.

### Recommended Settings

| Setting | Development | Production | Why |
|---------|-------------|------------|-----|
| Scale to zero | Enabled ✓ | **Disabled** | Avoids 500ms-2s cold start latency |
| Min compute | 0.25 CU | **0.25-0.5 CU** | Keeps working set in memory |
| Max compute | 0.5 CU | **2 CU** | Handles traffic spikes |
| Connection pooling | Enabled ✓ | **Enabled** ✓ | Essential for serverless |
| Autoscaling | Enabled ✓ | **Enabled** ✓ | Cost-efficient scaling |

### Connection Pooling (Critical)

Neon provides built-in PgBouncer connection pooling. For Cloudflare Workers, use one of:

**Option 1: Neon Serverless Driver** (Current)
```typescript
import { neon } from '@neondatabase/serverless';
const sql = neon(env.DATABASE_URL);
```

**Option 2: Hyperdrive** (Recommended for lowest latency)
```typescript
// In wrangler.toml
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "<hyperdrive-id>"

// In code
import { Client } from 'pg';
const client = new Client(env.HYPERDRIVE.connectionString);
```

### Neon Console Checklist

Before going to production, verify in Neon Console:

- [ ] **Disable "Suspend compute after inactivity"** for production branch
- [ ] **Set min compute to 0.25+ CU** for production branch
- [ ] **Enable autoscaling** with max of 2 CU
- [ ] **Use connection pooling endpoint** (ends in `-pooler.region.neon.tech`)
- [ ] **Create read replica** if read-heavy workload expected

### Multi-Tenancy Best Practices

For this SaaS application, we use **shared database with tenant_id** (vs database-per-tenant):

| Approach | Pros | Cons | Our Choice |
|----------|------|------|------------|
| Shared DB + tenant_id | Simple, cost-effective | Requires careful RLS | ✓ MVP |
| Database per tenant | Strong isolation | Complex management | Future |

**Implementation**:
- All per-company tables have `company_id` foreign key
- API routes filter by `company_id` from authenticated session
- Consider RLS policies for defense-in-depth (future)

### Cost Optimization

| Tier | Included | Recommended For |
|------|----------|-----------------|
| Free | 0.5 GB storage, 190 compute hours | Development |
| Launch ($19/mo) | 10 GB, 300 hours | Staging + low-traffic prod |
| Scale ($69/mo) | 50 GB, 750 hours | Production with traffic |

---

## 12. Implementation Priority & Roadmap

> [!CAUTION]
> **Revised based on 3 independent security audits.** Module 0 is now 8-12 weeks of foundational security work before any user-facing features.

### Phase 0: Security & Multi-Tenancy Foundation (Weeks 1-10)

**Must complete before multi-tenant production.**

| Phase | Tasks | Estimate |
|-------|-------|----------|
| 0.1 | Tenant Data Isolation (KV→DB, ConfigDO, RLS) | 2-3 weeks |
| 0.2 | Inbound Routing Safety (SMS/Email map To→company) | 1-2 weeks |
| 0.3 | Outbound Sender Safety (remove dangerous fallback) | 1 week |
| 0.4 | Webhook Security (signatures + idempotency) | 1-2 weeks |
| 0.5 | Auth Hardening (Argon2id, CSRF) | 1 week |
| 0.6 | Integration Isolation (per-tenant tokens + encryption) | 1-2 weeks |
| 0.7 | Billing Enforcement (pre-send credit checks, usage ledger) | 1 week |

**Deliverable**: Production-ready multi-tenant SaaS platform.

---

### Phase 1: Onboarding UX (Weeks 11-12)

Only after Module 0 is complete:

- Module 1: Welcome & Value Prop Step
- Module 2: Business Profile Enhancement
- Module 8: Onboarding State Tracking

---

### Phase 2: Email Integration (Week 13)

- Module 3: Gmail OAuth Self-Service

---

### Phase 3: Paid Features (Weeks 14-15)

- Module 4: Stripe Subscription Integration
- Module 5: Twilio Phone Provisioning
- Module 7: Platform Escalation Number

---

### Phase 4: Polish & Advanced Features (Weeks 16-18)

- Module 6: Telegram Deep-Link Setup
- Module 9: "Respond As Me" Style Learning
- Module 10: Authentication & Unified Login
- Multi-vertical config setup
- End-to-end testing
- Beta launch with 2-3 tenants

---

### Total Timeline

| Milestone | Week |
|-----------|------|
| Security foundation complete | Week 10 |
| Basic onboarding live | Week 12 |
| Paid features live | Week 15 |
| Full v1.0 launch | Week 18 |

---

## Appendix: Audit Sources

This document incorporates findings from 3 independent security audits:

1. **Audit 1**: Focused on KV storage patterns, Twilio sync strategy, and resource validation
2. **Audit 2**: Focused on RLS, envelope encryption, billing ledger, email ingestion strategy
3. **Audit 3**: Detailed P0 findings with specific file references and SQL injection vectors

All three auditors agreed: **NO-GO for multi-tenant paid production** until Module 0 is complete.


