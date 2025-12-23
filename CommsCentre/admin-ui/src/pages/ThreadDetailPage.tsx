import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, Thread, Stay, Property, Message, LLMSuggestion } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Send, MessageSquare, Mail, RefreshCw, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AI_AGENT_NAME } from '@shared/constants';

export default function ThreadDetailPage() {
    const { id } = useParams<{ id: string }>();
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

    const loadThread = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const data = await api.threads.get(id);
            setThread(data.thread);
            setStay(data.stay);
            setProperty(data.property);
            setMessages(data.messages);

            // Load LLM suggestion
            const suggestionData = await api.threads.suggest(id);
            setSuggestion(suggestionData.suggestion);

            if (suggestionData.suggestion?.reply_text) {
                setReplyBody(suggestionData.suggestion.reply_text);
                setReplyChannel(suggestionData.suggestion.reply_channel);
                if (suggestionData.suggestion.reply_subject) {
                    setReplySubject(suggestionData.suggestion.reply_subject);
                }
            }
        } catch (err) {
            console.error('Failed to load thread:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadThread();
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
                        </CardContent>
                    </Card>

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
