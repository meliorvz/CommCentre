import { useState, useEffect } from 'react';
import { api, IntegrationConfig, IntegrationLog } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Plus,
    Trash2,
    FileText,
    Terminal,
    Send,
    MessageSquare,
    Mail,
    Copy,
} from 'lucide-react';

export default function IntegrationsPage() {
    const [integrations, setIntegrations] = useState<IntegrationConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedIntegration, setSelectedIntegration] = useState<IntegrationConfig | null>(null);
    const [logsOpen, setLogsOpen] = useState(false);
    const [docsOpen, setDocsOpen] = useState(false);

    useEffect(() => {
        loadIntegrations();
    }, []);

    const loadIntegrations = async () => {
        setLoading(true);
        try {
            const { integrations } = await api.integrations.list();
            setIntegrations(integrations);
        } catch (error) {
            console.error('Failed to load integrations:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this integration? This action cannot be undone.')) return;
        try {
            await api.integrations.delete(id);
            setIntegrations(prev => prev.filter(i => i.id !== id));
        } catch (error) {
            console.error('Failed to delete integration:', error);
            alert('Failed to delete integration');
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
                    <p className="text-muted-foreground mt-2">
                        Manage external API access for automated cleaning reports, notifications, and more.
                    </p>
                </div>
                <div className="flex gap-4">
                    <Button variant="outline" onClick={() => setDocsOpen(true)}>
                        <FileText className="mr-2 h-4 w-4" />
                        API Docs
                    </Button>
                    <Button onClick={() => setIsCreateOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        New Integration
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {integrations.map((integration) => (
                    <IntegrationCard
                        key={integration.id}
                        integration={integration}
                        onDelete={() => handleDelete(integration.id)}
                        onViewLogs={() => {
                            setSelectedIntegration(integration);
                            setLogsOpen(true);
                        }}
                        onEdit={() => {
                            // TODO: Implement Edit
                            setSelectedIntegration(integration);
                            setIsCreateOpen(true);
                        }}
                    />
                ))}

                {integrations.length === 0 && !loading && (
                    <div className="col-span-full flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg bg-muted/20">
                        <Terminal className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold">No integrations yet</h3>
                        <p className="text-muted-foreground mb-4">Create your first integration to get an API key.</p>
                        <Button onClick={() => setIsCreateOpen(true)}>Create Integration</Button>
                    </div>
                )}
            </div>

            <IntegrationDialog
                open={isCreateOpen}
                onOpenChange={(open) => {
                    setIsCreateOpen(open);
                    if (!open) setSelectedIntegration(null);
                }}
                onSuccess={() => {
                    loadIntegrations();
                    // If created (not edited) and has key, maybe show it?
                    // The dialog handles showing the key.
                }}
                editingIntegration={selectedIntegration}
            />

            {selectedIntegration && (
                <IntegrationLogsDialog
                    open={logsOpen}
                    onOpenChange={setLogsOpen}
                    integration={selectedIntegration}
                />
            )}

            <Dialog open={docsOpen} onOpenChange={setDocsOpen}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Developer API Documentation</DialogTitle>
                        <DialogDescription>
                            Everything you need to integrate with the Comms Centre API.
                        </DialogDescription>
                    </DialogHeader>
                    <IntegrationDocs />
                </DialogContent>
            </Dialog>
        </div>
    );
}

function IntegrationCard({
    integration,
    onDelete,
    onViewLogs,
    onEdit
}: {
    integration: IntegrationConfig,
    onDelete: () => void,
    onViewLogs: () => void,
    onEdit: () => void
}) {
    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                    <CardTitle className="text-lg font-semibold">{integration.name}</CardTitle>
                    <Badge variant={integration.enabled ? 'default' : 'secondary'}>
                        {integration.enabled ? 'Active' : 'Disabled'}
                    </Badge>
                </div>
                <CardDescription className="font-mono text-xs">{integration.slug}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-2">
                    {integration.channelsAllowed.map(c => (
                        <Badge key={c} variant="outline" className="capitalize">
                            {c === 'email' && <Mail className="mr-1 h-3 w-3" />}
                            {c === 'sms' && <MessageSquare className="mr-1 h-3 w-3" />}
                            {c === 'telegram' && <Send className="mr-1 h-3 w-3" />}
                            {c}
                        </Badge>
                    ))}
                </div>

                <div className="text-sm text-muted-foreground">
                    <div className="flex justify-between py-1 border-b">
                        <span>Rate Limit</span>
                        <span>{integration.rateLimitPerMin}/min</span>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                        <span>API Key</span>
                        <span className="font-mono">••••••••</span>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={onEdit}>Edit</Button>
                    <Button variant="outline" size="sm" className="flex-1" onClick={onViewLogs}>Logs</Button>
                    <Button variant="destructive" size="icon" onClick={onDelete}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

// ... Additional components (Dialogs, Docs) will be added in subsequent edits to keep file size manageable if needed, 
// but for now I'll write the whole file structure.

function IntegrationDialog({
    open,
    onOpenChange,
    onSuccess,
    editingIntegration
}: {
    open: boolean,
    onOpenChange: (open: boolean) => void,
    onSuccess: (i: IntegrationConfig) => void,
    editingIntegration: IntegrationConfig | null
}) {
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [channels, setChannels] = useState<string[]>(['email']);
    const [notifySuccess, setNotifySuccess] = useState(false);
    const [notifyFailure, setNotifyFailure] = useState(true);
    const [newApiKey, setNewApiKey] = useState<string | null>(null);

    useEffect(() => {
        if (editingIntegration) {
            setName(editingIntegration.name);
            setSlug(editingIntegration.slug);
            setChannels(editingIntegration.channelsAllowed);
            setNotifySuccess(editingIntegration.notifyOnSuccess);
            setNotifyFailure(editingIntegration.notifyOnFailure);
        } else {
            setName('');
            setSlug('');
            setChannels(['email']);
            setNotifySuccess(false);
            setNotifyFailure(true);
            setNewApiKey(null);
        }
    }, [editingIntegration, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (editingIntegration) {
                const { integration } = await api.integrations.update(editingIntegration.id, {
                    name,
                    enabled: true, // assume re-enabling if editing? Actually should have toggle.
                    channelsAllowed: channels as any,
                    notifyOnSuccess: notifySuccess,
                    notifyOnFailure: notifyFailure,
                });
                onSuccess(integration);
                onOpenChange(false);
            } else {
                const { integration } = await api.integrations.create({
                    name,
                    slug: slug || name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
                    channelsAllowed: channels as any,
                    notifyOnSuccess: notifySuccess,
                    notifyOnFailure: notifyFailure,
                });
                // Show API Key
                if ('apiKey' in integration && integration.apiKey) {
                    setNewApiKey(integration.apiKey);
                } else {
                    onSuccess(integration);
                    onOpenChange(false);
                }
            }
        } catch (error) {
            console.error('Failed to save integration:', error);
            alert('Failed to save');
        } finally {
            setLoading(false);
        }
    };

    const handleCopyKey = () => {
        if (newApiKey) {
            navigator.clipboard.writeText(newApiKey);
            alert('Copied to clipboard!');
        }
    };

    if (newApiKey) {
        return (
            <Dialog open={open} onOpenChange={(val) => { if (!val) onOpenChange(false); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Integration Created</DialogTitle>
                        <DialogDescription>
                            Please copy your API key now. You won't be able to see it again.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="p-4 bg-muted rounded-md flex items-center justify-between gap-2">
                        <code className="font-mono text-sm break-all">{newApiKey}</code>
                        <Button size="icon" variant="ghost" onClick={handleCopyKey}>
                            <Copy className="h-4 w-4" />
                        </Button>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => {
                            setNewApiKey(null);
                            onOpenChange(false);
                            onSuccess({} as any); // trigger reload
                        }}>Done</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{editingIntegration ? 'Edit Integration' : 'New Integration'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label>Name</Label>
                        <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Cleaning Report" required />
                    </div>
                    <div>
                        <Label>Slug (URL-safe ID)</Label>
                        <Input
                            value={slug}
                            onChange={e => setSlug(e.target.value)}
                            placeholder="cleaning-report"
                            disabled={!!editingIntegration}
                            className="font-mono text-sm"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Allowed Channels</Label>
                        <div className="flex gap-4">
                            {['email', 'sms', 'telegram'].map(c => (
                                <div key={c} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`c-${c}`}
                                        checked={channels.includes(c)}
                                        onCheckedChange={(chk) => {
                                            if (chk) setChannels([...channels, c]);
                                            else setChannels(channels.filter(x => x !== c));
                                        }}
                                    />
                                    <label htmlFor={`c-${c}`} className="capitalize cursor-pointer">{c}</label>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Notifications</Label>
                        <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="n-fail"
                                    checked={notifyFailure}
                                    onCheckedChange={(chk) => setNotifyFailure(!!chk)}
                                />
                                <label htmlFor="n-fail" className="cursor-pointer">Notify me on failure</label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="n-success"
                                    checked={notifySuccess}
                                    onCheckedChange={(chk) => setNotifySuccess(!!chk)}
                                />
                                <label htmlFor="n-success" className="cursor-pointer">Notify me on success</label>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={loading}>Save</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function IntegrationLogsDialog({
    open,
    onOpenChange,
    integration
}: {
    open: boolean,
    onOpenChange: (open: boolean) => void,
    integration: IntegrationConfig
}) {
    const [logs, setLogs] = useState<IntegrationLog[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && integration) {
            setLoading(true);
            api.integrations.getLogs(integration.id)
                .then(({ logs }) => setLogs(logs))
                .catch(console.error)
                .finally(() => setLoading(false));
        }
    }, [open, integration]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Integration Logs: {integration.name}</DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="py-8 text-center">Loading logs...</div>
                ) : logs.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">No logs found.</div>
                ) : (
                    <div className="space-y-2">
                        {logs.map(log => (
                            <div key={log.id} className="border rounded-md p-3 text-sm">
                                <div className="flex justify-between mb-2">
                                    <Badge variant={
                                        log.status === 'success' ? 'default' :
                                            log.status === 'failed' ? 'destructive' : 'secondary'
                                    }>
                                        {log.status.toUpperCase()}
                                    </Badge>
                                    <span className="text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-2">
                                    <div>Channels: {log.channels.join(', ')}</div>
                                    <div className="truncate">Recipients: {log.recipients.join(', ')}</div>
                                </div>
                                {log.errorMessage && (
                                    <div className="bg-destructive/10 text-destructive p-2 rounded text-xs font-mono">
                                        {log.errorMessage}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

function IntegrationDocs() {
    const cleanReportExample = `
import requests
import base64
from datetime import date

API_URL = "https://comms.paradisestayz.com.au/api/integrations/v1/send"
API_KEY = "sk_live_..."

def send_report(file_path):
    with open(file_path, "rb") as f:
        pdf_b64 = base64.b64encode(f.read()).decode("utf-8")

    payload = {
        "channels": ["email"],
        "to": ["cleaner@example.com"],
        "subject": f"Cleaning Report {date.today()}",
        "body": "Please find attached today's cleaning report.",
        "html": "<h1>Cleaning Report</h1><p>See attached.</p>",
        "attachments": [
            {
                "filename": "report.pdf",
                "content": pdf_b64,
                "contentType": "application/pdf"
            }
        ]
    }
    
    headers = {
        "x-integration-key": API_KEY,
        "Content-Type": "application/json"
    }

    resp = requests.post(API_URL, json=payload, headers=headers)
    print(resp.json())

# Usage
# send_report("daily_report.pdf")
`.trim();

    return (
        <div className="space-y-6">
            <div className="prose prose-sm max-w-none">
                <p>
                    Use the Integrations API to trigger communications from external systems (like VPS scripts, existing CRMs, or legacy systems).
                    Requests are authenticated via the <code>x-integration-key</code> header.
                </p>

                <h3>Endpoint</h3>
                <pre className="bg-muted p-2 rounded">POST https://comms.paradisestayz.com.au/api/integrations/v1/send</pre>

                <h3>Python Example: Sending PDF Report</h3>
                <div className="relative">
                    <pre className="bg-slate-950 text-slate-50 p-4 rounded-md overflow-x-auto">
                        <code>{cleanReportExample}</code>
                    </pre>
                </div>

                <h3>Request Body</h3>
                <table className="w-full text-left text-sm border-collapse mb-6">
                    <thead>
                        <tr className="border-b">
                            <th className="py-2">Field</th>
                            <th className="py-2">Type</th>
                            <th className="py-2">Required</th>
                            <th className="py-2">Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b">
                            <td className="py-2 font-mono text-primary">channels</td>
                            <td className="py-2">string[]</td>
                            <td className="py-2">Yes</td>
                            <td className="py-2">One or more of: <code>email</code>, <code>sms</code>, <code>telegram</code></td>
                        </tr>
                        <tr className="border-b">
                            <td className="py-2 font-mono text-primary">to</td>
                            <td className="py-2">string[]</td>
                            <td className="py-2">No</td>
                            <td className="py-2">
                                Recipient addresses.
                                <ul className="list-disc ml-4 mt-1 text-xs">
                                    <li><b>email</b>: Full email address</li>
                                    <li><b>sms</b>: E164 phone number (+61...)</li>
                                    <li><b>telegram</b>: Numeric Chat ID</li>
                                </ul>
                                Defaults to configured integration recipients if omitted.
                            </td>
                        </tr>
                        <tr className="border-b">
                            <td className="py-2 font-mono text-primary">from</td>
                            <td className="py-2">string</td>
                            <td className="py-2">No</td>
                            <td className="py-2">Optional sender override (must be an allowed sender address).</td>
                        </tr>
                        <tr className="border-b">
                            <td className="py-2 font-mono text-primary">subject</td>
                            <td className="py-2">string</td>
                            <td className="py-2">Email only</td>
                            <td className="py-2">Subject line.</td>
                        </tr>
                        <tr className="border-b">
                            <td className="py-2 font-mono text-primary">body</td>
                            <td className="py-2">string</td>
                            <td className="py-2">Yes</td>
                            <td className="py-2">Plain text message content. Used as primary content for SMS/Telegram.</td>
                        </tr>
                        <tr className="border-b">
                            <td className="py-2 font-mono text-primary">html</td>
                            <td className="py-2">string</td>
                            <td className="py-2">No</td>
                            <td className="py-2">Optional HTML version of the message (Email only).</td>
                        </tr>
                        <tr>
                            <td className="py-2 font-mono text-primary">attachments</td>
                            <td className="py-2">object[]</td>
                            <td className="py-2">Email only</td>
                            <td className="py-2">
                                <code>{`[{ filename, content (base64), contentType }]`}</code>.
                                Max total size: 10MB.
                            </td>
                        </tr>
                    </tbody>
                </table>

                <h3>Response Format</h3>
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                    <div className="space-y-2">
                        <p className="text-xs font-semibold text-green-600">Success (200 OK)</p>
                        <pre className="bg-muted p-3 rounded text-[10px] overflow-x-auto">
                            {`{
  "success": true,
  "status": "success",
  "results": [
    { "channel": "email", "status": "sent", "messageId": "..." }
  ]
}`}
                        </pre>
                    </div>
                    <div className="space-y-2">
                        <p className="text-xs font-semibold text-red-600">Error (4xx/5xx)</p>
                        <pre className="bg-muted p-3 rounded text-[10px] overflow-x-auto">
                            {`{
  "error": "Validation error",
  "details": { ... }
}`}
                        </pre>
                    </div>
                </div>

                <h3>HTTP Status Codes</h3>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs border rounded-md p-4">
                    <div className="font-mono font-bold">400 Bad Request</div>
                    <div>Validation failed or missing required fields.</div>
                    <div className="font-mono font-bold">401 Unauthorized</div>
                    <div>Missing or invalid <code>x-integration-key</code>.</div>
                    <div className="font-mono font-bold">403 Forbidden</div>
                    <div>Channel or sender not allowed for this integration.</div>
                    <div className="font-mono font-bold">429 Too Many Requests</div>
                    <div>Rate limit exceeded (configured per integration).</div>
                    <div className="font-mono font-bold">500 Server Error</div>
                    <div>An internal error occurred during message delivery.</div>
                </div>
            </div>
        </div>
    );
}
