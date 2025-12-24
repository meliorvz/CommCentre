import { useEffect, useState } from 'react';
import { api, GlobalSettings, PropertySettings, Property } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save } from 'lucide-react';

export default function AutomationsPage() {
    const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null);
    const [properties, setProperties] = useState<Property[]>([]);
    const [selectedProperty, setSelectedProperty] = useState<string>('');
    const [propertySettings, setPropertySettings] = useState<PropertySettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        async function load() {
            try {
                const [{ settings }, { properties }] = await Promise.all([
                    api.settings.getGlobal(),
                    api.properties.list(),
                ]);
                setGlobalSettings(settings);
                setProperties(properties);
                if (properties.length > 0) {
                    setSelectedProperty(properties[0].id);
                }
            } catch (err) {
                console.error('Failed to load settings:', err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    useEffect(() => {
        if (!selectedProperty) return;
        api.settings.getProperty(selectedProperty).then(({ settings }) => {
            setPropertySettings(settings);
        });
    }, [selectedProperty]);

    const saveGlobal = async () => {
        if (!globalSettings) return;
        setSaving(true);
        try {
            await api.settings.updateGlobal(globalSettings);
            alert('Saved!');
        } catch (err) {
            alert('Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const saveProperty = async () => {
        if (!propertySettings || !selectedProperty) return;
        setSaving(true);
        try {
            await api.settings.updateProperty(selectedProperty, propertySettings);
            alert('Saved!');
        } catch (err) {
            alert('Failed to save');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-[hsl(var(--muted-foreground))]">Loading...</div>;
    }

    return (
        <div className="p-8 space-y-6">
            <h1 className="text-2xl font-bold">Automations</h1>

            {/* Global Settings */}
            <Card>
                <CardHeader>
                    <CardTitle>Global Settings</CardTitle>
                    <CardDescription>Settings that apply across all properties</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {globalSettings && (
                        <>
                            <div className="flex items-center gap-4">
                                <input
                                    type="checkbox"
                                    id="autoReply"
                                    checked={globalSettings.autoReplyEnabled}
                                    onChange={(e) =>
                                        setGlobalSettings({ ...globalSettings, autoReplyEnabled: e.target.checked })
                                    }
                                />
                                <Label htmlFor="autoReply">Enable Auto-Reply</Label>
                            </div>
                            <div>
                                <Label>Confidence Threshold</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="1"
                                        value={Math.round(globalSettings.confidenceThreshold * 100)}
                                        onChange={(e) =>
                                            setGlobalSettings({
                                                ...globalSettings,
                                                confidenceThreshold: parseFloat(e.target.value) / 100,
                                            })
                                        }
                                        className="w-24"
                                    />
                                    <span className="text-sm">%</span>
                                </div>
                                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                                    Escalate to human via Telegram if confidence is below this threshold, where 100% is extremely confident, and 0% is completely uncertain
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Quiet Hours Start</Label>
                                    <Input
                                        type="time"
                                        value={globalSettings.quietHoursStart}
                                        onChange={(e) =>
                                            setGlobalSettings({ ...globalSettings, quietHoursStart: e.target.value })
                                        }
                                    />
                                </div>
                                <div>
                                    <Label>Quiet Hours End</Label>
                                    <Input
                                        type="time"
                                        value={globalSettings.quietHoursEnd}
                                        onChange={(e) =>
                                            setGlobalSettings({ ...globalSettings, quietHoursEnd: e.target.value })
                                        }
                                    />
                                </div>
                            </div>
                            <div>
                                <Label>Escalation Intents</Label>
                                <Input
                                    value={globalSettings.escalationIntents.join(', ')}
                                    onChange={(e) =>
                                        setGlobalSettings({
                                            ...globalSettings,
                                            escalationIntents: e.target.value.split(',').map((s) => s.trim()),
                                        })
                                    }
                                    placeholder="refund, payment, complaint"
                                />
                                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                                    Comma-separated list of intents that always escalate
                                </p>
                            </div>
                            <Button onClick={saveGlobal} disabled={saving}>
                                <Save className="h-4 w-4 mr-2" />
                                Save Global Settings
                            </Button>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Property Settings */}
            <Card>
                <CardHeader>
                    <CardTitle>Property Settings</CardTitle>
                    <CardDescription>Per-property automation configuration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label>Select Property</Label>
                        <select
                            value={selectedProperty}
                            onChange={(e) => setSelectedProperty(e.target.value)}
                            className="w-full px-3 py-2 rounded-md border bg-[hsl(var(--background))]"
                        >
                            {properties.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    {propertySettings && (
                        <>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="propTimezone">Timezone</Label>
                                    <Input
                                        id="propTimezone"
                                        value={propertySettings.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
                                        onChange={(e) =>
                                            setPropertySettings({ ...propertySettings, timezone: e.target.value })
                                        }
                                        placeholder="e.g. Australia/Sydney"
                                    />
                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                        Timezone used for scheduling automations (defaults to browser timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone})
                                    </p>
                                </div>

                                <div className="flex items-center gap-4">
                                    <input
                                        type="checkbox"
                                        id="propAutoReply"
                                        checked={propertySettings.autoReplyEnabled}
                                        onChange={(e) =>
                                            setPropertySettings({ ...propertySettings, autoReplyEnabled: e.target.checked })
                                        }
                                    />
                                    <Label htmlFor="propAutoReply">Auto-Reply Enabled</Label>
                                </div>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="checkbox"
                                        id="smsEnabled"
                                        checked={propertySettings.smsEnabled}
                                        onChange={(e) =>
                                            setPropertySettings({ ...propertySettings, smsEnabled: e.target.checked })
                                        }
                                    />
                                    <Label htmlFor="smsEnabled">SMS Enabled</Label>
                                </div>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="checkbox"
                                        id="emailEnabled"
                                        checked={propertySettings.emailEnabled}
                                        onChange={(e) =>
                                            setPropertySettings({ ...propertySettings, emailEnabled: e.target.checked })
                                        }
                                    />
                                    <Label htmlFor="emailEnabled">Email Enabled</Label>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label>T-3 Days Time</Label>
                                    <Input
                                        type="time"
                                        value={propertySettings.scheduleT3Time}
                                        onChange={(e) =>
                                            setPropertySettings({ ...propertySettings, scheduleT3Time: e.target.value })
                                        }
                                    />
                                </div>
                                <div>
                                    <Label>T-1 Day Time</Label>
                                    <Input
                                        type="time"
                                        value={propertySettings.scheduleT1Time}
                                        onChange={(e) =>
                                            setPropertySettings({ ...propertySettings, scheduleT1Time: e.target.value })
                                        }
                                    />
                                </div>
                                <div>
                                    <Label>Day-Of Time</Label>
                                    <Input
                                        type="time"
                                        value={propertySettings.scheduleDayOfTime}
                                        onChange={(e) =>
                                            setPropertySettings({ ...propertySettings, scheduleDayOfTime: e.target.value })
                                        }
                                    />
                                </div>
                            </div>

                            <Button onClick={saveProperty} disabled={saving}>
                                <Save className="h-4 w-4 mr-2" />
                                <span className="sr-only">Save Property Settings</span>
                                Save Property Settings
                            </Button>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
