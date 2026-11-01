import { useState } from 'react';
import {
  PiGridFourLight,
  PiArmchairLight,
  PiUsersLight,
  PiIdentificationBadgeLight,
  PiLightningLight,
  PiReceiptLight,
  PiWrenchLight,
} from 'react-icons/pi';
import { LogOut } from 'lucide-react';
import type { Page } from '../../types';
import { useAuth } from '../../../context/AuthContext';
import { ProfileModal } from '../../../components/ui/ProfileModal';

interface SidebarProps {
  isOpen?: boolean;
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const navItems: { id: Page; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 'dashboard', label: 'Tổng quan', icon: <PiGridFourLight className="w-5 h-5" />, description: 'Xem nhanh hoạt động' },
  { id: 'rooms', label: 'Phòng trọ', icon: <PiArmchairLight className="w-5 h-5" />, description: 'Quản lý phòng' },
  { id: 'tenants', label: 'Người thuê', icon: <PiUsersLight className="w-5 h-5" />, description: 'Thông tin thuê' },
  { id: 'tenant-accounts', label: 'Tài khoản', icon: <PiIdentificationBadgeLight className="w-5 h-5" />, description: 'Quản lý tài khoản' },
  { id: 'meter-readings', label: 'Điện nước', icon: <PiLightningLight className="w-5 h-5" />, description: 'Chỉ số tiêu thụ' },
  { id: 'invoices', label: 'Hóa đơn', icon: <PiReceiptLight className="w-5 h-5" />, description: 'Thanh toán' },
  { id: 'repairs', label: 'Sửa chữa', icon: <PiWrenchLight className="w-5 h-5" />, description: 'Yêu cầu bảo trì' },
];

export function Sidebar({ currentPage, onNavigate, isOpen = false }: SidebarProps) {
  const { user, logout } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <>
      <aside className={`w-72 bg-white border-r border-charcoal-100/50 fixed h-screen flex flex-col overflow-hidden z-40 transition-transform duration-200 lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Brand Section */}
        <div className="px-7 py-8 border-b border-charcoal-100/50 flex justify-center">
          <h1 className="text-2xl font-serif text-charcoal-900 tracking-widest uppercase relative inline-block">
            HostelMate
            <span className="absolute top-1 -right-3 text-[10px] tracking-normal text-charcoal-500 font-sans">TM</span>
          </h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 min-h-0 px-4 py-4 space-y-1 overflow-hidden">
          {navItems.map((item) => {
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-4 px-5 py-3 rounded-xl transition-all duration-200 ${
                  isActive ? 'bg-wood-50 shadow-sm' : 'hover:bg-cream-50'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                  isActive ? 'bg-wood-500 text-white shadow-soft' : 'bg-charcoal-50 text-charcoal-400'
                }`}>
                  {item.icon}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <span className={`block text-sm font-medium truncate ${isActive ? 'text-wood-700' : 'text-charcoal-600'}`}>
                    {item.label}
                  </span>
                  <span className={`block text-xs mt-0.5 truncate ${isActive ? 'text-wood-500' : 'text-charcoal-400'}`}>
                    {item.description}
                  </span>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Tài khoản quản trị ở góc trái phía dưới */}
        <div className="p-5 border-t border-charcoal-100/50 bg-cream-50/40">
          <div className="bg-white rounded-2xl p-2 shadow-sm border border-wood-100/40 flex items-center justify-between">
            <button
              onClick={() => setIsProfileOpen(true)}
              className="flex items-center gap-3 flex-1 px-2 py-1.5 rounded-xl hover:bg-cream-50 transition-colors text-left overflow-hidden"
              title="Mở hồ sơ tài khoản"
            >
              <div className="w-9 h-9 rounded-full bg-wood-100 flex items-center justify-center flex-shrink-0">
                <span className="text-wood-700 font-serif italic text-sm">
                  {(user?.full_name || user?.username || 'A').trim().charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 pr-2">
                <p className="text-sm font-medium text-charcoal-900 truncate">
                  {user?.full_name || user?.username || 'Admin'}
                </p>
                <p className="text-[11px] text-charcoal-400 truncate">Quản trị viên</p>
              </div>
            </button>
            <button
              onClick={logout}
              className="p-3 text-charcoal-400 hover:text-charcoal-900 hover:bg-cream-50 rounded-xl transition-colors flex-shrink-0"
              title="Đăng xuất"
              aria-label="Đăng xuất"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          <p className="mt-3 text-[10px] text-charcoal-300 text-center">Phiên bản 1.0.0</p>
        </div>
      </aside>

      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </>
  );
}
