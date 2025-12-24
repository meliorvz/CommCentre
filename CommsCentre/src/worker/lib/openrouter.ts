import { Env, LLMResponse, llmResponseSchema } from '../../types';
import { APP_NAME } from '@shared/constants';

interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export async function callLLM(
    env: Env,
    systemPrompt: string,
    messages: ChatMessage[]
): Promise<LLMResponse> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'https://comms-centre.pages.dev',
            'X-Title': `${APP_NAME} Guest Communications`,
        },
        body: JSON.stringify({
            model: 'deepseek/deepseek-chat', // DeepSeek V3
            messages: [
                { role: 'system', content: systemPrompt },
                ...messages,
            ],
            temperature: 0.3,
            max_tokens: 1024,
            response_format: { type: 'json_object' },
        }),
    });

    if (!response.ok) {
        let errorBody = '';
        try {
            errorBody = await response.text();
        } catch (e) {
            errorBody = '[Could not read response body]';
        }
        console.error(`OpenRouter error (${response.status} ${response.statusText}):`, errorBody);
        throw new Error(`OpenRouter error: ${response.status} ${response.statusText} - ${errorBody.slice(0, 100)}`);
    }

    const result = await response.json() as {
        choices: Array<{ message: { content: string } }>;
    };

    const content = result.choices[0]?.message?.content;

    if (!content) {
        throw new Error('No content in LLM response');
    }

    // Parse and validate the JSON response
    let parsed: unknown;
    try {
        parsed = JSON.parse(content);
    } catch {
        console.error('Failed to parse LLM response:', content);
        // Return a safe fallback
        return {
            intent: 'unknown',
            confidence: 0,
            needs_human: true,
            auto_reply_ok: false,
            reply_channel: 'sms',
            reply_subject: null,
            reply_text: '',
            internal_note: 'Failed to parse LLM response',
        };
    }

    const validated = llmResponseSchema.safeParse(parsed);

    if (!validated.success) {
        console.error('Invalid LLM response schema:', validated.error);
        return {
            intent: 'unknown',
            confidence: 0,
            needs_human: true,
            auto_reply_ok: false,
            reply_channel: 'sms',
            reply_subject: null,
            reply_text: '',
            internal_note: `Invalid response schema: ${validated.error.message}`,
        };
    }

    return validated.data;
}

export function buildConversationContext(
    messages: Array<{ direction: string; bodyText: string; channel: string }>
): ChatMessage[] {
    return messages.map((msg) => ({
        role: msg.direction === 'inbound' ? 'user' : 'assistant',
        content: msg.bodyText,
    })) as ChatMessage[];
}
