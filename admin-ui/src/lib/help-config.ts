import { Step } from 'react-joyride';

// ============================================================================
// TOUR CONFIGURATION
// ============================================================================

export const TOUR_STEPS: Record<string, Step[]> = {
    GENERAL: [
        {
            target: 'body',
            content: 'Welcome to Paradise Comms! Let\'s get you oriented with your new guest communication center.',
            placement: 'center',
            disableBeacon: true,
        },
        {
            target: '#nav-inbox',
            content: 'This is your command center. All guest SMS and Emails appear here in a unified timeline.',
            placement: 'right',
        },
        {
            target: '#nav-stays',
            content: 'Manage bookings and guest details here. You can edit dates, assigned properties, and guest info.',
            placement: 'right',
        },
        {
            target: '#nav-help',
            content: 'Need a refresher? Detailed guides and this tour are always available here.',
            placement: 'right',
        },
    ],
    ADMIN: [
        {
            target: '#nav-properties',
            content: 'Start by confirming all your rental properties are set up correctly.',
            placement: 'right',
        },
        {
            target: '#nav-ai-config',
            content: 'Customize how your AI Assistant (system prompt, tone) responds to your guests.',
            placement: 'right',
        },
        {
            target: '#nav-settings',
            content: 'Connect your Twilio (SMS) and Gmail accounts here to enable messaging.',
            placement: 'right',
        },
        {
            target: '#nav-billing',
            content: 'Monitor your credit usage for messages and phone numbers, and top up your balance.',
            placement: 'right',
        },
    ],
    SUPER_ADMIN: [
        {
            target: '#nav-admin',
            content: 'As a Super Admin, manage companies, tenants, and platform-wide credit settings here.',
            placement: 'right',
        },
    ],
};

// ============================================================================
// HELP CONTENT CONFIGURATION
// ============================================================================

export interface HelpArticle {
    id: string;
    title: string;
    content: string;
}

export interface HelpSection {
    id: string;
    title: string;
    articles: HelpArticle[];
}

export const HELP_SECTIONS: HelpSection[] = [
    {
        id: 'quick-start',
        title: 'Quick Start',
        articles: [
            {
                id: 'how-it-works',
                title: 'How it Works',
                content: `
# How Paradise Comms Works

Paradise Comms is an AI-powered assistant that sits between your guests and your staff.

### The Concept
1. **Guest Messages**: A guest sends an SMS or Email.
2. **AI Analysis**: Our AI reads the message, checks previous history, and determines the **Intent** (e.g., checking in, complaint, question).
3. **Draft or Reply**:
   - If the AI is confident and Auto-Reply is ON, it replies instantly.
   - If the AI is unsure, it marks the thread as **Needs Attention**.
4. **Escalation**: Your staff is notified (via Telegram/Dashboard) to review the thread.

### Key Terms
- **Thread**: A conversation with a guest.
- **Stay**: A booking record (dates, guest name).
- **Credits**: The currency used for sending messages.
`
            },
            {
                id: 'terminology',
                title: 'Terminology',
                content: `
# Terminology

- **Property**: A physical rental unit you manage.
- **Channel**: How we talk to guests (SMS or Email).
- **Escalation**: When the AI stops and asks a human for help.
- **T-Minus Messages**: Automated messages sent before check-in (e.g., T-3 days).
`
            }
        ]
    },
    {
        id: 'setup-guide',
        title: 'Setup Guide',
        articles: [
            {
                id: 'connecting-channels',
                title: 'Connecting Channels',
                content: `
# Connecting Channels

### Twilio (SMS)
1. Go to **Settings**.
2. Scroll to **Phone & Messaging**.
3. Select a phone number from the available pool.
4. This number will be used for all outbound SMS.

### Gmail (Email)
1. Go to **Settings**.
2. Scroll to **Email Configuration**.
3. Click "Connect Gmail".
4. Authorize the application to send emails on your behalf.
`
            },
            {
                id: 'configuring-ai',
                title: 'Configuring AI',
                content: `
# Configuring Your AI

Go to **AI Configuration** to fine-tune your assistant.

### Persona
- **Name**: What the AI calls itself (e.g., "Sarah from Support").
- **Tone**: Formal, Casual, or Friendly.

### Escalation Rules
- **Confidence Threshold**: How sure the AI must be to auto-reply (default: 80%).
- **Always Escalate**: Categories like "Complaints" or "Payments" can be set to always require human review.
`
            }
        ]
    },
    {
        id: 'daily-ops',
        title: 'Daily Operations',
        articles: [
            {
                id: 'handling-responses',
                title: 'Handling Responses',
                content: `
# Handling Responses

### The Inbox
Your daily workflow revolves around the **Inbox**.

1. **Filter**: Use the "Needs Attention" filter to see urgent items.
2. **Review**: Click a thread to read the guest's message.
3. **AI Suggestion**: Look for the "AI Suggestion" box.
   - Click **Apply** to use it.
   - Click **Edit** to modify it before sending.
4. **Manual Reply**: Type your own message in the text box.
`
            },
            {
                id: 'managing-stays',
                title: 'Managing Stays',
                content: `
# Managing Stays

Stays are the core record of a guest's visit.

- **Creating**: Go to **Stays** -> **New Stay**.
- **Importing**: You can upload a CSV of bookings.
- **Editing**: Click any stay to update dates or guest contact info.

> **Note**: Updating a stay automatically updates the context for the AI in any open threads.
`
            }
        ]
    }
];
