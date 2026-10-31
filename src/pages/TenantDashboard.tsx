import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, Phone, ChevronRight, Bell, FileText, Wrench } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { MockPaymentGateway } from './MockPaymentGateway';
import { getRepairRequests, changePassword } from '../lib/api';
import { RoomCard } from '../components/tenant/RoomCard';
import { FinancialsCard } from '../components/tenant/FinancialsCard';
import { MaintenanceCard } from '../components/tenant/MaintenanceCard';
const API_URL = import.meta.env.VITE_API_URL || '/api';

const ROOM_IMAGES = [
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=2000',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&q=80&w=2000',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=2000',
];

interface TenantDashboardProps {
  onNavigate?: (page: string) => void;
}

export function TenantDashboard({ onNavigate }: TenantDashboardProps = {}) {
  const { user } = useAuth();
  const userFullName = (user as { full_name?: string } | null)?.full_name || user?.username || 'Khách thuê';
  const [contactInfo, setContactInfo] = useState<{ name: string; phone: string } | null>(null);
  const [portalData, setPortalData] = useState<any>(null);
  const [tenantRepairs, setTenantRepairs] = useState<any[]>([]);
  
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [signingAssignmentId, setSigningAssignmentId] = useState<string | null>(null);
  const [payingInvoice, setPayingInvoice] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [pwdOld, setPwdOld] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState('');

  const sigPad = useRef<any>(null);

  useEffect(() => {
    fetch(`${API_URL}/landlord/contact`)
      .then(res => res.json())
      .then(data => {
        if (!data.error) setContactInfo(data);
      })
      .catch(err => console.error(err));

    if (user?.tenant_id) {
      loadPortalData();
      loadRepairSummary();
    }
  }, [user]);

  const loadPortalData = async () => {
    try {
      const res = await fetch(`${API_URL}/tenant/portal`, { credentials: 'include' });
      if (res.ok) {
        setPortalData(await res.json());
      }
    } catch (error) {
      console.error(error);
    }
  };

  const loadRepairSummary = async () => {
    try {
      const result = await getRepairRequests({ limit: 10000 } as any);
      const rows = result.data || [];
      const tenantRows = rows.filter(
        (repair: any) =>
          String(repair.tenant_id) === String(user?.tenant_id)
      );
      setTenantRepairs(tenantRows);
    } catch (error) {
      console.error('Failed to load repair summary:', error);
      setTenantRepairs([]);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    if (pwdNew !== pwdConfirm) {
      setPwdError('Mật khẩu xác nhận không khớp');
      return;
    }
    setPwdLoading(true);
    try {
      await changePassword(pwdOld, pwdNew);
      alert('Đổi mật khẩu thành công!');
      setIsChangePasswordOpen(false);
      setPwdOld(''); setPwdNew(''); setPwdConfirm('');
    } catch (err: any) {
      setPwdError(err.message || 'Lỗi khi đổi mật khẩu');
    } finally {
      setPwdLoading(false);
    }
  };

  const handleSignContract = async () => {
    if (sigPad.current?.isEmpty()) {
      alert('Vui lòng ký tên trước khi xác nhận');
      return;
    }
    setSaving(true);
    try {
      const signatureBase64 = sigPad.current.getTrimmedCanvas().toDataURL('image/png');
      const res = await fetch(`${API_URL}/contracts/${signingAssignmentId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ signatureBase64 })
      });
      if (res.ok) {
        alert('Ký hợp đồng thành công!');
        setIsSignModalOpen(false);
        setSigningAssignmentId(null);
        loadPortalData();
      } else {
        alert('Lỗi khi ký hợp đồng');
      }
    } catch {
      alert('Lỗi hệ thống');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadContract = (assignmentId: string) => {
    window.open(`${API_URL}/contracts/${assignmentId}/download`, '_blank');
  };

  if (payingInvoice) {
    return <MockPaymentGateway invoiceId={payingInvoice.id} amount={Number(payingInvoice.total_amount)} onBack={() => { setPayingInvoice(null); loadPortalData(); loadRepairSummary(); }} />;
  }

  const rentals: any[] = portalData?.rentals || (portalData?.assignment ? [{
    assignment: portalData.assignment,
    room: portalData.room,
    dien_nuoc_info: portalData.dien_nuoc_info,
    chu_hop_dong: portalData.chu_hop_dong,
    so_nguoi_o: portalData.so_nguoi_o
  }] : []);
  const unpaidInvoices: any[] = portalData?.unpaidInvoices || [];
  const totalUnpaid = unpaidInvoices.reduce((sum: number, inv: any) => sum + inv.total_amount, 0);

  const repairSummary = {
    total: tenantRepairs.length,
    active: tenantRepairs.filter(r => r.status === 'new' || r.status === 'in_progress').length,
  };

  return (
    <div className="space-y-10">
      
      {/* Header */}
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-serif lining-nums tabular-nums text-charcoal-900 tracking-wide">
            Welcome, <span className="italic">{userFullName || user?.username}</span>.
          </h1>
          <p className="text-charcoal-400 mt-2 text-sm">Xem nhanh hoạt động phòng trọ của bạn</p>
        </div>
        
        <div className="flex items-center gap-4">
          {user?.tenant_id && (
            <button
              onClick={() => setIsChangePasswordOpen(true)}
              className="px-4 py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-full text-sm font-medium transition-colors flex items-center gap-2 border border-amber-200"
            >
              <Bell className="w-4 h-4" />
              Đang dùng mật khẩu mặc định. <span className="underline decoration-amber-300 underline-offset-4">Đổi ngay</span>
            </button>
          )}
        </div>
      </header>

      {/* TOP SUMMARY WIDGETS (Global) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        <FinancialsCard 
          unpaidInvoices={unpaidInvoices}
          totalUnpaid={totalUnpaid}
          onPay={(invoice: any) => setPayingInvoice(invoice)}
        />
        
        <MaintenanceCard 
          repairSummary={repairSummary}
          onNavigate={() => onNavigate?.('repairs')}
        />


      </div>

      {/* ROOMS GRID */}
      <div>
        <h2 className="text-xl font-serif text-charcoal-900 mb-6 flex items-center gap-2">
          Your Residences <span className="text-charcoal-300 text-sm font-sans font-normal">({rentals.length})</span>
        </h2>
        
        {rentals.length === 0 ? (
          <div className="bg-cream-50 rounded-[2rem] p-16 text-center border border-wood-100">
            <h3 className="text-2xl font-serif text-charcoal-500 italic mb-2">Chưa có thông tin phòng</h3>
            <p className="text-charcoal-400 font-light">Vui lòng liên hệ quản lý để được xếp phòng.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {rentals.map((rental: any, index: number) => {
              const bgImg = ROOM_IMAGES[index % ROOM_IMAGES.length];
              const roomInvoices = unpaidInvoices.filter(i => String(i.room_id) === String(rental.room.id));
              const roomRepairs = tenantRepairs.filter(r => String(r.room_id) === String(rental.room.id) && (r.status === 'new' || r.status === 'in_progress'));
              
              return (
                <RoomCard 
                  key={rental.assignment.id} 
                  rental={rental} 
                  userFullName={userFullName} 
                  bgImg={bgImg} 
                  roomInvoices={roomInvoices}
                  roomRepairs={roomRepairs}
                  onPay={(invoice: any) => setPayingInvoice(invoice)}
                  onSignContract={(id) => {
                    setSigningAssignmentId(id);
                    setIsSignModalOpen(true);
                  }}
                  onDownloadContract={handleDownloadContract}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Modals remain the same */}
      <Modal isOpen={isSignModalOpen} onClose={() => { setIsSignModalOpen(false); setSigningAssignmentId(null); }} title="Ký Hợp Đồng Điện Tử">
        <div className="p-6 space-y-4">
          <p className="text-sm text-charcoal-600">Vui lòng ký tên của bạn vào khung bên dưới để xác nhận Hợp đồng thuê phòng.</p>
          <div className="border-2 border-dashed border-wood-200 rounded-2xl bg-cream-50 overflow-hidden">
            <SignatureCanvas 
              ref={sigPad}
              canvasProps={{ className: 'w-full h-48 cursor-crosshair' }}
              backgroundColor="transparent"
            />
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={() => sigPad.current?.clear()} className="text-sm font-medium text-charcoal-400 hover:text-charcoal-600">Xóa chữ ký</button>
          </div>
          <div className="flex justify-end gap-3 pt-6 border-t border-charcoal-100">
            <Button type="button" variant="secondary" onClick={() => { setIsSignModalOpen(false); setSigningAssignmentId(null); }}>Hủy</Button>
            <Button type="button" onClick={handleSignContract} disabled={saving}>{saving ? 'Đang xử lý...' : 'Xác nhận'}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isChangePasswordOpen} onClose={() => setIsChangePasswordOpen(false)} title="Đổi Mật Khẩu">
        <form onSubmit={handleChangePassword} className="p-6 space-y-5">
          {pwdError && <div className="bg-red-50 p-4 rounded-xl text-sm text-red-600">{pwdError}</div>}
          <div>
            <label className="block text-sm font-medium text-charcoal-700 mb-2">Mật khẩu hiện tại</label>
            <input type="password" required value={pwdOld} onChange={(e) => setPwdOld(e.target.value)} className="w-full px-4 py-3 border border-charcoal-200 rounded-xl" />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal-700 mb-2">Mật khẩu mới</label>
            <input type="password" required value={pwdNew} onChange={(e) => setPwdNew(e.target.value)} className="w-full px-4 py-3 border border-charcoal-200 rounded-xl" />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal-700 mb-2">Xác nhận mật khẩu mới</label>
            <input type="password" required value={pwdConfirm} onChange={(e) => setPwdConfirm(e.target.value)} className="w-full px-4 py-3 border border-charcoal-200 rounded-xl" />
          </div>
          <div className="flex justify-end gap-3 pt-6 border-t border-charcoal-100">
            <Button type="button" variant="secondary" onClick={() => setIsChangePasswordOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={pwdLoading}>{pwdLoading ? 'Đang xử lý...' : 'Xác nhận'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
