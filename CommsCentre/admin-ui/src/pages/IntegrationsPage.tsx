import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, CheckCircle, XCircle } from 'lucide-react';

interface Integration {
    name: string;
    key: string;
    description?: string;
    fields: Array<{ name: string; key: string; type: string; placeholder: string }>;
    testEndpoint?: string;
}

const INTEGRATIONS: Integration[] = [
    {
        name: 'Twilio',
        key: 'twilio',
        fields: [
            { name: 'Global Phone Number', key: 'phoneNumber', type: 'select', placeholder: 'Select a number' },
        ],
    },
    {
        name: 'MailChannels',
        key: 'mailchannels',
        fields: [
            { name: 'Sending Domain', key: 'domain', type: 'text', placeholder: 'mail.example.com' },
        ],
    },
    {
        name: 'OpenRouter',
        key: 'openrouter',
        fields: [],
    },
    {
        name: 'Telegram',
        key: 'telegram',
        description: `This refers to the name of the Telegram Group chat where notifications will be sent. To set this up:
1. Create a group with the bot and other notification recipients
2. Visit web.telegram.org and open the group chat
3. The Chat ID is part of the URL: https://web.telegram.org/a/#{Chat ID here}
Note - the Chat ID should start with a "-".`,
        fields: [
            { name: 'Chat ID', key: 'chatId', type: 'text', placeholder: '-100123456789' },
        ],
    },
];

export default function IntegrationsPage() {
    const [configs, setConfigs] = useState<Record<string, Record<string, string>>>({});
    const [envStatus, setEnvStatus] = useState<Record<string, boolean>>({});
    const [saving, setSaving] = useState<string | null>(null);
    const [twilioNumbers, setTwilioNumbers] = useState<string[]>([]);
    const [loadingNumbers, setLoadingNumbers] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            try {
                // Load settings from KV
                const configResults = await Promise.all(
                    INTEGRATIONS.map(async (integration) => {
                        const { settings } = await api.settings.getIntegration<Record<string, string>>(integration.key);
                        return { key: integration.key, settings };
                    })
                );

                const newConfigs: Record<string, Record<string, string>> = {};
                configResults.forEach(({ key, settings }) => {
                    newConfigs[key] = settings;
                });
                setConfigs(newConfigs);

                // Load Env Status (Secrets)
                const status = await api.settings.getIntegrationStatus();
                setEnvStatus(status);

            } catch (err) {
                console.error('Failed to load integration data:', err);
            }
        };

        const loadTwilioNumbers = async () => {
            setLoadingNumbers(true);
            try {
                const { numbers } = await api.settings.getTwilioNumbers();
                setTwilioNumbers(numbers);
            } catch (err) {
                console.error('Failed to load Twilio numbers:', err);
            } finally {
                setLoadingNumbers(false);
            }
        };

        loadData();
        loadTwilioNumbers();
    }, []);

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
        try {
            await api.settings.updateIntegration(key, configs[key]);
            alert('Settings saved');
        } catch (err) {
            console.error('Failed to save integration:', err);
            alert('Failed to save settings');
        } finally {
            setSaving(null);
        }
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
                                <CardDescription className="whitespace-pre-line">
                                    {integration.description || `Configure ${integration.name} settings`}
                                </CardDescription>
                            </div>
                            {envStatus[integration.key] ? (
                                <Badge variant="success" className="flex items-center gap-1">
                                    <CheckCircle className="h-3 w-3" />
                                    Env Configured
                                </Badge>
                            ) : (
                                <Badge variant="destructive" className="flex items-center gap-1">
                                    <XCircle className="h-3 w-3" />
                                    Missing Secrets
                                </Badge>
                            )}
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {integration.fields.map((field) => (
                                <div key={field.key}>
                                    <Label>{field.name}</Label>
                                    {field.type === 'select' && integration.key === 'twilio' ? (
                                        <Select
                                            value={configs[integration.key]?.[field.key] || ''}
                                            onValueChange={(val: string) => updateField(integration.key, field.key, val)}
                                            disabled={loadingNumbers}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder={
                                                    loadingNumbers
                                                        ? "Loading numbers..."
                                                        : twilioNumbers.length === 0
                                                            ? "No numbers found (check env configs)"
                                                            : "Select a number"
                                                } />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {twilioNumbers.map((num) => (
                                                    <SelectItem key={num} value={num}>
                                                        {num}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <Input
                                            type={field.type}
                                            value={configs[integration.key]?.[field.key] || ''}
                                            onChange={(e) => updateField(integration.key, field.key, e.target.value)}
                                            placeholder={field.placeholder}
                                        />
                                    )}
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
