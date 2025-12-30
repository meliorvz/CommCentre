import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { HELP_SECTIONS, HelpArticle } from '@/lib/help-config';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Book, ChevronRight, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function HelpPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const articleId = searchParams.get('article');
    const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Initial load or URL change
    useEffect(() => {
        if (articleId) {
            const found = findArticleById(articleId);
            if (found) {
                setSelectedArticle(found);
                return;
            }
        }
        // Default to first article of first section
        if (HELP_SECTIONS.length > 0 && HELP_SECTIONS[0].articles.length > 0) {
            setSelectedArticle(HELP_SECTIONS[0].articles[0]);
        }
    }, [articleId]);

    const findArticleById = (id: string) => {
        for (const section of HELP_SECTIONS) {
            const found = section.articles.find(a => a.id === id);
            if (found) return found;
        }
        return null;
    };

    const handleArticleSelect = (article: HelpArticle) => {
        setSelectedArticle(article);
        setSearchParams({ article: article.id });
        setMobileMenuOpen(false);
    };

    return (
        <div className="flex h-[calc(100vh-theme(spacing.16))] overflow-hidden">
            {/* Sidebar Navigation */}
            <aside className={cn(
                "w-64 border-r bg-background flex-shrink-0 flex flex-col transition-all duration-300 absolute inset-y-0 left-0 z-20 md:relative",
                mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
            )}>
                <div className="p-4 border-b">
                    <h2 className="font-semibold text-lg flex items-center gap-2">
                        <Book className="h-5 w-5" />
                        Documentation
                    </h2>
                </div>
                <div className="flex-1 overflow-y-auto">
                    <div className="p-4 space-y-6">
                        {HELP_SECTIONS.map((section) => (
                            <div key={section.id}>
                                <h3 className="text-sm font-medium text-muted-foreground mb-2 px-2 uppercase tracking-wider">
                                    {section.title}
                                </h3>
                                <div className="space-y-1">
                                    {section.articles.map((article) => (
                                        <Button
                                            key={article.id}
                                            variant={selectedArticle?.id === article.id ? "secondary" : "ghost"}
                                            className="w-full justify-start text-sm font-normal"
                                            onClick={() => handleArticleSelect(article)}
                                        >
                                            {selectedArticle?.id === article.id && (
                                                <ChevronRight className="h-4 w-4 mr-2 text-primary" />
                                            )}
                                            {article.title}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                {/* Mobile overlay background */}
                {mobileMenuOpen && (
                    <div
                        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[-1] md:hidden"
                        onClick={() => setMobileMenuOpen(false)}
                    />
                )}
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-6 md:p-8 relative">
                <Button
                    variant="outline"
                    size="icon"
                    className="absolute top-4 left-4 md:hidden z-10"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                    <Menu className="h-4 w-4" />
                </Button>

                <div className="max-w-3xl mx-auto">
                    {selectedArticle ? (
                        <Card className="border-none shadow-none bg-transparent">
                            <CardContent className="p-0 prose prose-slate dark:prose-invert max-w-none">
                                <ReactMarkdown>
                                    {selectedArticle.content}
                                </ReactMarkdown>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                            Select an article to view documentation
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
