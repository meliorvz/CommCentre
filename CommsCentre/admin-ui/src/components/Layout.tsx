import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { APP_NAME } from '@shared/constants';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
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

export default function Layout() {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen flex">
            {/* Sidebar */}
            <aside className="w-64 bg-[hsl(var(--card))] border-r flex flex-col">
                <div className="p-4 border-b">
                    <h1 className="text-xl font-bold">{APP_NAME}</h1>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">{user?.email}</p>
                </div>

                <nav className="flex-1 p-4 space-y-1">
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
