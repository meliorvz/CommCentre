import { useEffect, useState } from 'react';
import { api, Template } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save, MessageSquare, Mail } from 'lucide-react';

const RULE_LABELS: Record<string, string> = {
    T_MINUS_3: '3 Days Before Check-in',
    T_MINUS_1: '1 Day Before Check-in',
    DAY_OF: 'Day of Check-in',
};

export default function TemplatesPage() {
    const [templates, setTemplates] = useState<Record<string, Template>>({});
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<{ channel: string; ruleKey: string } | null>(null);
    const [editData, setEditData] = useState<{ body: string; subject?: string }>({ body: '' });
    const [saving, setSaving] = useState(false);

    const loadTemplates = async () => {
        setLoading(true);
        try {
            // Load all template keys
            const keys = ['T_MINUS_3', 'T_MINUS_1', 'DAY_OF'];
            const all: Record<string, Template> = {};

            for (const key of keys) {
                for (const channel of ['sms', 'email']) {
                    const { template } = await api.templates.get(channel, key);
                    if (template) {
                        all[`templates:${channel}:${key}`] = template;
                    }
                }
            }
            setTemplates(all);
        } catch (err) {
            console.error('Failed to load templates:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTemplates();
    }, []);

    const startEdit = (channel: string, ruleKey: string) => {
        const key = `templates:${channel}:${ruleKey}`;
        const template = templates[key];
        setEditing({ channel, ruleKey });
        setEditData({
            body: template?.body || '',
            subject: template?.subject,
        });
    };

    const saveTemplate = async () => {
        if (!editing) return;
        setSaving(true);
        try {
            await api.templates.update(editing.channel, editing.ruleKey, editData);
            setEditing(null);
            loadTemplates();
        } catch (err) {
            alert('Failed to save template');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-[hsl(var(--muted-foreground))]">Loading...</div>;
    }

    return (
        <div className="p-8 space-y-6">
            <h1 className="text-2xl font-bold">Templates</h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* SMS Templates */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <MessageSquare className="h-5 w-5" />
                            SMS Templates
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {['T_MINUS_3', 'T_MINUS_1', 'DAY_OF'].map((ruleKey) => {
                            const key = `templates:sms:${ruleKey}`;
                            const template = templates[key];
                            return (
                                <div key={ruleKey} className="p-4 rounded-lg bg-[hsl(var(--muted))]">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium">{RULE_LABELS[ruleKey]}</span>
                                        <Button size="sm" variant="ghost" onClick={() => startEdit('sms', ruleKey)}>
                                            Edit
                                        </Button>
                                    </div>
                                    <p className="text-sm text-[hsl(var(--muted-foreground))] line-clamp-2">
                                        {template?.body || 'No template set'}
                                    </p>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>

                {/* Email Templates */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Mail className="h-5 w-5" />
                            Email Templates
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {['T_MINUS_3', 'T_MINUS_1', 'DAY_OF'].map((ruleKey) => {
                            const key = `templates:email:${ruleKey}`;
                            const template = templates[key];
                            return (
                                <div key={ruleKey} className="p-4 rounded-lg bg-[hsl(var(--muted))]">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium">{RULE_LABELS[ruleKey]}</span>
                                        <Button size="sm" variant="ghost" onClick={() => startEdit('email', ruleKey)}>
                                            Edit
                                        </Button>
                                    </div>
                                    {template?.subject && (
                                        <p className="text-sm font-medium">{template.subject}</p>
                                    )}
                                    <p className="text-sm text-[hsl(var(--muted-foreground))] line-clamp-2">
                                        {template?.body || 'No template set'}
                                    </p>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            </div>

            {/* Template Variables Reference */}
            <Card>
                <CardHeader>
                    <CardTitle>Template Variables</CardTitle>
                    <CardDescription>Use these placeholders in your templates</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        <code className="p-2 bg-[hsl(var(--muted))] rounded">{'{{guest_name}}'}</code>
                        <code className="p-2 bg-[hsl(var(--muted))] rounded">{'{{property_name}}'}</code>
                        <code className="p-2 bg-[hsl(var(--muted))] rounded">{'{{property_address}}'}</code>
                        <code className="p-2 bg-[hsl(var(--muted))] rounded">{'{{checkin_time}}'}</code>
                        <code className="p-2 bg-[hsl(var(--muted))] rounded">{'{{checkout_time}}'}</code>
                        <code className="p-2 bg-[hsl(var(--muted))] rounded">{'{{property_code}}'}</code>
                        <code className="p-2 bg-[hsl(var(--muted))] rounded">{'{{wifi_name}}'}</code>
                        <code className="p-2 bg-[hsl(var(--muted))] rounded">{'{{wifi_password}}'}</code>
                    </div>
                </CardContent>
            </Card>

            {/* Edit Modal */}
            {editing && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-lg">
                        <CardHeader>
                            <CardTitle>
                                Edit {editing.channel.toUpperCase()} Template - {RULE_LABELS[editing.ruleKey]}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {editing.channel === 'email' && (
                                <div>
                                    <Label>Subject</Label>
                                    <Input
                                        value={editData.subject || ''}
                                        onChange={(e) => setEditData({ ...editData, subject: e.target.value })}
                                        placeholder="Email subject..."
                                    />
                                </div>
                            )}
                            <div>
                                <Label>Body</Label>
                                <Textarea
                                    value={editData.body}
                                    onChange={(e) => setEditData({ ...editData, body: e.target.value })}
                                    rows={editing.channel === 'email' ? 12 : 4}
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                                <Button onClick={saveTemplate} disabled={saving}>
                                    <Save className="h-4 w-4 mr-2" />
                                    Save
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
