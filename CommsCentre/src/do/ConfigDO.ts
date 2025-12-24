import { DurableObject } from 'cloudflare:workers';
import { Env, GlobalSettings, SetupProfile, PropertyDefaults, KnowledgeCategory, KnowledgeItem } from '../types';

interface Config {
    prompt: string;
    settings: GlobalSettings;
    templates: Record<string, any>;
    profile: SetupProfile;
    propertyDefaults: PropertyDefaults;
    knowledgeCategories: KnowledgeCategory[];
    knowledgeItems: KnowledgeItem[];
    lastFetched: number;
}

const DEFAULT_SETTINGS: GlobalSettings = {
    autoReplyEnabled: true,
    confidenceThreshold: 0.7,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    escalationCategories: ['complaint', 'booking_change', 'payment'],
    callForwardingNumber: '', // Disabled by default
};

const DEFAULT_PROFILE: SetupProfile = {
    companyName: 'Paradise Stayz',
    assistantName: 'Mark',
    businessType: 'holiday_rentals',
    timezone: 'Australia/Sydney',
};

const DEFAULT_PROPERTY_DEFAULTS: PropertyDefaults = {
    checkinTime: '15:00',
    checkoutTime: '10:00',
    earlyCheckinPolicy: 'Subject to availability, please contact us',
    lateCheckoutPolicy: 'Available until 12pm if requested 24 hours in advance',
    parkingInfo: '',
    petPolicy: 'No pets allowed',
    smokingPolicy: 'Strictly non-smoking property',
    partyPolicy: 'No parties or events permitted',
    quietHours: '10pm - 8am',
};

const DEFAULT_CATEGORIES: KnowledgeCategory[] = [
    { id: 'access', name: 'Access & Arrival', order: 0, exampleQuestions: 'Check-in time, early check-in, lockbox location, late arrival, door code' },
    { id: 'parking', name: 'Building & Parking', order: 1, exampleQuestions: 'Parking included, garage entry, visitor parking, lift access' },
    { id: 'wifi', name: 'Wi-Fi & Utilities', order: 2, exampleQuestions: 'Wi-Fi credentials, TV setup, AC controls, hot water' },
    { id: 'rules', name: 'House Rules', order: 3, exampleQuestions: 'Pets, smoking, parties, quiet hours, extra guests' },
    { id: 'stay', name: 'Stay Management', order: 4, exampleQuestions: 'Late checkout, luggage storage, extend stay, date changes' },
    { id: 'local', name: 'Local Area', order: 5, exampleQuestions: 'Nearest grocery, pharmacy, transport, recommendations' },
];

function generateSystemPrompt(
    profile: SetupProfile,
    defaults: PropertyDefaults,
    categories: KnowledgeCategory[],
    items: KnowledgeItem[]
): string {
    const { assistantName, companyName, businessType } = profile;

    // Build knowledge base section
    let knowledgeSection = '';
    if (items.length > 0) {
        knowledgeSection = '\n## Knowledge Base\nUse this information to answer guest questions:\n\n';

        // Group items by category
        const sortedCategories = [...categories].sort((a, b) => a.order - b.order);
        for (const category of sortedCategories) {
            const categoryItems = items.filter(item => item.categoryId === category.id);
            if (categoryItems.length > 0) {
                knowledgeSection += `### ${category.name}\n`;
                for (const item of categoryItems) {
                    knowledgeSection += `**${item.question}**: ${item.answer}\n`;
                }
                knowledgeSection += '\n';
            }
        }
    }

    // Build property defaults section
    let defaultsSection = '\n## Default Property Information\n';
    defaultsSection += `- Check-in time: ${defaults.checkinTime}\n`;
    defaultsSection += `- Check-out time: ${defaults.checkoutTime}\n`;
    if (defaults.earlyCheckinPolicy) defaultsSection += `- Early check-in: ${defaults.earlyCheckinPolicy}\n`;
    if (defaults.lateCheckoutPolicy) defaultsSection += `- Late check-out: ${defaults.lateCheckoutPolicy}\n`;
    if (defaults.parkingInfo) defaultsSection += `- Parking: ${defaults.parkingInfo}\n`;
    if (defaults.petPolicy) defaultsSection += `- Pets: ${defaults.petPolicy}\n`;
    if (defaults.smokingPolicy) defaultsSection += `- Smoking: ${defaults.smokingPolicy}\n`;
    if (defaults.partyPolicy) defaultsSection += `- Parties/Events: ${defaults.partyPolicy}\n`;
    if (defaults.quietHours) defaultsSection += `- Quiet hours: ${defaults.quietHours}\n`;

    const businessDesc = businessType === 'holiday_rentals' ? 'holiday rental properties' :
        businessType === 'hotel' ? 'hotel accommodations' :
            businessType === 'serviced_apartments' ? 'serviced apartments' :
                'accommodation services';

    return `You are ${assistantName}, a friendly and professional virtual assistant for ${companyName}, managing ${businessDesc} in Australia.

## Your Role
You help guests with their stay-related questions and concerns. You are warm, courteous, and concise in your responses.

## Communication Style
- Be friendly but professional
- Keep SMS messages short (under 160 characters when possible)
- For emails, use proper formatting with bullet points when helpful
- Always sign off as "${assistantName}"
${defaultsSection}${knowledgeSection}
## When to Escalate
Always escalate (set needs_human=true) for:
- Payment, refund, or billing issues
- Damage claims or reports
- Safety concerns or emergencies
- Legal matters or threats
- Complaints that require compensation
- When you're unsure how to help

## Response Format
You must respond with valid JSON matching this schema:
{
  "category": "inquiry|complaint|booking_change|payment|other",
  "intent_detail": "specific topic (e.g. checkin_info, wifi, parking, refund)",
  "confidence": 0.0-1.0,
  "needs_human": true/false,
  "auto_reply_ok": true/false,
  "reply_channel": "sms|email",
  "reply_subject": null or "subject for email",
  "reply_text": "your message to the guest",
  "internal_note": "notes for staff"
}`;
}

export class ConfigDO extends DurableObject<Env> {
    private config: Config | null = null;

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        if (url.pathname === '/config' && request.method === 'GET') {
            return this.handleGetConfig();
        }

        if (url.pathname === '/invalidate' && request.method === 'POST') {
            return this.handleInvalidate();
        }

        return new Response('Not found', { status: 404 });
    }

    private async handleGetConfig(): Promise<Response> {
        if (!this.config) {
            await this.loadConfig();
        }

        return Response.json({
            prompt: this.config!.prompt,
            settings: this.config!.settings,
            templates: this.config!.templates,
            profile: this.config!.profile,
            propertyDefaults: this.config!.propertyDefaults,
        });
    }

    private async handleInvalidate(): Promise<Response> {
        this.config = null;
        await this.loadConfig();
        return new Response('OK', { status: 200 });
    }

    private async loadConfig(): Promise<void> {
        // Load setup profile
        const profileJson = await this.env.KV.get('setup:profile');
        const profile: SetupProfile = profileJson ? JSON.parse(profileJson) : DEFAULT_PROFILE;

        // Load property defaults
        const defaultsJson = await this.env.KV.get('setup:property-defaults');
        const propertyDefaults: PropertyDefaults = defaultsJson ? JSON.parse(defaultsJson) : DEFAULT_PROPERTY_DEFAULTS;

        // Load knowledge base
        const categoriesJson = await this.env.KV.get('knowledge:categories');
        const knowledgeCategories: KnowledgeCategory[] = categoriesJson ? JSON.parse(categoriesJson) : DEFAULT_CATEGORIES;

        const itemsJson = await this.env.KV.get('knowledge:items');
        const knowledgeItems: KnowledgeItem[] = itemsJson ? JSON.parse(itemsJson) : [];

        // Check for manual prompt override
        const promptJson = await this.env.KV.get('prompt:business:published');
        let prompt: string;
        if (promptJson) {
            const parsed = JSON.parse(promptJson);
            // If there's a manually saved prompt, use it
            prompt = parsed.content || generateSystemPrompt(profile, propertyDefaults, knowledgeCategories, knowledgeItems);
        } else {
            // Generate prompt dynamically from profile/defaults/KB
            prompt = generateSystemPrompt(profile, propertyDefaults, knowledgeCategories, knowledgeItems);
        }

        // Load settings
        const settingsJson = await this.env.KV.get('settings:global');
        const settings: GlobalSettings = settingsJson
            ? JSON.parse(settingsJson)
            : DEFAULT_SETTINGS;

        // Load templates
        const templates: Record<string, any> = {};
        const templateKeys = [
            'templates:sms:T_MINUS_3',
            'templates:sms:T_MINUS_1',
            'templates:sms:DAY_OF',
            'templates:email:T_MINUS_3',
            'templates:email:T_MINUS_1',
            'templates:email:DAY_OF',
        ];

        for (const key of templateKeys) {
            const templateJson = await this.env.KV.get(key);
            if (templateJson) {
                templates[key] = JSON.parse(templateJson);
            }
        }

        this.config = {
            prompt,
            settings,
            templates,
            profile,
            propertyDefaults,
            knowledgeCategories,
            knowledgeItems,
            lastFetched: Date.now(),
        };
    }
}

