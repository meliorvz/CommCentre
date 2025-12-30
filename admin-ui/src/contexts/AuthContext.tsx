import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, User, UserRole } from '@/lib/api';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    // Multi-tenant helpers
    isSuperAdmin: boolean;
    isCompanyAdmin: boolean;
    canManageCompanies: boolean;
    canManageUsers: boolean;
    canViewBilling: boolean;
    companyId: string | undefined;
    companyName: string | undefined;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.auth.me()
            .then(({ user }) => setUser(user))
            .catch(() => setUser(null))
            .finally(() => setLoading(false));
    }, []);

    const login = async (email: string, password: string) => {
        const { user } = await api.auth.login(email, password);
        setUser(user);
    };

    const logout = async () => {
        await api.auth.logout();
        setUser(null);
    };

    // Role-based permission helpers
    const isSuperAdmin = user?.role === 'super_admin';
    const isCompanyAdmin = user?.role === 'company_admin' || user?.role === 'admin';
    const canManageCompanies = isSuperAdmin;
    const canManageUsers = isSuperAdmin || isCompanyAdmin;
    const canViewBilling = isSuperAdmin || isCompanyAdmin;

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            login,
            logout,
            isSuperAdmin,
            isCompanyAdmin,
            canManageCompanies,
            canManageUsers,
            canViewBilling,
            companyId: user?.companyId,
            companyName: user?.companyName,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}

// Helper to check if user has at least the specified role level
export function hasRoleLevel(userRole: UserRole | undefined, requiredRole: UserRole): boolean {
    if (!userRole) return false;

    const roleHierarchy: Record<UserRole, number> = {
        'super_admin': 100,
        'company_admin': 80,
        'admin': 80, // Legacy
        'property_manager': 60,
        'staff': 40,
    };

    const userLevel = roleHierarchy[userRole] ?? 0;
    const requiredLevel = roleHierarchy[requiredRole] ?? 0;

    return userLevel >= requiredLevel;
}
