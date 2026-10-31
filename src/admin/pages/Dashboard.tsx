import { useEffect, useState } from 'react';
import { 
  PiHouseLineLight, 
  PiUsersLight, 
  PiCurrencyCircleDollarLight, 
  PiClockLight, 
  PiWrenchLight, 
  PiReceiptLight, 
  PiTrendUpLight, 
  PiSparkleLight,
  PiArrowRightLight,
  PiWarningCircleLight,
  PiFileTextLight,
  PiPlusLight,
  PiUserPlusLight
} from 'react-icons/pi';
import { Badge, Spinner } from '../components/ui/Input';
import { getDashboardStats } from '../lib/api';
import type { Invoice, RepairRequest, Page } from '../types';

const HERO_IMAGE = "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1600&q=80";

function DonutChart({ percentage }: { percentage: number }) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  
  return (
    <div className="relative w-10 h-10 flex items-center justify-center -m-2">
      <svg className="w-14 h-14 transform -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r={radius} fill="transparent" stroke="currentColor" strokeWidth="3" className="opacity-20" />
        <circle cx="18" cy="18" r={radius} fill="transparent" stroke="currentColor" strokeWidth="3" strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold currentColor">{percentage}%</div>
    </div>
  );
}

export function Dashboard({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const handleQuickAction = (page: Page, action: string) => {
    onNavigate(page);
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('open-modal', { detail: { action } }));
    }, 100);
  };

  const handleFilterAction = (page: Page, filterKey: string, filterValue: string) => {
    onNavigate(page);
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('apply-filter', { detail: { filterKey, filterValue } }));
    }, 100);
  };
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getDashboardStats>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const data = await getDashboardStats();
      setStats(data as typeof stats);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <Spinner />;
  if (!stats) return null;

  const occupancyRate = Math.round((stats.occupiedRooms / stats.totalRooms) * 100) || 0;
  // Make sure we have the fields from the updated API
  const hasAlerts = (stats as any).expiringContracts?.length > 0 || (stats as any).missingIdTenants > 0 || stats.overdueInvoices > 0;

  return (
    <div className="space-y-5 pb-6">
      {/* Premium Hero Banner */}
      <div className="relative h-28 rounded-[2rem] overflow-hidden shadow-soft group">
        <img 
          src={HERO_IMAGE} 
          alt="HostelMate Dashboard Banner" 
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-charcoal-900/90 via-charcoal-900/60 to-transparent" />
        
        <div className="absolute inset-0 p-6 flex flex-col justify-center max-w-3xl">
          <h1 className="text-3xl font-serif lining-nums tabular-nums text-white tracking-wide leading-tight drop-shadow-sm mb-4">
            Tinh Hoa Không Gian Sống
          </h1>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => handleQuickAction('invoices', 'new-invoice')}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-sm font-medium rounded-full border border-white/30 transition-colors"
            >
              <PiPlusLight className="w-4 h-4" /> Lập Hóa Đơn
            </button>
            <button 
              onClick={() => handleQuickAction('tenants', 'new-tenant')}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-sm font-medium rounded-full border border-white/30 transition-colors"
            >
              <PiUserPlusLight className="w-4 h-4" /> Thêm Khách Thuê
            </button>
          </div>
        </div>
      </div>

      {/* Urgent Tasks Section */}
      {hasAlerts && (
        <section className="bg-rose-50/50 border border-rose-100 rounded-3xl p-5 flex flex-col gap-3 animate-fade-in">
          <h2 className="text-sm font-semibold text-rose-800 uppercase tracking-wider flex items-center gap-2">
            <PiWarningCircleLight className="w-5 h-5" /> Cần Xử Lý Gấp
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {(stats as any).expiringContracts?.length > 0 && (
              <div 
                onClick={() => handleFilterAction('tenants', 'sortBy', 'expiration_asc')}
                className="bg-white px-5 py-4 rounded-2xl border border-rose-100 shadow-sm flex items-center gap-4 cursor-pointer hover:bg-rose-50 hover:border-rose-200 transition-all min-w-[240px]"
              >
                <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <PiFileTextLight className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-serif lining-nums tabular-nums font-medium text-charcoal-900">{(stats as any).expiringContracts.length} Hợp đồng</p>
                  <p className="text-xs text-charcoal-500 mt-0.5">Sắp hết hạn (30 ngày)</p>
                </div>
              </div>
            )}
            {(stats as any).missingIdTenants > 0 && (
              <div 
                onClick={() => handleFilterAction('tenants', 'legalFilter', 'missing_id')}
                className="bg-white px-5 py-4 rounded-2xl border border-rose-100 shadow-sm flex items-center gap-4 cursor-pointer hover:bg-rose-50 hover:border-rose-200 transition-all min-w-[240px]"
              >
                <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <PiUsersLight className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-serif lining-nums tabular-nums font-medium text-charcoal-900">{(stats as any).missingIdTenants} Khách thuê</p>
                  <p className="text-xs text-charcoal-500 mt-0.5">Thiếu CCCD/CMND</p>
                </div>
              </div>
            )}
            {stats.overdueInvoices > 0 && (
              <div 
                onClick={() => handleFilterAction('invoices', 'statusFilter', 'overdue')}
                className="bg-white px-5 py-4 rounded-2xl border border-rose-100 shadow-sm flex items-center gap-4 cursor-pointer hover:bg-rose-50 hover:border-rose-200 transition-all min-w-[240px]"
              >
                <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <PiReceiptLight className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-serif lining-nums tabular-nums font-medium text-charcoal-900">{stats.overdueInvoices} Hóa đơn</p>
                  <p className="text-xs text-charcoal-500 mt-0.5">Quá hạn thanh toán</p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Stats Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-lg font-serif lining-nums tabular-nums text-charcoal-900 tracking-wide">Thống Kê Hoạt Động</h2>
        </div>

        <div className="grid grid-cols-4 gap-5">
          <DataCard
            label="Tổng số phòng"
            value={stats.totalRooms.toString()}
            subValue={`${stats.availableRooms} phòng trống`}
            icon={<PiHouseLineLight className="w-6 h-6" />}
            onClick={() => onNavigate('rooms')}
          />
          <DataCard
            label="Đang sử dụng"
            value={stats.occupiedRooms.toString()}
            icon={<DonutChart percentage={occupancyRate} />}
            accent
            onClick={() => onNavigate('rooms')}
          />
          <DataCard
            label="Khách thuê"
            value={stats.totalTenants.toString()}
            icon={<PiUsersLight className="w-6 h-6" />}
            onClick={() => onNavigate('tenants')}
          />
          <DataCard
            label="Sửa chữa chờ"
            value={stats.pendingRepairs.toString()}
            icon={<PiWrenchLight className="w-6 h-6" />}
            highlight={stats.pendingRepairs > 0}
            onClick={() => onNavigate('repairs')}
          />
        </div>
      </section>

      {/* Financial Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-lg font-serif lining-nums tabular-nums text-charcoal-900 tracking-wide">Tình Hình Tài Chính</h2>
        </div>

        <div className="grid grid-cols-3 gap-5">
          <FinancialCard
            label="Doanh thu đã thu"
            value={stats.totalRevenue}
            icon={<PiCurrencyCircleDollarLight className="w-7 h-7" />}
            variant="success"
            onClick={() => onNavigate('invoices')}
          />
          <FinancialCard
            label="Chờ thanh toán"
            value={stats.pendingPayments}
            icon={<PiClockLight className="w-7 h-7" />}
            variant="warning"
            onClick={() => onNavigate('invoices')}
          />
          <FinancialCard
            label="Hóa đơn quá hạn"
            value={stats.overdueInvoices}
            icon={<PiReceiptLight className="w-7 h-7" />}
            variant={stats.overdueInvoices > 0 ? 'danger' : 'default'}
            onClick={() => onNavigate('invoices')}
            unit="count"
          />
        </div>
      </section>

      {/* Activity Sections */}
      <section className="grid grid-cols-2 gap-6">
        <RecentInvoices invoices={stats.recentInvoices} onNavigate={onNavigate} />
        <RecentRepairs repairs={stats.recentRepairs} onNavigate={onNavigate} />
      </section>
    </div>
  );
}

function DataCard({
  label,
  value,
  subValue,
  icon,
  accent,
  highlight,
  onClick,
}: {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ReactNode;
  accent?: boolean;
  highlight?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-[1.5rem] border ${highlight ? 'border-amber-200 bg-amber-50/30' : 'border-cream-200'} p-5 shadow-soft group flex flex-col justify-between ${onClick ? 'cursor-pointer hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300' : ''}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
          accent ? 'bg-wood-50 text-wood-600 group-hover:bg-wood-100' : 'bg-cream-100 text-charcoal-500 group-hover:bg-cream-200'
        }`}>
          {icon}
        </div>
      </div>
      <div>
        <p className={`text-3xl font-serif lining-nums tabular-nums mb-1 tracking-tight ${accent ? 'text-wood-700' : 'text-charcoal-900'}`}>
          {value}
        </p>
        <p className="text-xs text-charcoal-400 font-medium uppercase tracking-widest">{label}</p>
        {subValue && <p className="text-[11px] text-charcoal-400 mt-1 italic">{subValue}</p>}
      </div>
    </div>
  );
}

function FinancialCard({
  label,
  value,
  icon,
  variant,
  onClick,
  unit = 'money',
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  variant: 'success' | 'warning' | 'danger' | 'default';
  onClick?: () => void;
  unit?: 'money' | 'count';
}) {
  const variantStyles = {
    success: { bg: 'bg-gradient-to-br from-sage-50 to-white', iconBg: 'bg-sage-100/50', iconColor: 'text-sage-700', border: 'border-sage-200/50' },
    warning: { bg: 'bg-gradient-to-br from-amber-50 to-white', iconBg: 'bg-amber-100/50', iconColor: 'text-amber-700', border: 'border-amber-200/50' },
    danger: { bg: 'bg-gradient-to-br from-rose-50 to-white', iconBg: 'bg-rose-100/50', iconColor: 'text-rose-700', border: 'border-rose-200/50' },
    default: { bg: 'bg-white', iconBg: 'bg-cream-100', iconColor: 'text-charcoal-500', border: 'border-cream-200' },
  };

  const style = variantStyles[variant];

  return (
    <div
      onClick={onClick}
      className={`${style.bg} rounded-[1.5rem] border ${style.border} p-6 shadow-soft group flex flex-col justify-between ${onClick ? 'cursor-pointer hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300' : ''}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-full ${style.iconBg} flex items-center justify-center ${style.iconColor} transition-transform group-hover:scale-110 duration-300`}>
          {icon}
        </div>
      </div>
      <div>
        <p className="text-3xl font-serif lining-nums tabular-nums text-charcoal-900 mb-1 tracking-tight">
          {unit === 'count' ? `${value} HĐ` : `${value.toLocaleString('vi-VN')}đ`}
        </p>
        <p className="text-xs text-charcoal-500 font-medium uppercase tracking-widest">{label}</p>
      </div>
    </div>
  );
}

function RecentInvoices({ invoices, onNavigate }: { invoices: Invoice[]; onNavigate: (page: Page) => void }) {
  return (
    <div className="bg-white rounded-[1.5rem] border border-cream-200 shadow-soft overflow-hidden group/container flex flex-col">
      <div
        onClick={() => onNavigate('invoices')}
        className="px-6 py-5 border-b border-cream-200 flex items-center justify-between cursor-pointer hover:bg-cream-50 transition-colors"
      >
        <div>
          <h3 className="text-lg font-serif lining-nums tabular-nums text-charcoal-900 tracking-wide">Hóa đơn gần đây</h3>
          <p className="text-xs text-charcoal-400 mt-0.5">Các hóa đơn mới nhất trong hệ thống</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-cream-100 flex items-center justify-center text-wood-600 transition-colors group-hover/container:bg-wood-50">
            <PiReceiptLight className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="divide-y divide-cream-100 flex-1 flex flex-col justify-between">
        {invoices.length === 0 ? (
          <div className="px-6 py-10 text-center flex-1 flex items-center justify-center">
            <p className="text-charcoal-400 italic text-sm">Chưa có hóa đơn nào</p>
          </div>
        ) : (
          invoices.slice(0, 5).map((invoice) => (
            <div key={invoice.id} className="px-6 py-4 flex items-center justify-between hover:bg-cream-50/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-cream-50 border border-cream-200 flex items-center justify-center text-xs font-medium text-charcoal-600 font-serif lining-nums tabular-nums">
                  {invoice.invoice_month}/{invoice.invoice_year.toString().slice(-2)}
                </div>
                <div>
                  <p className="font-medium text-charcoal-900 font-serif lining-nums tabular-nums">Phòng {invoice.room?.room_number}</p>
                  <p className="text-xs text-charcoal-400 mt-0.5">{invoice.tenant?.full_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-semibold text-charcoal-900 font-serif lining-nums tabular-nums">{invoice.total_amount.toLocaleString('vi-VN')}đ</p>
                  <Badge status={invoice.status} variant={invoice.status === 'paid' ? 'success' : invoice.status === 'overdue' ? 'danger' : 'warning'} size="sm" />
                </div>
                <PiArrowRightLight className="w-4 h-4 text-charcoal-300 opacity-0 group-hover/container:opacity-100 transition-opacity" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function RecentRepairs({ repairs, onNavigate }: { repairs: RepairRequest[]; onNavigate: (page: Page) => void }) {
  return (
    <div className="bg-white rounded-[1.5rem] border border-cream-200 shadow-soft overflow-hidden group/container flex flex-col">
      <div
        onClick={() => onNavigate('repairs')}
        className="px-6 py-5 border-b border-cream-200 flex items-center justify-between cursor-pointer hover:bg-cream-50 transition-colors"
      >
        <div>
          <h3 className="text-lg font-serif lining-nums tabular-nums text-charcoal-900 tracking-wide">Yêu cầu sửa chữa</h3>
          <p className="text-xs text-charcoal-400 mt-0.5">Các yêu cầu mới nhất từngười thuê</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-cream-100 flex items-center justify-center text-wood-600 transition-colors group-hover/container:bg-wood-50">
            <PiWrenchLight className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="divide-y divide-cream-100 flex-1 flex flex-col justify-between">
        {repairs.length === 0 ? (
          <div className="px-6 py-10 text-center flex-1 flex items-center justify-center">
            <p className="text-charcoal-400 italic text-sm">Chưa có yêu cầu nào</p>
          </div>
        ) : (
          repairs.slice(0, 5).map((repair) => (
            <div key={repair.id} className="px-6 py-4 flex items-center justify-between hover:bg-cream-50/50 transition-colors">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-full bg-cream-50 border border-cream-200 flex items-center justify-center shrink-0">
                  <PiWrenchLight className="w-4 h-4 text-charcoal-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-charcoal-900 truncate font-serif lining-nums tabular-nums">{repair.title}</p>
                  <p className="text-xs text-charcoal-400 mt-0.5">Phòng {repair.room?.room_number}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <Badge status={repair.status} variant={repair.status === 'new' ? 'info' : repair.status === 'in_progress' ? 'warning' : 'success'} size="sm" />
                <PiArrowRightLight className="w-4 h-4 text-charcoal-300 opacity-0 group-hover/container:opacity-100 transition-opacity" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function InvoiceBadge({ status }: { status: string }) {
  const variants: Record<string, 'success' | 'warning' | 'danger'> = {
    paid: 'success',
    pending: 'warning',
    overdue: 'danger',
  };
  return <Badge status={status} variant={variants[status] || 'default'} size="sm" />;
}

function RepairBadge({ status }: { status: string }) {
  const variants: Record<string, 'info' | 'warning' | 'success' | 'default'> = {
    new: 'info',
    in_progress: 'warning',
    resolved: 'success',
    closed: 'default',
  };
  return <Badge status={status} variant={variants[status]} size="sm" />;
}
