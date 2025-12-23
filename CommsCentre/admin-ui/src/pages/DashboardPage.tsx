import { useEffect, useState } from 'react';
import { api, ThreadWithContext } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Inbox, Calendar, Building2, AlertTriangle } from 'lucide-react';

export default function DashboardPage() {
    const [stats, setStats] = useState({
        activeStays: 0,
        openThreads: 0,
        needsHuman: 0,
        properties: 0,
    });
    const [recentThreads, setRecentThreads] = useState<ThreadWithContext[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            try {
                const [threadsRes, staysRes, propsRes] = await Promise.all([
                    api.threads.list({ limit: '5' }),
                    api.stays.list({ status: 'booked' }),
                    api.properties.list(),
                ]);

                const needsHuman = threadsRes.threads.filter(t => t.status === 'needs_human').length;

                setStats({
                    activeStays: staysRes.stays.length,
                    openThreads: threadsRes.threads.filter(t => t.status === 'open').length,
                    needsHuman,
                    properties: propsRes.properties.length,
                });

                setRecentThreads(threadsRes.threads);
            } catch (err) {
                console.error('Failed to load dashboard:', err);
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, []);

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center">
                <p className="text-[hsl(var(--muted-foreground))]">Loading...</p>
            </div>
        );
    }

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Active Stays</CardTitle>
                        <Calendar className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.activeStays}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Open Threads</CardTitle>
                        <Inbox className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.openThreads}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Needs Attention</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-500">{stats.needsHuman}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Properties</CardTitle>
                        <Building2 className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.properties}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Threads */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Conversations</CardTitle>
                </CardHeader>
                <CardContent>
                    {recentThreads.length === 0 ? (
                        <p className="text-[hsl(var(--muted-foreground))]">No conversations yet</p>
                    ) : (
                        <div className="space-y-3">
                            {recentThreads.map((thread) => (
                                <div
                                    key={thread.id}
                                    className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--muted))]"
                                >
                                    <div>
                                        <p className="font-medium">{thread.stay?.guestName || 'Unknown Guest'}</p>
                                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                            {thread.property?.name || 'Unknown Property'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
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
                                        {thread.lastChannel && (
                                            <Badge variant="outline">{thread.lastChannel}</Badge>
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
