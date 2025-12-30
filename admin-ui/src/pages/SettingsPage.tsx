import { useState, useEffect } from 'react';
import { api, GlobalSettings, UserWithDates } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    CheckCircle,
    XCircle,
    Phone,
    Bell,
    Mail,
    Bot,
    Users,
    Shield,
    User as UserIcon,
    Plus,
    Key,
    Trash2,
    Loader2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function SettingsPage() {
    const { user: currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState('phone');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Global Settings State
    const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null);

    // Integration Configs
    const [integrationConfigs, setIntegrationConfigs] = useState<Record<string, Record<string, string>>>({});
    const [envStatus, setEnvStatus] = useState<Record<string, boolean>>({});

    // Twilio specific state
    const [twilioNumbers, setTwilioNumbers] = useState<string[]>([]);
    const [loadingNumbers, setLoadingNumbers] = useState(false);

    // Users State
    const [users, setUsers] = useState<UserWithDates[]>([]);
    const [showCreateUser, setShowCreateUser] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRole, setNewRole] = useState<'admin' | 'staff'>('staff');
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [newPasswordForUser, setNewPasswordForUser] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // Load Global Settings
            const { settings } = await api.settings.getGlobal();
            setGlobalSettings(settings);

            // Load Integration Status
            const status = await api.settings.getIntegrationStatus();
            setEnvStatus(status);

            // Load Integration Configs
            const configs: Record<string, Record<string, string>> = {};
            for (const key of ['twilio', 'telegram']) {
                const { settings } = await api.settings.getIntegration<Record<string, string>>(key);
                configs[key] = settings;
            }
            setIntegrationConfigs(configs);

            // Load Users
            const { users: userList } = await api.users.list();
            setUsers(userList);

            // Load Twilio numbers if configured
            if (status.twilio) {
                loadTwilioNumbers();
            }

        } catch (err: any) {
            console.error('Failed to load settings:', err);
            setError(err.message);
        } finally {
            setLoading(false);
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

    // --- SAVE HANDLERS ---

    const saveGlobalSettings = async () => {
        if (!globalSettings) return;
        setSaving('global');
        try {
            await api.settings.updateGlobal(globalSettings);
            // Also save Twilio number from integration config if strictly needed there, 
            // but we mostly rely on global setting now for forwarding. 
            // However, Twilio integration config usually holds the "Main Number" for specific legacy lookups.
            // We'll save integrations separately.
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(null);
        }
    };

    const saveIntegration = async (key: string) => {
        setSaving(key);
        try {
            await api.settings.updateIntegration(key, integrationConfigs[key]);
            if (key === 'telegram') {
                // Test telegram on save
                await api.settings.testTelegram();
                alert('Settings saved and test message sent!');
            } else {
                alert('Settings saved');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(null);
        }
    };

    const updateIntegrationField = (integration: string, field: string, value: string) => {
        setIntegrationConfigs({
            ...integrationConfigs,
            [integration]: {
                ...integrationConfigs[integration],
                [field]: value,
            },
        });
    };

    // --- USER HANDLERS ---

    const handleCreateUser = async () => {
        if (!newEmail || !newPassword) {
            setError('Email and password are required');
            return;
        }
        setSaving('create-user');
        try {
            await api.users.create({ email: newEmail, password: newPassword, role: newRole });
            setNewEmail('');
            setNewPassword('');
            setShowCreateUser(false);
            const { users: updated } = await api.users.list();
            setUsers(updated);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(null);
        }
    };

    const handleChangePassword = async (userId: string) => {
        if (!newPasswordForUser || newPasswordForUser.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }
        setSaving(`pwd-${userId}`);
        try {
            await api.users.update(userId, { password: newPasswordForUser });
            setEditingUserId(null);
            setNewPasswordForUser('');
            alert('Password updated');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(null);
        }
    };

    const handleChangeRole = async (userId: string, role: 'admin' | 'staff') => {
        try {
            await api.users.update(userId, { role });
            const { users: updated } = await api.users.list();
            setUsers(updated);
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleDeleteUser = async (userId: string) => {
        if (!confirm('Delete this user?')) return;
        try {
            await api.users.delete(userId);
            const { users: updated } = await api.users.list();
            setUsers(updated);
        } catch (err: any) {
            setError(err.message);
        }
    };


    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--muted-foreground))]" />
            </div>
        );
    }

    return (
        <div className="p-8 space-y-6">
            <h1 className="text-2xl font-bold">Settings</h1>

            {error && (
                <div className="bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] p-4 rounded-lg flex justify-between items-center">
                    <span>{error}</span>
                    <Button variant="ghost" size="sm" onClick={() => setError(null)}>Dismiss</Button>
                </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-5 lg:w-[800px]">
                    <TabsTrigger value="phone" className="gap-2"><Phone className="h-4 w-4" /> Phone</TabsTrigger>
                    <TabsTrigger value="notifications" className="gap-2"><Bell className="h-4 w-4" /> Notify</TabsTrigger>
                    <TabsTrigger value="email" className="gap-2"><Mail className="h-4 w-4" /> Email</TabsTrigger>
                    <TabsTrigger value="ai" className="gap-2"><Bot className="h-4 w-4" /> AI</TabsTrigger>
                    <TabsTrigger value="users" className="gap-2"><Users className="h-4 w-4" /> Users</TabsTrigger>
                </TabsList>

                {/* --- PHONE & MESSAGING TAB --- */}
                <TabsContent value="phone" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Call Forwarding</CardTitle>
                            <CardDescription>
                                Unanswered calls to your Twilio number will be forwarded here.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>Forward Calls To</Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={globalSettings?.callForwardingNumber || ''}
                                        onChange={(e) => setGlobalSettings(prev => prev ? { ...prev, callForwardingNumber: e.target.value } : null)}
                                        placeholder="+614..."
                                    />
                                    <Button
                                        onClick={saveGlobalSettings}
                                        disabled={saving === 'global'}
                                    >
                                        {saving === 'global' ? 'Saving...' : 'Save'}
                                    </Button>
                                </div>
                                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-2">
                                    Must be in E.164 format (e.g., +61412345678). Leave empty to disable forwarding.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Twilio Configuration</CardTitle>
                                <CardDescription>Select the active phone number for this system</CardDescription>
                            </div>
                            {envStatus.twilio ? (
                                <Badge variant="success" className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Connected</Badge>
                            ) : (
                                <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="h-3 w-3" /> Secrets Missing</Badge>
                            )}
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>Active Number</Label>
                                <div className="flex gap-2">
                                    <Select
                                        value={integrationConfigs['twilio']?.['phoneNumber'] || ''}
                                        onValueChange={(val) => updateIntegrationField('twilio', 'phoneNumber', val)}
                                        disabled={loadingNumbers}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={loadingNumbers ? "Loading..." : "Select a number"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {twilioNumbers.map(num => (
                                                <SelectItem key={num} value={num}>{num}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        onClick={() => saveIntegration('twilio')}
                                        disabled={saving === 'twilio'}
                                    >
                                        {saving === 'twilio' ? 'Saving...' : 'Save'}
                                    </Button>
                                </div>
                            </div>
                            <div className="text-sm text-[hsl(var(--muted-foreground))] space-y-1">
                                <p>Webhook URL (Voice): <code className="bg-[hsl(var(--muted))] px-1 rounded">.../api/webhooks/twilio/voice</code></p>
                                <p>Webhook URL (SMS): <code className="bg-[hsl(var(--muted))] px-1 rounded">.../api/webhooks/twilio/sms</code></p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- NOTIFICATIONS TAB --- */}
                <TabsContent value="notifications" className="space-y-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Telegram Escalations</CardTitle>
                                <CardDescription>Receive instant alerts for urgent issues</CardDescription>
                            </div>
                            {envStatus.telegram ? (
                                <Badge variant="success" className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Connected</Badge>
                            ) : (
                                <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="h-3 w-3" /> Missing Token</Badge>
                            )}
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="bg-[hsl(var(--muted))] p-4 rounded-md text-sm mb-4">
                                <p className="font-semibold mb-2">How to setup:</p>
                                <ol className="list-decimal list-inside space-y-1">
                                    <li>Create a Telegram group with your bot</li>
                                    <li>Open web.telegram.org and find the Chat ID in the URL</li>
                                    <li>The ID usually starts with "-", e.g. -100123456789</li>
                                </ol>
                            </div>

                            <div>
                                <Label>Chat ID</Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={integrationConfigs['telegram']?.['chatId'] || ''}
                                        onChange={(e) => updateIntegrationField('telegram', 'chatId', e.target.value)}
                                        placeholder="-100..."
                                    />
                                    <Button
                                        onClick={() => saveIntegration('telegram')}
                                        disabled={saving === 'telegram'}
                                    >
                                        {saving === 'telegram' ? 'Saving...' : 'Save & Test'}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- EMAIL TAB --- */}
                <TabsContent value="email" className="space-y-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Gmail Integration</CardTitle>
                                <CardDescription>Status of outgoing email system</CardDescription>
                            </div>
                            {envStatus.gmail ? (
                                <Badge variant="success" className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> configured</Badge>
                            ) : (
                                <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="h-3 w-3" /> Not Configured</Badge>
                            )}
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
                                Gmail integration is configured via environment variables for security.
                            </p>
                            <div className="space-y-2">
                                <div className="p-3 bg-[hsl(var(--muted))] rounded flex justify-between items-center">
                                    <span className="text-sm font-medium">OAuth Credentials</span>
                                    {envStatus.gmail ? (
                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                    ) : (
                                        <XCircle className="h-4 w-4 text-red-500" />
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- AI PROVIDER TAB --- */}
                <TabsContent value="ai" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Response Delay</CardTitle>
                            <CardDescription>
                                Wait before responding to allow guests to send follow-up messages
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>Delay (minutes)</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="number"
                                        min="0"
                                        max="60"
                                        value={globalSettings?.responseDelayMinutes ?? 3}
                                        onChange={(e) => setGlobalSettings(prev => prev ? { ...prev, responseDelayMinutes: parseInt(e.target.value) || 0 } : null)}
                                        className="w-24"
                                    />
                                    <Button
                                        onClick={saveGlobalSettings}
                                        disabled={saving === 'global'}
                                    >
                                        {saving === 'global' ? 'Saving...' : 'Save'}
                                    </Button>
                                </div>
                                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-2">
                                    Set to 0 for instant replies. If a guest sends multiple messages within this window, they'll be batched into a single response.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>OpenRouter AI</CardTitle>
                                <CardDescription>LLM Provider Connection</CardDescription>
                            </div>
                            {envStatus.openrouter ? (
                                <Badge variant="success" className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Active</Badge>
                            ) : (
                                <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="h-3 w-3" /> Missing Key</Badge>
                            )}
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                The AI provider is configured via the <code>OPENROUTER_API_KEY</code> environment variable.
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- USERS TAB --- */}
                <TabsContent value="users" className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-semibold">User Management</h2>
                        <Button onClick={() => setShowCreateUser(true)} size="sm">
                            <Plus className="h-4 w-4 mr-2" /> Add User
                        </Button>
                    </div>

                    {showCreateUser && (
                        <Card>
                            <CardHeader><CardTitle>Create New User</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <Label>Email</Label>
                                        <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} />
                                    </div>
                                    <div>
                                        <Label>Password</Label>
                                        <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                                    </div>
                                    <div>
                                        <Label>Role</Label>
                                        <Select value={newRole} onValueChange={(v: any) => setNewRole(v)}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="staff">Staff</SelectItem>
                                                <SelectItem value="admin">Admin</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button onClick={handleCreateUser} disabled={!!saving}>Create</Button>
                                    <Button variant="ghost" onClick={() => setShowCreateUser(false)}>Cancel</Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardContent className="p-0">
                            {users.map((user) => (
                                <div key={user.id} className="p-4 border-b last:border-0 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center">
                                            {user.role === 'admin' ? <Shield className="h-5 w-5" /> : <UserIcon className="h-5 w-5" />}
                                        </div>
                                        <div>
                                            <div className="font-medium">{user.email}</div>
                                            <div className="text-xs text-[hsl(var(--muted-foreground))]">
                                                Joined {new Date(user.createdAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                        <Badge variant="outline">{user.role}</Badge>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {/* Edit Password */}
                                        {editingUserId === user.id ? (
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="password"
                                                    placeholder="New password"
                                                    className="w-32 h-8 text-sm"
                                                    value={newPasswordForUser}
                                                    onChange={e => setNewPasswordForUser(e.target.value)}
                                                />
                                                <Button size="sm" onClick={() => handleChangePassword(user.id)}>Save</Button>
                                                <Button size="sm" variant="ghost" onClick={() => setEditingUserId(null)}>Cancel</Button>
                                            </div>
                                        ) : (
                                            <Button size="sm" variant="ghost" onClick={() => setEditingUserId(user.id)} title="Change Password">
                                                <Key className="h-4 w-4" />
                                            </Button>
                                        )}

                                        {/* Role Select */}
                                        {user.id !== currentUser?.id && (
                                            <Select value={user.role} onValueChange={(v: any) => handleChangeRole(user.id, v)}>
                                                <SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="staff">Staff</SelectItem>
                                                    <SelectItem value="admin">Admin</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}

                                        {/* Delete */}
                                        {user.id !== currentUser?.id && (
                                            <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => handleDeleteUser(user.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
