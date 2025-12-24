import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, Thread, Stay, Property, Message, LLMSuggestion } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Send, MessageSquare, Mail, RefreshCw, Sparkles, UserPlus, Save, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AI_AGENT_NAME } from '@shared/constants';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ThreadDetailPage() {
    const { threadId } = useParams<{ threadId: string }>();
    const id = threadId;
    const navigate = useNavigate();
    const [thread, setThread] = useState<Thread | null>(null);
    const [stay, setStay] = useState<Stay | null>(null);
    const [property, setProperty] = useState<Property | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [suggestion, setSuggestion] = useState<LLMSuggestion | null>(null);
    const [loading, setLoading] = useState(true);

    // Reply form
    const [replyChannel, setReplyChannel] = useState<'sms' | 'email'>('sms');
    const [replyBody, setReplyBody] = useState('');
    const [replySubject, setReplySubject] = useState('');
    const [sending, setSending] = useState(false);

    // Edit state
    const [isEditingStay, setIsEditingStay] = useState(false);
    const [editForm, setEditForm] = useState({
        guestName: '',
        guestPhoneE164: '',
        guestEmail: '',
        propertyId: '',
        checkinAt: '',
        checkoutAt: '',
    });
    const [properties, setProperties] = useState<Property[]>([]);

    const loadThread = async () => {
        if (!id) return;
        setLoading(true);

        // 1. Load main thread data first
        try {
            const data = await api.threads.get(id);
            setThread(data.thread);
            setStay(data.stay);
            setProperty(data.property);
            setMessages(data.messages);
        } catch (err) {
            console.error('Failed to load thread:', err);
            setLoading(false);
            return;
        }

        setLoading(false);

        // 2. Load LLM suggestion in background
        try {
            const suggestionData = await api.threads.suggest(id);
            setSuggestion(suggestionData.suggestion);

            if (suggestionData.suggestion?.reply_text) {
                if (!replyBody) { // Only set if empty
                    setReplyBody(suggestionData.suggestion.reply_text);
                    setReplyChannel(suggestionData.suggestion.reply_channel);
                    if (suggestionData.suggestion.reply_subject) {
                        setReplySubject(suggestionData.suggestion.reply_subject);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to load suggestion:', err);
        }
    };

    const loadProperties = async () => {
        try {
            const { properties } = await api.properties.list();
            setProperties(properties);
        } catch (err) {
            console.error('Failed to load properties:', err);
        }
    };

    useEffect(() => {
        loadThread();
        loadProperties();
    }, [id]);

    const handleSendReply = async () => {
        if (!id || !replyBody.trim()) return;
        setSending(true);
        try {
            const { message } = await api.threads.reply(id, {
                channel: replyChannel,
                body: replyBody,
                subject: replyChannel === 'email' ? replySubject : undefined,
            });
            setMessages([...messages, message]);
            setReplyBody('');
            setReplySubject('');

            // Update thread status to open
            await api.threads.update(id, { status: 'open' });
            setThread({ ...thread!, status: 'open' });
        } catch (err: any) {
            console.error('Failed to send reply:', err);
            const errorDetail = err.response?.data?.details || err.message || '';
            alert(`Failed to send message: ${errorDetail}`);
        } finally {
            setSending(false);
        }
    };

    const handleCloseThread = async () => {
        if (!id) return;
        await api.threads.update(id, { status: 'closed' });
        setThread({ ...thread!, status: 'closed' });
    };

    const handleStartEdit = () => {
        if (!stay) return;
        setEditForm({
            guestName: stay.guestName,
            guestPhoneE164: stay.guestPhoneE164 || '',
            guestEmail: stay.guestEmail || '',
            propertyId: stay.propertyId,
            checkinAt: new Date(stay.checkinAt).toISOString().split('T')[0],
            checkoutAt: new Date(stay.checkoutAt).toISOString().split('T')[0],
        });
        setIsEditingStay(true);
    };

    const handleSaveStay = async () => {
        if (!stay || !id) return;
        try {
            // Convert dates back to ISO strings
            const data = {
                ...editForm,
                checkinAt: new Date(editForm.checkinAt).toISOString(),
                checkoutAt: new Date(editForm.checkoutAt).toISOString(),
            };
            const { stay: updatedStay } = await api.stays.update(stay.id, data);
            setStay(updatedStay);
            setIsEditingStay(false);

            // Refresh thread to get updated context
            loadThread();
        } catch (err: any) {
            console.error('Failed to save stay:', err);
            alert(`Failed to save stay: ${err.message}`);
        }
    };

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center">
                <p className="text-[hsl(var(--muted-foreground))]">Loading...</p>
            </div>
        );
    }

    if (!thread || !stay) {
        return (
            <div className="p-8">
                <p className="text-[hsl(var(--muted-foreground))]">Thread not found</p>
            </div>
        );
    }

    return (
        <div className="p-8">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" size="icon" onClick={() => navigate('/inbox')}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold">{stay.guestName}</h1>
                    <p className="text-[hsl(var(--muted-foreground))]">
                        {property?.name} • {new Date(stay.checkinAt).toLocaleDateString()} - {new Date(stay.checkoutAt).toLocaleDateString()}
                    </p>
                </div>
                <Badge
                    variant={
                        thread.status === 'needs_human'
                            ? 'warning'
                            : thread.status === 'open'
                                ? 'default'
                                : 'secondary'
                    }
                >
                    {thread.status}
                </Badge>
                {stay.propertyId === '00000000-0000-0000-0000-000000000000' && (
                    <Button variant="default" onClick={handleStartEdit} className="bg-[hsl(var(--warning))] hover:bg-[hsl(var(--warning)/0.8)] text-black">
                        <UserPlus className="h-4 w-4 mr-2" />
                        Promote to Booking
                    </Button>
                )}
                <Button variant="outline" onClick={loadThread}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                </Button>
                {thread.status !== 'closed' && (
                    <Button variant="secondary" onClick={handleCloseThread}>
                        Close Thread
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Messages */}
                <div className="lg:col-span-2 space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Conversation</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 max-h-[500px] overflow-y-auto">
                            {messages.length === 0 ? (
                                <p className="text-[hsl(var(--muted-foreground))]">No messages yet</p>
                            ) : (
                                messages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={cn(
                                            'p-4 rounded-lg max-w-[80%]',
                                            msg.direction === 'inbound'
                                                ? 'bg-[hsl(var(--muted))]'
                                                : 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] ml-auto'
                                        )}
                                    >
                                        <div className="flex items-center gap-2 mb-2 text-xs opacity-70">
                                            {msg.channel === 'sms' ? (
                                                <MessageSquare className="h-3 w-3" />
                                            ) : (
                                                <Mail className="h-3 w-3" />
                                            )}
                                            <span>{msg.direction === 'inbound' ? 'Guest' : AI_AGENT_NAME}</span>
                                            <span>•</span>
                                            <span>{new Date(msg.createdAt).toLocaleString()}</span>
                                        </div>
                                        {msg.subject && (
                                            <p className="font-medium mb-1">{msg.subject}</p>
                                        )}
                                        <p className="whitespace-pre-wrap">{msg.bodyText}</p>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    {/* Reply Form */}
                    {thread.status !== 'closed' && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    Send Reply
                                    {suggestion && (
                                        <Badge variant="outline" className="ml-2">
                                            <Sparkles className="h-3 w-3 mr-1" />
                                            AI Suggested
                                        </Badge>
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex gap-2">
                                    <Button
                                        variant={replyChannel === 'sms' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setReplyChannel('sms')}
                                        disabled={!stay.guestPhoneE164}
                                    >
                                        <MessageSquare className="h-4 w-4 mr-2" />
                                        SMS
                                    </Button>
                                    <Button
                                        variant={replyChannel === 'email' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setReplyChannel('email')}
                                        disabled={!stay.guestEmail}
                                    >
                                        <Mail className="h-4 w-4 mr-2" />
                                        Email
                                    </Button>
                                </div>

                                {replyChannel === 'email' && (
                                    <div>
                                        <Label>Subject</Label>
                                        <Input
                                            value={replySubject}
                                            onChange={(e) => setReplySubject(e.target.value)}
                                            placeholder="Re: Your inquiry"
                                        />
                                    </div>
                                )}

                                <div>
                                    <Label>Message</Label>
                                    <Textarea
                                        value={replyBody}
                                        onChange={(e) => setReplyBody(e.target.value)}
                                        placeholder="Type your message..."
                                        rows={4}
                                    />
                                </div>

                                <Button onClick={handleSendReply} disabled={sending || !replyBody.trim()}>
                                    <Send className="h-4 w-4 mr-2" />
                                    {sending ? 'Sending...' : 'Send'}
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-4">
                    {/* Guest Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Guest Info</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <div>
                                <span className="text-[hsl(var(--muted-foreground))]">Name:</span>{' '}
                                {stay.guestName}
                            </div>
                            {stay.guestPhoneE164 && (
                                <div>
                                    <span className="text-[hsl(var(--muted-foreground))]">Phone:</span>{' '}
                                    {stay.guestPhoneE164}
                                </div>
                            )}
                            {stay.guestEmail && (
                                <div>
                                    <span className="text-[hsl(var(--muted-foreground))]">Email:</span>{' '}
                                    {stay.guestEmail}
                                </div>
                            )}
                            <div>
                                <span className="text-[hsl(var(--muted-foreground))]">Channel:</span>{' '}
                                {stay.preferredChannel}
                            </div>
                            <div className="pt-2 border-t mt-2">
                                <Button variant="outline" size="sm" className="w-full" onClick={handleStartEdit}>
                                    Edit Details
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Edit Stay Overlay/Modal (Simulated with conditional rendering) */}
                    {isEditingStay && (
                        <Card className="border-primary">
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    Edit Stay Details
                                    <Button variant="ghost" size="sm" onClick={() => setIsEditingStay(false)}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Guest Name</Label>
                                    <Input
                                        value={editForm.guestName}
                                        onChange={(e) => setEditForm({ ...editForm, guestName: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Phone</Label>
                                    <Input
                                        value={editForm.guestPhoneE164}
                                        onChange={(e) => setEditForm({ ...editForm, guestPhoneE164: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Email</Label>
                                    <Input
                                        value={editForm.guestEmail}
                                        onChange={(e) => setEditForm({ ...editForm, guestEmail: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Assign to Property</Label>
                                    <Select
                                        value={editForm.propertyId}
                                        onValueChange={(val) => setEditForm({ ...editForm, propertyId: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Property" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {properties.map(p => (
                                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Check-in</Label>
                                        <Input
                                            type="date"
                                            value={editForm.checkinAt}
                                            onChange={(e) => setEditForm({ ...editForm, checkinAt: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Check-out</Label>
                                        <Input
                                            type="date"
                                            value={editForm.checkoutAt}
                                            onChange={(e) => setEditForm({ ...editForm, checkoutAt: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <Button className="flex-1" onClick={handleSaveStay}>
                                        <Save className="h-4 w-4 mr-2" />
                                        Save Changes
                                    </Button>
                                    <Button variant="outline" onClick={() => setIsEditingStay(false)}>
                                        Cancel
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* LLM Analysis */}
                    {suggestion && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Sparkles className="h-4 w-4" />
                                    AI Analysis
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <div>
                                    <span className="text-[hsl(var(--muted-foreground))]">Intent:</span>{' '}
                                    <Badge variant="outline">{suggestion.intent}</Badge>
                                </div>
                                <div>
                                    <span className="text-[hsl(var(--muted-foreground))]">Confidence:</span>{' '}
                                    {Math.round(suggestion.confidence * 100)}%
                                </div>
                                {suggestion.internal_note && (
                                    <div>
                                        <span className="text-[hsl(var(--muted-foreground))]">Note:</span>{' '}
                                        {suggestion.internal_note}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Stay Notes */}
                    {stay.notesInternal && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Internal Notes</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm">{stay.notesInternal}</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
