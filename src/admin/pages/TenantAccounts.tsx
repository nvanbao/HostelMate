import { useEffect, useState } from 'react';
import { PiIdentificationBadgeLight, PiUserPlusLight, PiCheckCircleLight, PiEyeLight, PiEyeSlashLight, PiPhoneLight, PiCopyLight, PiArrowsClockwiseLight, PiLockKeyLight, PiTrashLight, PiUserLight, PiKeyLight } from 'react-icons/pi';
import { getTenants, getRooms, updateTenant, issueTenantCredentials } from '../lib/api';
import type { Tenant, Room } from '../types';
import { EmptyState } from '../components/ui/Input';

export function TenantAccounts() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [visiblePhones, setVisiblePhones] = useState<Set<string>>(new Set());
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  // The server only stores hashes, so an issued password exists here until the page is reloaded.
  const [issuedPasswords, setIssuedPasswords] = useState<Record<string, string>>({});

  const toggle = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => {
    setter(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const maskValue = (val: string | null | undefined, visibleChars: number) => {
    if (!val) return '—';
    if (val.length <= visibleChars) return val;
    return '*'.repeat(val.length - visibleChars) + val.slice(-visibleChars);
  };


  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [tenantsData, roomsData] = await Promise.all([
        getTenants(),
        getRooms(),
      ]);
      setTenants(tenantsData);
      setRooms(roomsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  const generateAccount = async (tenant: Tenant) => {
    try {
      const noAccents = tenant.full_name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const username = noAccents.replace(/\s+/g, '').toLowerCase();
      const { temporary_password, ...updatedTenant } = await issueTenantCredentials(tenant.id, username);
      setTenants(tenants.map(t => t.id === tenant.id ? updatedTenant : t));
      setIssuedPasswords(prev => ({ ...prev, [tenant.id]: temporary_password }));
    } catch (error) {
      console.error('Lỗi khi tạo tài khoản:', error);
      alert(error instanceof Error ? error.message : 'Không thể tạo tài khoản, vui lòng thử lại!');
    }
  };

  const copyToZalo = (tenant: Tenant) => {
    const password = issuedPasswords[tenant.id];
    if (!password) {
      alert('Mật khẩu chỉ hiển thị ngay sau khi cấp. Hãy reset mật khẩu để lấy mật khẩu mới.');
      return;
    }
    const text = `Tài khoản App phòng trọ của bạn là:\n- Đăng nhập: ${tenant.username}\n- Mật khẩu: ${password}`;
    navigator.clipboard.writeText(text);
    setCopiedId(tenant.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  
  const handleRemoveAccount = async (tenant: Tenant) => {
    if (!confirm(`Bạn có chắc muốn thu hồi tài khoản của ${tenant.full_name}?`)) return;
    try {
      const updatedTenant = await updateTenant(tenant.id, { username: null, password: null, google_email: null } as any);
      setTenants(tenants.map(t => t.id === tenant.id ? updatedTenant : t));
    } catch (error) {
      alert('Lỗi khi thu hồi tài khoản');
    }
  };

  const handleResetPassword = async (tenant: Tenant) => {
    if (!confirm(`Reset mật khẩu cho ${tenant.full_name}?`)) return;
    try {
      const { temporary_password, ...updatedTenant } = await issueTenantCredentials(tenant.id);
      setTenants(tenants.map(t => t.id === tenant.id ? updatedTenant : t));
      setIssuedPasswords(prev => ({ ...prev, [tenant.id]: temporary_password }));
      alert(`Đã reset mật khẩu thành: ${temporary_password}`);
    } catch (error) {
      alert('Lỗi khi reset mật khẩu');
    }
  };

  const toggleLockAccount = async (tenant: Tenant) => {
    if (!confirm(`Bạn có chắc muốn ${tenant.is_locked ? 'mở khóa' : 'khóa'} tài khoản của ${tenant.full_name}?`)) return;
    try {
      const updatedTenant = await updateTenant(tenant.id, { is_locked: !tenant.is_locked } as any);
      setTenants(tenants.map(t => t.id === tenant.id ? updatedTenant : t));
    } catch (error) {
      alert('Lỗi khi cập nhật trạng thái khóa tài khoản');
    }
  };

  const filteredTenants = tenants.filter(t => 
    t.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.phone?.includes(searchQuery)
  );

  const getTenantRooms = (tenantId: string) => {
    const assignedRooms = rooms.filter(r => 
      r.active_assignments?.some(a => a.tenant_id === tenantId)
    );
    if (assignedRooms.length === 0) return 'Chưa có phòng';
    return assignedRooms.map(r => `P.${r.room_number}`).join(', ');
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-serif text-charcoal-900">Tài khoản Khách</h2>
        <p className="text-charcoal-500 mt-2">Quản lý tài khoản truy cập ứng dụng của người thuê</p>
      </div>

      {/* Toolbar */}
      <div className="flex justify-between items-center bg-white p-2 rounded-2xl shadow-sm border border-charcoal-100/50">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            placeholder="Tìm theo tên hoặc số điện thoại..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2.5 bg-transparent border-none focus:ring-0 text-charcoal-900 placeholder:text-charcoal-400"
          />
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-charcoal-400">
            <div className="w-8 h-8 border-2 border-wood-300 border-t-wood-600 rounded-full animate-spin mb-4" />
            <p>Đang tải dữ liệu...</p>
          </div>
        ) : filteredTenants.length === 0 ? (
          <EmptyState
            icon={<PiIdentificationBadgeLight className="w-8 h-8" />}
            title="Không tìm thấy người thuê"
            description="Không có khách thuê nào phù hợp với tìm kiếm của bạn."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-cream-50/50 border-b border-cream-200 text-xs uppercase tracking-widest text-charcoal-500 font-semibold">
                  <th className="px-4 py-3">Khách Thuê</th>
                  <th className="px-4 py-3">Phòng</th>
                  <th className="px-4 py-3">Trạng Thái</th>
                  <th className="px-4 py-3">Thông Tin Đăng Nhập</th>
                  <th className="px-4 py-3 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100">
                {filteredTenants.map((tenant) => {
                  const hue = tenant.full_name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;
                  const avatarStyle = { background: `linear-gradient(135deg, hsl(${hue}, 70%, 65%), hsl(${hue + 20}, 70%, 50%))` };
                  const hasAccount = !!tenant.username;

                  return (
                    <tr key={tenant.id} className="hover:bg-cream-50/50 transition-colors group">
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-9 h-9 rounded-full flex items-center justify-center text-white font-serif text-base shrink-0 shadow-sm"
                            style={avatarStyle}
                          >
                            {tenant.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-serif text-charcoal-900 font-medium text-base">{tenant.full_name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-xs text-charcoal-400 font-mono ${!visiblePhones.has(tenant.id) ? 'tracking-widest' : ''}`}>
                                  {visiblePhones.has(tenant.id) ? (tenant.phone || '—') : maskValue(tenant.phone, 3)}
                                </span>
                                {tenant.phone && (
                                  <button onClick={() => toggle(setVisiblePhones, tenant.id)} className="p-0.5 hover:bg-cream-100 rounded text-charcoal-400">
                                    {visiblePhones.has(tenant.id) ? <PiEyeSlashLight className="w-3.5 h-3.5" /> : <PiEyeLight className="w-3.5 h-3.5" />}
                                  </button>
                                )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <span className="font-serif text-wood-700 font-medium">{getTenantRooms(tenant.id)}</span>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        {hasAccount ? (
                          tenant.is_locked ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-100">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                              Bị khóa
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium uppercase tracking-wider bg-sage-50 text-sage-600 border border-sage-100">
                              <span className="w-1.5 h-1.5 rounded-full bg-sage-500"></span>
                              Đã cấp TK
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium uppercase tracking-wider bg-charcoal-50 text-charcoal-500 border border-charcoal-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-charcoal-300"></span>
                            Chưa có TK
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        {hasAccount ? (
                          <div className="flex flex-col gap-2 pt-0.5 w-48">
                            <div className="flex items-center gap-2.5">
                              <PiUserLight className="w-4 h-4 text-charcoal-400 shrink-0" />
                              <span className="font-mono text-charcoal-900 font-medium text-sm tracking-tight">{tenant.username}</span>
                            </div>
                            <div className="flex items-center gap-2.5 group/pass">
                              <PiKeyLight className="w-4 h-4 text-charcoal-400 shrink-0" />
                              <span className={`font-mono text-charcoal-900 font-medium text-sm tracking-tight ${issuedPasswords[tenant.id] && visiblePasswords.has(tenant.id) ? '' : 'w-20'}`}>
                                {issuedPasswords[tenant.id] && visiblePasswords.has(tenant.id) ? issuedPasswords[tenant.id] : '********'}
                              </span>
                              {issuedPasswords[tenant.id] && (
                                <button 
                                  onClick={() => toggle(setVisiblePasswords, tenant.id)}
                                  className="p-0.5 text-charcoal-400 hover:text-wood-600 hover:bg-wood-50 rounded transition-colors opacity-0 group-hover/pass:opacity-100"
                                >
                                  {visiblePasswords.has(tenant.id) ? <PiEyeSlashLight className="w-4 h-4" /> : <PiEyeLight className="w-4 h-4" />}
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-charcoal-400 italic inline-block pt-1.5">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-middle text-right">
                        <div className="flex justify-end items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                          {hasAccount ? (
                            <>
                              <button 
                                onClick={() => copyToZalo(tenant)}
                                className={`p-1.5 rounded-lg transition-colors bg-white border ${
                                  copiedId === tenant.id 
                                    ? 'text-sage-600 border-sage-200 bg-sage-50' 
                                    : 'text-wood-600 border-transparent hover:border-wood-200 hover:bg-wood-50'
                                }`}
                                title="Sao chép thông tin"
                              >
                                {copiedId === tenant.id ? <PiCheckCircleLight className="w-4 h-4" /> : <PiCopyLight className="w-4 h-4" />}
                              </button>
                              <button 
                                onClick={() => handleResetPassword(tenant)}
                                className="p-1.5 rounded-lg text-charcoal-400 hover:text-wood-600 hover:bg-wood-50 transition-colors bg-white border border-transparent hover:border-wood-200"
                                title="Reset mật khẩu"
                              >
                                <PiArrowsClockwiseLight className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => toggleLockAccount(tenant)}
                                className={`p-1.5 rounded-lg transition-colors bg-white border border-transparent ${tenant.is_locked ? 'text-rose-600 bg-rose-50 border-rose-200' : 'text-charcoal-400 hover:text-amber-600 hover:bg-amber-50 hover:border-amber-200'}`}
                                title={tenant.is_locked ? "Mở khóa tài khoản" : "Khóa tài khoản tạm thời"}
                              >
                                <PiLockKeyLight className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleRemoveAccount(tenant)}
                                className="p-1.5 rounded-lg text-charcoal-400 hover:text-rose-600 hover:bg-rose-50 transition-colors bg-white border border-transparent hover:border-rose-200"
                                title="Thu hồi tài khoản"
                              >
                                <PiTrashLight className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <button 
                              onClick={() => generateAccount(tenant)} 
                              className="p-1.5 rounded-lg text-wood-600 bg-white border border-wood-200 hover:border-wood-400 hover:bg-wood-50 transition-colors flex items-center gap-1.5 pr-3 pl-2 text-xs font-medium"
                              title="Cấp tài khoản"
                            >
                              <PiUserPlusLight className="w-4 h-4" /> Tạo TK
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
