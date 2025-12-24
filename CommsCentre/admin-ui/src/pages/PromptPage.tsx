import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, PromptVersion } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Save, Upload, History, ChevronDown, ChevronRight, AlertTriangle, Wand2, BookOpen } from 'lucide-react';

export default function PromptPage() {
    const [published, setPublished] = useState<PromptVersion | null>(null);
    const [draft, setDraft] = useState('');
    const [versions, setVersions] = useState<PromptVersion[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

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
        setShowAdvanced(true); // Show editor when restoring
    };

    if (loading) {
        return <div className="p-8 text-[hsl(var(--muted-foreground))]">Loading...</div>;
    }

    return (
        <div className="p-8 space-y-6">
            <div>
                <h1 className="text-2xl font-bold">System Prompt</h1>
                <p className="text-[hsl(var(--muted-foreground))]">
                    The AI uses this prompt to understand how to respond to guests
                </p>
            </div>

            {/* Info Card */}
            <Card className="bg-[hsl(var(--primary)/0.1)] border-[hsl(var(--primary)/0.3)]">
                <CardContent className="py-4">
                    <div className="flex items-start gap-4">
                        <div className="flex-1">
                            <p className="text-sm mb-2">
                                <strong>The prompt is automatically generated</strong> from your Setup and Knowledge Base settings.
                                For most use cases, you don't need to edit it directly.
                            </p>
                            <div className="flex gap-4">
                                <Link
                                    to="/setup"
                                    className="inline-flex items-center text-sm text-[hsl(var(--primary))] hover:underline"
                                >
                                    <Wand2 className="h-4 w-4 mr-1" />
                                    Edit Setup
                                </Link>
                                <Link
                                    to="/knowledge"
                                    className="inline-flex items-center text-sm text-[hsl(var(--primary))] hover:underline"
                                >
                                    <BookOpen className="h-4 w-4 mr-1" />
                                    Edit Knowledge Base
                                </Link>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Preview / Editor */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Read-only Preview */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                Current Prompt
                                {draft !== published?.content && (
                                    <Badge variant="warning">Unsaved changes</Badge>
                                )}
                            </CardTitle>
                            <CardDescription>
                                This is the prompt currently being used by the AI
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="bg-[hsl(var(--muted))] rounded-lg p-4 font-mono text-sm whitespace-pre-wrap max-h-[400px] overflow-auto">
                                {published?.content || 'No prompt published yet'}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Advanced Toggle */}
                    <div
                        className="flex items-center gap-2 cursor-pointer hover:text-[hsl(var(--primary))] transition-colors"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                    >
                        {showAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <span className="text-sm font-medium">Advanced: Edit Raw Prompt</span>
                    </div>

                    {showAdvanced && (
                        <Card className="border-[hsl(var(--destructive)/0.5)]">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-[hsl(var(--destructive))]" />
                                    Edit Raw Prompt
                                </CardTitle>
                                <CardDescription>
                                    <span className="text-[hsl(var(--destructive))]">Warning:</span> Manual edits here may be overwritten if you change Setup or Knowledge Base settings.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Textarea
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                    className="min-h-[400px] font-mono text-sm"
                                />
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" onClick={saveDraft} disabled={saving}>
                                        <Save className="h-4 w-4 mr-2" />
                                        Save Draft
                                    </Button>
                                    <Button onClick={publish} disabled={saving}>
                                        <Upload className="h-4 w-4 mr-2" />
                                        Publish
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
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
                                {published?.version || 'None'}
                            </div>
                            <div>
                                <span className="text-[hsl(var(--muted-foreground))]">Published:</span>{' '}
                                {published?.publishedAt
                                    ? new Date(published.publishedAt).toLocaleString()
                                    : 'Never'}
                            </div>
                            <div>
                                <span className="text-[hsl(var(--muted-foreground))]">By:</span>{' '}
                                {published?.publishedBy || 'N/A'}
                            </div>
                        </CardContent>
                    </Card>

                    {/* History Toggle */}
                    <Button variant="outline" className="w-full" onClick={() => setShowHistory(!showHistory)}>
                        <History className="h-4 w-4 mr-2" />
                        {showHistory ? 'Hide History' : 'Show History'}
                    </Button>

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
                            <p>• Use <Link to="/setup" className="text-[hsl(var(--primary))] underline">Setup</Link> to configure assistant name and defaults</p>
                            <p>• Add Q&A to the <Link to="/knowledge" className="text-[hsl(var(--primary))] underline">Knowledge Base</Link></p>
                            <p>• Only use Advanced editing for custom formatting</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

