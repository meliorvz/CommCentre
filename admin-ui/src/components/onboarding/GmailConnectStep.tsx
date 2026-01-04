import { useState, useEffect } from 'react';
import { api, GmailStatus } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Mail, AlertCircle, Loader2 } from 'lucide-react';

interface GmailConnectStepProps {
    onContinue: () => void;
    onSkip?: () => void;
}

export default function GmailConnectStep({ onContinue, onSkip }: GmailConnectStepProps) {
    const [status, setStatus] = useState<'loading' | 'idle' | 'connected' | 'error'>('loading');
    const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Check URL params for OAuth return
        const params = new URLSearchParams(window.location.search);
        if (params.get('gmail') === 'connected') {
            const email = params.get('email');
            setConnectedEmail(email);
            setStatus('connected');
            // Clean URL
            window.history.replaceState({}, '', window.location.pathname);
            return;
        }
        if (params.get('gmail') === 'error') {
            setError(params.get('message') || 'Connection failed');
            setStatus('error');
            window.history.replaceState({}, '', window.location.pathname);
            return;
        }

        // Fetch current status
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        try {
            const result: GmailStatus = await api.gmail.getStatus();
            if (result.connected && result.email) {
                setConnectedEmail(result.email);
                setStatus('connected');
            } else if (result.error) {
                setError(result.error);
                setStatus('error');
            } else {
                setStatus('idle');
            }
        } catch (err) {
            console.error('Failed to fetch Gmail status:', err);
            setStatus('idle');
        }
    };

    const handleConnect = () => {
        // Navigate to OAuth endpoint (full page redirect)
        window.location.href = api.gmail.getConnectUrl();
    };

    const handleDisconnect = async () => {
        try {
            await api.gmail.disconnect();
            setConnectedEmail(null);
            setStatus('idle');
        } catch (err) {
            console.error('Failed to disconnect Gmail:', err);
        }
    };

    if (status === 'loading') {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
            </div>
        );
    }

    if (status === 'connected') {
        return (
            <div className="space-y-6">
                <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/50">
                                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div className="flex-1">
                                <p className="font-medium">Email Connected</p>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                    {connectedEmail}
                                </p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={handleDisconnect}>
                                Disconnect
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    Your AI assistant can now read and send emails on your behalf.
                </p>

                <Button onClick={onContinue} className="w-full">
                    Continue
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[hsl(var(--muted))] mb-4">
                    <Mail className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
                </div>
                <h3 className="text-lg font-semibold">Connect Your Email</h3>
                <p className="text-[hsl(var(--muted-foreground))]">
                    Allow your AI assistant to read and send emails on your behalf.
                </p>
            </div>

            {status === 'error' && error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <p className="text-sm">{error}</p>
                </div>
            )}

            <Card>
                <CardContent className="pt-6 space-y-4">
                    <div className="text-sm space-y-2">
                        <p className="font-medium">We'll request permission to:</p>
                        <ul className="list-disc list-inside text-[hsl(var(--muted-foreground))] space-y-1">
                            <li>Read incoming emails</li>
                            <li>Send emails on your behalf</li>
                        </ul>
                    </div>
                    <div className="p-3 rounded-lg bg-[hsl(var(--muted))] text-sm">
                        <p className="text-[hsl(var(--muted-foreground))]">
                            🔒 We only request the minimum permissions needed. We never access your contacts or other data.
                        </p>
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-3">
                <Button onClick={handleConnect} className="w-full" size="lg">
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                        <path
                            fill="currentColor"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                            fill="currentColor"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                            fill="currentColor"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                            fill="currentColor"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                    </svg>
                    Connect with Google
                </Button>

                {onSkip && (
                    <Button variant="ghost" onClick={onSkip} className="w-full">
                        Skip for now
                    </Button>
                )}
            </div>
        </div>
    );
}
