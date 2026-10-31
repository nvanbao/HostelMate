import { useEffect, useState } from 'react';
import { Sidebar as TenantSidebar } from './components/ui/Sidebar';
import { Sidebar as AdminSidebar } from './admin/components/ui/Sidebar';
import { TenantDashboard } from './pages/TenantDashboard';
import { Invoices as TenantInvoices } from './pages/Invoices';
import { Repairs as TenantRepairs } from './pages/Repairs';
import { Login } from './pages/Login';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AiChatbot } from './components/ui/AiChatbot';

import { Dashboard as AdminDashboard } from './admin/pages/Dashboard';
import { Rooms as AdminRooms } from './admin/pages/Rooms';
import { Tenants as AdminTenants } from './admin/pages/Tenants';
import { TenantAccounts } from './admin/pages/TenantAccounts';
import { MeterReadings as AdminMeterReadings } from './admin/pages/MeterReadings';
import { Invoices as AdminInvoices } from './admin/pages/Invoices';
import { Repairs as AdminRepairs } from './admin/pages/Repairs';
import type { Page } from './types';
import type { Page as AdminPage } from './admin/types';

function AdminBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      <div style={{ position: 'absolute', top: -120, right: -100, width: 420, height: 420, background: 'rgba(243,164,122,.10)', clipPath: 'polygon(100% 0,100% 100%,0 0)' }} />
      <div style={{ position: 'absolute', top: -40, right: -20, width: 220, height: 220, background: 'rgba(214,99,60,.07)', clipPath: 'polygon(100% 0,100% 100%,0 0)' }} />
      <div style={{ position: 'absolute', bottom: -80, left: 288, width: 320, height: 320, background: 'rgba(184,120,60,.07)', clipPath: 'polygon(0 100%,100% 100%,50% 0)' }} />
      <div style={{ position: 'absolute', top: '45%', right: -180, width: 380, height: 380, borderRadius: '50%', background: 'rgba(248,201,172,.12)' }} />
      <div style={{ position: 'absolute', bottom: -120, right: 80, width: 260, height: 260, borderRadius: '50%', background: 'rgba(245,158,11,.07)' }} />
      <div style={{ position: 'absolute', top: '20%', left: 310, width: 60, height: 60, borderRadius: '50%', background: 'rgba(214,99,60,.08)' }} />
    </div>
  );
}

function TenantBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden bg-cream-50" style={{ zIndex: 0 }}>
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-wood-100/30 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-wood-50/50 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4" />
    </div>
  );
}

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => setCurrentPage('dashboard'), [user?.id, user?.role]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-cream-50"><div className="w-8 h-8 border-4 border-terra-500 border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (!user) return <Login />;

  const renderAdminPage = () => {
    switch (currentPage) {
      case 'dashboard': return <AdminDashboard onNavigate={(page) => setCurrentPage(page as Page)} />;
      case 'rooms': return <AdminRooms />;
      case 'tenants': return <AdminTenants />;
      case 'tenant-accounts': return <TenantAccounts />;
      case 'meter-readings': return <AdminMeterReadings />;
      case 'invoices': return <AdminInvoices />;
      case 'repairs': return <AdminRepairs />;
      default: return <AdminDashboard onNavigate={(page) => setCurrentPage(page as Page)} />;
    }
  };

  const renderTenantPage = () => {
    switch (currentPage) {
      case 'dashboard': return <TenantDashboard onNavigate={(page) => setCurrentPage(page as Page)} />;
      case 'invoices': return <TenantInvoices />;
      case 'repairs': return <TenantRepairs />;
      default: return <TenantDashboard onNavigate={(page) => setCurrentPage(page as Page)} />;
    }
  };

  return (
    <div className="min-h-screen bg-cream-100 flex">
      {isAdmin ? <AdminBackground /> : <TenantBackground />}
      {isAdmin ? (
        <AdminSidebar
          currentPage={currentPage as AdminPage}
          onNavigate={(page) => setCurrentPage(page as Page)}
        />
      ) : (
        <TenantSidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      )}
      <main className="flex-1 ml-72 min-h-screen relative" style={{ zIndex: 1 }}>
        <div className="py-10 px-12 max-w-6xl mx-auto">
          {isAdmin ? renderAdminPage() : renderTenantPage()}
        </div>
      </main>
      <AiChatbot />
    </div>
  );
}

export default function App() {
  return <AuthProvider><AppContent /></AuthProvider>;
}
