import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GmailCallbackPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('');

    useEffect(() => {
        const gmailStatus = searchParams.get('gmail');
        const email = searchParams.get('email');
        const errorMessage = searchParams.get('message');

        if (gmailStatus === 'connected') {
            setStatus('success');
            setMessage(email ? `Connected as ${email}` : 'Gmail connected successfully');
            // Redirect back to setup after a short delay
            setTimeout(() => navigate('/setup?gmail=connected&email=' + encodeURIComponent(email || '')), 2000);
        } else if (gmailStatus === 'error') {
            setStatus('error');
            setMessage(errorMessage || 'Failed to connect Gmail');
        } else {
            // No status, redirect to setup
            navigate('/setup');
        }
    }, [searchParams, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center p-8">
            <div className="text-center space-y-4">
                {status === 'loading' && (
                    <>
                        <Loader2 className="h-12 w-12 animate-spin mx-auto text-[hsl(var(--muted-foreground))]" />
                        <p className="text-[hsl(var(--muted-foreground))]">Processing...</p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mx-auto">
                            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                        </div>
                        <h2 className="text-xl font-semibold">Email Connected!</h2>
                        <p className="text-[hsl(var(--muted-foreground))]">{message}</p>
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">Redirecting...</p>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 mx-auto">
                            <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                        </div>
                        <h2 className="text-xl font-semibold">Connection Failed</h2>
                        <p className="text-[hsl(var(--muted-foreground))]">{message}</p>
                        <Button onClick={() => navigate('/setup')} variant="outline">
                            Back to Setup
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}
