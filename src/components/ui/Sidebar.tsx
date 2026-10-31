import { useEffect, useState } from 'react';
import { PiGridFourLight, PiReceiptLight, PiWrenchLight } from 'react-icons/pi';
import { LogOut } from 'lucide-react';
import type { Page } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { ProfileModal } from './ProfileModal';
import { getBadges } from '../../lib/api';
import { useSocket } from '../../hooks/useSocket';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const { user, logout } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [badges, setBadges] = useState({ invoices: 0, repairs: 0 });
  const socket = useSocket();

  const loadBadges = async () => {
    try {
      const data = await getBadges();
      setBadges({ invoices: Number(data.invoices || 0), repairs: Number(data.repairs || 0) });
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadBadges();
    const interval = window.setInterval(loadBadges, 10000);
    return () => window.clearInterval(interval);
  }, [user?.id]);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => loadBadges();
    socket.on('invoice_updated', handleUpdate);
    socket.on('repair_updated', handleUpdate);
    return () => {
      socket.off('invoice_updated', handleUpdate);
      socket.off('repair_updated', handleUpdate);
    };
  }, [socket]);

  const navItems: { id: Page; label: string; icon: React.ReactNode; description: string; badge?: number }[] = [
    { id: 'dashboard', label: 'Tổng quan', description: 'Xem nhanh hoạt động', icon: <PiGridFourLight className="w-5 h-5" /> },
    { id: 'invoices', label: 'Hóa đơn', description: 'Thanh toán', icon: <PiReceiptLight className="w-5 h-5" />, badge: badges.invoices },
    { id: 'repairs', label: 'Sửa chữa', description: 'Yêu cầu bảo trì', icon: <PiWrenchLight className="w-5 h-5" />, badge: badges.repairs },
  ];

  return (
    <>
      <aside className="w-72 bg-white border-r border-charcoal-100/50 fixed h-screen flex flex-col z-40 transition-base">
        <div className="px-7 py-8 border-b border-charcoal-100/50 flex justify-center">
          <h1 className="text-2xl font-serif text-charcoal-900 tracking-widest uppercase relative inline-block">
            HostelMate
            <span className="absolute top-1 -right-3 text-[10px] tracking-normal text-charcoal-500 font-sans">TM</span>
          </h1>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-xl transition-all duration-200 relative ${isActive ? 'bg-wood-50 shadow-sm' : 'hover:bg-cream-50'}`}
              >
                <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${isActive ? 'bg-wood-500 text-white shadow-soft' : 'bg-charcoal-50 text-charcoal-400'}`}>
                  {item.icon}
                  {item.badge ? (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold min-w-4 h-4 px-1 flex items-center justify-center rounded-full">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  ) : null}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <span className={`block text-sm font-medium truncate ${isActive ? 'text-wood-700' : 'text-charcoal-600'}`}>{item.label}</span>
                  <span className={`block text-xs mt-0.5 truncate ${isActive ? 'text-wood-500' : 'text-charcoal-400'}`}>{item.description}</span>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="p-6">
          <div className="bg-white rounded-3xl p-2 shadow-sm border border-wood-100/30 flex items-center justify-between">
            <button
              onClick={() => setIsProfileOpen(true)}
              className="flex items-center gap-3 flex-1 px-2 py-1.5 rounded-2xl hover:bg-cream-50 transition-colors text-left overflow-hidden group"
            >
              <div className="w-9 h-9 rounded-full bg-wood-100 flex items-center justify-center flex-shrink-0">
                <span className="text-wood-700 font-serif italic text-sm">{user?.username?.[0]?.toUpperCase() || 'A'}</span>
              </div>
              <div className="text-sm truncate pr-2">
                <p className="font-medium text-charcoal-900 truncate">{user?.full_name || user?.username}</p>
              </div>
            </button>
            <button
              onClick={logout}
              className="p-3 text-charcoal-400 hover:text-charcoal-900 hover:bg-cream-50 rounded-2xl transition-colors flex-shrink-0"
              title="Đăng xuất"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </>
  );
}
