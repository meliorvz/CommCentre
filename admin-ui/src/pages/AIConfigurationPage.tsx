import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, SetupProfile, PropertyDefaults, PromptVersion } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
    Save,
    Building2,
    Clock,
    Shield,
    MessageSquare,
    ChevronDown,
    ChevronRight,
    AlertTriangle,
    Upload,
    History,
    BookOpen,
    Check,
} from 'lucide-react';

const BUSINESS_TYPES = [
    { value: 'holiday_rentals', label: 'Holiday Rentals' },
    { value: 'hotel', label: 'Hotel' },
    { value: 'serviced_apartments', label: 'Serviced Apartments' },
    { value: 'other', label: 'Other' },
];

const TIMEZONES = [
    { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
    { value: 'Australia/Melbourne', label: 'Melbourne (AEST/AEDT)' },
    { value: 'Australia/Brisbane', label: 'Brisbane (AEST)' },
    { value: 'Australia/Perth', label: 'Perth (AWST)' },
    { value: 'Australia/Adelaide', label: 'Adelaide (ACST/ACDT)' },
    { value: 'Pacific/Auckland', label: 'Auckland (NZST/NZDT)' },
];

interface SectionProps {
    title: string;
    description: string;
    icon: React.ElementType;
    children: React.ReactNode;
    saving?: boolean;
    onSave?: () => void;
    defaultOpen?: boolean;
}

function CollapsibleSection({ title, description, icon: Icon, children, saving, onSave, defaultOpen = false }: SectionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <Card>
            <CardHeader
                className="cursor-pointer select-none"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[hsl(var(--primary)/0.1)]">
                            <Icon className="h-5 w-5 text-[hsl(var(--primary))]" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">{title}</CardTitle>
                            <CardDescription>{description}</CardDescription>
                        </div>
                    </div>
                    {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </div>
            </CardHeader>
            {isOpen && (
                <CardContent className="space-y-6 pt-0">
                    {children}
                    {onSave && (
                        <div className="flex justify-end pt-4 border-t">
                            <Button onClick={onSave} disabled={saving}>
                                {saving ? (
                                    <>Saving...</>
                                ) : (
                                    <>
                                        <Check className="h-4 w-4 mr-2" />
                                        Save Changes
                                    </>
                                )}
                            </Button>
                        </div>
                    )}
                </CardContent>
            )}
        </Card>
    );
}

export default function AIConfigurationPage() {
    const [loading, setLoading] = useState(true);
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingDefaults, setSavingDefaults] = useState(false);
    const [savingPrompt, setSavingPrompt] = useState(false);

    // Profile state
    const [profile, setProfile] = useState<SetupProfile>({
        companyName: '',
        assistantName: '',
        businessType: 'holiday_rentals',
        timezone: 'Australia/Sydney',
    });

    // Property defaults state
    const [defaults, setDefaults] = useState<PropertyDefaults>({
        checkinTime: '15:00',
        checkoutTime: '10:00',
    });

    // Prompt state
    const [published, setPublished] = useState<PromptVersion | null>(null);
    const [draft, setDraft] = useState('');
    const [versions, setVersions] = useState<PromptVersion[]>([]);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    useEffect(() => {
        loadAllData();
    }, []);

    const loadAllData = async () => {
        setLoading(true);
        try {
            const [profileRes, defaultsRes, pubRes, draftRes, versRes] = await Promise.all([
                api.setup.getProfile(),
                api.setup.getDefaults(),
                api.prompt.getPublished(),
                api.prompt.getDraft(),
                api.prompt.getVersions(),
            ]);
            setProfile(profileRes.profile);
            setDefaults(defaultsRes.defaults);
            setPublished(pubRes.prompt);
            setDraft(draftRes.draft || pubRes.prompt.content);
            setVersions(versRes.versions);
        } catch (err) {
            console.error('Failed to load configuration:', err);
        } finally {
            setLoading(false);
        }
    };

    const saveProfile = async () => {
        setSavingProfile(true);
        try {
            await api.setup.updateProfile(profile);
            // Reload prompt since it depends on profile
            const pubRes = await api.prompt.getPublished();
            setPublished(pubRes.prompt);
            setDraft(pubRes.prompt.content);
        } catch (err) {
            console.error('Failed to save profile:', err);
            alert('Failed to save profile');
        } finally {
            setSavingProfile(false);
        }
    };

    const saveDefaults = async () => {
        setSavingDefaults(true);
        try {
            await api.setup.updateDefaults(defaults);
            // Reload prompt since it depends on defaults
            const pubRes = await api.prompt.getPublished();
            setPublished(pubRes.prompt);
            setDraft(pubRes.prompt.content);
        } catch (err) {
            console.error('Failed to save defaults:', err);
            alert('Failed to save defaults');
        } finally {
            setSavingDefaults(false);
        }
    };

    const saveDraft = async () => {
        setSavingPrompt(true);
        try {
            await api.prompt.saveDraft(draft);
            alert('Draft saved!');
        } catch (err) {
            alert('Failed to save draft');
        } finally {
            setSavingPrompt(false);
        }
    };

    const publishPrompt = async () => {
        if (!confirm('Publish this prompt? It will be used for all new conversations.')) return;
        setSavingPrompt(true);
        try {
            const { prompt } = await api.prompt.publish(draft);
            setPublished(prompt);
            loadAllData();
            alert('Published!');
        } catch (err) {
            alert('Failed to publish');
        } finally {
            setSavingPrompt(false);
        }
    };

    const restoreVersion = (version: PromptVersion) => {
        setDraft(version.content);
        setShowHistory(false);
        setShowAdvanced(true);
    };

    if (loading) {
        return <div className="p-8 text-[hsl(var(--muted-foreground))]">Loading...</div>;
    }

    return (
        <div className="p-8 space-y-6 max-w-4xl">
            <div>
                <h1 className="text-2xl font-bold">AI Configuration</h1>
                <p className="text-[hsl(var(--muted-foreground))]">
                    Configure how your AI assistant behaves and responds to guests
                </p>
            </div>

            {/* Section 1: Your Business */}
            <CollapsibleSection
                title="Your Business"
                description="Company identity and branding"
                icon={Building2}
                saving={savingProfile}
                onSave={saveProfile}
                defaultOpen={true}
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="companyName">Company Name *</Label>
                        <Input
                            id="companyName"
                            value={profile.companyName}
                            onChange={(e) => setProfile({ ...profile, companyName: e.target.value })}
                            placeholder="e.g. Paradise Stayz"
                        />
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                            Appears in messages: "Hi, I'm Mark from <strong>Paradise Stayz</strong>"
                        </p>
                    </div>
                    <div>
                        <Label htmlFor="assistantName">Assistant Name *</Label>
                        <Input
                            id="assistantName"
                            value={profile.assistantName}
                            onChange={(e) => setProfile({ ...profile, assistantName: e.target.value })}
                            placeholder="e.g. Mark"
                        />
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                            How the AI introduces itself: "Hi, I'm <strong>Mark</strong>"
                        </p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="businessType">Business Type</Label>
                        <Select
                            value={profile.businessType}
                            onValueChange={(val) => setProfile({ ...profile, businessType: val as SetupProfile['businessType'] })}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {BUSINESS_TYPES.map((type) => (
                                    <SelectItem key={type.value} value={type.value}>
                                        {type.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                            Adjusts the AI's tone and common scenarios
                        </p>
                    </div>
                    <div>
                        <Label htmlFor="timezone">Timezone</Label>
                        <Select
                            value={profile.timezone}
                            onValueChange={(val) => setProfile({ ...profile, timezone: val })}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {TIMEZONES.map((tz) => (
                                    <SelectItem key={tz.value} value={tz.value}>
                                        {tz.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CollapsibleSection>

            {/* Section 2: Property Defaults */}
            <CollapsibleSection
                title="Property Defaults"
                description="Default policies for all properties"
                icon={Clock}
                saving={savingDefaults}
                onSave={saveDefaults}
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="checkinTime">Default Check-in Time</Label>
                        <Input
                            id="checkinTime"
                            type="time"
                            value={defaults.checkinTime}
                            onChange={(e) => setDefaults({ ...defaults, checkinTime: e.target.value })}
                        />
                    </div>
                    <div>
                        <Label htmlFor="checkoutTime">Default Check-out Time</Label>
                        <Input
                            id="checkoutTime"
                            type="time"
                            value={defaults.checkoutTime}
                            onChange={(e) => setDefaults({ ...defaults, checkoutTime: e.target.value })}
                        />
                    </div>
                </div>
                <div>
                    <Label htmlFor="earlyCheckinPolicy">Early Check-in Policy</Label>
                    <Textarea
                        id="earlyCheckinPolicy"
                        value={defaults.earlyCheckinPolicy || ''}
                        onChange={(e) => setDefaults({ ...defaults, earlyCheckinPolicy: e.target.value })}
                        placeholder="e.g. Subject to availability, please contact us 24 hours in advance"
                        rows={2}
                    />
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                        Shown when guest asks: "Can I check in early?"
                    </p>
                </div>
                <div>
                    <Label htmlFor="lateCheckoutPolicy">Late Check-out Policy</Label>
                    <Textarea
                        id="lateCheckoutPolicy"
                        value={defaults.lateCheckoutPolicy || ''}
                        onChange={(e) => setDefaults({ ...defaults, lateCheckoutPolicy: e.target.value })}
                        placeholder="e.g. Available until 12pm if requested 24 hours in advance"
                        rows={2}
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="petPolicy">Pet Policy</Label>
                        <Input
                            id="petPolicy"
                            value={defaults.petPolicy || ''}
                            onChange={(e) => setDefaults({ ...defaults, petPolicy: e.target.value })}
                            placeholder="e.g. No pets allowed"
                        />
                    </div>
                    <div>
                        <Label htmlFor="smokingPolicy">Smoking Policy</Label>
                        <Input
                            id="smokingPolicy"
                            value={defaults.smokingPolicy || ''}
                            onChange={(e) => setDefaults({ ...defaults, smokingPolicy: e.target.value })}
                            placeholder="e.g. Non-smoking property"
                        />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="partyPolicy">Party/Events Policy</Label>
                        <Input
                            id="partyPolicy"
                            value={defaults.partyPolicy || ''}
                            onChange={(e) => setDefaults({ ...defaults, partyPolicy: e.target.value })}
                            placeholder="e.g. No parties or events"
                        />
                    </div>
                    <div>
                        <Label htmlFor="quietHours">Quiet Hours</Label>
                        <Input
                            id="quietHours"
                            value={defaults.quietHours || ''}
                            onChange={(e) => setDefaults({ ...defaults, quietHours: e.target.value })}
                            placeholder="e.g. 10pm - 8am"
                        />
                    </div>
                </div>
                <div>
                    <Label htmlFor="parkingInfo">Parking Information</Label>
                    <Textarea
                        id="parkingInfo"
                        value={defaults.parkingInfo || ''}
                        onChange={(e) => setDefaults({ ...defaults, parkingInfo: e.target.value })}
                        placeholder="e.g. Free undercover parking in Bay 12, enter via Smith Street"
                        rows={2}
                    />
                </div>
            </CollapsibleSection>

            {/* Section 3: Escalation */}
            <CollapsibleSection
                title="Escalation"
                description="Where to send urgent issues"
                icon={Shield}
                saving={savingProfile}
                onSave={saveProfile}
            >
                <div className="bg-[hsl(var(--muted))] p-4 rounded-lg mb-4">
                    <p className="text-sm">
                        When the AI isn't confident or encounters sensitive topics (refunds, complaints, safety), it will escalate to these contacts.
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="escalationPhone">Escalation Phone</Label>
                        <Input
                            id="escalationPhone"
                            type="tel"
                            value={profile.escalationPhone || ''}
                            onChange={(e) => setProfile({ ...profile, escalationPhone: e.target.value })}
                            placeholder="+61400000000"
                        />
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                            For urgent SMS escalations
                        </p>
                    </div>
                    <div>
                        <Label htmlFor="escalationEmail">Escalation Email</Label>
                        <Input
                            id="escalationEmail"
                            type="email"
                            value={profile.escalationEmail || ''}
                            onChange={(e) => setProfile({ ...profile, escalationEmail: e.target.value })}
                            placeholder="support@example.com"
                        />
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                            For email escalations
                        </p>
                    </div>
                </div>
                <div className="bg-[hsl(var(--muted))] p-4 rounded-lg">
                    <p className="text-sm font-medium mb-2">Telegram Notifications</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                        For real-time escalation alerts via Telegram, configure the Telegram integration in the <Link to="/integrations" className="text-[hsl(var(--primary))] underline">Integrations</Link> page.
                    </p>
                </div>
            </CollapsibleSection>

            {/* Section 4: System Prompt */}
            <CollapsibleSection
                title="System Prompt"
                description="The instructions given to the AI"
                icon={MessageSquare}
            >
                {/* Info Card */}
                <div className="bg-[hsl(var(--primary)/0.1)] border border-[hsl(var(--primary)/0.3)] p-4 rounded-lg">
                    <p className="text-sm mb-2">
                        <strong>This prompt is automatically generated</strong> from your settings above and your Knowledge Base.
                    </p>
                    <Link
                        to="/knowledge"
                        className="inline-flex items-center text-sm text-[hsl(var(--primary))] hover:underline"
                    >
                        <BookOpen className="h-4 w-4 mr-1" />
                        Edit Knowledge Base
                    </Link>
                </div>

                {/* Read-only Preview */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <Label>Current Prompt</Label>
                        {draft !== published?.content && (
                            <Badge variant="warning">Unsaved changes</Badge>
                        )}
                    </div>
                    <div className="bg-[hsl(var(--muted))] rounded-lg p-4 font-mono text-sm whitespace-pre-wrap max-h-[300px] overflow-auto">
                        {published?.content || 'No prompt configured yet'}
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                        <span>
                            Version {published?.version || 0} • Last updated{' '}
                            {published?.publishedAt
                                ? new Date(published.publishedAt).toLocaleString()
                                : 'Never'}
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)}>
                            <History className="h-4 w-4 mr-1" />
                            {showHistory ? 'Hide' : 'Show'} History
                        </Button>
                    </div>
                </div>

                {/* Version History */}
                {showHistory && versions.length > 0 && (
                    <div className="bg-[hsl(var(--muted))] p-4 rounded-lg space-y-2">
                        <p className="text-sm font-medium mb-2">Version History</p>
                        {versions.map((v) => (
                            <div
                                key={v.version}
                                className="flex items-center justify-between p-2 rounded bg-[hsl(var(--background))]"
                            >
                                <div className="text-sm">
                                    <p>v{v.version}</p>
                                    <p className="text-[hsl(var(--muted-foreground))]">
                                        {new Date(v.publishedAt).toLocaleDateString()}
                                    </p>
                                </div>
                                <Button size="sm" variant="ghost" onClick={() => restoreVersion(v)}>
                                    Restore
                                </Button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Advanced Toggle */}
                <div
                    className="flex items-center gap-2 cursor-pointer hover:text-[hsl(var(--primary))] transition-colors"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                >
                    {showAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span className="text-sm font-medium">Advanced: Edit Raw Prompt</span>
                </div>

                {showAdvanced && (
                    <div className="border border-[hsl(var(--destructive)/0.5)] rounded-lg p-4 space-y-4">
                        <div className="flex items-center gap-2 text-[hsl(var(--destructive))]">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="text-sm font-medium">Manual edits may be overwritten by changes to settings above</span>
                        </div>
                        <Textarea
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            className="min-h-[300px] font-mono text-sm"
                        />
                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={saveDraft} disabled={savingPrompt}>
                                <Save className="h-4 w-4 mr-2" />
                                Save Draft
                            </Button>
                            <Button onClick={publishPrompt} disabled={savingPrompt}>
                                <Upload className="h-4 w-4 mr-2" />
                                Publish
                            </Button>
                        </div>
                    </div>
                )}
            </CollapsibleSection>
        </div>
    );
}
