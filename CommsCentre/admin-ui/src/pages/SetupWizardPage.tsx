import { useState, useEffect } from 'react';
import { api, SetupProfile, PropertyDefaults } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, ChevronRight, ChevronLeft, Save, Building2, Clock, Shield } from 'lucide-react';

const STEPS = [
    { id: 'business', title: 'Your Business', icon: Building2, description: 'Tell us about your company' },
    { id: 'defaults', title: 'Property Defaults', icon: Clock, description: 'Set default policies' },
    { id: 'escalation', title: 'Escalation', icon: Shield, description: 'Where to send urgent issues' },
];

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

export default function SetupWizardPage() {
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState<SetupProfile>({
        companyName: '',
        assistantName: '',
        businessType: 'holiday_rentals',
        timezone: 'Australia/Sydney',
    });
    const [defaults, setDefaults] = useState<PropertyDefaults>({
        checkinTime: '15:00',
        checkoutTime: '10:00',
    });

    useEffect(() => {
        const loadData = async () => {
            try {
                const [profileRes, defaultsRes] = await Promise.all([
                    api.setup.getProfile(),
                    api.setup.getDefaults(),
                ]);
                setProfile(profileRes.profile);
                setDefaults(defaultsRes.defaults);
            } catch (err) {
                console.error('Failed to load setup data:', err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const saveAll = async () => {
        setSaving(true);
        try {
            await Promise.all([
                api.setup.updateProfile(profile),
                api.setup.updateDefaults(defaults),
            ]);
            alert('Settings saved successfully!');
        } catch (err) {
            console.error('Failed to save settings:', err);
            alert('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const goNext = () => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            saveAll();
        }
    };

    const goBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    if (loading) {
        return <div className="p-8 text-[hsl(var(--muted-foreground))]">Loading...</div>;
    }

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold mb-2">Setup Assistant</h1>
                <p className="text-[hsl(var(--muted-foreground))]">
                    Configure your AI assistant in a few simple steps
                </p>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center justify-between mb-8">
                {STEPS.map((step, index) => {
                    const Icon = step.icon;
                    const isActive = index === currentStep;
                    const isComplete = index < currentStep;
                    return (
                        <div
                            key={step.id}
                            className={`flex items-center ${index < STEPS.length - 1 ? 'flex-1' : ''}`}
                        >
                            <div
                                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${isComplete
                                        ? 'bg-[hsl(var(--primary))] border-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                                        : isActive
                                            ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]'
                                            : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]'
                                    }`}
                            >
                                {isComplete ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                            </div>
                            <div className="ml-3 hidden sm:block">
                                <p className={`text-sm font-medium ${isActive ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]'}`}>
                                    {step.title}
                                </p>
                            </div>
                            {index < STEPS.length - 1 && (
                                <div className={`flex-1 h-0.5 mx-4 ${isComplete ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--border))]'}`} />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Step Content */}
            <Card>
                <CardHeader>
                    <CardTitle>{STEPS[currentStep].title}</CardTitle>
                    <CardDescription>{STEPS[currentStep].description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {currentStep === 0 && (
                        <>
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
                        </>
                    )}

                    {currentStep === 1 && (
                        <>
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
                        </>
                    )}

                    {currentStep === 2 && (
                        <>
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
                                    For real-time escalation alerts via Telegram, configure the Telegram integration in the <a href="/integrations" className="text-[hsl(var(--primary))] underline">Integrations</a> page.
                                </p>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Navigation */}
            <div className="flex justify-between mt-6">
                <Button
                    variant="outline"
                    onClick={goBack}
                    disabled={currentStep === 0}
                >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Back
                </Button>
                <Button onClick={goNext} disabled={saving}>
                    {currentStep === STEPS.length - 1 ? (
                        <>
                            <Save className="h-4 w-4 mr-2" />
                            {saving ? 'Saving...' : 'Save & Finish'}
                        </>
                    ) : (
                        <>
                            Next
                            <ChevronRight className="h-4 w-4 ml-2" />
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
