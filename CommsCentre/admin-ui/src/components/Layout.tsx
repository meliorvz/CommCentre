import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { APP_NAME } from '@shared/constants';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    LayoutDashboard,
    Building2,
    Calendar,
    Inbox,
    Settings,
    FileText,
    MessageSquare,
    LogOut,
    BookOpen,
    Shield,
    CreditCard,
    Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
    path: string;
    label: string;
    icon: React.ElementType;
    adminOnly?: boolean;
    superAdminOnly?: boolean;
    companyAdminOnly?: boolean;
}

const navItems: NavItem[] = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/properties', label: 'Properties', icon: Building2 },
    { path: '/stays', label: 'Stays', icon: Calendar },
    { path: '/inbox', label: 'Inbox', icon: Inbox },
    { path: '/automations', label: 'Automations', icon: Settings },
    { path: '/templates', label: 'Templates', icon: FileText },
    { path: '/ai-config', label: 'AI Configuration', icon: MessageSquare },
    { path: '/knowledge', label: 'Knowledge Base', icon: BookOpen },
    { path: '/settings', label: 'Settings', icon: Settings },
];

const adminNavItems: NavItem[] = [
    { path: '/billing', label: 'Billing', icon: CreditCard, companyAdminOnly: true },
    { path: '/admin', label: 'Platform Admin', icon: Shield, superAdminOnly: true },
];

export default function Layout() {
    const { user, logout, isSuperAdmin, canViewBilling, companyName, companyId } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [creditBalance, setCreditBalance] = useState<number | null>(null);

    // Load credit balance
    useEffect(() => {
        if (companyId && canViewBilling) {
            api.credits.getBalance(isSuperAdmin ? companyId : undefined)
                .then(data => setCreditBalance(data.balance))
                .catch(err => console.error('Failed to load credits:', err));
        }
    }, [companyId, canViewBilling, isSuperAdmin]);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const shouldShowItem = (item: NavItem) => {
        if (item.superAdminOnly && !isSuperAdmin) return false;
        if (item.companyAdminOnly && !canViewBilling) return false;
        return true;
    };

    // Combine admin items with main items for display
    const visibleAdminItems = adminNavItems.filter(shouldShowItem);

    return (
        <div className="min-h-screen flex">
            {/* Sidebar */}
            <aside className="w-64 bg-[hsl(var(--card))] border-r flex flex-col">
                <div className="p-4 border-b">
                    <h1 className="text-xl font-bold">{APP_NAME}</h1>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">{user?.email}</p>
                    {companyName && !isSuperAdmin && (
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                            {companyName}
                        </p>
                    )}
                    {isSuperAdmin && (
                        <Badge variant="secondary" className="mt-2 text-xs">
                            Super Admin
                        </Badge>
                    )}
                </div>

                {/* Credit Balance (if company admin+) */}
                {canViewBilling && creditBalance !== null && (
                    <div className="px-4 py-3 border-b bg-[hsl(var(--muted))]/50">
                        <Link to="/billing" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                            <Wallet className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                            <div className="flex-1">
                                <div className="text-xs text-[hsl(var(--muted-foreground))]">Credits</div>
                                <div className="font-semibold">{creditBalance.toLocaleString()}</div>
                            </div>
                        </Link>
                    </div>
                )}

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={cn(
                                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                                    isActive
                                        ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                                        : 'hover:bg-[hsl(var(--muted))]'
                                )}
                            >
                                <Icon className="h-4 w-4" />
                                {item.label}
                            </Link>
                        );
                    })}

                    {/* Admin section separator */}
                    {visibleAdminItems.length > 0 && (
                        <>
                            <div className="pt-4 pb-2">
                                <div className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider px-3">
                                    Administration
                                </div>
                            </div>
                            {visibleAdminItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = location.pathname === item.path;

                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className={cn(
                                            'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                                            isActive
                                                ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                                                : 'hover:bg-[hsl(var(--muted))]'
                                        )}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </>
                    )}
                </nav>

                <div className="p-4 border-t">
                    <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
                        <LogOut className="h-4 w-4 mr-2" />
                        Sign out
                    </Button>
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 bg-[hsl(var(--muted))]">
                <Outlet />
            </main>
        </div>
    );
}
