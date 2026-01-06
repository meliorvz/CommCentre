/**
 * Style Analyzer - T-039
 * Analyzes sent emails to learn a company's communication style
 */

import { Env } from '../../types';
import { APP_NAME } from '@shared/constants';

export interface StyleAnalysisResult {
    styleGuide: string;
    traits: {
        tone: string;
        formality: 'formal' | 'semi-formal' | 'casual' | 'friendly';
        greetingPatterns: string[];
        signOffPatterns: string[];
        averageLength: 'short' | 'medium' | 'long';
        usesEmoji: boolean;
    };
    examplePhrases: string[];
    emailsAnalyzed: number;
}

const STYLE_ANALYSIS_PROMPT = `You are analyzing sent emails to extract a communication style guide.

Analyze the following sent emails and extract:
1. Overall tone (professional, warm, casual, formal, friendly)
2. Formality level (formal, semi-formal, casual, friendly)
3. Common greeting patterns (e.g., "Hi", "Dear", "Hey", "Good morning")
4. Common sign-off patterns (e.g., "Best regards", "Thanks", "Cheers")
5. Average response length preference
6. Whether emojis are used
7. Unique phrases or expressions commonly used
8. Sentence structure tendencies (short and direct vs. detailed)

Output a JSON object with this exact structure:
{
    "styleGuide": "A 2-3 paragraph description written in second person ('You should...', 'Use...') that can be injected into an AI system prompt to help it match this writing style. Include specific examples of phrasing to use.",
    "traits": {
        "tone": "descriptive word for the tone",
        "formality": "formal" | "semi-formal" | "casual" | "friendly",
        "greetingPatterns": ["list of common greetings"],
        "signOffPatterns": ["list of common sign-offs"],
        "averageLength": "short" | "medium" | "long",
        "usesEmoji": true | false
    },
    "examplePhrases": ["list of characteristic phrases from the emails"]
}`;

/**
 * Call LLM specifically for style analysis (different from the main callLLM which expects guest response format)
 */
async function callStyleAnalysisLLM(
    env: Env,
    emailContents: string[]
): Promise<StyleAnalysisResult> {
    const emailsText = emailContents
        .slice(0, 50) // Limit to 50 emails
        .map((email, i) => `--- Email ${i + 1} ---\n${email}`)
        .join('\n\n');

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'https://comms-centre.pages.dev',
            'X-Title': `${APP_NAME} Style Analysis`,
        },
        body: JSON.stringify({
            model: 'deepseek/deepseek-chat',
            messages: [
                { role: 'system', content: STYLE_ANALYSIS_PROMPT },
                { role: 'user', content: `Analyze these ${emailContents.length} sent emails:\n\n${emailsText}` },
            ],
            temperature: 0.3,
            max_tokens: 2048,
            response_format: { type: 'json_object' },
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[StyleAnalyzer] LLM error:', errorText);
        throw new Error(`Style analysis LLM error: ${response.status}`);
    }

    const result = await response.json() as {
        choices: Array<{ message: { content: string } }>;
    };

    const content = result.choices[0]?.message?.content;
    if (!content) {
        throw new Error('No content in style analysis response');
    }

    try {
        const parsed = JSON.parse(content) as StyleAnalysisResult;
        return {
            ...parsed,
            emailsAnalyzed: emailContents.length,
        };
    } catch (e) {
        console.error('[StyleAnalyzer] Failed to parse LLM response:', content);
        throw new Error('Failed to parse style analysis response');
    }
}

/**
 * Extract plain text body from Gmail message payload
 */
function extractEmailBody(payload: GmailMessagePayload): string {
    // Handle simple messages
    if (payload.body?.data) {
        return decodeBase64Url(payload.body.data);
    }

    // Handle multipart messages
    if (payload.parts) {
        // Prefer text/plain, then text/html
        for (const part of payload.parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
                return decodeBase64Url(part.body.data);
            }
        }
        // Try HTML and strip tags
        for (const part of payload.parts) {
            if (part.mimeType === 'text/html' && part.body?.data) {
                return stripHtml(decodeBase64Url(part.body.data));
            }
        }
        // Recursively check nested parts
        for (const part of payload.parts) {
            if (part.parts) {
                const nestedBody = extractEmailBody(part);
                if (nestedBody) return nestedBody;
            }
        }
    }

    return '';
}

/**
 * Decode base64url encoded string
 */
function decodeBase64Url(data: string): string {
    try {
        // Replace base64url chars with standard base64
        const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
        // Add padding if needed
        const padded = base64 + '=='.slice(0, (4 - base64.length % 4) % 4);
        return decodeURIComponent(escape(atob(padded)));
    } catch (e) {
        console.error('[StyleAnalyzer] Base64 decode error:', e);
        return '';
    }
}

/**
 * Simple HTML tag stripper
 */
function stripHtml(html: string): string {
    return html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim();
}

interface GmailMessagePayload {
    mimeType?: string;
    body?: { data?: string };
    parts?: GmailMessagePayload[];
}

interface GmailMessage {
    id: string;
    payload?: GmailMessagePayload;
}

interface GmailMessageListResponse {
    messages?: Array<{ id: string; threadId: string }>;
    nextPageToken?: string;
}

/**
 * Fetch sent emails from Gmail API
 */
export async function fetchSentEmails(
    accessToken: string,
    maxResults: number = 50
): Promise<string[]> {
    // List sent messages
    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=SENT&maxResults=${maxResults}`;

    const listResponse = await fetch(listUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!listResponse.ok) {
        const error = await listResponse.text();
        console.error('[StyleAnalyzer] Gmail list error:', error);
        throw new Error(`Failed to list sent emails: ${listResponse.status}`);
    }

    const listData = await listResponse.json() as GmailMessageListResponse;

    if (!listData.messages || listData.messages.length === 0) {
        return [];
    }

    // Fetch individual message bodies (in parallel, batches of 10)
    const messageIds = listData.messages.map(m => m.id);
    const emailBodies: string[] = [];

    for (let i = 0; i < messageIds.length; i += 10) {
        const batch = messageIds.slice(i, i + 10);
        const fetchPromises = batch.map(async (id) => {
            const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`;
            const msgResponse = await fetch(msgUrl, {
                headers: { 'Authorization': `Bearer ${accessToken}` },
            });

            if (!msgResponse.ok) {
                console.warn(`[StyleAnalyzer] Failed to fetch message ${id}`);
                return null;
            }

            const message = await msgResponse.json() as GmailMessage;
            if (message.payload) {
                return extractEmailBody(message.payload);
            }
            return null;
        });

        const bodies = await Promise.all(fetchPromises);
        emailBodies.push(...bodies.filter((b): b is string => b !== null && b.length > 0));
    }

    return emailBodies;
}

/**
 * Main function: Analyze sent emails and generate style guide
 */
export async function analyzeCompanyStyle(
    env: Env,
    accessToken: string,
    maxEmails: number = 50
): Promise<StyleAnalysisResult> {
    console.log(`[StyleAnalyzer] Fetching up to ${maxEmails} sent emails...`);

    const emailBodies = await fetchSentEmails(accessToken, maxEmails);

    if (emailBodies.length === 0) {
        throw new Error('No sent emails found to analyze');
    }

    if (emailBodies.length < 5) {
        throw new Error(`Need at least 5 sent emails for meaningful analysis (found ${emailBodies.length})`);
    }

    console.log(`[StyleAnalyzer] Analyzing ${emailBodies.length} emails...`);

    const result = await callStyleAnalysisLLM(env, emailBodies);

    console.log(`[StyleAnalyzer] Analysis complete. Traits:`, result.traits);

    return result;
}
