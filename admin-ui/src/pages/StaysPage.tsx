import { useEffect, useState } from 'react';
import { api, Stay, Property } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Upload, X } from 'lucide-react';

export default function StaysPage() {
    const [stays, setStays] = useState<Stay[]>([]);
    const [properties, setProperties] = useState<Property[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<Partial<Stay> | null>(null);
    const [isNew, setIsNew] = useState(false);
    const [filter, setFilter] = useState({ propertyId: '', status: '' });

    const loadData = async () => {
        setLoading(true);
        try {
            const [staysRes, propsRes] = await Promise.all([
                api.stays.list(filter.propertyId || filter.status ? filter : undefined),
                api.properties.list(),
            ]);
            setStays(staysRes.stays);
            setProperties(propsRes.properties);
        } catch (err) {
            console.error('Failed to load data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [filter.propertyId, filter.status]);

    const handleSave = async () => {
        if (!editing) return;
        try {
            // Ensure dates are full ISO strings
            const formatDate = (date: string, time: string) => {
                if (!date) return '';
                // If already ISO string, return it
                if (date.includes('T')) return date;
                // Otherwise append time
                return `${date}T${time}Z`;
            };

            const payload = {
                propertyId: editing.propertyId,
                guestName: editing.guestName,
                guestPhoneE164: editing.guestPhoneE164,
                guestEmail: editing.guestEmail,
                checkinAt: formatDate(editing.checkinAt || '', '14:00:00'),
                checkoutAt: formatDate(editing.checkoutAt || '', '10:00:00'),
                preferredChannel: editing.preferredChannel,
                notesInternal: editing.notesInternal,
            };

            if (isNew) {
                await api.stays.create(payload as any);
            } else {
                await api.stays.update((editing as Stay).id, payload);
            }
            setEditing(null);
            setIsNew(false);
            loadData();
        } catch (err) {
            console.error('Failed to save stay:', err);
            alert('Failed to save stay');
        }
    };

    const handleCancel = async (id: string) => {
        if (!confirm('Cancel this stay?')) return;
        try {
            await api.stays.cancel(id);
            loadData();
        } catch (err) {
            console.error('Failed to cancel stay:', err);
        }
    };

    const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !filter.propertyId) {
            alert('Select a property first');
            return;
        }

        const text = await file.text();
        const lines = text.trim().split('\n');
        const headers = lines[0].split(',').map((h) => h.trim());
        const rows = lines.slice(1).map((line) => {
            const values = line.split(',');
            const row: Record<string, string> = {};
            headers.forEach((h, i) => {
                row[h] = values[i]?.trim() || '';
            });
            return row;
        });

        try {
            const result = await api.stays.import(filter.propertyId, rows);
            alert(`Imported ${result.success} stays. ${result.errors.length} errors.`);
            loadData();
        } catch (err) {
            console.error('Import failed:', err);
            alert('Import failed');
        }
    };

    const startCreate = () => {
        setEditing({
            propertyId: filter.propertyId || properties[0]?.id,
            guestName: '',
            checkinAt: new Date().toISOString().split('T')[0],
            checkoutAt: new Date(Date.now() + 86400000).toISOString().split('T')[0],
            preferredChannel: 'sms',
        });
        setIsNew(true);
    };

    const getPropertyName = (id: string) =>
        properties.find((p) => p.id === id)?.name || 'Unknown';

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Stays</h1>
                <div className="flex items-center gap-2">
                    <select
                        value={filter.propertyId}
                        onChange={(e) => setFilter({ ...filter, propertyId: e.target.value })}
                        className="px-3 py-2 rounded-md border bg-[hsl(var(--background))]"
                    >
                        <option value="">All Properties</option>
                        {properties.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                    <select
                        value={filter.status}
                        onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                        className="px-3 py-2 rounded-md border bg-[hsl(var(--background))]"
                    >
                        <option value="">All Status</option>
                        <option value="booked">Booked</option>
                        <option value="checked_in">Checked In</option>
                        <option value="checked_out">Checked Out</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                    <label className="cursor-pointer">
                        <input type="file" accept=".csv" onChange={handleCSVImport} className="hidden" />
                        <Button variant="outline" asChild>
                            <span>
                                <Upload className="h-4 w-4 mr-2" />
                                Import CSV
                            </span>
                        </Button>
                    </label>
                    <Button onClick={startCreate}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Stay
                    </Button>
                </div>
            </div>

            {/* Edit Modal */}
            {editing && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{isNew ? 'New Stay' : 'Edit Stay'}</CardTitle>
                            <Button variant="ghost" size="icon" onClick={() => setEditing(null)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>Property</Label>
                                <select
                                    value={editing.propertyId || ''}
                                    onChange={(e) => setEditing({ ...editing, propertyId: e.target.value })}
                                    className="w-full px-3 py-2 rounded-md border bg-[hsl(var(--background))]"
                                >
                                    {properties.map((p) => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <Label>Guest Name</Label>
                                <Input
                                    value={editing.guestName || ''}
                                    onChange={(e) => setEditing({ ...editing, guestName: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label>Phone (E.164)</Label>
                                <Input
                                    value={editing.guestPhoneE164 || ''}
                                    onChange={(e) => setEditing({ ...editing, guestPhoneE164: e.target.value })}
                                    placeholder="+61400000000"
                                />
                            </div>
                            <div>
                                <Label>Email</Label>
                                <Input
                                    value={editing.guestEmail || ''}
                                    onChange={(e) => setEditing({ ...editing, guestEmail: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Check-in</Label>
                                    <Input
                                        type="date"
                                        value={editing.checkinAt?.split('T')[0] || ''}
                                        onChange={(e) => setEditing({ ...editing, checkinAt: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label>Check-out</Label>
                                    <Input
                                        type="date"
                                        value={editing.checkoutAt?.split('T')[0] || ''}
                                        onChange={(e) => setEditing({ ...editing, checkoutAt: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <Label>Preferred Channel</Label>
                                <select
                                    value={editing.preferredChannel || 'sms'}
                                    onChange={(e) => setEditing({ ...editing, preferredChannel: e.target.value as any })}
                                    className="w-full px-3 py-2 rounded-md border bg-[hsl(var(--background))]"
                                >
                                    <option value="sms">SMS</option>
                                    <option value="email">Email</option>
                                    <option value="both">Both</option>
                                </select>
                            </div>
                            <div>
                                <Label>Internal Notes</Label>
                                <Textarea
                                    value={editing.notesInternal || ''}
                                    onChange={(e) => setEditing({ ...editing, notesInternal: e.target.value })}
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                                <Button onClick={handleSave}>Save</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Stays List */}
            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-8 text-center text-[hsl(var(--muted-foreground))]">Loading...</div>
                    ) : stays.length === 0 ? (
                        <div className="p-8 text-center text-[hsl(var(--muted-foreground))]">No stays found</div>
                    ) : (
                        <div className="divide-y">
                            {stays.map((stay) => (
                                <div key={stay.id} className="flex items-center justify-between p-4">
                                    <div>
                                        <p className="font-medium">{stay.guestName}</p>
                                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                            {getPropertyName(stay.propertyId)} •{' '}
                                            {new Date(stay.checkinAt).toLocaleDateString()} -{' '}
                                            {new Date(stay.checkoutAt).toLocaleDateString()}
                                        </p>
                                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                            {stay.guestPhoneE164 || stay.guestEmail || 'No contact'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge
                                            variant={
                                                stay.status === 'cancelled'
                                                    ? 'destructive'
                                                    : stay.status === 'checked_out'
                                                        ? 'secondary'
                                                        : 'success'
                                            }
                                        >
                                            {stay.status}
                                        </Badge>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setEditing(stay);
                                                setIsNew(false);
                                            }}
                                        >
                                            Edit
                                        </Button>
                                        {stay.status === 'booked' && (
                                            <Button variant="ghost" size="sm" onClick={() => handleCancel(stay.id)}>
                                                Cancel
                                            </Button>
                                        )}
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
