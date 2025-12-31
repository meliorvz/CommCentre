export const API_BASE = import.meta.env.VITE_API_URL || 'https://comms-centre.ancient-fire-eaa9.workers.dev';

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
        create: (data: { email: string; password: string; role?: UserRole; companyId?: string }) =>
            fetchApi<{ user: UserWithDates }>('/api/users', {
                method: 'POST',
                body: JSON.stringify(data),
            }),
        update: (id: string, data: { password?: string; role?: UserRole }) =>
            fetchApi<{ user: UserWithDates }>(`/api/users/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            }),
        delete: (id: string) =>
            fetchApi<{ success: boolean }>(`/api/users/${id}`, {
                method: 'DELETE',
            }),
    },

    // Super admin only
    companies: {
        list: () => fetchApi<{ companies: Company[] }>('/api/companies'),
        get: (id: string) => fetchApi<CompanyDetails>(`/api/companies/${id}`),
        create: (data: CreateCompanyData) =>
            fetchApi<{ company: Company }>('/api/companies', {
                method: 'POST',
                body: JSON.stringify(data),
            }),
        update: (id: string, data: Partial<Company>) =>
            fetchApi<{ company: Company }>(`/api/companies/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            }),
        delete: (id: string) =>
            fetchApi<{ success: boolean }>(`/api/companies/${id}`, { method: 'DELETE' }),
        addCredits: (id: string, amount: number, description?: string) =>
            fetchApi<{ success: boolean; newBalance: number }>(`/api/companies/${id}/credits`, {
                method: 'POST',
                body: JSON.stringify({ amount, description }),
            }),
        getTransactions: (id: string, limit?: number) =>
            fetchApi<{ transactions: CreditTransaction[] }>(
                `/api/companies/${id}/transactions${limit ? `?limit=${limit}` : ''}`
            ),
        getTrialCost: () =>
            fetchApi<{ trialCredits: number; estimatedCostCents: number; estimatedCostFormatted: string }>(
                '/api/companies/config/trial-cost'
            ),
    },

    // Company admin and above
    credits: {
        getBalance: (companyId?: string) =>
            fetchApi<CreditBalanceResponse>(
                `/api/credits${companyId ? `?companyId=${companyId}` : ''}`
            ),
        getTransactions: (limit?: number, offset?: number, companyId?: string) => {
            const params = new URLSearchParams();
            if (limit) params.set('limit', String(limit));
            if (offset) params.set('offset', String(offset));
            if (companyId) params.set('companyId', companyId);
            return fetchApi<{ transactions: CreditTransaction[]; total: number }>(
                `/api/credits/transactions?${params}`
            );
        },
        getUsage: (companyId?: string) =>
            fetchApi<CreditUsageReport>(
                `/api/credits/usage${companyId ? `?companyId=${companyId}` : ''}`
            ),
        getConfig: () =>
            fetchApi<CreditConfigResponse>('/api/credits/config'),
        updateConfig: (key: string, value: number, estimatedCostCents?: number) =>
            fetchApi<{ config: CreditConfigItem }>(`/api/credits/config/${key}`, {
                method: 'PATCH',
                body: JSON.stringify({ value, estimatedCostCents }),
            }),
    },

    integrations: {
        list: () => fetchApi<{ integrations: IntegrationConfig[] }>('/api/integrations/manage'),
        create: (data: Partial<IntegrationConfig>) =>
            fetchApi<{ integration: IntegrationConfigWithKey }>('/api/integrations/manage', {
                method: 'POST',
                body: JSON.stringify(data),
            }),
        update: (id: string, data: Partial<IntegrationConfig>) =>
            fetchApi<{ integration: IntegrationConfig }>(`/api/integrations/manage/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            }),
        regenerateKey: (id: string) =>
            fetchApi<{ apiKey: string }>(`/api/integrations/manage/${id}/regenerate-key`, {
                method: 'POST',
            }),
        getLogs: (id: string) =>
            fetchApi<{ logs: IntegrationLog[] }>(`/api/integrations/manage/${id}/logs`),
        delete: (id: string) =>
            fetchApi<{ success: boolean }>(`/api/integrations/manage/${id}`, {
                method: 'DELETE',
            }),
    },
};

// Types
export type UserRole = 'super_admin' | 'company_admin' | 'property_manager' | 'staff' | 'admin';

export interface User {
    id: string;
    email: string;
    role: UserRole;
    companyId?: string;
    companyName?: string;
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
    escalationCategories: string[];
    callForwardingNumber?: string;
    responseDelayMinutes: number;
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

// Multi-tenant types
export type CompanyStatus = 'active' | 'trial' | 'churned';

export interface Company {
    id: string;
    name: string;
    slug: string;
    status: CompanyStatus;
    creditBalance: number;
    allowNegativeBalance: boolean;
    trialCreditsGranted: number;
    escalationPhone?: string;
    escalationEmail?: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    createdAt: string;
    updatedAt: string;
    userCount?: number;
    propertyCount?: number;
}

export interface CreateCompanyData {
    name: string;
    slug: string;
    escalationPhone?: string;
    escalationEmail?: string;
    allowNegativeBalance?: boolean;
    grantTrialCredits?: boolean;
}

export interface CompanyDetails {
    company: Company;
    users: UserWithDates[];
    properties: Property[];
    phoneNumbers: CompanyPhoneNumber[];
    emailAddresses: CompanyEmailAddress[];
    usageSummary: {
        totalUsed: number;
        totalAdded: number;
        byType: Record<string, number>;
    };
}

export interface CompanyPhoneNumber {
    id: string;
    companyId: string;
    phoneE164: string;
    twilioSid?: string;
    monthlyCredits: number;
    isActive: boolean;
    allocatedAt: string;
    lastBilledAt?: string;
}

export interface CompanyEmailAddress {
    id: string;
    companyId: string;
    email: string;
    monthlyCredits: number;
    isActive: boolean;
    allocatedAt: string;
    lastBilledAt?: string;
}

export type CreditTransactionType =
    | 'purchase'
    | 'sms_usage'
    | 'sms_manual_usage'
    | 'email_usage'
    | 'email_manual_usage'
    | 'phone_rental'
    | 'email_rental'
    | 'trial_grant'
    | 'adjustment'
    | 'refund';

export interface CreditTransaction {
    id: string;
    companyId: string;
    amount: number;
    type: CreditTransactionType;
    referenceId?: string;
    referenceType?: string;
    description?: string;
    balanceAfter: number;
    createdBy?: string;
    createdAt: string;
}

export interface CreditBalanceResponse {
    balance: number;
    company: {
        id: string;
        name: string;
        status: CompanyStatus;
        allowNegativeBalance: boolean;
        trialCreditsGranted: number;
    };
    recentTransactions: CreditTransaction[];
    usageSummary: {
        totalUsed: number;
        totalAdded: number;
        byType: Record<string, number>;
    };
}

export interface CreditUsageReport {
    usageByType: Array<{
        type: CreditTransactionType;
        count: number;
        totalCredits: number;
    }>;
    dailyUsage: Array<{
        date: string;
        totalCredits: number;
    }>;
}

export interface CreditConfigItem {
    id: string;
    key: string;
    value: number;
    estimatedCostCents?: number;
    description?: string;
    updatedBy?: string;
    updatedAt: string;
}

export interface PlatformSetting {
    id: string;
    key: string;
    value: string;
    description?: string;
    updatedBy?: string;
    updatedAt: string;
}

export interface CreditConfigResponse {
    creditPricing: CreditConfigItem[];
    platformSettings: PlatformSetting[];
    estimatedNewCustomerCost: {
        credits: number;
        costCents: number;
        formatted: string;
    } | null;
}

export interface IntegrationConfig {
    id: string;
    companyId: string;
    name: string;
    slug: string;
    enabled: boolean;
    channelsAllowed: ('email' | 'sms' | 'telegram')[];
    allowedSenders: string[];
    defaultRecipients: string[];
    rateLimitPerMin: number;
    notifyOnSuccess: boolean;
    notifyOnFailure: boolean;
    notifyTelegramId?: string;
    createdAt: string;
    updatedAt: string;
}

export interface IntegrationConfigWithKey extends IntegrationConfig {
    apiKey?: string; // Only returned on creation/regeneration
}

export interface IntegrationLog {
    id: string;
    configId: string;
    channels: string[];
    recipients: string[];
    status: 'success' | 'partial' | 'failed';
    results: Array<{
        channel: string;
        status: string;
        messageId?: string;
        error?: string;
    }>;
    errorMessage?: string;
    metadata?: {
        subject?: string;
        hasAttachments?: boolean;
        attachmentCount?: number;
        from?: string;
    };
    createdAt: string;
}
