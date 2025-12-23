import { useEffect, useState } from 'react';
import { api, PromptVersion } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Save, Upload, History } from 'lucide-react';
import { AI_AGENT_NAME } from '@shared/constants';

export default function PromptPage() {
    const [published, setPublished] = useState<PromptVersion | null>(null);
    const [draft, setDraft] = useState('');
    const [versions, setVersions] = useState<PromptVersion[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const [pubRes, draftRes, versRes] = await Promise.all([
                api.prompt.getPublished(),
                api.prompt.getDraft(),
                api.prompt.getVersions(),
            ]);
            setPublished(pubRes.prompt);
            setDraft(draftRes.draft || pubRes.prompt.content);
            setVersions(versRes.versions);
        } catch (err) {
            console.error('Failed to load prompt:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const saveDraft = async () => {
        setSaving(true);
        try {
            await api.prompt.saveDraft(draft);
            alert('Draft saved!');
        } catch (err) {
            alert('Failed to save draft');
        } finally {
            setSaving(false);
        }
    };

    const publish = async () => {
        if (!confirm('Publish this prompt? It will be used for all new conversations.')) return;
        setSaving(true);
        try {
            const { prompt } = await api.prompt.publish(draft);
            setPublished(prompt);
            loadData();
            alert('Published!');
        } catch (err) {
            alert('Failed to publish');
        } finally {
            setSaving(false);
        }
    };

    const restoreVersion = (version: PromptVersion) => {
        setDraft(version.content);
        setShowHistory(false);
    };

    if (loading) {
        return <div className="p-8 text-[hsl(var(--muted-foreground))]">Loading...</div>;
    }

    return (
        <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">System Prompt</h1>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setShowHistory(!showHistory)}>
                        <History className="h-4 w-4 mr-2" />
                        History
                    </Button>
                    <Button variant="outline" onClick={saveDraft} disabled={saving}>
                        <Save className="h-4 w-4 mr-2" />
                        Save Draft
                    </Button>
                    <Button onClick={publish} disabled={saving}>
                        <Upload className="h-4 w-4 mr-2" />
                        Publish
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Editor */}
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                Edit Prompt
                                {draft !== published?.content && (
                                    <Badge variant="warning">Unsaved changes</Badge>
                                )}
                            </CardTitle>
                            <CardDescription>
                                This prompt instructs the LLM how to respond as "{AI_AGENT_NAME}"
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Textarea
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                className="min-h-[500px] font-mono text-sm"
                            />
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-4">
                    {/* Current Version */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Published Version</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm space-y-2">
                            <div>
                                <span className="text-[hsl(var(--muted-foreground))]">Version:</span>{' '}
                                {published?.version}
                            </div>
                            <div>
                                <span className="text-[hsl(var(--muted-foreground))]">Published:</span>{' '}
                                {published?.publishedAt
                                    ? new Date(published.publishedAt).toLocaleString()
                                    : 'Never'}
                            </div>
                            <div>
                                <span className="text-[hsl(var(--muted-foreground))]">By:</span>{' '}
                                {published?.publishedBy}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Version History */}
                    {showHistory && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Version History</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {versions.length === 0 ? (
                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">No history yet</p>
                                ) : (
                                    versions.map((v) => (
                                        <div
                                            key={v.version}
                                            className="flex items-center justify-between p-2 rounded-lg bg-[hsl(var(--muted))]"
                                        >
                                            <div className="text-sm">
                                                <p>v{v.version}</p>
                                                <p className="text-[hsl(var(--muted-foreground))]">
                                                    {new Date(v.publishedAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <Button size="sm" variant="ghost" onClick={() => restoreVersion(v)}>
                                                Restore
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Tips */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Tips</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm space-y-2">
                            <p>• Include property-specific details like check-in procedures</p>
                            <p>• Define when to escalate clearly</p>
                            <p>• Specify the JSON response format</p>
                            <p>• Keep SMS guidance concise (160 chars)</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
