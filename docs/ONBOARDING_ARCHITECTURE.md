# Paradise Comms: Onboarding Architecture Master Plan

> **Purpose**: This document defines the ideal onboarding experience for Paradise Comms, compares it to the current implementation, and breaks down the work into implementation modules.
>
> **Target Audience**: Non-technical small business owners (hotels, Airbnbs, and future verticals like wedding photographers)
>
> **Goal**: "Zero to Live in 15 Minutes" - A frictionless, guided setup experience

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Ideal State User Journey](#2-ideal-state-user-journey)
3. [Current State Analysis](#3-current-state-analysis)
4. [Gap Analysis](#4-gap-analysis)
5. [Multi-Vertical Architecture](#5-multi-vertical-architecture)
6. [Implementation Modules](#6-implementation-modules)
7. [Database Schema Changes](#7-database-schema-changes)
8. [API Endpoints Required](#8-api-endpoints-required)
9. [Verification Strategy](#9-verification-strategy)

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
