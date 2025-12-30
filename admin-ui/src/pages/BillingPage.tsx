import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api, CreditTransaction, CreditBalanceResponse } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Wallet, TrendingDown, TrendingUp, MessageSquare, Mail, Phone } from 'lucide-react';

export function BillingPage() {
    const { canViewBilling, companyId, companyName, isSuperAdmin } = useAuth();
    const navigate = useNavigate();
    const [balanceData, setBalanceData] = useState<CreditBalanceResponse | null>(null);
    const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!canViewBilling) {
            navigate('/');
            return;
        }
        loadData();
    }, [canViewBilling, companyId, navigate]);

    const loadData = async () => {
        try {
            setLoading(true);

            // For super admin, we need to pass companyId
            const targetCompanyId = isSuperAdmin ? companyId : undefined;

            const [balance, txns] = await Promise.all([
                api.credits.getBalance(targetCompanyId),
                api.credits.getTransactions(50, 0, targetCompanyId),
            ]);

            setBalanceData(balance);
            setTransactions(txns.transactions);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getTransactionIcon = (type: CreditTransaction['type']) => {
        switch (type) {
            case 'sms_usage':
            case 'sms_manual_usage':
                return <MessageSquare className="h-4 w-4" />;
            case 'email_usage':
            case 'email_manual_usage':
                return <Mail className="h-4 w-4" />;
            case 'phone_rental':
                return <Phone className="h-4 w-4" />;
            case 'purchase':
            case 'trial_grant':
                return <TrendingUp className="h-4 w-4 text-green-500" />;
            default:
                return <Wallet className="h-4 w-4" />;
        }
    };

    const getTransactionLabel = (type: CreditTransaction['type']) => {
        const labels: Record<string, string> = {
            'purchase': 'Credit Purchase',
            'sms_usage': 'SMS (AI)',
            'sms_manual_usage': 'SMS (Manual)',
            'email_usage': 'Email (AI)',
            'email_manual_usage': 'Email (Manual)',
            'phone_rental': 'Phone Number Rental',
            'email_rental': 'Email Address Rental',
            'trial_grant': 'Trial Credits',
            'adjustment': 'Adjustment',
            'refund': 'Refund',
        };
        return labels[type] || type;
    };

    if (!canViewBilling) {
        return null;
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-muted-foreground">Loading billing information...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                {error}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Billing & Credits</h1>
                <p className="text-muted-foreground mt-1">
                    {companyName || 'Your company'} credit balance and usage
                </p>
            </div>

            {/* Balance Card */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="md:col-span-1">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Credit Balance</CardTitle>
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold">
                            {balanceData?.balance.toLocaleString()}
                            <span className="text-lg text-muted-foreground ml-2">credits</span>
                        </div>
                        {balanceData?.company.allowNegativeBalance && (
                            <p className="text-xs text-muted-foreground mt-2">
                                ∞ Overdraft enabled
                            </p>
                        )}
                        {balanceData?.company.status === 'trial' && (
                            <Badge variant="secondary" className="mt-2">Trial Account</Badge>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Used</CardTitle>
                        <TrendingDown className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                            {balanceData?.usageSummary.totalUsed.toLocaleString() || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">Credits consumed</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Added</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {balanceData?.usageSummary.totalAdded.toLocaleString() || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">Credits received</p>
                    </CardContent>
                </Card>
            </div>

            {/* Usage Breakdown */}
            {balanceData?.usageSummary.byType && Object.keys(balanceData.usageSummary.byType).length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Usage by Type</CardTitle>
                        <CardDescription>Where your credits are being spent</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-4">
                            {Object.entries(balanceData.usageSummary.byType)
                                .filter(([_, value]) => value > 0)
                                .map(([type, value]) => (
                                    <div key={type} className="flex items-center gap-2">
                                        {getTransactionIcon(type as CreditTransaction['type'])}
                                        <div>
                                            <div className="font-medium">{getTransactionLabel(type as CreditTransaction['type'])}</div>
                                            <div className="text-sm text-muted-foreground">{value} credits</div>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Transaction History */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Transactions</CardTitle>
                    <CardDescription>Your credit usage history</CardDescription>
                </CardHeader>
                <CardContent>
                    {transactions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No transactions yet
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead className="text-right">Balance After</TableHead>
                                    <TableHead>Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {transactions.map((txn) => (
                                    <TableRow key={txn.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {getTransactionIcon(txn.type)}
                                                <span>{getTransactionLabel(txn.type)}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {txn.description || '-'}
                                        </TableCell>
                                        <TableCell className={`text-right font-mono ${txn.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {txn.amount >= 0 ? '+' : ''}{txn.amount}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            {txn.balanceAfter}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {new Date(txn.createdAt).toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Credit Pricing Info */}
            <Card className="bg-slate-50">
                <CardHeader>
                    <CardTitle className="text-lg">Credit Costs</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-3 text-sm">
                        <div>
                            <div className="font-medium">SMS</div>
                            <div className="text-muted-foreground">AI: 2 credits / Manual: 1 credit</div>
                        </div>
                        <div>
                            <div className="font-medium">Email</div>
                            <div className="text-muted-foreground">AI: 2 credits / Manual: 1 credit</div>
                        </div>
                        <div>
                            <div className="font-medium">Monthly Rentals</div>
                            <div className="text-muted-foreground">Phone: 50 / Email: 20 credits</div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default BillingPage;
