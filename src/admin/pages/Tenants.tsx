import { useEffect, useState, useRef } from 'react';
import { 
  PiPlusLight, 
  PiUsersLight, 
  PiPencilSimpleLight, 
  PiTrashLight, 
  PiPhoneLight, 
  PiEnvelopeSimpleLight, 
  PiHouseLineLight, 
  PiCrownLight, 
  PiSignOutLight, 
  PiUserPlusLight, 
  PiMagnifyingGlassLight, 
  PiEyeLight, 
  PiEyeSlashLight,
  PiIdentificationCardLight,
  PiCaretDownLight,
  PiCheckLight,
  PiFadersLight,
  PiDownloadSimpleLight,
  PiXLight,
  PiCheckSquareLight,
  PiSquareLight
} from 'react-icons/pi';
import { Modal } from '../components/ui/Modal';
import { FilterDropdown } from '../../components/ui/FilterDropdown';
import { Button } from '../components/ui/Button';
import { Input, Badge, Spinner, EmptyState } from '../components/ui/Input';
import {
  getTenants,
  createTenant,
  updateTenant,
  deleteTenant,
  getRooms,
  assignTenantToRoom,
  endRoomAssignment,
  getInvoices,
} from '../lib/api';
import type { Tenant, Room, RoomAssignment, Invoice } from '../types';

const countryCodes = [
  { code: '+84', label: 'VN (+84)' },
  { code: '+1', label: 'Mỹ/Canada (+1)' },
  { code: '+81', label: 'Nhật Bản (+81)' },
  { code: '+82', label: 'Hàn Quốc (+82)' },
  { code: '+86', label: 'Trung Quốc (+86)' },
  { code: '+65', label: 'Singapore (+65)' },
  { code: '+886', label: 'Đài Loan (+886)' },
];

function parsePhone(phone: string) {
  if (!phone) return { countryCode: '+84', body: '' };
  
  // Find matching country code prefix
  const matched = countryCodes.find(c => phone.startsWith(c.code));
  if (matched) {
    return { countryCode: matched.code, body: phone.slice(matched.code.length) };
  }
  
  // If it starts with '0' and has no '+', it's a legacy VN number
  if (phone.startsWith('0')) {
    return { countryCode: '+84', body: phone.slice(1) };
  }
  
  return { countryCode: '+84', body: phone };
}


export function Tenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [deletingTenant, setDeletingTenant] = useState<Tenant | null>(null);
  const [assigningTenant, setAssigningTenant] = useState<Tenant | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [roomFilter, setRoomFilter] = useState('all');
  const [debtFilter, setDebtFilter] = useState('all');
  const [legalFilter, setLegalFilter] = useState('all');
  const [selectedTenants, setSelectedTenants] = useState<Set<string>>(new Set());
  const [primaryFilter, setPrimaryFilter] = useState<'all' | 'primary' | 'non_primary'>('all');
  const [sortBy, setSortBy] = useState<'name_asc' | 'expiration_asc'>('name_asc');
  const [visiblePhones, setVisiblePhones] = useState<Set<string>>(new Set());
  const [visibleEmails, setVisibleEmails] = useState<Set<string>>(new Set());
  const [visibleIDs, setVisibleIDs] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    id_card_number: '',
    date_of_birth: '',
    address: '',
    emergency_contact: '',
    notes: '',
  });

  const [formErrors, setFormErrors] = useState<{
    phone?: string;
    email?: string;
    id_card_number?: string;
  }>({});

  const [assignData, setAssignData] = useState({
    room_id: '',
    start_date: new Date().toISOString().split('T')[0],
    deposit_amount: '' as string | number,
    is_primary: false,
    contract_end_date: '',
    notes: '',
  });

  const [saving, setSaving] = useState(false);
  const parsedPhone = parsePhone(formData.phone);

  useEffect(() => {
    loadData();
    
    const handleOpenModal = (e: any) => {
      if (e.detail?.action === 'new-tenant') {
        setEditingTenant(null);
        setIsModalOpen(true);
      }
    };

    const handleApplyFilter = (e: any) => {
      if (e.detail?.filterKey === 'legalFilter') {
        setLegalFilter(e.detail.filterValue);
        setShowAdvancedFilters(true);
      } else if (e.detail?.filterKey === 'sortBy') {
        setSortBy(e.detail.filterValue);
        setShowAdvancedFilters(true);
      }
    };

    window.addEventListener('open-modal', handleOpenModal);
    window.addEventListener('apply-filter', handleApplyFilter);
    return () => {
      window.removeEventListener('open-modal', handleOpenModal);
      window.removeEventListener('apply-filter', handleApplyFilter);
    };
  }, []);

  async function loadData() {
    try {
      const [tenantsData, roomsData, invoicesData] = await Promise.all([getTenants(), getRooms(), getInvoices()]);
      setTenants(tenantsData);
      setRooms(roomsData);
      setInvoices(invoicesData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  function getTenantAssignments(tenantId: string): { room: Room; assignment: RoomAssignment }[] {
    const assignments: { room: Room; assignment: RoomAssignment }[] = [];
    for (const room of rooms) {
      if (room.active_assignments) {
        room.active_assignments.filter((a) => a.tenant_id === tenantId).forEach((a) => {
          assignments.push({ room, assignment: a });
        });
      }
    }
    return assignments;
  }

  function toggle(set: Set<string>, setFn: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setFn(next);
  }

  function maskValue(value: string, visibleEnd = 3): string {
    if (!value || value.length <= visibleEnd) return value;
    return '•'.repeat(Math.min(value.length - visibleEnd, 8)) + value.slice(-visibleEnd);
  }

  function exportCSV() {
    const data = filteredTenants.filter(t => selectedTenants.has(t.id));
    if (data.length === 0) return;
    
    const headers = ['Họ tên', 'Số điện thoại', 'Email', 'CCCD/CMND', 'Phòng', 'Vai trò'];
    const rows = data.map(t => {
      const infos = getTenantAssignments(t.id);
        const roomStr = infos.length > 0 ? infos.map(i => i.room.room_number).join(', ') : 'Chưa xếp phòng';
        const roleStr = infos.some(i => i.assignment.is_primary) ? 'Chủ hộ' : (infos.length > 0 ? 'Thành viên' : '');
      return [t.full_name, t.phone || '', t.email || '', t.id_card_number || '', roomStr, roleStr];
    });
    
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `danh_sach_nguoi_thue_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function toggleTenantSelection(id: string) {
    const next = new Set(selectedTenants);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedTenants(next);
  }

  function toggleAllSelection() {
    if (selectedTenants.size === filteredTenants.length) {
      setSelectedTenants(new Set());
    } else {
      setSelectedTenants(new Set(filteredTenants.map(t => t.id)));
    }
  }

  function maskEmail(email: string): string {
    if (!email) return email;
    const [local, domain] = email.split('@');
    if (!domain) return maskValue(email, 3);
    const visible = local.length > 2 ? local.slice(0, 2) : local.slice(0, 1);
    return visible + '•'.repeat(Math.min(local.length - visible.length, 6)) + '@' + domain;
  }

  const filteredTenants = tenants.filter((t) => {
    // 1. Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase().replace(/\D/g, '') || searchQuery.toLowerCase();
      const nameMatch = t.full_name.toLowerCase().includes(searchQuery.toLowerCase());
      const queryDigits = searchQuery.replace(/\D/g, '');
      const phoneMatch = t.phone
        ? (queryDigits && t.phone.replace(/\D/g, '').includes(queryDigits)) ||
          t.phone.toLowerCase().includes(searchQuery.toLowerCase())
        : false;
      if (!nameMatch && !phoneMatch) return false;
    }

    // 2. Primary Tenant Filter
    if (primaryFilter !== 'all') {
      const infos = getTenantAssignments(t.id);
        const isPrimary = infos.some(info => info.assignment.is_primary);
        if (primaryFilter === 'primary' && !isPrimary) return false;
        if (primaryFilter === 'non_primary' && (isPrimary || infos.length === 0)) return false;
    }

    // 3. Room Filter
    if (roomFilter !== 'all') {
      const infos = getTenantAssignments(t.id);
        if (!infos.some(info => info.room.id === roomFilter)) return false;
    }

    // 4. Debt Filter
    if (debtFilter === 'debt') {
      const infos = getTenantAssignments(t.id);
        if (infos.length === 0) return false;
        const hasDebt = infos.some(info => invoices.some(inv => inv.room_id === info.room.id && (inv.status === 'pending' || inv.status === 'overdue')));
        if (!hasDebt) return false;
    }

    // 5. Legal Filter
    if (legalFilter === 'missing_id') {
      if (t.id_card_number && t.id_card_number.length >= 9) return false;
    }

    return true;
  });

  // 3. Sorting
  filteredTenants.sort((a, b) => {
    if (sortBy === 'name_asc') {
      return a.full_name.localeCompare(b.full_name, 'vi-VN');
    } else if (sortBy === 'expiration_asc') {
      const aInfos = getTenantAssignments(a.id);
        const bInfos = getTenantAssignments(b.id);
        const getMinDate = (infos: any[]) => Math.min(...infos.map(i => i.assignment.contract_end_date ? new Date(i.assignment.contract_end_date).getTime() : Infinity));
        const aDate = aInfos.length > 0 ? getMinDate(aInfos) : Infinity;
        const bDate = bInfos.length > 0 ? getMinDate(bInfos) : Infinity;
        return aDate - bDate;
    }
    return 0;
  });

  function validateField(field: 'phone' | 'email' | 'id_card_number', value: string): string | undefined {
    if (!value) return undefined; // empty = not required, skip
    if (field === 'phone') {
      const parsed = parsePhone(value);
      const digitsOnly = parsed.body.replace(/\D/g, '');
      if (!digitsOnly) return 'Vui lòng nhập số điện thoại';
      if (parsed.countryCode === '+84') {
        if (!/^\d{9}$/.test(digitsOnly)) return 'SĐT Việt Nam phải có đúng 9 chữ số (sau mã +84, bỏ số 0 ở đầu)';
      } else {
        if (!/^\d{7,11}$/.test(digitsOnly)) return 'SĐT quốc tế phải từ 7 đến 11 chữ số';
      }
    }
    if (field === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return 'Email không đúng định dạng';
    }
    if (field === 'id_card_number') {
      if (!/^\d{9}$/.test(value) && !/^\d{12}$/.test(value))
        return 'CCCD phải là 12 số (CCCD mới) hoặc 9 số (CMND cũ)';
    }
    return undefined;
  }

  function validateForm(): boolean {
    const errors: typeof formErrors = {};
    const pErr = validateField('phone', formData.phone);
    if (pErr) errors.phone = pErr;
    const eErr = validateField('email', formData.email);
    if (eErr) errors.email = eErr;
    const iErr = validateField('id_card_number', formData.id_card_number);
    if (iErr) errors.id_card_number = iErr;
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function updatePhone(v: string) {
    const err = validateField('phone', v);
    setFormErrors((e) => ({ ...e, phone: err }));
    setFormData((f) => ({ ...f, phone: v }));
  }

  function updateEmail(v: string) {
    const err = validateField('email', v);
    setFormErrors((e) => ({ ...e, email: err }));
    setFormData((f) => ({ ...f, email: v }));
  }

  function updateIDCard(v: string) {
    const digits = v.replace(/\D/g, '').slice(0, 12);
    const err = validateField('id_card_number', digits);
    setFormErrors((e) => ({ ...e, id_card_number: err }));
    setFormData((f) => ({ ...f, id_card_number: digits }));
  }

  function openCreateModal() {
    setEditingTenant(null);
    setFormErrors({});
    setFormData({ full_name: '', phone: '', email: '', id_card_number: '', date_of_birth: '', address: '', emergency_contact: '', notes: '' });
    setIsModalOpen(true);
  }

  function openEditModal(tenant: Tenant) {
    setEditingTenant(tenant);
    setFormErrors({});
    setFormData({
      full_name: tenant.full_name,
      phone: tenant.phone || '',
      email: tenant.email || '',
      id_card_number: tenant.id_card_number || '',
      date_of_birth: tenant.date_of_birth || '',
      address: tenant.address || '',
      emergency_contact: tenant.emergency_contact || '',
      notes: tenant.notes || '',
    });
    setIsModalOpen(true);
  }

  function openAssignModal(tenant: Tenant) {
    setAssigningTenant(tenant);
    // Default contract end date: 1 year from now
    const defaultEndDate = new Date();
    defaultEndDate.setFullYear(defaultEndDate.getFullYear() + 1);
    setAssignData({
      room_id: '',
      start_date: new Date().toISOString().split('T')[0],
      deposit_amount: '',
      is_primary: false,
      contract_end_date: defaultEndDate.toISOString().split('T')[0],
      notes: '',
    });
    setIsAssignModalOpen(true);
  }

  function openDeleteModal(tenant: Tenant) {
    setDeletingTenant(tenant);
    setIsDeleteModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateForm()) return;
    setSaving(true);
    try {
      if (editingTenant) {
        await updateTenant(editingTenant.id, formData);
      } else {
        await createTenant(formData);
      }
      await loadData();
      setIsModalOpen(false);
    } catch (error) {
      alert('Không thể lưu thông tin. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!assigningTenant) return;
    setSaving(true);
    try {
      await assignTenantToRoom(
        assignData.room_id,
        assigningTenant.id,
        assignData.start_date,
        parseFloat(assignData.deposit_amount as any) || 0,
        assignData.is_primary,
        assignData.notes,
        assignData.contract_end_date || undefined
      );
      await loadData();
      setIsAssignModalOpen(false);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Không thể gán phòng.';
      alert(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleCheckout(assignment: RoomAssignment) {
    if (!confirm('Xác nhận trả phòng?')) return;
    try {
      await endRoomAssignment(assignment.id);
      await loadData();
    } catch (error) {
      alert('Không thể trả phòng. Vui lòng thử lại.');
    }
  }

  async function handleDelete() {
    if (!deletingTenant) return;
    try {
      await deleteTenant(deletingTenant.id);
      await loadData();
      setIsDeleteModalOpen(false);
    } catch (error) {
      alert('Không thể xóa người thuê. Có thể vẫn còn dữ liệu liên quan.');
    }
  }

  const assignableRooms = rooms.filter((r) => r.status !== 'maintenance');

  if (loading) return <Spinner />;

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-serif lining-nums tabular-nums text-charcoal-900 tracking-wide">Người thuê</h1>
          <p className="text-charcoal-400 mt-2 text-sm">Quản lý thông tin khách thuê và hợp đồng</p>
        </div>
        <Button onClick={openCreateModal}>
          <PiPlusLight className="w-4 h-4 mr-1" />
          Thêm người thuê
        </Button>
      </header>

      {tenants.length === 0 ? (
        <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card p-12">
          <EmptyState
            icon={<PiUsersLight className="w-10 h-10" />}
            title="Chưa có người thuê nào"
            description="Bắt đầu bằng cách thêm thông tin người thuê mới vào hệ thống"
            action={<Button onClick={openCreateModal}><PiPlusLight className="w-4 h-4 mr-2" />Thêm người thuê</Button>}
          />
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-cream-200 shadow-soft overflow-hidden">
          {/* Toolbar */}
          <div className="p-5 border-b border-cream-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-cream-50/30">
            <div className="flex flex-1 flex-col sm:flex-row gap-3 w-full">
              <div className="relative flex-1 max-w-md">
                <PiMagnifyingGlassLight className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
                <input
                  type="text"
                  placeholder="Tìm theo tên hoặc số điện thoại..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-5 py-2.5 text-sm rounded-full border border-charcoal-100 hover:border-charcoal-200 focus:ring-wood-400 focus:border-wood-400 bg-white text-charcoal-800 transition-colors shadow-soft outline-none"
                />
              </div>
              <FilterDropdown 
                  value={primaryFilter} 
                  onChange={(val) => setPrimaryFilter(val as any)} 
                  options={[
                    { value: 'all', label: 'Tất cả người thuê' },
                    { value: 'primary', label: 'Chủ hợp đồng' },
                    { value: 'non_primary', label: 'Thành viên' }
                  ]}
                  className="min-w-[180px]"
                />
              <FilterDropdown 
                  value={sortBy} 
                  onChange={(val) => setSortBy(val as any)} 
                  options={[
                    { value: 'name_asc', label: 'Sắp xếp: Tên A-Z' },
                    { value: 'expiration_asc', label: 'Hết hạn gần nhất' }
                  ]}
                  className="min-w-[180px]"
                />
            </div>
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-full border border-charcoal-100 hover:border-charcoal-200 bg-white text-charcoal-800 transition-colors shadow-soft whitespace-nowrap"
              >
                <PiFadersLight className="w-4 h-4" />
                Lọc nâng cao
              </button>
          </div>
          
                    
          {/* Advanced Filters Panel */}
          {showAdvancedFilters && (
            <div className="bg-cream-50/50 border-b border-cream-200 p-5 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Room Filter */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-charcoal-500 uppercase tracking-wider">Phòng / Căn hộ</label>
                  <FilterDropdown 
                      value={roomFilter} 
                      onChange={(val) => setRoomFilter(val)} 
                      options={[
                        { value: 'all', label: 'Tất cả phòng' },
                        ...rooms.map(r => ({ value: r.id, label: `Phòng ${r.room_number}` }))
                      ]}
                      className="w-full"
                    />
                </div>

                {/* Legal Status Filter */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-charcoal-500 uppercase tracking-wider">Giấy tờ Pháp lý</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => setLegalFilter('all')}
                      className={`px-3 py-2.5 text-sm rounded-xl border transition-all ${legalFilter === 'all' ? 'bg-wood-50 border-wood-200 text-wood-700 font-medium shadow-sm' : 'bg-white border-charcoal-100 text-charcoal-600 hover:bg-cream-50'}`}
                    >
                      Tất cả
                    </button>
                    <button 
                      onClick={() => setLegalFilter('missing_id')}
                      className={`px-3 py-2.5 text-sm rounded-xl border transition-all ${legalFilter === 'missing_id' ? 'bg-rose-50 border-rose-200 text-rose-700 font-medium shadow-sm' : 'bg-white border-charcoal-100 text-charcoal-600 hover:bg-cream-50'}`}
                    >
                      Thiếu CCCD
                    </button>
                  </div>
                </div>

                {/* Financial Status Filter */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-charcoal-500 uppercase tracking-wider">Tình trạng Tài chính</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => setDebtFilter('all')}
                      className={`px-3 py-2.5 text-sm rounded-xl border transition-all ${debtFilter === 'all' ? 'bg-wood-50 border-wood-200 text-wood-700 font-medium shadow-sm' : 'bg-white border-charcoal-100 text-charcoal-600 hover:bg-cream-50'}`}
                    >
                      Tất cả
                    </button>
                    <button 
                      onClick={() => setDebtFilter('debt')}
                      className={`px-3 py-2.5 text-sm rounded-xl border transition-all ${debtFilter === 'debt' ? 'bg-amber-50 border-amber-200 text-amber-700 font-medium shadow-sm' : 'bg-white border-charcoal-100 text-charcoal-600 hover:bg-cream-50'}`}
                    >
                      Chưa đóng tiền
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

{/* Bulk Action Bar */}
          {selectedTenants.size > 0 && (
            <div className="bg-wood-50 border-b border-wood-100 px-5 py-3 flex items-center justify-between animate-fade-in">
              <div className="text-sm text-wood-800 font-medium">
                Đã chọn <span className="font-bold">{selectedTenants.size}</span> người thuê
              </div>
              <Button size="sm" onClick={exportCSV} className="bg-wood-600 hover:bg-wood-700 text-white rounded-full">
                <PiDownloadSimpleLight className="w-4 h-4 mr-2" />
                Xuất danh sách (.csv)
              </Button>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-cream-50/50 border-b border-cream-200 text-xs uppercase tracking-widest text-charcoal-500 font-semibold">
                  <th className="px-4 py-3">Khách Thuê</th>
                  <th className="px-4 py-3">Phòng</th>
                  <th className="px-4 py-3">Liên Hệ</th>
                  <th className="px-4 py-3">Giấy Tờ</th>
                  <th className="px-4 py-3 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100">
                {filteredTenants.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-charcoal-400 italic text-sm">
                      Không tìm thấyngười thuê nào phù hợp.
                    </td>
                  </tr>
                ) : (
                  filteredTenants.map((tenant) => {
                    const infos = getTenantAssignments(tenant.id);
                      const isPhoneVisible = visiblePhones.has(tenant.id);
                    const hue = tenant.full_name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;
                    const avatarStyle = { background: `linear-gradient(135deg, hsl(${hue}, 70%, 65%), hsl(${hue + 20}, 70%, 50%))` };

                    return (
                      <tr key={tenant.id} className="hover:bg-cream-50/50 transition-colors group">
                        <td className="px-4 py-2.5 align-top">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-9 h-9 rounded-full flex items-center justify-center text-white font-serif lining-nums tabular-nums text-base shrink-0 shadow-sm"
                              style={avatarStyle}
                            >
                              {tenant.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-serif lining-nums tabular-nums text-charcoal-900 font-medium text-base">{tenant.full_name}</p>
                              {infos.some(i => i.assignment.is_primary) && (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-md border border-amber-100 mt-0.5 uppercase font-semibold tracking-wider">
                                  <PiCrownLight className="w-3 h-3" /> Chủ HĐ
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 align-top">
                          {infos.length > 0 ? (
                            <div className="flex flex-col gap-2 pt-1">
                              {infos.map((info, idx) => (
                                <div key={idx} className="flex flex-col gap-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-serif lining-nums tabular-nums font-medium text-wood-700">P.{info.room.room_number}</span>
                                    {info.assignment.is_primary && (
                                      <PiCrownLight className="w-3.5 h-3.5 text-amber-500" title="Chủ hợp đồng" />
                                    )}
                                  </div>
                                  {invoices.some(inv => inv.room_id === info.room.id && (inv.status === 'pending' || inv.status === 'overdue')) && (
                                    <span className="inline-block mt-0.5 px-1.5 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 rounded text-[10px] font-semibold tracking-wider w-fit">
                                      CHƯA ĐÓNG TIỀN
                                    </span>
                                  )}
                                  <span className="text-[10px] text-charcoal-400">
                                    Hết hạn: {info.assignment.contract_end_date ? new Date(info.assignment.contract_end_date).toLocaleDateString('vi-VN') : '—'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-sm text-charcoal-400 italic pt-1 inline-block">Chưa có</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 align-top">
                          <div className="space-y-1 pt-1">
                            {tenant.phone && (
                              <div className="flex items-center gap-2 text-sm text-charcoal-700">
                                <PiPhoneLight className="w-3.5 h-3.5 text-charcoal-400 shrink-0" />
                                <span className={`font-mono text-xs ${!isPhoneVisible ? 'tracking-widest' : ''}`}>
                                  {isPhoneVisible ? tenant.phone : maskValue(tenant.phone, 3)}
                                </span>
                                <button onClick={() => toggle(visiblePhones, setVisiblePhones, tenant.id)} className="p-0.5 hover:bg-cream-100 rounded text-charcoal-400">
                                  {isPhoneVisible ? <PiEyeSlashLight className="w-3.5 h-3.5" /> : <PiEyeLight className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            )}
                            {tenant.email && (
                              <div className="flex items-center gap-2 text-sm text-charcoal-700">
                                <PiEnvelopeSimpleLight className="w-3.5 h-3.5 text-charcoal-400 shrink-0" />
                                <span className="text-[11px] truncate max-w-[120px]" title={tenant.email}>{tenant.email}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 align-top">
                          {tenant.id_card_number ? (
                            <div className="flex items-center gap-2 text-sm text-charcoal-700 pt-1">
                              <PiIdentificationCardLight className="w-3.5 h-3.5 text-charcoal-400 shrink-0" />
                              <span className="font-mono text-xs">{maskValue(tenant.id_card_number, 3)}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-charcoal-400 italic pt-1 inline-block">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 align-top text-right">
                          <div className="flex justify-end items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pt-1">
                            <button onClick={() => openAssignModal(tenant)} className="p-1.5 rounded-lg text-charcoal-400 hover:text-wood-600 hover:bg-wood-50 transition-colors bg-white border border-transparent hover:border-wood-200" title="Gán phòng">
                              <PiUserPlusLight className="w-4 h-4" />
                            </button>
                            {infos.map((info, idx) => (
                              <button key={idx} onClick={() => handleCheckout(info.assignment)} className="flex items-center gap-1 p-1.5 rounded-lg text-amber-500 hover:text-amber-700 hover:bg-amber-50 transition-colors bg-white border border-transparent hover:border-amber-200" title={`Trả phòng ${info.room.room_number}`}>
                                <PiSignOutLight className="w-4 h-4" />
                                <span className="text-[10px] font-medium leading-none font-mono">{info.room.room_number}</span>
                              </button>
                            ))}
                            <button onClick={() => openEditModal(tenant)} className="p-1.5 rounded-lg text-charcoal-400 hover:text-wood-600 hover:bg-wood-50 transition-colors bg-white border border-transparent hover:border-wood-200" title="Sửa thông tin">
                              <PiPencilSimpleLight className="w-4 h-4" />
                            </button>
                            <button onClick={() => openDeleteModal(tenant)} className="p-1.5 rounded-lg text-charcoal-400 hover:text-rose-600 hover:bg-rose-50 transition-colors bg-white border border-transparent hover:border-rose-200" title="Xóa khách thuê">
                              <PiTrashLight className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}

      {/* Create/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingTenant ? 'Sửa thông tin' : 'Thêm người thuê mới'} size="lg">
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <Input label="Họ và tên" name="full_name" value={formData.full_name} onChange={(v) => setFormData({ ...formData, full_name: v })} required placeholder="Nguyễn Văn A" />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-charcoal-700">
                Số điện thoại <span className="text-rose-500 ml-1">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={parsedPhone.countryCode}
                  onChange={(e) => {
                    const newPhone = e.target.value + parsedPhone.body;
                    updatePhone(newPhone);
                  }}
                  className="w-1/3 px-3.5 py-2.5 rounded-xl border border-charcoal-200 focus:ring-wood-400 focus:border-wood-400 bg-white text-charcoal-900 transition-colors"
                >
                  {countryCodes.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  name="phone"
                  value={parsedPhone.body}
                  onChange={(e) => {
                    const cleanBody = e.target.value.replace(/\D/g, '').slice(0, 11);
                    const newPhone = parsedPhone.countryCode + cleanBody;
                    updatePhone(newPhone);
                  }}
                  placeholder="987654321"
                  required
                  className="w-2/3 px-3.5 py-2.5 rounded-xl border border-charcoal-200 focus:ring-wood-400 focus:border-wood-400 bg-white text-charcoal-900 transition-colors"
                />
              </div>
              {formErrors.phone && <p className="text-sm text-rose-600 font-medium">{formErrors.phone}</p>}
            </div>
            <Input
              label="Email"
              name="email"
              type="email"
              value={formData.email}
              onChange={updateEmail}
              placeholder="email@example.com"
              error={formErrors.email}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Số CMND/CCCD"
              name="id_card_number"
              value={formData.id_card_number}
              onChange={updateIDCard}
              placeholder="CCCD: 12 số / CMND: 9 số"
              error={formErrors.id_card_number}
            />
            <Input label="Ngày sinh" name="date_of_birth" type="date" value={formData.date_of_birth} onChange={(v) => setFormData({ ...formData, date_of_birth: v })} />
          </div>
          <Input label="Địa chỉ thường trú" name="address" value={formData.address} onChange={(v) => setFormData({ ...formData, address: v })} placeholder="123 Đường ABC, Quận XYZ, TP. HCM" />
          <Input label="Liên hệ khẩn cấp" name="emergency_contact" value={formData.emergency_contact} onChange={(v) => setFormData({ ...formData, emergency_contact: v })} placeholder="Nguyễn Văn B - 0909876543" />
          <Input label="Ghi chú" name="notes" type="textarea" value={formData.notes} onChange={(v) => setFormData({ ...formData, notes: v })} rows={1} />
          <div className="flex gap-3 pt-5 border-t border-charcoal-100">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : editingTenant ? 'Cập nhật' : 'Thêm mới'}</Button>
          </div>
        </form>
      </Modal>

      {/* Assign Room Modal */}
      <Modal isOpen={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)} title={`Gán phòng cho ${assigningTenant?.full_name}`} size="md">
        <form onSubmit={handleAssign} className="p-5 space-y-4">
          <Input label="Chọn phòng" name="room_id" type="select" value={assignData.room_id} onChange={(v) => setAssignData({ ...assignData, room_id: v })} required
            options={[
              { value: '', label: '-- Chọn phòng --' },
              ...assignableRooms.map((r) => ({
                value: r.id,
                label: `Phòng ${r.room_number} - ${r.monthly_rent.toLocaleString('vi-VN')}đ${r.active_assignments?.length ? ` (${r.active_assignments.length}người)` : ' (trống)'}`,
              })),
            ]}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Ngày bắt đầu thuê" name="start_date" type="date" value={assignData.start_date} onChange={(v) => setAssignData({ ...assignData, start_date: v })} required />
            <Input label="Tiền cọc (VNĐ)" name="deposit_amount" type="number" value={assignData.deposit_amount} onChange={(v) => setAssignData({ ...assignData, deposit_amount: v })} min={0} />
          </div>
          <Input label="Ngày kết thúc hợp đồng" name="contract_end_date" type="date" value={assignData.contract_end_date} onChange={(v) => setAssignData({ ...assignData, contract_end_date: v })} />
          <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
            <input
              type="checkbox"
              id="assign_is_primary"
              checked={assignData.is_primary}
              onChange={(e) => setAssignData({ ...assignData, is_primary: e.target.checked })}
              className="w-4 h-4 text-wood-500 rounded border-charcoal-300 focus:ring-wood-400"
            />
            <label htmlFor="assign_is_primary" className="flex items-center gap-2 text-sm font-medium text-charcoal-700 cursor-pointer">
              <PiCrownLight className="w-4 h-4 text-amber-500" />
              Là chủ hợp đồng
            </label>
          </div>
          <Input label="Ghi chú" name="notes" type="textarea" value={assignData.notes} onChange={(v) => setAssignData({ ...assignData, notes: v })} rows={1} />
          <div className="flex gap-3 pt-5 border-t border-charcoal-100">
            <Button type="button" variant="secondary" onClick={() => setIsAssignModalOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={saving || !assignData.room_id}>{saving ? 'Đang xử lý...' : 'Xác nhận'}</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Xác nhận xóa" size="sm">
        <div className="p-6">
          <p className="text-charcoal-600">Bạn có chắc muốn xóa người thuê <strong className="text-charcoal-900">{deletingTenant?.full_name}</strong>?</p>
          <div className="flex gap-3 mt-6">
            <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>Hủy</Button>
            <Button variant="danger" onClick={handleDelete}>Xóa</Button>
          </div>
        </div>
      </Modal>
      </div>
  );
}
