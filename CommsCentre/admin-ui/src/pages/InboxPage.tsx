import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ThreadWithContext } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, MessageSquare, Mail } from 'lucide-react';

export default function InboxPage() {
    const [threads, setThreads] = useState<ThreadWithContext[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>('');

    const loadThreads = async () => {
        setLoading(true);
        try {
            const params = filter ? { status: filter } : undefined;
            const { threads } = await api.threads.list(params);
            setThreads(threads);
        } catch (err) {
            console.error('Failed to load threads:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadThreads();
    }, [filter]);

    // Auto-refresh every 60 seconds
    useEffect(() => {
        const interval = setInterval(loadThreads, 60000);
        return () => clearInterval(interval);
    }, [filter]);

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Inbox</h1>
                <div className="flex items-center gap-2">
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="px-3 py-2 rounded-md border bg-[hsl(var(--background))]"
                    >
                        <option value="">All</option>
                        <option value="open">Open</option>
                        <option value="needs_human">Needs Attention</option>
                        <option value="closed">Closed</option>
                    </select>
                    <Button variant="outline" onClick={loadThreads} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    {threads.length === 0 ? (
                        <div className="p-8 text-center text-[hsl(var(--muted-foreground))]">
                            {loading ? 'Loading...' : 'No conversations found'}
                        </div>
                    ) : (
                        <div className="divide-y">
                            {threads.map((thread) => (
                                <Link
                                    key={thread.id}
                                    to={`/inbox/${thread.id}`}
                                    className="flex items-center justify-between p-4 hover:bg-[hsl(var(--muted))] transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center text-[hsl(var(--primary-foreground))]">
                                            {thread.stay?.guestName?.charAt(0) || '?'}
                                        </div>
                                        <div>
                                            <p className="font-medium">
                                                {thread.property?.id === '00000000-0000-0000-0000-000000000000'
                                                    ? 'Unassigned Enquiry'
                                                    : (thread.stay?.guestName || 'Unknown Guest')}
                                            </p>
                                            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                                {thread.property?.id === '00000000-0000-0000-0000-000000000000'
                                                    ? `From ${thread.stay?.guestPhoneE164 || thread.stay?.guestEmail || 'Unknown'}`
                                                    : `${thread.property?.name} • ${thread.lastMessageAt
                                                        ? new Date(thread.lastMessageAt).toLocaleString()
                                                        : 'No messages'}`}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {thread.lastChannel === 'sms' ? (
                                            <MessageSquare className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                                        ) : thread.lastChannel === 'email' ? (
                                            <Mail className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                                        ) : null}
                                        <Badge
                                            variant={
                                                thread.status === 'needs_human'
                                                    ? 'warning'
                                                    : thread.status === 'open'
                                                        ? 'default'
                                                        : 'secondary'
                                            }
                                        >
                                            {thread.status === 'needs_human' ? 'Needs Attention' : thread.status}
                                        </Badge>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
