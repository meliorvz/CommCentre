import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api, CreditTransaction, CreditBalanceResponse, SubscriptionStatus, SubscriptionPlan } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Wallet, TrendingDown, TrendingUp, MessageSquare, Mail, Phone, Loader2, Info, CreditCard, ExternalLink, Zap, Check } from 'lucide-react';

export function BillingPage() {
    const { canViewBilling, companyId, companyName, isSuperAdmin } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [balanceData, setBalanceData] = useState<CreditBalanceResponse | null>(null);
    const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
    const [creditConfig, setCreditConfig] = useState<Record<string, number>>({});
    const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [portalLoading, setPortalLoading] = useState(false);
    const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Handle success/canceled from Stripe checkout
    useEffect(() => {
        if (searchParams.get('success') === 'true') {
            // Show success message and refresh data
            loadData();
            loadSubscription();
        }
    }, [searchParams]);

    useEffect(() => {
        // Super admin should go to Platform Admin for billing overview
        if (isSuperAdmin && !companyId) {
            navigate('/admin');
            return;
        }
        if (!canViewBilling) {
            navigate('/');
            return;
        }
        loadData();
        loadSubscription();
        loadPlans();
        loadCreditConfig();
    }, [canViewBilling, companyId, navigate, isSuperAdmin]);

    const loadData = async () => {
        try {
            setLoading(true);

            // For super admin with a company context, pass companyId
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

    const loadSubscription = async () => {
        try {
            const targetCompanyId = isSuperAdmin ? companyId : undefined;
            const sub = await api.stripe.getSubscription(targetCompanyId);
            setSubscription(sub);
        } catch (err) {
            // Subscription API may fail for non-subscribed companies, ignore
            console.log('No active subscription');
        }
    };

    const loadPlans = async () => {
        try {
            const { plans } = await api.stripe.getPlans();
            setPlans(plans);
        } catch (err) {
            console.log('Failed to load plans');
        }
    };

    const loadCreditConfig = async () => {
        try {
            const config = await api.credits.getConfig?.();
            if (config?.creditPricing) {
                const pricing: Record<string, number> = {};
                config.creditPricing.forEach((item: any) => {
                    pricing[item.key] = item.value;
                });
                setCreditConfig(pricing);
            }
        } catch {
            setCreditConfig({
                sms_cost: 2,
                email_cost: 1,
                call_forward_cost: 1,
                phone_rental: 50,
                email_rental: 20,
            });
        }
    };

    const handleManageSubscription = async () => {
        setPortalLoading(true);
        try {
            const { url } = await api.stripe.createPortal();
            window.location.href = url;
        } catch (err: any) {
            setError(err.message);
        } finally {
            setPortalLoading(false);
        }
    };

    const handleSubscribe = async (priceId: string, annual: boolean = false) => {
        setCheckoutLoading(priceId);
        try {
            const { url } = await api.stripe.createCheckout(priceId, annual);
            window.location.href = url;
        } catch (err: any) {
            setError(err.message);
        } finally {
            setCheckoutLoading(null);
        }
    };

    const getTransactionIcon = (type: CreditTransaction['type']) => {
        switch (type) {
            case 'sms_usage':
            case 'integration_sms_usage':
                return <MessageSquare className="h-4 w-4" />;
            case 'email_usage':
            case 'integration_email_usage':
                return <Mail className="h-4 w-4" />;
            case 'phone_rental':
            case 'call_forward_usage':
                return <Phone className="h-4 w-4" />;
            case 'purchase':
            case 'trial_grant':
            case 'subscription_grant':
                return <TrendingUp className="h-4 w-4 text-green-500" />;
            default:
                return <Wallet className="h-4 w-4" />;
        }
    };

    const getTransactionLabel = (type: CreditTransaction['type']) => {
        const labels: Record<string, string> = {
            'purchase': 'Credit Purchase',
            'sms_usage': 'SMS',
            'email_usage': 'Email',
            'integration_sms_usage': 'SMS (Integration)',
            'integration_email_usage': 'Email (Integration)',
            'call_forward_usage': 'Call Forward',
            'phone_rental': 'Phone Number Rental',
            'email_rental': 'Email Address Rental',
            'trial_grant': 'Trial Credits',
            'subscription_grant': 'Subscription Credits',
            'overage_charge': 'Overage Charge',
            'adjustment': 'Adjustment',
            'refund': 'Refund',
        };
        return labels[type] || type;
    };

    const formatTransactionAmount = (amount: number) => {
        const isCredit = amount >= 0;
        const absAmount = Math.abs(amount);

        if (isCredit) {
            return (
                <span className="text-green-600 font-mono">
                    +{absAmount} added
                </span>
            );
        }
        return (
            <span className="text-red-600 font-mono">
                {absAmount} spent
            </span>
        );
    };

    const formatCents = (cents: number) => {
        return `S$${(cents / 100).toFixed(0)}`;
    };

    const getStatusBadge = (status: string) => {
        const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
            active: 'default',
            trialing: 'secondary',
            past_due: 'destructive',
            canceled: 'outline',
            unpaid: 'destructive',
            none: 'outline',
        };
        return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
    };

    if (!canViewBilling) {
        return null;
    }

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center h-64">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span className="text-muted-foreground">Loading billing information...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6">
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                    {error}
                </div>
            </div>
        );
    }

    const hasSubscription = subscription?.subscription?.status === 'active' || subscription?.subscription?.status === 'trialing';

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Billing & Credits</h1>
                <p className="text-muted-foreground mt-1">
                    {companyName || 'Your company'} credit balance and subscription
                </p>
            </div>

            {/* Success message from Stripe */}
            {searchParams.get('success') === 'true' && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded flex items-center gap-2">
                    <Check className="h-5 w-5" />
                    Subscription activated successfully! Your credits have been added.
                </div>
            )}

            {/* Subscription Card */}
            <Card className="border-2 border-primary/20">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5" />
                            Subscription
                        </CardTitle>
                        <CardDescription>
                            {hasSubscription ? 'Manage your subscription and billing' : 'Subscribe to get monthly credits'}
                        </CardDescription>
                    </div>
                    {hasSubscription && (
                        <Button
                            variant="outline"
                            onClick={handleManageSubscription}
                            disabled={portalLoading}
                        >
                            {portalLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
                            Manage Subscription
                        </Button>
                    )}
                </CardHeader>
                <CardContent>
                    {hasSubscription && subscription ? (
                        <div className="grid gap-4 md:grid-cols-4">
                            <div>
                                <div className="text-sm text-muted-foreground">Plan</div>
                                <div className="font-medium text-lg">{subscription.plan?.name || 'Active Plan'}</div>
                                {subscription.subscription.isAnnual && (
                                    <Badge variant="secondary" className="mt-1">Annual (Save 20%)</Badge>
                                )}
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground">Status</div>
                                <div className="mt-1">{getStatusBadge(subscription.subscription.status)}</div>
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground">Credits This Period</div>
                                <div className="font-medium">
                                    {subscription.subscription.creditsRemaining} / {subscription.subscription.creditsAllocation}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {subscription.subscription.creditsUsed} used
                                </div>
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground">Next Billing</div>
                                <div className="font-medium">
                                    {subscription.subscription.currentPeriodEnd
                                        ? new Date(subscription.subscription.currentPeriodEnd).toLocaleDateString()
                                        : '-'}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-3">
                            {plans.map((plan) => (
                                <Card key={plan.id} className={`relative ${plan.allowsIntegrations ? 'border-primary' : ''}`}>
                                    {plan.allowsIntegrations && (
                                        <Badge className="absolute -top-2 -right-2">
                                            <Zap className="h-3 w-3 mr-1" />
                                            Pro
                                        </Badge>
                                    )}
                                    <CardHeader>
                                        <CardTitle>{plan.name}</CardTitle>
                                        <CardDescription>
                                            <span className="text-2xl font-bold text-foreground">{formatCents(plan.monthlyPriceCents)}</span>/mo
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <ul className="space-y-2 text-sm">
                                            <li className="flex items-center gap-2">
                                                <Check className="h-4 w-4 text-green-500" />
                                                {plan.creditsIncluded.toLocaleString()} credits/month
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <Check className="h-4 w-4 text-green-500" />
                                                {formatCents(plan.overagePriceCents)}/credit overage
                                            </li>
                                            {plan.allowsIntegrations && (
                                                <li className="flex items-center gap-2">
                                                    <Check className="h-4 w-4 text-green-500" />
                                                    API Integrations Access
                                                </li>
                                            )}
                                        </ul>
                                        <div className="space-y-2">
                                            <Button
                                                className="w-full"
                                                onClick={() => plan.stripeMonthlyPriceId && handleSubscribe(plan.stripeMonthlyPriceId, false)}
                                                disabled={!plan.stripeMonthlyPriceId || checkoutLoading === plan.stripeMonthlyPriceId}
                                            >
                                                {checkoutLoading === plan.stripeMonthlyPriceId && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                                Subscribe Monthly
                                            </Button>
                                            {plan.stripeAnnualPriceId && (
                                                <Button
                                                    variant="outline"
                                                    className="w-full"
                                                    onClick={() => handleSubscribe(plan.stripeAnnualPriceId!, true)}
                                                    disabled={checkoutLoading === plan.stripeAnnualPriceId}
                                                >
                                                    {checkoutLoading === plan.stripeAnnualPriceId && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                                    Annual (Save 20%)
                                                </Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

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
                            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                                <Info className="h-3 w-3" />
                                <span>Overdraft enabled</span>
                            </div>
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
                            {balanceData?.usageSummary?.totalUsed?.toLocaleString() || 0}
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
                            {balanceData?.usageSummary?.totalAdded?.toLocaleString() || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">Credits received</p>
                    </CardContent>
                </Card>
            </div>

            {/* Usage Breakdown */}
            {balanceData?.usageSummary?.byType && Object.keys(balanceData.usageSummary.byType).length > 0 && (
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
                                        <TableCell className="text-right">
                                            {formatTransactionAmount(txn.amount)}
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
                    <div className="grid gap-4 md:grid-cols-4 text-sm">
                        <div>
                            <div className="font-medium">SMS</div>
                            <div className="text-muted-foreground">
                                {creditConfig.sms_cost || 2} credits
                            </div>
                        </div>
                        <div>
                            <div className="font-medium">Email</div>
                            <div className="text-muted-foreground">
                                {creditConfig.email_cost || 1} credit
                            </div>
                        </div>
                        <div>
                            <div className="font-medium">Call Forward</div>
                            <div className="text-muted-foreground">
                                {creditConfig.call_forward_cost || 1} credit
                            </div>
                        </div>
                        <div>
                            <div className="font-medium">Monthly Rentals</div>
                            <div className="text-muted-foreground">
                                Phone: {creditConfig.phone_rental || 50} / Email: {creditConfig.email_rental || 20} credits
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default BillingPage;
