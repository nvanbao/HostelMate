import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PiCalendarBlankLight,
  PiCheckCircleLight,
  PiClockLight,
  PiPencilSimpleLight,
  PiPlusLight,
  PiTrashLight,
  PiWrenchLight,
  PiEyeLight,
  PiWarningLight,
  PiUserLight,
  PiChatCircleLight
} from 'react-icons/pi';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input, Badge, EmptyState, Spinner } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import {
  createMyRepairRequest,
  deleteMyRepairRequest,
  getMyRepairRequests,
  updateMyRepairRequest,
} from '../lib/api';
import { useSocket } from '../hooks/useSocket';
import type { RepairRequest, Room } from '../types';

const API_URL = import.meta.env.VITE_API_URL || '/api';
type Filter = 'all' | RepairRequest['status'];

const emptyForm = {
  room_id: '',
  title: '',
  description: '',
  priority: 'medium' as RepairRequest['priority'],
};

export function Repairs() {
  const { user } = useAuth();
  const tenantId = user?.tenant_id || '';
  const socket = useSocket();
  const [repairs, setRepairs] = useState<RepairRequest[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editing, setEditing] = useState<RepairRequest | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [viewingRepair, setViewingRepair] = useState<RepairRequest | null>(null);

  const loadData = useCallback(async (showSpinner = true) => {
    if (!tenantId) {
      setRepairs([]);
      setRooms([]);
      setLoading(false);
      return;
    }

    try {
      if (showSpinner) setLoading(true);
      const [repairResult, portalResponse] = await Promise.all([
        getMyRepairRequests(),
        fetch(`${API_URL}/tenant/portal?tenant_id=${encodeURIComponent(tenantId)}`, {
          credentials: 'include',
        }),
      ]);

      const data = repairResult || [];
      setRepairs(data);
      setViewingRepair((current) => {
        if (!current) return current;
        return data.find((item: RepairRequest) => item.id === current.id) || current;
      });

      if (portalResponse.ok) {
        const portal = await portalResponse.json();
        const rentalRooms = Array.isArray(portal.rentals)
          ? portal.rentals.map((item: { room?: Room }) => item.room).filter(Boolean)
          : portal.room
            ? [portal.room]
            : [];
        setRooms(rentalRooms as Room[]);
      }
    } catch (error) {
      console.error('Không thể tải yêu cầu sửa chữa:', error);
      setRepairs([]);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadData(true);
  }, [loadData]);

  useEffect(() => {
    if (!socket || !tenantId) return;
    const refresh = () => void loadData(false);
    socket.on('repair_updated', refresh);
    return () => {
      socket.off('repair_updated', refresh);
    };
  }, [socket, tenantId, loadData]);

  const filteredRepairs = useMemo(
    () => repairs.filter((repair) => filter === 'all' || repair.status === filter),
    [repairs, filter],
  );

  const counts = useMemo(() => ({
    all: repairs.length,
    new: repairs.filter((item) => item.status === 'new').length,
    in_progress: repairs.filter((item) => item.status === 'in_progress').length,
    resolved: repairs.filter((item) => item.status === 'resolved').length,
    closed: repairs.filter((item) => item.status === 'closed').length,
  }), [repairs]);

  function openCreateModal() {
    setEditing(null);
    setFormData({ ...emptyForm, room_id: rooms.length > 0 ? String(rooms[0].id) : '' });
    setIsCreateModalOpen(true);
  }

  function openEditModal(repair: RepairRequest) {
    setEditing(repair);
    setFormData({
      room_id: String(repair.room_id),
      title: repair.title,
      description: repair.description || '',
      priority: repair.priority,
    });
    setIsCreateModalOpen(true);
  }

  function openDetailModal(repair: RepairRequest) {
    setViewingRepair(repair);
    setIsDetailModalOpen(true);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!tenantId || !formData.room_id || !formData.title.trim()) return;

    try {
      setSaving(true);
      const payload = {
        room_id: formData.room_id,
        tenant_id: tenantId,
        title: formData.title.trim(),
        description: formData.description.trim(),
        priority: formData.priority,
      };

      if (editing) {
        await updateMyRepairRequest(editing.id, {
          title: payload.title,
          description: payload.description,
          priority: payload.priority,
        });
      } else {
        await createMyRepairRequest({
          room_id: payload.room_id,
          title: payload.title,
          description: payload.description,
          priority: payload.priority,
        });
      }
      setIsCreateModalOpen(false);
      await loadData(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Không thể lưu yêu cầu sửa chữa.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(repair: RepairRequest) {
    if (!window.confirm(`Xóa yêu cầu “${repair.title}”?`)) return;
    try {
      await deleteMyRepairRequest(repair.id);
      setIsDetailModalOpen(false);
      await loadData(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Không thể xóa yêu cầu.');
    }
  }

  async function handleConfirmDone(repair: RepairRequest) {
    try {
      await updateMyRepairRequest(repair.id, { status: 'closed' });
      await loadData(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Không thể xác nhận.');
    }
  }

  if (loading) return <Spinner />;

  const filters: Array<{ value: Filter; label: string }> = [
    { value: 'all', label: 'Tất cả' },
    { value: 'new', label: 'Mới' },
    { value: 'in_progress', label: 'Đang xử lý' },
    { value: 'resolved', label: 'Đã hoàn thành' },
    { value: 'closed', label: 'Đã đóng' },
  ];

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif lining-nums tabular-nums text-charcoal-900 tracking-wide">Sửa chữa</h1>
          <p className="text-charcoal-400 mt-2 text-sm">Gửi và theo dõi yêu cầu bảo trì phòng trọ</p>
        </div>
        <Button onClick={openCreateModal} disabled={rooms.length === 0}>
          <PiPlusLight className="w-4 h-4" /> Tạo yêu cầu
        </Button>
      </header>

      {rooms.length === 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          Bạn chưa được xếp phòng nên chưa thể tạo yêu cầu sửa chữa.
        </div>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={`px-5 py-2.5 text-sm font-medium rounded-xl transition-all ${
                filter === item.value
                  ? 'bg-white text-charcoal-900 shadow-card border border-charcoal-100'
                  : 'text-charcoal-400 hover:text-charcoal-600 hover:bg-white/50'
              }`}
            >
              {item.label}
              <span className={`ml-2 px-2 py-0.5 rounded-lg text-xs ${
                filter === item.value ? 'bg-wood-100 text-wood-700' : 'bg-charcoal-100 text-charcoal-500'
              }`}>
                {counts[item.value]}
              </span>
            </button>
          ))}
        </div>
      </section>

      {filteredRepairs.length === 0 ? (
        <EmptyState
          icon={<PiWrenchLight className="w-8 h-8" />}
          title="Chưa có yêu cầu sửa chữa"
          description={filter === 'all'
            ? 'Khi phòng có sự cố, hãy tạo yêu cầu để chủ trọ tiếp nhận và xử lý.'
            : 'Không có yêu cầu nào ở trạng thái này.'}
          action={rooms.length > 0 && filter === 'all' ? (
            <Button onClick={openCreateModal}><PiPlusLight className="w-4 h-4" /> Tạo yêu cầu</Button>
          ) : undefined}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-cream-50/50 border-b border-cream-200 text-xs uppercase tracking-widest text-charcoal-500 font-semibold">
                <th className="px-4 py-3">Phòng</th>
                <th className="px-4 py-3">Yêu cầu</th>
                <th className="px-4 py-3 text-center">Mức độ</th>
                <th className="px-4 py-3 text-center">Trạng thái</th>
                <th className="px-4 py-3">Ngày báo</th>
                <th className="px-4 py-3 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {filteredRepairs.map((repair) => {
                const priority = getPriorityConfig(repair.priority);
                return (
                  <tr
                    key={repair.id}
                    onClick={() => openDetailModal(repair)}
                    className="hover:bg-cream-50/50 transition-colors group cursor-pointer"
                  >
                    <td className="px-4 py-3 align-middle">
                      <p className="font-serif font-medium text-wood-700 text-[15px]">P.{repair.room?.room_number || repair.room_id}</p>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <p className="font-serif font-semibold text-charcoal-900 tracking-wide line-clamp-1">{repair.title}</p>
                      {repair.description && <p className="text-xs text-charcoal-400 mt-0.5 line-clamp-1">{repair.description}</p>}
                    </td>
                    <td className="px-4 py-3 align-middle text-center">
                      <span className={`inline-flex items-center justify-center px-2 py-1 rounded-md text-[10px] font-medium uppercase tracking-wider ${priority.bg} ${priority.text}`}>
                        {priority.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle text-center"><StatusBadge status={repair.status} /></td>
                    <td className="px-4 py-3 align-middle">
                      <span className="font-serif lining-nums tabular-nums font-medium text-charcoal-600">
                        {formatDate(repair.reported_at || repair.created_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle text-right">
                      <div className="flex justify-end items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => openDetailModal(repair)}
                          className="p-2 rounded-lg text-charcoal-400 hover:text-wood-600 hover:bg-wood-50 transition-colors"
                          title="Xem chi tiết"
                        >
                          <PiEyeLight className="w-4 h-4" />
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

      {/* Tạo/Cập nhật Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={editing ? 'Cập nhật yêu cầu sửa chữa' : 'Tạo yêu cầu sửa chữa'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-5 bg-white">
          <Input
            label="Phòng"
            name="room_id"
            type="select"
            value={formData.room_id}
            onChange={(value) => setFormData((current) => ({ ...current, room_id: value }))}
            options={rooms.map((room) => ({ value: String(room.id), label: `Phòng ${room.room_number}` }))}
            required
            disabled={Boolean(editing)}
          />
          <Input
            label="Tiêu đề sự cố"
            name="title"
            value={formData.title}
            onChange={(value) => setFormData((current) => ({ ...current, title: value }))}
            placeholder="Ví dụ: Máy lạnh không hoạt động"
            required
          />
          <Input
            label="Mô tả chi tiết"
            name="description"
            type="textarea"
            value={formData.description}
            onChange={(value) => setFormData((current) => ({ ...current, description: value }))}
            placeholder="Mô tả tình trạng, vị trí và thời điểm phát hiện..."
            rows={5}
          />
          <Input
            label="Mức độ ưu tiên"
            name="priority"
            type="select"
            value={formData.priority}
            onChange={(value) => setFormData((current) => ({ ...current, priority: value as RepairRequest['priority'] }))}
            options={[
              { value: 'low', label: 'Thấp' },
              { value: 'medium', label: 'Trung bình' },
              { value: 'high', label: 'Cao' },
              { value: 'urgent', label: 'Khẩn cấp' },
            ]}
          />
          <div className="flex justify-end gap-3 border-t border-charcoal-100 pt-5">
            <Button type="button" variant="secondary" onClick={() => setIsCreateModalOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu yêu cầu'}</Button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Chi tiết yêu cầu"
        size="lg"
      >
        {viewingRepair && (
          <div className="p-6 space-y-5 bg-white">
            <div className="flex items-center gap-3 flex-wrap">
              <PriorityIcon priority={viewingRepair.priority} />
              <h3 className="text-2xl font-serif font-bold text-charcoal-900 flex-1 tracking-wide">{viewingRepair.title}</h3>
              <StatusBadge status={viewingRepair.status} />
            </div>

            <div className="p-4 bg-cream-50 rounded-xl">
              <p className="text-charcoal-700 whitespace-pre-line">{viewingRepair.description || 'Không có mô tả chi tiết.'}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoItem icon={<PiWrenchLight />} label="Phòng" value={String(viewingRepair.room?.room_number || viewingRepair.room_id)} />
              <InfoItem icon={<PiUserLight />} label="Người báo" value={viewingRepair.tenant?.full_name || 'Người thuê'} />
              <InfoItem icon={<PiCalendarBlankLight />} label="Ngày báo" value={formatDate(viewingRepair.reported_at || viewingRepair.created_at)} />
              <InfoItem icon={<PiUserLight />} label="Người phụ trách" value={viewingRepair.assigned_to || 'Chưa phân công'} />
            </div>

            {viewingRepair.resolution_notes && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <PiChatCircleLight className="w-4 h-4 text-charcoal-400" />
                  <p className="text-sm font-medium text-charcoal-600">Phản hồi xử lý từ Chủ trọ/Quản lý</p>
                </div>
                <div className="p-3 bg-sage-50 rounded-xl border border-sage-200">
                  <p className="text-sage-800 whitespace-pre-line">{viewingRepair.resolution_notes}</p>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-5 border-t border-charcoal-100 flex-wrap">
              {viewingRepair.status === 'resolved' && (
                <Button variant="success" onClick={() => void handleConfirmDone(viewingRepair)}>
                  <PiCheckCircleLight className="w-4 h-4" /> Xác nhận đã xong
                </Button>
              )}
              
              {(viewingRepair.status === 'new' || viewingRepair.status === 'in_progress') && (
                <>
                  <Button variant="ghost" onClick={() => {
                    setIsDetailModalOpen(false);
                    openEditModal(viewingRepair);
                  }}>
                    <PiPencilSimpleLight className="w-4 h-4" /> Sửa yêu cầu
                  </Button>
                  {viewingRepair.status === 'new' && (
                    <Button variant="danger" onClick={() => void handleDelete(viewingRepair)}>
                      <PiTrashLight className="w-4 h-4" /> Xóa
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function StatusBadge({ status }: { status: RepairRequest['status'] }) {
  const config: Record<RepairRequest['status'], { label: string; variant: 'info' | 'warning' | 'success' | 'default' }> = {
    new: { label: 'Mới', variant: 'info' },
    in_progress: { label: 'Đang xử lý', variant: 'warning' },
    resolved: { label: 'Đã hoàn thành', variant: 'success' },
    closed: { label: 'Đã đóng', variant: 'default' },
  };
  const item = config[status];
  return <Badge status={`${item.label}`} variant={item.variant} />;
}

function PriorityIcon({ priority }: { priority: RepairRequest['priority'] }) {
  const config = getPriorityConfig(priority);
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium ${config.bg} ${config.text}`}>
      <PiWarningLight className="w-4 h-4 mr-1.5" />
      {config.label}
    </span>
  );
}

function getPriorityConfig(priority: RepairRequest['priority']) {
  const config: Record<RepairRequest['priority'], { label: string; bg: string; text: string }> = {
    low: { label: 'Thấp', bg: 'bg-charcoal-100', text: 'text-charcoal-500' },
    medium: { label: 'Trung bình', bg: 'bg-blue-100', text: 'text-blue-600' },
    high: { label: 'Cao', bg: 'bg-amber-100', text: 'text-amber-600' },
    urgent: { label: 'Khẩn cấp', bg: 'bg-rose-100', text: 'text-rose-600' },
  };
  return config[priority] || config.medium;
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-charcoal-100 flex items-center justify-center text-charcoal-500">
        {icon}
      </div>
      <div>
        <p className="text-xs text-charcoal-400">{label}</p>
        <p className="font-medium text-charcoal-900">{value}</p>
      </div>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN');
}
