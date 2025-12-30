import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PropertiesPage from './pages/PropertiesPage';
import StaysPage from './pages/StaysPage';
import InboxPage from './pages/InboxPage';
import ThreadDetailPage from './pages/ThreadDetailPage';
import AutomationsPage from '@/pages/AutomationsPage';
import TemplatesPage from '@/pages/TemplatesPage';
import AIConfigurationPage from '@/pages/AIConfigurationPage';
import KnowledgeBasePage from '@/pages/KnowledgeBasePage';
import SetupWizardPage from '@/pages/SetupWizardPage';
import SettingsPage from '@/pages/SettingsPage';
import SuperAdminPage from '@/pages/SuperAdminPage';
import BillingPage from '@/pages/BillingPage';
import HelpPage from '@/pages/HelpPage';
import IntegrationsPage from '@/pages/IntegrationsPage';
import GuidedTour from '@/components/GuidedTour';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[hsl(var(--muted-foreground))]">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="properties" element={<PropertiesPage />} />
        <Route path="stays" element={<StaysPage />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="inbox/:threadId" element={<ThreadDetailPage />} />
        <Route path="automations" element={<AutomationsPage />} />
        <Route path="templates" element={<TemplatesPage />} />
        <Route path="ai-config" element={<AIConfigurationPage />} />
        <Route path="setup" element={<SetupWizardPage />} />
        <Route path="knowledge" element={<KnowledgeBasePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="integrations" element={<IntegrationsPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="admin" element={<SuperAdminPage />} />
        <Route path="help" element={<HelpPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <GuidedTour />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
