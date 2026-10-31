import { useEffect, useState } from 'react';
import {
  PiFunnelLight,
  PiCaretDownLight,
  PiCaretUpLight,
  PiPlusLight,
  PiDoorOpenLight,
  PiPencilSimpleLight,
  PiTrashLight,
  PiUserLight,
  PiUserPlusLight,
  PiCrownLight,
  PiSignOutLight,
  PiCalendarBlankLight,
  PiMoneyLight,
  PiInfoLight,
  PiMagnifyingGlassLight,
  PiWarningCircleLight,
  PiArrowsClockwiseLight,
  PiGridFourLight,
  PiListLight,
  PiCheckSquareOffsetLight
} from 'react-icons/pi';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Input, Badge, Spinner, EmptyState } from '../components/ui/Input';
import {
  getRooms,
  getTenants,
  createRoom,
  updateRoom,
  deleteRoom,
  assignTenantToRoom,
  endRoomAssignment,
  setPrimaryTenant,
  getExpiringContracts,
  extendContract,
} from '../lib/api';
import type { Room, Tenant, RoomAssignment } from '../types';

export function Rooms() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [deletingRoom, setDeletingRoom] = useState<Room | null>(null);
  const [assigningRoom, setAssigningRoom] = useState<Room | null>(null);
  const [viewingRoom, setViewingRoom] = useState<Room | null>(null);
  const [extendingAssignment, setExtendingAssignment] = useState<RoomAssignment | null>(null);
  const [filter, setFilter] = useState<'all' | 'available' | 'occupied' | 'maintenance'>('all');

  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => (localStorage.getItem('roomsViewMode') as 'grid' | 'list') || 'grid');

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [isBulkStatusModalOpen, setIsBulkStatusModalOpen] = useState(false);
  const [isBulkPriceModalOpen, setIsBulkPriceModalOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<'available' | 'maintenance'>('available');
  const [bulkPrice, setBulkPrice] = useState<string | number>('');

  useEffect(() => {
    localStorage.setItem('roomsViewMode', viewMode);
  }, [viewMode]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [floorFilter, setFloorFilter] = useState('');
  const [occupantsFilter, setOccupantsFilter] = useState('');
  const [areaRange, setAreaRange] = useState('');
  const [rentRange, setRentRange] = useState('');
    const [expiringContracts, setExpiringContracts] = useState<RoomAssignment[]>([]);
  const [extendData, setExtendData] = useState({
    contract_end_date: '',
  });
  const [formData, setFormData] = useState({
    room_number: '',
    floor: 1,
    area_sqm: '' as string | number,
    monthly_rent: '' as string | number,
    max_occupants: 2,
    status: 'available' as 'available' | 'occupied' | 'maintenance',
    description: '',
    location: 'Cơ sở chính',
  });
  const [assignData, setAssignData] = useState({
    tenant_id: '',
    start_date: new Date().toISOString().split('T')[0],
    deposit_amount: '' as string | number,
    is_primary: true,
    contract_end_date: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [roomsData, tenantsData, expiringData] = await Promise.all([
        getRooms(),
        getTenants(),
        getExpiringContracts(30).catch(() => [] as RoomAssignment[]),
      ]);
      setRooms(roomsData);
      setTenants(tenantsData);
      setExpiringContracts(expiringData);
    } catch (error) {
      console.error('Failed to load rooms:', error);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingRoom(null);
    setFormData({ room_number: '', floor: 1, area_sqm: '', monthly_rent: '', max_occupants: 2, status: 'available', description: '', location: 'Cơ sở chính' });
    setIsModalOpen(true);
  }

  function openEditModal(room: Room) {
    setEditingRoom(room);
    setFormData({
      room_number: room.room_number,
      floor: Math.min(room.floor, 50),
      area_sqm: room.area_sqm ?? '',
      monthly_rent: room.monthly_rent ?? '',
      max_occupants: room.max_occupants || 2,
      status: room.status,
      description: room.description || '',
      location: room.location || '',
    });
    setIsModalOpen(true);
  }

  function openDeleteModal(room: Room) {
    if ((room.active_assignments?.length ?? 0) > 0) {
      alert(`Không thể xóa phòng ${room.room_number} vì hiện có ${room.active_assignments?.length}người đang ở. Vui lòng cho tất cảngười thuê trả phòng trước.`);
      return;
    }
    setDeletingRoom(room);
    setIsDeleteModalOpen(true);
  }

  function openAssignModal(room: Room) {
    setAssigningRoom(room);
    const hasTenants = (room.active_assignments?.length ?? 0) > 0;
    // Default contract end date: 1 year from now
    const defaultEndDate = new Date();
    defaultEndDate.setFullYear(defaultEndDate.getFullYear() + 1);
    setAssignData({
      tenant_id: '',
      start_date: new Date().toISOString().split('T')[0],
      deposit_amount: '',
      is_primary: !hasTenants,
      contract_end_date: defaultEndDate.toISOString().split('T')[0],
      notes: '',
    });
    setIsAssignModalOpen(true);
  }

  function openDetailModal(room: Room) {
    setViewingRoom(room);
    setIsDetailModalOpen(true);
  }

  function openExtendModal(assignment: RoomAssignment) {
    setExtendingAssignment(assignment);
    let defaultDate: Date;
    if (assignment.contract_end_date) {
      // Extend from current end date by 1 month
      defaultDate = new Date(assignment.contract_end_date);
      defaultDate.setMonth(defaultDate.getMonth() + 1);
    } else {
      // No date yet: default to 1 year from today
      defaultDate = new Date();
      defaultDate.setFullYear(defaultDate.getFullYear() + 1);
    }
    setExtendData({ contract_end_date: defaultDate.toISOString().split('T')[0] });
    setIsExtendModalOpen(true);
  }

  async function handleExtendContract() {
    if (!extendingAssignment) return;
    setSaving(true);
    try {
      await extendContract(extendingAssignment.id, extendData.contract_end_date);
      await loadData();
      setIsExtendModalOpen(false);
    } catch (error) {
      alert('Không thể gia hạn hợp đồng. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (formData.floor > 50) {
      alert('Tầng không được vượt quá 50.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...formData,
        area_sqm: parseFloat(formData.area_sqm as any) || 0,
        monthly_rent: parseFloat(formData.monthly_rent as any) || 0,
      };
      let savedRoom: Room;
      
      const currentTenants = editingRoom?.active_assignments?.length ?? 0;
      let needsAssignPrompt = false;
      if (payload.status === 'occupied' && currentTenants === 0) {
        payload.status = 'available';
        needsAssignPrompt = true;
      }

      if (editingRoom) {
        savedRoom = await updateRoom(editingRoom.id, payload);
      } else {
        savedRoom = await createRoom(payload);
      }
      await loadData();
      setIsModalOpen(false);

      if (needsAssignPrompt) {
        setTimeout(() => {
          alert('Không thể chuyển sang "Đang thuê" khi chưa có người ở. Hệ thống tạm lưu là "Trống". Vui lòng gán người thuê để tự động cập nhật trạng thái!');
          openAssignModal(savedRoom);
        }, 300);
      }
    } catch (error: any) {
      console.error('Failed to save room:', error);
      const msg = error?.message || 'Không thể lưu phòng. Vui lòng thử lại.';
      alert(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingRoom) return;
    try {
      await deleteRoom(deletingRoom.id);
      await loadData();
      setIsDeleteModalOpen(false);
    } catch (error: any) {
      console.error('Failed to delete room:', error);
      const msg = error?.response?.data?.error || error?.message || 'Không thể xóa phòng.';
      alert(msg);
    }
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!assigningRoom) return;
    setSaving(true);
    try {
      await assignTenantToRoom(
        assigningRoom.id,
        assignData.tenant_id,
        assignData.start_date,
        parseFloat(assignData.deposit_amount as any) || 0,
        assignData.is_primary,
        assignData.notes,
        assignData.contract_end_date || undefined
      );
      await loadData();
      setIsAssignModalOpen(false);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Không thể gán người thuê.';
      alert(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleCheckout(assignment: RoomAssignment) {
    if (!confirm(`Xác nhận trả phòng cho ${assignment.tenant?.full_name}?`)) return;
    try {
      await endRoomAssignment(assignment.id);
      await loadData();
      // Refresh viewing room if open
      if (viewingRoom) {
        const updated = rooms.find(r => r.id === viewingRoom.id);
        if (updated) setViewingRoom(updated);
      }
    } catch (error) {
      alert('Không thể trả phòng. Vui lòng thử lại.');
    }
  }

  async function handleSetPrimary(assignment: RoomAssignment, roomId: string) {
    try {
      await setPrimaryTenant(assignment.id, roomId);
      await loadData();
    } catch (error) {
      alert('Không thể cập nhật chủ hợp đồng.');
    }
  }

  const uniqueLocations = Array.from(new Set(rooms.map(r => r.location).filter(Boolean)));

  const filteredRooms = rooms.filter((r) => {
    const matchesStatus = filter === 'all' || r.status === filter;
    const matchesSearch = !searchQuery || 
      r.room_number.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (r.location && r.location.toLowerCase().includes(searchQuery.toLowerCase()));
      
    if (!matchesStatus || !matchesSearch) return false;

    if (showFilters) {
      if (floorFilter && r.floor.toString() !== floorFilter) return false;
      if (occupantsFilter && r.max_occupants.toString() !== occupantsFilter) return false;
  
      if (areaRange) {
        const area = r.area_sqm || 0;
        if (areaRange === '<20' && area >= 20) return false;
        if (areaRange === '20-30' && (area < 20 || area > 30)) return false;
        if (areaRange === '>30' && area <= 30) return false;
      }
      if (rentRange) {
        const rent = r.monthly_rent || 0;
        if (rentRange === '<2m' && rent >= 2000000) return false;
        if (rentRange === '2m-3m' && (rent < 2000000 || rent > 3000000)) return false;
        if (rentRange === '3m-5m' && (rent < 3000000 || rent > 5000000)) return false;
        if (rentRange === '>5m' && rent <= 5000000) return false;
      }
    }

    return true;
  });

  const toggleRoomSelection = (roomId: string) => {
    const newSelected = new Set(selectedRooms);
    if (newSelected.has(roomId)) {
      newSelected.delete(roomId);
    } else {
      newSelected.add(roomId);
    }
    setSelectedRooms(newSelected);
  };

  const toggleAllSelection = () => {
    if (selectedRooms.size === filteredRooms.length) {
      setSelectedRooms(new Set());
    } else {
      setSelectedRooms(new Set(filteredRooms.map(r => r.id)));
    }
  };

  const handleBulkUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await Promise.all(Array.from(selectedRooms).map(id => updateRoom(id, { status: bulkStatus })));
      setIsBulkStatusModalOpen(false);
      setSelectedRooms(new Set());
      loadData();
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleBulkUpdatePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkPrice) return;
    setSaving(true);
    try {
      await Promise.all(Array.from(selectedRooms).map(id => updateRoom(id, { monthly_rent: Number(bulkPrice) })));
      setIsBulkPriceModalOpen(false);
      setSelectedRooms(new Set());
      loadData();
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const statusCounts = {
    all: rooms.length,
    available: rooms.filter((r) => r.status === 'available').length,
    occupied: rooms.filter((r) => r.status === 'occupied').length,
    maintenance: rooms.filter((r) => r.status === 'maintenance').length,
  };

  const availableForAssign = tenants.filter(
    (t) => !assigningRoom?.active_assignments?.some((a) => a.tenant_id === t.id)
  );

  if (loading) return <Spinner />;

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-serif lining-nums tabular-nums text-charcoal-900 tracking-wide">Phòng trọ</h1>
          <p className="text-charcoal-400 mt-2 text-sm">Quản lý và theo dõi tất cả các phòng trọ</p>
        </div>
        <Button onClick={openCreateModal}>
          <PiPlusLight className="w-4 h-4" />
          Thêm phòng mới
        </Button>
      </header>

      {/* Filters */}
      <section className="space-y-4">
        <div className="flex gap-1 lg:gap-2 items-center w-full">
          {(['all', 'available', 'occupied', 'maintenance'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-2 lg:px-4 py-2.5 text-sm font-medium rounded-xl transition-all whitespace-nowrap shrink-0 ${
                filter === status
                  ? 'bg-white text-charcoal-900 shadow-card border border-charcoal-100'
                  : 'text-charcoal-400 hover:text-charcoal-600 hover:bg-white/50'
              }`}
            >
              {status === 'all' && 'Tất cả'}
              {status === 'available' && 'Trống'}
              {status === 'occupied' && 'Đang thuê'}
              {status === 'maintenance' && 'Bảo trì'}
              <span className={`ml-2 px-2 py-0.5 rounded-lg text-[10px] ${
                filter === status ? 'bg-wood-100 text-wood-700' : 'bg-charcoal-100 text-charcoal-500'
              }`}>{statusCounts[status]}</span>
            </button>
          ))}
          
          <div className="flex bg-charcoal-100/50 rounded-xl p-1 mr-4">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-charcoal-900' : 'text-charcoal-400 hover:text-charcoal-600'}`}
              title="Chế độ Lưới"
            >
              <PiGridFourLight className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-charcoal-900' : 'text-charcoal-400 hover:text-charcoal-600'}`}
              title="Chế độ Danh sách"
            >
              <PiListLight className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={() => {
              setIsSelectionMode(!isSelectionMode);
              if (isSelectionMode) setSelectedRooms(new Set()); // Clear selection when exiting mode
            }}
            className={`flex items-center justify-center min-w-[100px] gap-1.5 py-1.5 rounded-xl text-sm font-medium transition-colors mr-2 md:mr-4 ${
              isSelectionMode ? 'bg-wood-100 text-wood-700 shadow-sm' : 'text-charcoal-500 hover:text-charcoal-700 bg-charcoal-50 hover:bg-charcoal-100/50'
            }`}
          >
            <PiCheckSquareOffsetLight className="w-4 h-4 shrink-0" />
            <span className="truncate">{isSelectionMode ? 'Hủy chọn' : 'Chọn'}</span>
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <div className="relative">
              <PiMagnifyingGlassLight className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
              <input
                type="text"
                placeholder="Tìm phòng, khu vực..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-2 text-sm rounded-xl border border-charcoal-200 focus:ring-wood-400 focus:border-wood-400 bg-white text-charcoal-900 transition-colors w-32 md:w-40 lg:w-48 xl:w-56 shrink"
              />
            </div>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border transition-all ${showFilters ? 'bg-wood-50 border-wood-200 text-wood-700' : 'bg-white border-charcoal-200 text-charcoal-600 hover:bg-cream-50'}`}
            >
              <PiFunnelLight className="w-4 h-4" /> Lọc
              {showFilters ? <PiCaretUpLight className="w-3 h-3" /> : <PiCaretDownLight className="w-3 h-3" />}
            </button>
          </div>
        </div>
        
        {/* Advanced Filters Panel */}
        {showFilters && (
          <div className="relative z-50 bg-cream-50/80 backdrop-blur-sm p-6 rounded-2xl border border-cream-200 shadow-inner animate-in fade-in slide-in-from-top-2 duration-200 mt-4">
            <div className="flex items-center gap-2 mb-4 text-charcoal-600">
              <PiFunnelLight className="w-4 h-4" />
              <h4 className="text-sm font-semibold tracking-wide">BỘ LỌC CHI TIẾT</h4>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">

              <Input 
                label="Tầng" 
                name="floorFilter" 
                type="number" 
                placeholder="Ví dụ: 1" 
                value={floorFilter} 
                onChange={(v) => setFloorFilter(v)} 
              />
              <Input 
                label="Số người ở tối đa" 
                name="occupantsFilter" 
                type="number" 
                placeholder="Ví dụ: 2" 
                value={occupantsFilter} 
                onChange={(v) => setOccupantsFilter(v)} 
              />
              
              <Input 
                label="Diện tích" 
                name="areaRange" 
                type="select" 
                value={areaRange} 
                onChange={(v) => setAreaRange(v)} 
                options={[
                  {value: '', label: 'Tất cả'}, 
                  {value: '<20', label: 'Dưới 20 m²'},
                  {value: '20-30', label: '20 - 30 m²'},
                  {value: '>30', label: 'Trên 30 m²'}
                ]} 
              />
              <Input 
                label="Giá thuê" 
                name="rentRange" 
                type="select" 
                value={rentRange} 
                onChange={(v) => setRentRange(v)} 
                options={[
                  {value: '', label: 'Tất cả'}, 
                  {value: '<2m', label: 'Dưới 2 triệu'},
                  {value: '2m-3m', label: '2 - 3 triệu'},
                  {value: '3m-5m', label: '3 - 5 triệu'},
                  {value: '>5m', label: 'Trên 5 triệu'}
                ]} 
              />
            </div>
            
            {(floorFilter || occupantsFilter || areaRange || rentRange) && (
              <div className="mt-5 flex justify-end">
                <button 
                  onClick={() => {
                    setFloorFilter(''); setOccupantsFilter('');
                    setAreaRange(''); setRentRange('');
                  }}
                  className="text-xs font-medium text-charcoal-500 hover:text-wood-600 transition-colors underline underline-offset-2"
                >
                  Xóa tất cả bộ lọc
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Expiring Contracts Alert */}
      {expiringContracts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <PiWarningCircleLight className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-900">Hợp đồng sắp hết hạn</h3>
              <p className="text-xs text-amber-700 mt-0.5">
                {expiringContracts.length} hợp đồng sẽ hết hạn trong vòng 30Đã đóngày tới
              </p>
              <div className="mt-3 space-y-2">
                {expiringContracts.map((assignment) => (
                  <div key={assignment.id} className="flex items-center justify-between bg-white/70 rounded-lg px-4 py-2">
                    <div className="flex items-center gap-3">
                      <PiCalendarBlankLight className="w-4 h-4 text-amber-600" />
                      <span className="text-xs font-medium text-charcoal-900">
                        {assignment.tenant?.full_name} - Phòng {assignment.room?.room_number}
                      </span>
                      <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                        Hết hạn: {assignment.contract_end_date ? new Date(assignment.contract_end_date).toLocaleDateString('vi-VN') : 'N/A'}
                      </span>
                    </div>
                    <button
                      onClick={() => openExtendModal(assignment)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-wood-600 bg-wood-50 hover:bg-wood-100 rounded-lg transition-colors"
                    >
                      <PiArrowsClockwiseLight className="w-3.5 h-3.5" />
                      Gia hạn
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedRooms.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-charcoal-900 text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-6 z-50 animate-fade-in border border-charcoal-700">
          <div className="flex items-center gap-3 pr-6 border-r border-charcoal-700">
            <div className="w-8 h-8 rounded-full bg-charcoal-800 flex items-center justify-center text-sm font-bold">
              {selectedRooms.size}
            </div>
            <span className="text-sm font-medium">phòng đã chọn</span>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsBulkStatusModalOpen(true)}
              className="px-4 py-2 text-sm font-medium bg-charcoal-800 hover:bg-charcoal-700 rounded-full transition-colors flex items-center gap-2"
            >
              Cập nhật trạng thái
            </button>
            <button 
              onClick={() => setIsBulkPriceModalOpen(true)}
              className="px-4 py-2 text-sm font-medium bg-charcoal-800 hover:bg-charcoal-700 rounded-full transition-colors flex items-center gap-2"
            >
              Cập nhật giá
            </button>
            <button 
              onClick={() => setSelectedRooms(new Set())}
              className="p-2 text-charcoal-400 hover:text-white rounded-full transition-colors ml-2"
              title="Bỏ chọn"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Room Grid / List */}
      {filteredRooms.length === 0 ? (
        <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card p-12">
          <EmptyState
            icon={<PiDoorOpenLight className="w-10 h-10" />}
            title="Chưa có phòng nào"
            description="Bắt đầu bằng cách thêm phòng trọ mới vào hệ thống"
            action={<Button onClick={openCreateModal}><PiPlusLight className="w-4 h-4 mr-1" />Thêm phòng</Button>}
          />
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-5">
          {filteredRooms.map((room) => (
            <PropertyCard
              key={room.id}
              room={room}
              isSelectionMode={isSelectionMode}
              selected={selectedRooms.has(room.id)}
              onToggleSelect={() => toggleRoomSelection(room.id)}
              onView={() => openDetailModal(room)}
              onEdit={() => openEditModal(room)}
              onDelete={() => openDeleteModal(room)}
              onAssignTenant={() => openAssignModal(room)}
              onCheckout={handleCheckout}
              onSetPrimary={handleSetPrimary}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-[2rem] border border-cream-200 shadow-soft overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-cream-50/50 border-b border-cream-200 text-[11px] uppercase tracking-widest text-charcoal-400 font-semibold">
                <th className="p-4 pl-6 w-12">
                  <input 
                    type="checkbox" 
                    checked={selectedRooms.size === filteredRooms.length && filteredRooms.length > 0}
                    onChange={toggleAllSelection}
                    className="w-4 h-4 rounded border-cream-300 text-wood-500 focus:ring-wood-400 cursor-pointer"
                  />
                </th>
                <th className="p-4">Phòng</th>
                <th className="p-4">Trạng thái</th>
                <th className="p-4">Giá thuê</th>
                <th className="p-4">Sức chứa</th>
                <th className="p-4">Người thuê chính</th>
                <th className="p-4 pr-6 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {filteredRooms.map(room => {
                const currentOccupants = room.active_assignments?.length || 0;
                const maxOccupants = room.max_occupants || 2;
                const primaryAssignment = room.active_assignments?.find(a => a.is_primary);
                
                return (
                  <tr key={room.id} className="hover:bg-cream-50/50 transition-colors group">
                    <td className="p-4 pl-6">
                      <input 
                        type="checkbox" 
                        checked={selectedRooms.has(room.id)}
                        onChange={() => toggleRoomSelection(room.id)}
                        className="w-4 h-4 rounded border-cream-300 text-wood-500 focus:ring-wood-400 cursor-pointer"
                      />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-charcoal-50 flex items-center justify-center shrink-0 border border-charcoal-100">
                          <PiDoorOpenLight className="w-5 h-5 text-charcoal-400" />
                        </div>
                        <div>
                          <p className="font-serif lining-nums tabular-nums font-medium text-charcoal-900 cursor-pointer hover:text-wood-600 transition-colors" onClick={() => openDetailModal(room)}>Phòng {room.room_number}</p>
                          <p className="text-xs text-charcoal-400">Tầng {room.floor} • {room.area_sqm}m² • {room.location || 'Cơ sở chính'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge 
                        status={room.status} 
                        variant={room.status === 'available' ? 'success' : room.status === 'occupied' ? 'info' : 'default'} 
                        size="sm" 
                      />
                    </td>
                    <td className="p-4 font-serif lining-nums tabular-nums text-wood-600">
                      {room.monthly_rent.toLocaleString('vi-VN')}đ
                    </td>
                    <td className="p-4">
                      <p className={`text-sm font-medium ${currentOccupants >= maxOccupants ? 'text-amber-600' : 'text-charcoal-600'}`}>
                        {currentOccupants}/{maxOccupants} người
                      </p>
                    </td>
                    <td className="p-4">
                      {primaryAssignment ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-amber-50 flex items-center justify-center">
                            <PiCrownLight className="w-3.5 h-3.5 text-amber-600" />
                          </div>
                          <span className="text-sm text-charcoal-800 font-medium">{primaryAssignment.tenant?.full_name}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-charcoal-300 italic">Trống</span>
                      )}
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEditModal(room)} className="p-2 rounded-lg text-charcoal-400 hover:text-wood-600 hover:bg-wood-50 transition-colors" title="Sửa">
                          <PiPencilSimpleLight className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => openDeleteModal(room)} 
                          disabled={currentOccupants > 0}
                          className={`p-2 rounded-lg transition-colors ${currentOccupants > 0 ? 'text-cream-200 cursor-not-allowed' : 'text-charcoal-400 hover:text-rose-500 hover:bg-rose-50'}`}
                          title="Xóa"
                        >
                          <PiTrashLight className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk Status Modal */}
      <Modal isOpen={isBulkStatusModalOpen} onClose={() => setIsBulkStatusModalOpen(false)} title="Cập nhật trạng thái hàng loạt" size="sm">
        <form onSubmit={handleBulkUpdateStatus} className="p-5 space-y-4">
          <div className="p-3 bg-amber-50 rounded-xl mb-4">
            <p className="text-sm text-amber-800">
              Bạn đang cập nhật <strong>{selectedRooms.size}</strong> phòng. Lưu ý: Các phòng đang có người ở sẽ không bị ảnh hưởng nếu bạn chuyển sang Trống/Bảo trì.
            </p>
          </div>
          <Input label="Trạng thái mới" name="status" type="select" value={bulkStatus} onChange={(v) => setBulkStatus(v as any)} required
            options={[
              { value: 'available', label: 'Trống' },
              { value: 'maintenance', label: 'Bảo trì' },
            ]} />
          <div className="flex gap-3 pt-4 border-t border-charcoal-100">
            <Button type="button" variant="secondary" onClick={() => setIsBulkStatusModalOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Đang xử lý...' : 'Xác nhận'}</Button>
          </div>
        </form>
      </Modal>

      {/* Bulk Price Modal */}
      <Modal isOpen={isBulkPriceModalOpen} onClose={() => setIsBulkPriceModalOpen(false)} title="Cập nhật giá hàng loạt" size="sm">
        <form onSubmit={handleBulkUpdatePrice} className="p-5 space-y-4">
          <div className="p-3 bg-amber-50 rounded-xl mb-4">
            <p className="text-sm text-amber-800">
              Bạn đang cập nhật giá thuê cho <strong>{selectedRooms.size}</strong> phòng.
            </p>
          </div>
          <Input label="Giá thuê mới (VNĐ)" name="monthly_rent" type="number" value={bulkPrice} onChange={(v) => setBulkPrice(v)} required min={0} />
          <div className="flex gap-3 pt-4 border-t border-charcoal-100">
            <Button type="button" variant="secondary" onClick={() => setIsBulkPriceModalOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Đang xử lý...' : 'Xác nhận'}</Button>
          </div>
        </form>
      </Modal>

      {/* Room Detail Modal */}
      <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title={`Chi tiết phòng ${viewingRoom?.room_number}`} size="lg">
        {viewingRoom && (
          <div className="p-6 space-y-6">
            {/* Room Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-cream-50 rounded-xl border border-charcoal-100">
                <p className="text-xs text-charcoal-400 uppercase tracking-wide font-medium mb-1">Trạng thái</p>
                <Badge status={viewingRoom.status} variant={
                  viewingRoom.status === 'available' ? 'success' : viewingRoom.status === 'occupied' ? 'info' : 'default'
                } />
              </div>
              <div className="p-4 bg-cream-50 rounded-xl border border-charcoal-100">
                <p className="text-xs text-charcoal-400 uppercase tracking-wide font-medium mb-1">Tầng</p>
                <p className="font-semibold text-charcoal-900">Tầng {viewingRoom.floor}</p>
              </div>
              <div className="p-4 bg-cream-50 rounded-xl border border-charcoal-100">
                <p className="text-xs text-charcoal-400 uppercase tracking-wide font-medium mb-1">Vị trí</p>
                <p className="font-semibold text-charcoal-900">{viewingRoom.location || 'Cơ sở chính'}</p>
              </div>
              <div className="p-4 bg-cream-50 rounded-xl border border-charcoal-100">
                <p className="text-xs text-charcoal-400 uppercase tracking-wide font-medium mb-1">Diện tích</p>
                <p className="font-semibold text-charcoal-900">{viewingRoom.area_sqm} m²</p>
              </div>
              <div className="p-4 bg-cream-50 rounded-xl border border-charcoal-100">
                <p className="text-xs text-charcoal-400 uppercase tracking-wide font-medium mb-1">Giá thuê/tháng</p>
                <p className="font-semibold text-wood-600">{viewingRoom.monthly_rent.toLocaleString('vi-VN')}đ</p>
              </div>
            </div>

            {/* Capacity */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-charcoal-700">Người đang ở</p>
                <p className="text-sm text-charcoal-500">
                  {viewingRoom.active_assignments?.length || 0}/{viewingRoom.max_occupants}người
                </p>
              </div>
              <div className="h-2 bg-charcoal-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-wood-400 rounded-full transition-all"
                  style={{ width: `${Math.min(100, ((viewingRoom.active_assignments?.length || 0) / (viewingRoom.max_occupants || 1)) * 100)}%` }}
                />
              </div>
            </div>

            {/* Occupants */}
            {(viewingRoom.active_assignments?.length ?? 0) > 0 ? (
              <div>
                <p className="text-sm font-medium text-charcoal-700 mb-3">Danh sách người ở</p>
                <div className="space-y-3">
                  {viewingRoom.active_assignments!.map((assignment) => (
                    <div key={assignment.id} className="bg-white border border-charcoal-100 rounded-xl p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            assignment.is_primary ? 'bg-amber-100' : 'bg-charcoal-50'
                          }`}>
                            {assignment.is_primary
                              ? <PiCrownLight className="w-5 h-5 text-amber-600" />
                              : <PiUserLight className="w-5 h-5 text-charcoal-400" />
                            }
                          </div>
                          <div>
                            <p className="font-semibold text-charcoal-900">{assignment.tenant?.full_name}</p>
                            <p className={`text-xs font-medium ${assignment.is_primary ? 'text-amber-600' : 'text-charcoal-400'}`}>
                              {assignment.is_primary ? 'Chủ hợp đồng' : 'Người ở cùng'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 pt-3 border-t border-charcoal-100">
                        <div className="flex items-center gap-2 text-sm text-charcoal-500">
                          <PiCalendarBlankLight className="w-4 h-4 shrink-0" />
                          <span>Vào ở: <span className="font-medium text-charcoal-700">{new Date(assignment.start_date).toLocaleDateString('vi-VN')}</span></span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-charcoal-500">
                          <PiMoneyLight className="w-4 h-4 shrink-0" />
                          <span>Cọc: <span className="font-medium text-charcoal-700">{Number(assignment.deposit_amount).toLocaleString('vi-VN')}đ</span></span>
                        </div>
                        {/* Contract end date - always shown */}
                        <div className="col-span-2 flex items-center justify-between gap-2 text-sm">
                          <div className="flex items-center gap-2 text-charcoal-500">
                            <PiCalendarBlankLight className="w-4 h-4 shrink-0 text-wood-500" />
                            {assignment.contract_end_date ? (
                              <span>Hết hạn HĐ: <span className="font-medium text-charcoal-700">{new Date(assignment.contract_end_date).toLocaleDateString('vi-VN')}</span></span>
                            ) : (
                              <span className="text-charcoal-400 italic">Chưa đặtĐã đóngày kết thúc HĐ</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {assignment.contract_end_date && (() => {
                              const daysLeft = Math.ceil((new Date(assignment.contract_end_date).getTime() - new Date().getTime()) / 86400000);
                              if (daysLeft <= 0) return <span className="text-xs font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg">Đã hết hạn</span>;
                              if (daysLeft <= 30) return <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg">Còn {daysLeft}Đã đóngày</span>;
                              return null;
                            })()}
                            <button
                              onClick={() => openExtendModal(assignment)}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-wood-600 bg-wood-50 hover:bg-wood-100 rounded-lg transition-colors"
                            >
                              <PiArrowsClockwiseLight className="w-3 h-3" />
                              {assignment.contract_end_date ? 'Gia hạn' : 'ĐặtĐã đóngày'}
                            </button>
                          </div>
                        </div>
                        {assignment.notes && (
                          <div className="col-span-2 flex items-start gap-2 text-sm text-charcoal-500">
                            <PiInfoLight className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{assignment.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center bg-cream-50 rounded-xl border border-charcoal-100">
                <p className="text-charcoal-400">Phòng hiện chưa có người ở</p>
              </div>
            )}

            {viewingRoom.description && (
              <div className="p-4 bg-cream-50 rounded-xl border border-charcoal-100">
                <p className="text-xs text-charcoal-400 uppercase tracking-wide font-medium mb-2">Ghi chú</p>
                <p className="text-charcoal-700 text-sm">{viewingRoom.description}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2 border-t border-charcoal-100">
              <Button variant="secondary" onClick={() => setIsDetailModalOpen(false)}>Đóng</Button>
              <Button onClick={() => { setIsDetailModalOpen(false); openEditModal(viewingRoom); }}>
                <PiPencilSimpleLight className="w-4 h-4 mr-1" />Sửa thông tin
              </Button>
              {viewingRoom.status !== 'maintenance' && (viewingRoom.active_assignments?.length ?? 0) < (viewingRoom.max_occupants ?? 2) && (
                <Button variant="secondary" onClick={() => { setIsDetailModalOpen(false); openAssignModal(viewingRoom); }}>
                  <PiUserPlusLight className="w-4 h-4 mr-1" />Thêm người
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Create/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingRoom ? 'Sửa thông tin phòng' : 'Thêm phòng mới'} size="md">
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <Input label="Địa chỉ (Tên đường, Số nhà...)" name="location" value={formData.location} onChange={(v) => setFormData({ ...formData, location: v })} placeholder="VD: 123 Lê Văn Sỹ..." />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Số phòng" name="room_number" value={formData.room_number} onChange={(v) => setFormData({ ...formData, room_number: v })} required placeholder="VD: 101" />
            <Input label="Tầng (tối đa 50)" name="floor" type="number" value={formData.floor} onChange={(v) => setFormData({ ...formData, floor: Math.min(parseInt(v) || 1, 50) })} min={1} max={50} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Diện tích (m²)" name="area_sqm" type="number" value={formData.area_sqm} onChange={(v) => setFormData({ ...formData, area_sqm: v })} min={0} step={0.1} />
            <Input label="Giá thuê/tháng (VNĐ)" name="monthly_rent" type="number" value={formData.monthly_rent} onChange={(v) => setFormData({ ...formData, monthly_rent: v })} min={0} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Sức chứa (người)" name="max_occupants" type="number" value={formData.max_occupants} onChange={(v) => setFormData({ ...formData, max_occupants: parseInt(v) || 2 })} min={1} max={10} required />
            <Input label="Trạng thái" name="status" type="select" value={formData.status} onChange={(v) => setFormData({ ...formData, status: v as 'available' | 'occupied' | 'maintenance' })}
              options={[{ value: 'available', label: 'Trống' }, { value: 'occupied', label: 'Đang thuê' }, { value: 'maintenance', label: 'Bảo trì' }]} />
          </div>
          <Input label="Ghi chú" name="description" type="textarea" value={formData.description} onChange={(v) => setFormData({ ...formData, description: v })} placeholder="Mô tả thêm về phòng..." rows={1} />
          <div className="flex gap-3 pt-4 border-t border-charcoal-100">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : editingRoom ? 'Cập nhật' : 'Thêm mới'}</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Xác nhận xóa" size="sm">
        <div className="p-6">
          <p className="text-charcoal-600">Bạn có chắc muốn xóa phòng <strong className="text-charcoal-900">{deletingRoom?.room_number}</strong>? Hành động này không thể hoàn tác.</p>
          <div className="flex gap-3 mt-6">
            <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>Hủy</Button>
            <Button variant="danger" onClick={handleDelete}>Xóa phòng</Button>
          </div>
        </div>
      </Modal>

      {/* Assign Tenant Modal */}
      <Modal isOpen={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)} title={`Thêm người vào phòng ${assigningRoom?.room_number}`} size="md">
        <form onSubmit={handleAssign} className="p-5 space-y-4">
          {availableForAssign.length === 0 ? (
            <div className="py-8 text-center text-charcoal-500">Không còn người thuê nào chưa vào phòng này.</div>
          ) : (
            <>
              <Input label="Chọn người thuê" name="tenant_id" type="select" value={assignData.tenant_id} onChange={(v) => setAssignData({ ...assignData, tenant_id: v })} required
                options={[{ value: '', label: '-- Chọn người thuê --' }, ...availableForAssign.map((t) => ({ value: t.id, label: t.full_name }))]} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Ngày bắt đầu thuê" name="start_date" type="date" value={assignData.start_date} onChange={(v) => setAssignData({ ...assignData, start_date: v })} required />
                <Input label="Tiền cọc (VNĐ)" name="deposit_amount" type="number" value={assignData.deposit_amount} onChange={(v) => setAssignData({ ...assignData, deposit_amount: v })} min={0} />
              </div>
              <Input label="Ngày kết thúc hợp đồng" name="contract_end_date" type="date" value={assignData.contract_end_date} onChange={(v) => setAssignData({ ...assignData, contract_end_date: v })} />
              {assignData.contract_end_date && (
                <div className="flex items-center gap-2 text-sm text-charcoal-500 bg-amber-50 px-4 py-2.5 rounded-xl">
                  <PiCalendarBlankLight className="w-4 h-4 text-amber-500" />
                  <span>Hợp đồng hết hạn: {new Date(assignData.contract_end_date).toLocaleDateString('vi-VN')}</span>
                </div>
              )}
              <div className={`flex items-center gap-3 p-3 rounded-xl border ${(assigningRoom?.active_assignments?.length ?? 0) === 0 ? 'bg-wood-50 border-wood-200' : 'bg-cream-50 border-charcoal-100'}`}>
                <input
                  type="checkbox"
                  id="is_primary"
                  checked={assignData.is_primary}
                  onChange={(e) => setAssignData({ ...assignData, is_primary: e.target.checked })}
                  className="w-4 h-4 text-wood-500 rounded border-charcoal-300 focus:ring-wood-400"
                />
                <label htmlFor="is_primary" className="flex items-center gap-2 text-sm font-medium text-charcoal-700 cursor-pointer">
                  <PiCrownLight className="w-4 h-4 text-amber-500" />
                  Là chủ hợp đồng (người đại diện ký hợp đồng)
                </label>
              </div>
              <Input label="Ghi chú" name="notes" type="textarea" value={assignData.notes} onChange={(v) => setAssignData({ ...assignData, notes: v })} rows={1} />
              <div className="flex gap-3 pt-4 border-t border-charcoal-100">
                <Button type="button" variant="secondary" onClick={() => setIsAssignModalOpen(false)}>Hủy</Button>
                <Button type="submit" disabled={saving || !assignData.tenant_id}>{saving ? 'Đang xử lý...' : 'Xác nhận'}</Button>
              </div>
            </>
          )}
        </form>
      </Modal>

      {/* Extend Contract Modal */}
      <Modal isOpen={isExtendModalOpen} onClose={() => setIsExtendModalOpen(false)} title="Gia hạn hợp đồng" size="sm">
        <form onSubmit={(e) => { e.preventDefault(); handleExtendContract(); }} className="p-5 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-charcoal-50 rounded-xl">
            <PiUserLight className="w-5 h-5 text-charcoal-500" />
            <div>
              <p className="font-medium text-charcoal-900">{extendingAssignment?.tenant?.full_name}</p>
              <p className="text-sm text-charcoal-500">Phòng {extendingAssignment?.room?.room_number}</p>
            </div>
          </div>
          <Input
            label="Ngày kết thúc hợp đồng mới"
            name="contract_end_date"
            type="date"
            value={extendData.contract_end_date}
            onChange={(v) => setExtendData({ contract_end_date: v })}
            required
          />
          <div className="flex gap-3 pt-4 border-t border-charcoal-100">
            <Button type="button" variant="secondary" onClick={() => setIsExtendModalOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Xác nhận gia hạn'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

const roomImages = [
  "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1598928506311-c55dd580e5cb?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1618221381711-42ca8ab6e908?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1616137466211-f939a420be84?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1616047006789-b7af5afb8c20?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1615873968403-89e068629265?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1615874959474-d609969a20ed?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1615529182904-14819c35db37?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1615529162924-f8605388461d?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1609121703648-963b65e99092?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1583847268964-b28ce8f25f51?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1550581190-9c1c48d21d6c?auto=format&fit=crop&w=800&q=80"
];

function PropertyCard({
  isSelectionMode,
  selected,
  onToggleSelect,
  room,
  onView,
  onEdit,
  onDelete,
  onAssignTenant,
  onCheckout,
  onSetPrimary,
}: {
  isSelectionMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  room: Room;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAssignTenant: () => void;
  onCheckout: (a: RoomAssignment) => void;
  onSetPrimary: (a: RoomAssignment, roomId: string) => void;
}) {
  const statusConfig = {
    available: { variant: 'success' as const, bg: 'bg-sage-50', text: 'text-sage-600' },
    occupied: { variant: 'info' as const, bg: 'bg-wood-50', text: 'text-wood-600' },
    maintenance: { variant: 'default' as const, bg: 'bg-charcoal-50', text: 'text-charcoal-500' },
  };

  const config = statusConfig[room.status];
  const currentOccupants = room.active_assignments?.length || 0;
  const maxOccupants = room.max_occupants || 2;
  const isFull = currentOccupants >= maxOccupants;
  const isMaintenance = room.status === 'maintenance';
  const isOccupied = currentOccupants > 0;

  // Generate a stable image index based on room.id or room_number
  const hashString = String(room.id || room.room_number || "1");
  const imageIndex = Math.abs(hashString.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % roomImages.length;
  const imageUrl = roomImages[imageIndex];

  return (
    <div className={`group relative bg-white rounded-2xl transition-all duration-500 overflow-hidden flex flex-col h-full border ${selected ? 'border-wood-500 shadow-[0_8px_30px_rgb(139,94,60,0.15)] scale-[1.02] ring-1 ring-wood-500' : 'border-cream-200 shadow-soft hover:shadow-card-hover'}`}>
      {/* Header Image Area — clickable to view detail */}
      <div
        onClick={isSelectionMode ? onToggleSelect : onView}
        className="relative h-48 w-full cursor-pointer overflow-hidden"
      >
        {/* Selection Indicator Overlay */}
        {selected && (
          <div className="absolute inset-0 bg-wood-900/20 backdrop-blur-[1px] z-20 pointer-events-none transition-all duration-500"></div>
        )}
        {selected && (
          <div className="absolute top-3 right-3 w-8 h-8 bg-white/95 backdrop-blur-md border border-white/50 rounded-full flex items-center justify-center z-30 shadow-xl animate-fade-in">
            <svg className="w-4 h-4 text-wood-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}

        <img 
          src={imageUrl} 
          alt={`Phòng ${room.room_number}`} 
          onError={(e) => { e.currentTarget.src = roomImages[0]; }}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        {/* Soft Dark Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal-900/80 via-charcoal-900/20 to-transparent"></div>
        
        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
          <Badge status={room.status} variant={config.variant} size="sm" />
          <div className="w-7 h-7 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <PiInfoLight className="w-4 h-4 text-white" />
          </div>
        </div>

        {/* Bottom Info inside Image */}
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="font-serif lining-nums tabular-nums text-2xl text-white tracking-wide mb-0.5 drop-shadow-md">
            Phòng {room.room_number}
          </h3>
          <div className="flex items-center gap-1.5 text-white/90 text-[11px] font-medium tracking-wider uppercase drop-shadow-md">
            <span>Tầng {room.floor}</span>
            {room.location && (
              <>
                <span className="w-1 h-1 rounded-full bg-white/50"></span>
                <span className="truncate max-w-[150px]" title={room.location}>{room.location}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Key Info */}
        <div className="flex justify-between items-end pb-3 border-b border-cream-200">
          <div>
            <p className="text-[10px] text-charcoal-400 uppercase tracking-widest font-semibold mb-0.5">Giá Thuê</p>
            <p className="font-serif lining-nums tabular-nums text-lg text-wood-600">{room.monthly_rent.toLocaleString('vi-VN')}đ</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-charcoal-400 uppercase tracking-widest font-semibold mb-0.5">Diện Tích</p>
            <p className="text-sm font-medium text-charcoal-800">{room.area_sqm} m²</p>
          </div>
        </div>

        {/* Occupancy */}
        <div className="pt-3 grow">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-charcoal-400 uppercase tracking-widest font-semibold">Sức Chứa</p>
            <p className={`text-xs font-medium ${isFull ? 'text-amber-600' : 'text-charcoal-600'}`}>
              {currentOccupants}/{maxOccupants}người
            </p>
          </div>
          <div className="h-1 bg-cream-100 rounded-full overflow-hidden mb-3">
            <div
              className={`h-full rounded-full transition-all duration-500 ${isFull ? 'bg-amber-400' : 'bg-wood-400'}`}
              style={{ width: `${(currentOccupants / maxOccupants) * 100}%` }}
            />
          </div>

          {/* Tenants List - Simplified for Card */}
          {room.active_assignments && room.active_assignments.length > 0 ? (
            <div className="space-y-2">
              {room.active_assignments.map((assignment) => (
                <div key={assignment.id} className="flex items-center justify-between group/tenant">
                  <div className="flex items-center gap-2">
                    {assignment.is_primary ? (
                      <div className="w-5 h-5 rounded-full bg-amber-50 flex items-center justify-center">
                        <PiCrownLight className="w-3 h-3 text-amber-600" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-cream-100 flex items-center justify-center">
                        <PiUserLight className="w-3 h-3 text-charcoal-400" />
                      </div>
                    )}
                    <p className="text-xs font-medium text-charcoal-800 truncate max-w-[100px]">{assignment.tenant?.full_name}</p>
                  </div>
                  <div className="flex items-center opacity-0 group-hover/tenant:opacity-100 transition-opacity">
                    {!assignment.is_primary && (
                      <button onClick={() => onSetPrimary(assignment, room.id)} className="p-1 text-charcoal-300 hover:text-amber-500" title="Chủ hợp đồng">
                        <PiCrownLight className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => onCheckout(assignment)} className="p-1 text-charcoal-300 hover:text-rose-500" title="Trả phòng">
                      <PiSignOutLight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
             <div className="py-1 text-charcoal-300 text-xs italic">Phòng trống...</div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="px-4 py-3 bg-cream-50/50 flex items-center justify-between border-t border-cream-200">
        <button
          onClick={onAssignTenant}
          disabled={isMaintenance || isFull}
          title={isMaintenance ? 'Phòng đang bảo trì' : isFull ? 'Phòng đã đầy' : 'Thêm người'}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
            isMaintenance || isFull
              ? 'text-charcoal-300 bg-cream-100 cursor-not-allowed'
              : 'text-wood-600 bg-wood-50 hover:bg-wood-100'
          }`}
        >
          <PiUserPlusLight className="w-3.5 h-3.5" />
          Thêm người
        </button>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="p-1.5 rounded-full text-charcoal-400 hover:text-wood-600 hover:bg-wood-50 transition-colors">
            <PiPencilSimpleLight className="w-4 h-4" />
          </button>

          <button
            onClick={onDelete}
            disabled={isOccupied}
            title={isOccupied ? 'Không thể xóa khi có người đang ở' : 'Xóa phòng'}
            className={`p-1.5 rounded-full transition-colors ${
              isOccupied
                ? 'text-cream-200 cursor-not-allowed'
                : 'text-charcoal-400 hover:text-rose-500 hover:bg-rose-50'
            }`}
          >
            <PiTrashLight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Selection Mode Overlay - placed at the end so it covers everything */}
      {isSelectionMode && (
        <div 
          className="absolute inset-0 z-50 cursor-pointer" 
          onClick={onToggleSelect}
          title="Bấm để chọn phòng này"
        ></div>
      )}
    </div>
  );
}
