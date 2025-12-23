import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Save, CheckCircle, XCircle } from 'lucide-react';

interface Integration {
    name: string;
    key: string;
    fields: Array<{ name: string; key: string; type: string; placeholder: string }>;
    testEndpoint?: string;
}

const INTEGRATIONS: Integration[] = [
    {
        name: 'Twilio',
        key: 'twilio',
        fields: [
            { name: 'Account SID', key: 'accountSid', type: 'text', placeholder: 'ACXXXXXXX' },
            { name: 'Auth Token', key: 'authToken', type: 'password', placeholder: '••••••••' },
            { name: 'Phone Number', key: 'phoneNumber', type: 'text', placeholder: '+61400000000' },
        ],
    },
    {
        name: 'MailChannels',
        key: 'mailchannels',
        fields: [
            { name: 'API Key', key: 'apiKey', type: 'password', placeholder: '••••••••' },
            { name: 'Sending Domain', key: 'domain', type: 'text', placeholder: 'mail.example.com' },
        ],
    },
    {
        name: 'OpenRouter',
        key: 'openrouter',
        fields: [
            { name: 'API Key', key: 'apiKey', type: 'password', placeholder: 'sk-or-v1-...' },
        ],
    },
    {
        name: 'Telegram',
        key: 'telegram',
        fields: [
            { name: 'Bot Token', key: 'botToken', type: 'password', placeholder: '123456:ABC-DEF...' },
            { name: 'Chat ID', key: 'chatId', type: 'text', placeholder: '-100123456789' },
        ],
    },
];

export default function IntegrationsPage() {
    const [configs, setConfigs] = useState<Record<string, Record<string, string>>>({});
    const [status, setStatus] = useState<Record<string, 'connected' | 'error' | 'pending'>>({});
    const [saving, setSaving] = useState<string | null>(null);

    const updateField = (integration: string, field: string, value: string) => {
        setConfigs({
            ...configs,
            [integration]: {
                ...configs[integration],
                [field]: value,
            },
        });
    };

    const saveIntegration = async (key: string) => {
        setSaving(key);
        // In a real implementation, this would save to the backend
        // For now, just simulate success
        setTimeout(() => {
            setStatus({ ...status, [key]: 'connected' });
            setSaving(null);
        }, 1000);
    };

    return (
        <div className="p-8 space-y-6">
            <h1 className="text-2xl font-bold">Integrations</h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {INTEGRATIONS.map((integration) => (
                    <Card key={integration.key}>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>{integration.name}</CardTitle>
                                <CardDescription>Configure {integration.name} credentials</CardDescription>
                            </div>
                            {status[integration.key] === 'connected' && (
                                <Badge variant="success" className="flex items-center gap-1">
                                    <CheckCircle className="h-3 w-3" />
                                    Connected
                                </Badge>
                            )}
                            {status[integration.key] === 'error' && (
                                <Badge variant="destructive" className="flex items-center gap-1">
                                    <XCircle className="h-3 w-3" />
                                    Error
                                </Badge>
                            )}
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {integration.fields.map((field) => (
                                <div key={field.key}>
                                    <Label>{field.name}</Label>
                                    <Input
                                        type={field.type}
                                        value={configs[integration.key]?.[field.key] || ''}
                                        onChange={(e) => updateField(integration.key, field.key, e.target.value)}
                                        placeholder={field.placeholder}
                                    />
                                </div>
                            ))}
                            <Button
                                onClick={() => saveIntegration(integration.key)}
                                disabled={saving === integration.key}
                                className="w-full"
                            >
                                <Save className="h-4 w-4 mr-2" />
                                {saving === integration.key ? 'Saving...' : 'Save & Test'}
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Important Notes */}
            <Card>
                <CardHeader>
                    <CardTitle>Important Notes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                    <p>
                        <strong>Twilio:</strong> Configure your webhook URLs in Twilio Console:
                    </p>
                    <code className="block p-2 bg-[hsl(var(--muted))] rounded">
                        SMS: https://your-worker.workers.dev/api/webhooks/twilio/sms
                    </code>
                    <code className="block p-2 bg-[hsl(var(--muted))] rounded">
                        Voice: https://your-worker.workers.dev/api/webhooks/twilio/voice
                    </code>
                    <p className="mt-4">
                        <strong>MailChannels:</strong> Add these DNS records:
                    </p>
                    <code className="block p-2 bg-[hsl(var(--muted))] rounded">
                        TXT _mailchannels: v=mc1 cfid=your-worker.workers.dev
                    </code>
                    <code className="block p-2 bg-[hsl(var(--muted))] rounded">
                        TXT @: v=spf1 include:relay.mailchannels.net -all
                    </code>
                </CardContent>
            </Card>
        </div>
    );
}
