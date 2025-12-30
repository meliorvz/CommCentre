import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api, Company, CreateCompanyData } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Building2, Users, CreditCard, Plus, DollarSign, TrendingUp } from 'lucide-react';

export function SuperAdminPage() {
    const { isSuperAdmin } = useAuth();
    const navigate = useNavigate();
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [trialCost, setTrialCost] = useState<{ credits: number; cost: string } | null>(null);

    // Dialog state
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [showAddCreditsDialog, setShowAddCreditsDialog] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [createForm, setCreateForm] = useState<CreateCompanyData>({
        name: '',
        slug: '',
        grantTrialCredits: true,
    });
    const [creditsAmount, setCreditsAmount] = useState('');
    const [creditsDescription, setCreditsDescription] = useState('');

    useEffect(() => {
        if (!isSuperAdmin) {
            navigate('/');
            return;
        }
        loadCompanies();
        loadTrialCost();
    }, [isSuperAdmin, navigate]);

    const loadCompanies = async () => {
        try {
            setLoading(true);
            const { companies } = await api.companies.list();
            setCompanies(companies);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const loadTrialCost = async () => {
        try {
            const data = await api.companies.getTrialCost();
            setTrialCost({
                credits: data.trialCredits,
                cost: data.estimatedCostFormatted,
            });
        } catch (err) {
            console.error('Failed to load trial cost:', err);
        }
    };

    const handleCreateCompany = async () => {
        try {
            await api.companies.create(createForm);
            setShowCreateDialog(false);
            setCreateForm({ name: '', slug: '', grantTrialCredits: true });
            await loadCompanies();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleAddCredits = async () => {
        if (!selectedCompany) return;
        try {
            await api.companies.addCredits(
                selectedCompany.id,
                parseInt(creditsAmount),
                creditsDescription || undefined
            );
            setShowAddCreditsDialog(false);
            setSelectedCompany(null);
            setCreditsAmount('');
            setCreditsDescription('');
            await loadCompanies();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const generateSlug = (name: string) => {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    };

    const getStatusBadgeVariant = (status: Company['status']) => {
        switch (status) {
            case 'active': return 'default';
            case 'suspended': return 'destructive';
            case 'trial': return 'secondary';
            default: return 'outline';
        }
    };

    // Calculate totals
    const totalCredits = companies.reduce((sum, c) => sum + c.creditBalance, 0);
    const totalUsers = companies.reduce((sum, c) => sum + (c.userCount || 0), 0);
    const totalProperties = companies.reduce((sum, c) => sum + (c.propertyCount || 0), 0);

    if (!isSuperAdmin) {
        return null;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Platform Administration</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage companies, credits, and platform settings
                    </p>
                </div>
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            New Company
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create New Company</DialogTitle>
                            <DialogDescription>
                                Add a new company to the platform. They'll receive {trialCost?.credits || 200} trial credits.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div>
                                <Label>Company Name</Label>
                                <Input
                                    value={createForm.name}
                                    onChange={(e) => {
                                        setCreateForm({
                                            ...createForm,
                                            name: e.target.value,
                                            slug: generateSlug(e.target.value),
                                        });
                                    }}
                                    placeholder="Acme Property Management"
                                />
                            </div>
                            <div>
                                <Label>URL Slug</Label>
                                <Input
                                    value={createForm.slug}
                                    onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value })}
                                    placeholder="acme-property"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Used in URLs. Lowercase letters, numbers, and hyphens only.
                                </p>
                            </div>
                            <div>
                                <Label>Escalation Phone (Optional)</Label>
                                <Input
                                    value={createForm.escalationPhone || ''}
                                    onChange={(e) => setCreateForm({ ...createForm, escalationPhone: e.target.value })}
                                    placeholder="+61400000000"
                                />
                            </div>
                            <div>
                                <Label>Escalation Email (Optional)</Label>
                                <Input
                                    type="email"
                                    value={createForm.escalationEmail || ''}
                                    onChange={(e) => setCreateForm({ ...createForm, escalationEmail: e.target.value })}
                                    placeholder="admin@example.com"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="grantTrialCredits"
                                    checked={createForm.grantTrialCredits}
                                    onChange={(e) => setCreateForm({ ...createForm, grantTrialCredits: e.target.checked })}
                                />
                                <Label htmlFor="grantTrialCredits" className="cursor-pointer">
                                    Grant {trialCost?.credits || 200} trial credits (est. {trialCost?.cost || '$10.00'} cost)
                                </Label>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleCreateCompany} disabled={!createForm.name || !createForm.slug}>
                                Create Company
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                    {error}
                    <button className="ml-4 underline" onClick={() => setError(null)}>Dismiss</button>
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{companies.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalUsers}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Properties</CardTitle>
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalProperties}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Credits in Circulation</CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalCredits.toLocaleString()}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Trial Cost Info */}
            {trialCost && (
                <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-blue-600" />
                            <span className="font-medium">New Customer Acquisition Cost:</span>
                            <span>{trialCost.credits} trial credits = ~{trialCost.cost}</span>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Companies Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Companies</CardTitle>
                    <CardDescription>All companies registered on the platform</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8 text-muted-foreground">Loading...</div>
                    ) : companies.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No companies yet. Create one to get started.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Company</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Credits</TableHead>
                                    <TableHead className="text-right">Users</TableHead>
                                    <TableHead className="text-right">Properties</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {companies.map((company) => (
                                    <TableRow key={company.id}>
                                        <TableCell>
                                            <div>
                                                <div className="font-medium">{company.name}</div>
                                                <div className="text-sm text-muted-foreground">{company.slug}</div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={getStatusBadgeVariant(company.status)}>
                                                {company.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            {company.creditBalance.toLocaleString()}
                                            {company.allowNegativeBalance && (
                                                <span className="text-xs text-muted-foreground ml-1">∞</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">{company.userCount || 0}</TableCell>
                                        <TableCell className="text-right">{company.propertyCount || 0}</TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {new Date(company.createdAt).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    setSelectedCompany(company);
                                                    setShowAddCreditsDialog(true);
                                                }}
                                            >
                                                <DollarSign className="h-4 w-4 mr-1" />
                                                Add Credits
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Add Credits Dialog */}
            <Dialog open={showAddCreditsDialog} onOpenChange={setShowAddCreditsDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Credits to {selectedCompany?.name}</DialogTitle>
                        <DialogDescription>
                            Current balance: {selectedCompany?.creditBalance.toLocaleString()} credits
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Amount</Label>
                            <Input
                                type="number"
                                value={creditsAmount}
                                onChange={(e) => setCreditsAmount(e.target.value)}
                                placeholder="100"
                                min="1"
                            />
                        </div>
                        <div>
                            <Label>Description (Optional)</Label>
                            <Input
                                value={creditsDescription}
                                onChange={(e) => setCreditsDescription(e.target.value)}
                                placeholder="Monthly top-up"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddCreditsDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleAddCredits} disabled={!creditsAmount || parseInt(creditsAmount) <= 0}>
                            Add {creditsAmount ? parseInt(creditsAmount).toLocaleString() : 0} Credits
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default SuperAdminPage;
