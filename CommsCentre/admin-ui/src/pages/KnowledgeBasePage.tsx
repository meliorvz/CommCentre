import { useState, useEffect } from 'react';
import { api, KnowledgeCategory, KnowledgeItem } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Save, ChevronDown, ChevronRight, GripVertical, Edit2, X } from 'lucide-react';

export default function KnowledgeBasePage() {
    const [categories, setCategories] = useState<KnowledgeCategory[]>([]);
    const [items, setItems] = useState<KnowledgeItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [editingItem, setEditingItem] = useState<string | null>(null);
    const [newItemCategory, setNewItemCategory] = useState<string | null>(null);
    const [editingCategory, setEditingCategory] = useState<string | null>(null);
    const [newCategoryName, setNewCategoryName] = useState('');

    // Form state for new/editing item
    const [itemForm, setItemForm] = useState({ question: '', answer: '' });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [catRes, itemsRes] = await Promise.all([
                api.knowledge.getCategories(),
                api.knowledge.getItems(),
            ]);
            setCategories(catRes.categories.sort((a, b) => a.order - b.order));
            setItems(itemsRes.items);
            // Expand first category by default
            if (catRes.categories.length > 0) {
                setExpandedCategories(new Set([catRes.categories[0].id]));
            }
        } catch (err) {
            console.error('Failed to load knowledge base:', err);
        } finally {
            setLoading(false);
        }
    };

    const toggleCategory = (categoryId: string) => {
        const newExpanded = new Set(expandedCategories);
        if (newExpanded.has(categoryId)) {
            newExpanded.delete(categoryId);
        } else {
            newExpanded.add(categoryId);
        }
        setExpandedCategories(newExpanded);
    };

    const startAddItem = (categoryId: string) => {
        setNewItemCategory(categoryId);
        setItemForm({ question: '', answer: '' });
        setEditingItem(null);
    };

    const startEditItem = (item: KnowledgeItem) => {
        setEditingItem(item.id);
        setItemForm({ question: item.question, answer: item.answer });
        setNewItemCategory(null);
    };

    const cancelEdit = () => {
        setEditingItem(null);
        setNewItemCategory(null);
        setItemForm({ question: '', answer: '' });
    };

    const saveItem = async (categoryId: string, itemId?: string) => {
        if (!itemForm.question.trim() || !itemForm.answer.trim()) {
            alert('Please fill in both question and answer');
            return;
        }

        setSaving(true);
        try {
            const id = itemId || crypto.randomUUID();
            const { item } = await api.knowledge.saveItem(id, {
                categoryId,
                question: itemForm.question.trim(),
                answer: itemForm.answer.trim(),
            });

            if (itemId) {
                // Update existing
                setItems(items.map(i => i.id === itemId ? item : i));
            } else {
                // Add new
                setItems([...items, item]);
            }

            cancelEdit();
        } catch (err) {
            console.error('Failed to save item:', err);
            alert('Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const deleteItem = async (itemId: string) => {
        if (!confirm('Delete this knowledge item?')) return;

        try {
            await api.knowledge.deleteItem(itemId);
            setItems(items.filter(i => i.id !== itemId));
        } catch (err) {
            console.error('Failed to delete item:', err);
            alert('Failed to delete');
        }
    };

    const addCategory = async () => {
        const name = prompt('Enter category name:');
        if (!name?.trim()) return;

        const newCategory: KnowledgeCategory = {
            id: crypto.randomUUID(),
            name: name.trim(),
            order: categories.length,
        };

        const updatedCategories = [...categories, newCategory];
        try {
            await api.knowledge.updateCategories(updatedCategories);
            setCategories(updatedCategories);
            setExpandedCategories(new Set([...expandedCategories, newCategory.id]));
        } catch (err) {
            console.error('Failed to add category:', err);
            alert('Failed to add category');
        }
    };

    const startEditCategory = (category: KnowledgeCategory) => {
        setEditingCategory(category.id);
        setNewCategoryName(category.name);
    };

    const saveCategory = async (categoryId: string) => {
        if (!newCategoryName.trim()) return;

        const updatedCategories = categories.map(c =>
            c.id === categoryId ? { ...c, name: newCategoryName.trim() } : c
        );

        try {
            await api.knowledge.updateCategories(updatedCategories);
            setCategories(updatedCategories);
            setEditingCategory(null);
        } catch (err) {
            console.error('Failed to update category:', err);
            alert('Failed to update category');
        }
    };

    const deleteCategory = async (categoryId: string) => {
        const categoryItems = items.filter(i => i.categoryId === categoryId);
        if (categoryItems.length > 0) {
            if (!confirm(`This category has ${categoryItems.length} items. Delete them all?`)) {
                return;
            }
            // Delete all items in this category
            for (const item of categoryItems) {
                await api.knowledge.deleteItem(item.id);
            }
            setItems(items.filter(i => i.categoryId !== categoryId));
        }

        const updatedCategories = categories.filter(c => c.id !== categoryId);
        try {
            await api.knowledge.updateCategories(updatedCategories);
            setCategories(updatedCategories);
        } catch (err) {
            console.error('Failed to delete category:', err);
            alert('Failed to delete category');
        }
    };

    if (loading) {
        return <div className="p-8 text-[hsl(var(--muted-foreground))]">Loading...</div>;
    }

    return (
        <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Knowledge Base</h1>
                    <p className="text-[hsl(var(--muted-foreground))]">
                        Add information the AI can use to answer guest questions
                    </p>
                </div>
                <Button onClick={addCategory}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Category
                </Button>
            </div>

            {categories.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="text-[hsl(var(--muted-foreground))] mb-4">
                            No categories yet. Add a category to get started.
                        </p>
                        <Button onClick={addCategory}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add First Category
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {categories.map((category) => {
                        const categoryItems = items.filter(i => i.categoryId === category.id);
                        const isExpanded = expandedCategories.has(category.id);

                        return (
                            <Card key={category.id}>
                                <CardHeader
                                    className="cursor-pointer hover:bg-[hsl(var(--muted)/0.5)] transition-colors"
                                    onClick={() => toggleCategory(category.id)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <GripVertical className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                                            {isExpanded ? (
                                                <ChevronDown className="h-4 w-4" />
                                            ) : (
                                                <ChevronRight className="h-4 w-4" />
                                            )}
                                            {editingCategory === category.id ? (
                                                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                    <Input
                                                        value={newCategoryName}
                                                        onChange={(e) => setNewCategoryName(e.target.value)}
                                                        className="h-8 w-48"
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') saveCategory(category.id);
                                                            if (e.key === 'Escape') setEditingCategory(null);
                                                        }}
                                                    />
                                                    <Button size="sm" variant="ghost" onClick={() => saveCategory(category.id)}>
                                                        <Save className="h-3 w-3" />
                                                    </Button>
                                                    <Button size="sm" variant="ghost" onClick={() => setEditingCategory(null)}>
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <CardTitle className="text-lg">{category.name}</CardTitle>
                                            )}
                                            <span className="text-sm text-[hsl(var(--muted-foreground))]">
                                                ({categoryItems.length} items)
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => startEditCategory(category)}
                                            >
                                                <Edit2 className="h-3 w-3" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => deleteCategory(category.id)}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                    {category.exampleQuestions && (
                                        <CardDescription className="ml-11">
                                            Example topics: {category.exampleQuestions}
                                        </CardDescription>
                                    )}
                                </CardHeader>

                                {isExpanded && (
                                    <CardContent className="space-y-4">
                                        {categoryItems.map((item) => (
                                            <div
                                                key={item.id}
                                                className="border rounded-lg p-4 bg-[hsl(var(--muted)/0.3)]"
                                            >
                                                {editingItem === item.id ? (
                                                    <div className="space-y-3">
                                                        <div>
                                                            <Label>Question / Topic</Label>
                                                            <Input
                                                                value={itemForm.question}
                                                                onChange={(e) => setItemForm({ ...itemForm, question: e.target.value })}
                                                                placeholder="e.g. What is the Wi-Fi password?"
                                                            />
                                                        </div>
                                                        <div>
                                                            <Label>Answer</Label>
                                                            <Textarea
                                                                value={itemForm.answer}
                                                                onChange={(e) => setItemForm({ ...itemForm, answer: e.target.value })}
                                                                placeholder="The AI will use this information when answering similar questions"
                                                                rows={3}
                                                            />
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <Button
                                                                size="sm"
                                                                onClick={() => saveItem(item.categoryId, item.id)}
                                                                disabled={saving}
                                                            >
                                                                <Save className="h-3 w-3 mr-2" />
                                                                {saving ? 'Saving...' : 'Save'}
                                                            </Button>
                                                            <Button size="sm" variant="outline" onClick={cancelEdit}>
                                                                Cancel
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <p className="font-medium">{item.question}</p>
                                                            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1 whitespace-pre-wrap">
                                                                {item.answer}
                                                            </p>
                                                        </div>
                                                        <div className="flex gap-1">
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => startEditItem(item)}
                                                            >
                                                                <Edit2 className="h-3 w-3" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => deleteItem(item.id)}
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}

                                        {/* Add new item form */}
                                        {newItemCategory === category.id ? (
                                            <div className="border rounded-lg p-4 border-dashed border-[hsl(var(--primary))]">
                                                <div className="space-y-3">
                                                    <div>
                                                        <Label>Question / Topic</Label>
                                                        <Input
                                                            value={itemForm.question}
                                                            onChange={(e) => setItemForm({ ...itemForm, question: e.target.value })}
                                                            placeholder="e.g. What is the Wi-Fi password?"
                                                            autoFocus
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label>Answer</Label>
                                                        <Textarea
                                                            value={itemForm.answer}
                                                            onChange={(e) => setItemForm({ ...itemForm, answer: e.target.value })}
                                                            placeholder="The AI will use this information when answering similar questions"
                                                            rows={3}
                                                        />
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            size="sm"
                                                            onClick={() => saveItem(category.id)}
                                                            disabled={saving}
                                                        >
                                                            <Save className="h-3 w-3 mr-2" />
                                                            {saving ? 'Saving...' : 'Add'}
                                                        </Button>
                                                        <Button size="sm" variant="outline" onClick={cancelEdit}>
                                                            Cancel
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <Button
                                                variant="outline"
                                                className="w-full border-dashed"
                                                onClick={() => startAddItem(category.id)}
                                            >
                                                <Plus className="h-4 w-4 mr-2" />
                                                Add Item
                                            </Button>
                                        )}
                                    </CardContent>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
