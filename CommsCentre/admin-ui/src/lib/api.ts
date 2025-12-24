const API_BASE = import.meta.env.VITE_API_URL || 'https://comms-centre.ancient-fire-eaa9.workers.dev';

async function fetchApi<T>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        const message = error.details || error.error || `HTTP ${response.status}`;
        const err = new Error(message) as any;
        err.details = error.details;
        err.stack = error.stack;
        throw err;
    }

    return response.json();
}

// Auth
export const api = {
    auth: {
        login: (email: string, password: string) =>
            fetchApi<{ user: User }>('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password }),
            }),
        logout: () => fetchApi<{ success: boolean }>('/api/auth/logout', { method: 'POST' }),
        me: () => fetchApi<{ user: User | null }>('/api/auth/me'),
    },

    properties: {
        list: () => fetchApi<{ properties: Property[] }>('/api/properties'),
        get: (id: string) => fetchApi<{ property: Property }>(`/api/properties/${id}`),
        create: (data: Partial<Property>) =>
            fetchApi<{ property: Property }>('/api/properties', {
                method: 'POST',
                body: JSON.stringify(data),
            }),
        update: (id: string, data: Partial<Property>) =>
            fetchApi<{ property: Property }>(`/api/properties/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            }),
        delete: (id: string) =>
            fetchApi<{ success: boolean }>(`/api/properties/${id}`, { method: 'DELETE' }),
    },

    stays: {
        list: (params?: { propertyId?: string; status?: string }) => {
            const query = new URLSearchParams(params as Record<string, string>).toString();
            return fetchApi<{ stays: Stay[] }>(`/api/stays${query ? `?${query}` : ''}`);
        },
        get: (id: string) =>
            fetchApi<{ stay: Stay; property: Property; thread: Thread }>(`/api/stays/${id}`),
        create: (data: Partial<Stay>) =>
            fetchApi<{ stay: Stay; thread: Thread }>('/api/stays', {
                method: 'POST',
                body: JSON.stringify(data),
            }),
        update: (id: string, data: Partial<Stay>) =>
            fetchApi<{ stay: Stay }>(`/api/stays/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            }),
        cancel: (id: string) =>
            fetchApi<{ stay: Stay }>(`/api/stays/${id}/cancel`, { method: 'POST' }),
        import: (propertyId: string, rows: Record<string, string>[]) =>
            fetchApi<{ success: number; errors: string[] }>('/api/stays/import', {
                method: 'POST',
                body: JSON.stringify({ propertyId, rows }),
            }),
    },

    threads: {
        list: (params?: { status?: string; limit?: string }) => {
            const query = new URLSearchParams(params as Record<string, string>).toString();
            return fetchApi<{ threads: ThreadWithContext[] }>(`/api/threads${query ? `?${query}` : ''}`);
        },
        get: (id: string) =>
            fetchApi<{
                thread: Thread;
                stay: Stay;
                property: Property;
                messages: Message[];
            }>(`/api/threads/${id}`),
        update: (id: string, data: { status?: string; assignedUserId?: string }) =>
            fetchApi<{ thread: Thread }>(`/api/threads/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            }),
        reply: (id: string, data: { channel: string; body: string; subject?: string }) =>
            fetchApi<{ message: Message }>(`/api/threads/${id}/reply`, {
                method: 'POST',
                body: JSON.stringify(data),
            }),
        suggest: (id: string) =>
            fetchApi<{ suggestion: LLMSuggestion | null }>(`/api/threads/${id}/ai-analysis`),
    },

    settings: {
        getGlobal: () => fetchApi<{ settings: GlobalSettings }>('/api/settings/global'),
        updateGlobal: (data: GlobalSettings) =>
            fetchApi<{ success: boolean }>('/api/settings/global', {
                method: 'PUT',
                body: JSON.stringify(data),
            }),
        getProperty: (id: string) =>
            fetchApi<{ settings: PropertySettings }>(`/api/settings/property/${id}`),
        updateProperty: (id: string, data: PropertySettings) =>
            fetchApi<{ success: boolean }>(`/api/settings/property/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data),
            }),
        getIntegration: <T>(key: string) =>
            fetchApi<{ settings: T }>(`/api/settings/integration/${key}`),
        updateIntegration: <T>(key: string, data: T) =>
            fetchApi<{ success: boolean }>(`/api/settings/integration/${key}`, {
                method: 'PUT',
                body: JSON.stringify(data),
            }),
        getTwilioNumbers: () => fetchApi<{ numbers: string[] }>('/api/settings/integration/twilio/numbers'),
        getIntegrationStatus: () => fetchApi<Record<string, boolean>>('/api/settings/integration/status'),
        testTelegram: () => fetchApi<{ success: boolean; error?: string }>('/api/settings/integration/telegram/test', {
            method: 'POST',
        }),
    },

    templates: {
        list: () => fetchApi<{ templates: Record<string, Template> }>('/api/templates'),
        get: (channel: string, ruleKey: string) =>
            fetchApi<{ template: Template }>(`/api/templates/${channel}/${ruleKey}`),
        update: (channel: string, ruleKey: string, data: { body: string; subject?: string }) =>
            fetchApi<{ template: Template }>(`/api/templates/${channel}/${ruleKey}`, {
                method: 'PUT',
                body: JSON.stringify(data),
            }),
    },

    prompt: {
        getPublished: () => fetchApi<{ prompt: PromptVersion }>('/api/prompt/published'),
        getDraft: () => fetchApi<{ draft: string }>('/api/prompt/draft'),
        saveDraft: (content: string) =>
            fetchApi<{ success: boolean }>('/api/prompt/draft', {
                method: 'PUT',
                body: JSON.stringify({ content }),
            }),
        publish: (content: string) =>
            fetchApi<{ prompt: PromptVersion }>('/api/prompt/publish', {
                method: 'POST',
                body: JSON.stringify({ content }),
            }),
        getVersions: () => fetchApi<{ versions: PromptVersion[] }>('/api/prompt/versions'),
    },

    setup: {
        getProfile: () => fetchApi<{ profile: SetupProfile }>('/api/settings/setup/profile'),
        updateProfile: (data: Partial<SetupProfile>) =>
            fetchApi<{ profile: SetupProfile }>('/api/settings/setup/profile', {
                method: 'PUT',
                body: JSON.stringify(data),
            }),
        getDefaults: () => fetchApi<{ defaults: PropertyDefaults }>('/api/settings/setup/defaults'),
        updateDefaults: (data: Partial<PropertyDefaults>) =>
            fetchApi<{ defaults: PropertyDefaults }>('/api/settings/setup/defaults', {
                method: 'PUT',
                body: JSON.stringify(data),
            }),
    },

    knowledge: {
        getCategories: () => fetchApi<{ categories: KnowledgeCategory[] }>('/api/settings/knowledge/categories'),
        updateCategories: (categories: KnowledgeCategory[]) =>
            fetchApi<{ categories: KnowledgeCategory[] }>('/api/settings/knowledge/categories', {
                method: 'PUT',
                body: JSON.stringify({ categories }),
            }),
        getItems: () => fetchApi<{ items: KnowledgeItem[] }>('/api/settings/knowledge/items'),
        saveItem: (id: string, data: { categoryId: string; question: string; answer: string }) =>
            fetchApi<{ item: KnowledgeItem }>(`/api/settings/knowledge/items/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data),
            }),
        deleteItem: (id: string) =>
            fetchApi<{ success: boolean }>(`/api/settings/knowledge/items/${id}`, {
                method: 'DELETE',
            }),
    },

    users: {
        list: () => fetchApi<{ users: UserWithDates[] }>('/api/users'),
        create: (data: { email: string; password: string; role?: 'admin' | 'staff' }) =>
            fetchApi<{ user: UserWithDates }>('/api/users', {
                method: 'POST',
                body: JSON.stringify(data),
            }),
        update: (id: string, data: { password?: string; role?: 'admin' | 'staff' }) =>
            fetchApi<{ user: UserWithDates }>(`/api/users/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            }),
        delete: (id: string) =>
            fetchApi<{ success: boolean }>(`/api/users/${id}`, {
                method: 'DELETE',
            }),
    },
};

// Types
export interface User {
    id: string;
    email: string;
    role: 'admin' | 'staff';
}

export interface UserWithDates extends User {
    createdAt: string;
}

export interface Property {
    id: string;
    name: string;
    timezone: string;
    addressText?: string;
    supportPhoneE164?: string;
    supportEmail?: string;
    status: 'active' | 'inactive';
    createdAt: string;
    updatedAt: string;
}

export interface Stay {
    id: string;
    propertyId: string;
    guestName: string;
    guestPhoneE164?: string;
    guestEmail?: string;
    checkinAt: string;
    checkoutAt: string;
    status: 'booked' | 'checked_in' | 'checked_out' | 'cancelled';
    preferredChannel: 'sms' | 'email' | 'both';
    notesInternal?: string;
    createdAt: string;
    updatedAt: string;
}

export interface Thread {
    id: string;
    stayId: string;
    status: 'open' | 'needs_human' | 'closed';
    lastMessageAt?: string;
    lastChannel?: 'sms' | 'email';
    assignedUserId?: string;
    createdAt: string;
    updatedAt: string;
}

export interface ThreadWithContext extends Thread {
    stay?: Stay;
    property?: Property;
}

export interface Message {
    id: string;
    threadId: string;
    direction: 'inbound' | 'outbound';
    channel: 'sms' | 'email';
    fromAddr: string;
    toAddr: string;
    subject?: string;
    bodyText: string;
    provider: 'twilio' | 'mailchannels' | 'gmail'; // mailchannels kept for legacy DB records
    providerMessageId?: string;
    status: 'received' | 'queued' | 'sent' | 'delivered' | 'failed';
    createdAt: string;
}

export interface GlobalSettings {
    autoReplyEnabled: boolean;
    confidenceThreshold: number;
    quietHoursStart: string;
    quietHoursEnd: string;
    escalationIntents: string[];
    callForwardingNumber?: string;
}

export interface PropertySettings {
    timezone?: string;
    autoReplyEnabled: boolean;
    smsEnabled: boolean;
    emailEnabled: boolean;
    scheduleT3Time: string;
    scheduleT1Time: string;
    scheduleDayOfTime: string;
}

export interface Template {
    channel: 'sms' | 'email';
    ruleKey: string;
    subject?: string;
    body: string;
    version: number;
}

export interface PromptVersion {
    content: string;
    version: number;
    publishedAt: string;
    publishedBy: string;
}

export interface LLMSuggestion {
    intent: string;
    confidence: number;
    needs_human: boolean;
    auto_reply_ok: boolean;
    reply_channel: 'sms' | 'email';
    reply_subject?: string;
    reply_text: string;
    internal_note: string;
}

export interface SetupProfile {
    companyName: string;
    assistantName: string;
    businessType: 'holiday_rentals' | 'hotel' | 'serviced_apartments' | 'other';
    escalationPhone?: string;
    escalationEmail?: string;
    timezone: string;
}

export interface PropertyDefaults {
    checkinTime: string;
    checkoutTime: string;
    earlyCheckinPolicy?: string;
    lateCheckoutPolicy?: string;
    parkingInfo?: string;
    petPolicy?: string;
    smokingPolicy?: string;
    partyPolicy?: string;
    quietHours?: string;
}

export interface KnowledgeCategory {
    id: string;
    name: string;
    order: number;
    exampleQuestions?: string;
}

export interface KnowledgeItem {
    id: string;
    categoryId: string;
    question: string;
    answer: string;
    updatedAt: string;
}

