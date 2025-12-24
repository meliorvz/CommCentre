import { useEffect, useState } from 'react';
import { api, Property } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, X, RefreshCw } from 'lucide-react';

export default function PropertiesPage() {
    const [properties, setProperties] = useState<Property[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<Property | null>(null);
    const [isNew, setIsNew] = useState(false);
    const [twilioNumbers, setTwilioNumbers] = useState<string[]>([]);
    const [loadingNumbers, setLoadingNumbers] = useState(false);

    const loadProperties = async () => {
        setLoading(true);
        try {
            const { properties } = await api.properties.list();
            setProperties(properties);
        } catch (err) {
            console.error('Failed to load properties:', err);
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

    useEffect(() => {
        loadProperties();
    }, []);

    useEffect(() => {
        if (editing) {
            loadTwilioNumbers();
        }
    }, [editing]);

    const handleSave = async () => {
        if (!editing) return;
        try {
            if (isNew) {
                // Only send fields that the API accepts for creation
                await api.properties.create({
                    name: editing.name,
                    timezone: editing.timezone,
                    addressText: editing.addressText,
                    supportPhoneE164: editing.supportPhoneE164,
                    supportEmail: editing.supportEmail,
                });
            } else {
                await api.properties.update(editing.id, {
                    name: editing.name,
                    timezone: editing.timezone,
                    addressText: editing.addressText,
                    supportPhoneE164: editing.supportPhoneE164,
                    supportEmail: editing.supportEmail,
                });
            }
            setEditing(null);
            setIsNew(false);
            loadProperties();
        } catch (err) {
            console.error('Failed to save property:', err);
            alert('Failed to save property');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this property?')) return;
        try {
            await api.properties.delete(id);
            loadProperties();
        } catch (err) {
            console.error('Failed to delete property:', err);
            alert('Failed to delete property');
        }
    };

    const startCreate = () => {
        setEditing({
            id: '',
            name: '',
            timezone: 'Australia/Sydney',
            status: 'active',
            createdAt: '',
            updatedAt: '',
        });
        setIsNew(true);
    };

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Properties</h1>
                <Button onClick={startCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Property
                </Button>
            </div>

            {/* Edit Modal */}
            {editing && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{isNew ? 'New Property' : 'Edit Property'}</CardTitle>
                            <Button variant="ghost" size="icon" onClick={() => setEditing(null)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>Name</Label>
                                <Input
                                    value={editing.name}
                                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                                    placeholder="Property name"
                                />
                            </div>
                            <div>
                                <Label>Timezone</Label>
                                <Input
                                    value={editing.timezone}
                                    onChange={(e) => setEditing({ ...editing, timezone: e.target.value })}
                                    placeholder="Australia/Sydney"
                                />
                            </div>
                            <div>
                                <Label>Address</Label>
                                <Input
                                    value={editing.addressText || ''}
                                    onChange={(e) => setEditing({ ...editing, addressText: e.target.value })}
                                    placeholder="Full address"
                                />
                            </div>
                            <div>
                                <Label className="flex justify-between items-center mb-1">
                                    Support Phone (Twilio)
                                    {loadingNumbers && <RefreshCw className="h-3 w-3 animate-spin" />}
                                </Label>
                                <Select
                                    value={editing.supportPhoneE164 || ''}
                                    onValueChange={(val) => setEditing({ ...editing, supportPhoneE164: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a phone number" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {twilioNumbers.length === 0 ? (
                                            <SelectItem value="_none" disabled>
                                                No numbers found
                                            </SelectItem>
                                        ) : (
                                            twilioNumbers.map((num) => (
                                                <SelectItem key={num} value={num}>
                                                    {num}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                                {editing.supportPhoneE164 && !twilioNumbers.includes(editing.supportPhoneE164) && !loadingNumbers && twilioNumbers.length > 0 && (
                                    <p className="text-xs text-amber-500 mt-1">
                                        Current number ({editing.supportPhoneE164}) is not in your Twilio account. Please update it.
                                    </p>
                                )}
                            </div>
                            <div>
                                <Label>Support Email</Label>
                                <Input
                                    value={editing.supportEmail || ''}
                                    onChange={(e) => setEditing({ ...editing, supportEmail: e.target.value })}
                                    placeholder="support@example.com"
                                />
                            </div>
                            <div className="flex justify-end gap-2 mt-4">
                                <Button variant="outline" onClick={() => setEditing(null)}>
                                    Cancel
                                </Button>
                                <Button onClick={handleSave}>Save</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Properties List */}
            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-8 text-center text-[hsl(var(--muted-foreground))]">Loading...</div>
                    ) : properties.length === 0 ? (
                        <div className="p-8 text-center text-[hsl(var(--muted-foreground))]">
                            No properties yet. Create one to get started.
                        </div>
                    ) : (
                        <div className="divide-y">
                            {properties.map((prop) => (
                                <div key={prop.id} className="flex items-center justify-between p-4">
                                    <div>
                                        <p className="font-medium">{prop.name}</p>
                                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                            {prop.addressText || 'No address'} • {prop.timezone}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant={prop.status === 'active' ? 'success' : 'secondary'}>
                                            {prop.status}
                                        </Badge>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                                setEditing(prop);
                                                setIsNew(false);
                                            }}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(prop.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
