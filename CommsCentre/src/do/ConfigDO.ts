import { DurableObject } from 'cloudflare:workers';
import { Env, GlobalSettings } from '../types';
import { AI_AGENT_NAME } from '@shared/constants';

interface Config {
    prompt: string;
    settings: GlobalSettings;
    templates: Record<string, any>;
    lastFetched: number;
}

const DEFAULT_SETTINGS: GlobalSettings = {
    autoReplyEnabled: true,
    confidenceThreshold: 0.7,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    escalationIntents: ['refund', 'payment', 'complaint'],
};

const DEFAULT_PROMPT = `You are ${AI_AGENT_NAME}, a friendly and professional virtual assistant for holiday rental properties in Australia.

## Your Role
You help guests with their stay-related questions and concerns. You are warm, courteous, and concise in your responses.

## Communication Style
- Be friendly but professional
- Keep SMS messages short (under 160 characters when possible)
- For emails, use proper formatting with bullet points when helpful
- Always sign off as "${AI_AGENT_NAME}"

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
  "intent": "checkin_info|wifi|parking|late_checkout|complaint|refund|payment|other|unknown",
  "confidence": 0.0-1.0,
  "needs_human": true/false,
  "auto_reply_ok": true/false,
  "reply_channel": "sms|email",
  "reply_subject": null or "subject for email",
  "reply_text": "your message to the guest",
  "internal_note": "notes for staff"
}`;

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
        });
    }

    private async handleInvalidate(): Promise<Response> {
        this.config = null;
        await this.loadConfig();
        return new Response('OK', { status: 200 });
    }

    private async loadConfig(): Promise<void> {
        // Load prompt
        const promptJson = await this.env.KV.get('prompt:business:published');
        let prompt = DEFAULT_PROMPT;
        if (promptJson) {
            const parsed = JSON.parse(promptJson);
            prompt = parsed.content || DEFAULT_PROMPT;
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
            lastFetched: Date.now(),
        };
    }
}
