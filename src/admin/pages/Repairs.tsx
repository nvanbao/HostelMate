import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PiCalendarBlankLight,
  PiCheckCircleLight,
  PiChatCircleLight,
  PiClockLight,
  PiEyeLight,
  PiPencilSimpleLight,
  PiUserLight,
  PiWarningLight,
  PiWrenchLight,
  PiXLight,
} from 'react-icons/pi';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Input, Badge, Spinner, EmptyState } from '../components/ui/Input';
import { getRepairRequests, updateRepairRequest } from '../lib/api';
import { useSocket } from '../../hooks/useSocket';
import type { RepairRequest } from '../types';

type RepairFilter = 'all' | RepairRequest['status'];

const emptyProcessingForm = {
  status: 'new' as RepairRequest['status'],
  assigned_to: '',
  resolution_notes: '',
};

export function Repairs() {
  const [repairs, setRepairs] = useState<RepairRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<RepairFilter>('all');
  const [viewingRepair, setViewingRepair] = useState<RepairRequest | null>(null);
  const [editingRepair, setEditingRepair] = useState<RepairRequest | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isProcessingModalOpen, setIsProcessingModalOpen] = useState(false);
  const [formData, setFormData] = useState(emptyProcessingForm);
  const socket = useSocket();

  const loadData = useCallback(async (showSpinner = false) => {
    try {
      if (showSpinner) setLoading(true);
      const data = await getRepairRequests();
      setRepairs(Array.isArray(data) ? data : []);
      setViewingRepair((current) => {
        if (!current) return current;
        return data.find((item) => item.id === current.id) || current;
      });
    } catch (error) {
      console.error('Không thể tải yêu cầu sửa chữa:', error);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData(true);
    const intervalId = window.setInterval(() => void loadData(false), 10000);
    return () => window.clearInterval(intervalId);
  }, [loadData]);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => void loadData(false);
    socket.on('repair_updated', refresh);
    return () => {
      socket.off('repair_updated', refresh);
    };
  }, [socket, loadData]);

  const filteredRepairs = useMemo(
    () => repairs.filter((repair) => filter === 'all' || repair.status === filter),
    [repairs, filter],
  );

  const statusCounts = useMemo(() => ({
    all: repairs.length,
    new: repairs.filter((repair) => repair.status === 'new').length,
    in_progress: repairs.filter((repair) => repair.status === 'in_progress').length,
    resolved: repairs.filter((repair) => repair.status === 'resolved').length,
    closed: repairs.filter((repair) => repair.status === 'closed').length,
  }), [repairs]);

  function openDetailModal(repair: RepairRequest) {
    setViewingRepair(repair);
    setIsDetailModalOpen(true);
  }

  function openProcessingModal(repair: RepairRequest, event?: React.MouseEvent) {
    event?.stopPropagation();
    setEditingRepair(repair);
    setFormData({
      status: repair.status,
      assigned_to: repair.assigned_to || '',
      resolution_notes: repair.resolution_notes || '',
    });
    setIsProcessingModalOpen(true);
  }

  async function saveProcessing(event: React.FormEvent) {
    event.preventDefault();
    if (!editingRepair) return;

    try {
      setSaving(true);
      const resolvedAt = formData.status === 'resolved' || formData.status === 'closed'
        ? editingRepair.resolved_at || new Date().toISOString()
        : null;

      const updated = await updateRepairRequest(editingRepair.id, {
        status: formData.status,
        assigned_to: formData.assigned_to.trim(),
        resolution_notes: formData.resolution_notes.trim(),
        resolved_at: resolvedAt,
      });

      setRepairs((current) => current.map((item) => item.id === updated.id
        ? { ...item, ...updated, room: item.room, tenant: item.tenant }
        : item));
      setViewingRepair((current) => current?.id === updated.id
        ? { ...current, ...updated, room: current.room, tenant: current.tenant }
        : current);
      setIsProcessingModalOpen(false);
      await loadData(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Không thể cập nhật xử lý yêu cầu.');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(repair: RepairRequest, status: RepairRequest['status']) {
    try {
      const updated = await updateRepairRequest(repair.id, {
        status,
        resolved_at: status === 'resolved' || status === 'closed'
          ? repair.resolved_at || new Date().toISOString()
          : null,
      });
      setRepairs((current) => current.map((item) => item.id === updated.id
        ? { ...item, ...updated, room: item.room, tenant: item.tenant }
        : item));
      setViewingRepair((current) => current?.id === updated.id
        ? { ...current, ...updated, room: current.room, tenant: current.tenant }
        : current);
      await loadData(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Không thể cập nhật trạng thái.');
    }
  }

  if (loading) return <Spinner />;

  const filters: Array<{ value: RepairFilter; label: string }> = [
    { value: 'all', label: 'Tất cả' },
    { value: 'new', label: 'Mới' },
    { value: 'in_progress', label: 'Đang xử lý' },
    { value: 'resolved', label: 'Đã xong' },
    { value: 'closed', label: 'Đã đóng' },
  ];

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif lining-nums tabular-nums text-charcoal-900 tracking-wide">Sửa chữa</h1>
          <p className="text-charcoal-400 mt-2 text-sm">Tiếp nhận và theo dõi yêu cầu bảo trì do người thuê gửi</p>
        </div>
        <div className="rounded-full border border-sage-200 bg-sage-50 px-4 py-2 text-xs font-medium text-sage-700">
          Tự động nhận yêu cầu từ người thuê
        </div>
      </header>

      <section className="space-y-4">
        <div className="flex gap-2 flex-wrap">
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
                {statusCounts[item.value]}
              </span>
            </button>
          ))}
        </div>
      </section>

      {filteredRepairs.length === 0 ? (
        <EmptyState
          icon={<PiWrenchLight className="w-8 h-8" />}
          title="Không có yêu cầu nào"
          description={filter === 'all'
            ? 'Khi người thuê gửi yêu cầu sửa chữa, nội dung sẽ tự động xuất hiện tại đây.'
            : 'Không có yêu cầu nào ở trạng thái này.'}
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
                <th className="px-4 py-3 text-right">Xử lý</th>
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
                      <p className="text-xs text-charcoal-400 mt-0.5">{repair.tenant?.full_name || 'Người thuê'}</p>
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
                        {formatDate(repair.reported_at)}
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
                        {repair.status !== 'closed' && (
                          <button
                            type="button"
                            onClick={(event) => openProcessingModal(repair, event)}
                            className="p-2 rounded-lg text-charcoal-400 hover:text-wood-600 hover:bg-wood-50 transition-colors"
                            title="Cập nhật xử lý"
                          >
                            <PiPencilSimpleLight className="w-4 h-4" />
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

      <Modal
        isOpen={isProcessingModalOpen}
        onClose={() => setIsProcessingModalOpen(false)}
        title="Cập nhật xử lý yêu cầu"
        size="md"
      >
        <form onSubmit={saveProcessing} className="p-6 space-y-5">
          {editingRepair && (
            <div className="rounded-2xl border border-wood-100 bg-cream-50 p-4">
              <p className="text-xs text-charcoal-400">Yêu cầu từ {editingRepair.tenant?.full_name || 'người thuê'} · Phòng {editingRepair.room?.room_number || editingRepair.room_id}</p>
              <p className="mt-1 font-serif text-lg text-charcoal-900">{editingRepair.title}</p>
            </div>
          )}
          <Input
            label="Trạng thái xử lý"
            name="status"
            type="select"
            value={formData.status}
            onChange={(value) => setFormData((current) => ({ ...current, status: value as RepairRequest['status'] }))}
            options={[
              { value: 'new', label: 'Mới tiếp nhận' },
              { value: 'in_progress', label: 'Đang xử lý' },
              { value: 'resolved', label: 'Đã hoàn thành' },
              { value: 'closed', label: 'Đã đóng' },
            ]}
          />
          <Input
            label="Người phụ trách"
            name="assigned_to"
            value={formData.assigned_to}
            onChange={(value) => setFormData((current) => ({ ...current, assigned_to: value }))}
            placeholder="Ví dụ: Kỹ thuật viên Nguyễn Văn A"
          />
          <Input
            label="Phản hồi cho người thuê"
            name="resolution_notes"
            type="textarea"
            value={formData.resolution_notes}
            onChange={(value) => setFormData((current) => ({ ...current, resolution_notes: value }))}
            placeholder="Ghi tình trạng tiếp nhận, lịch sửa hoặc kết quả xử lý..."
            rows={4}
          />
          <div className="flex justify-end gap-3 border-t border-charcoal-100 pt-5">
            <Button type="button" variant="secondary" onClick={() => setIsProcessingModalOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu cập nhật'}</Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Chi tiết yêu cầu"
        size="lg"
      >
        {viewingRepair && (
          <div className="p-6 space-y-5">
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
              <InfoItem icon={<PiCalendarBlankLight />} label="Ngày báo" value={formatDate(viewingRepair.reported_at)} />
              <InfoItem icon={<PiUserLight />} label="Người phụ trách" value={viewingRepair.assigned_to || 'Chưa phân công'} />
            </div>

            {viewingRepair.resolution_notes && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <PiChatCircleLight className="w-4 h-4 text-charcoal-400" />
                  <p className="text-sm font-medium text-charcoal-600">Phản hồi xử lý</p>
                </div>
                <div className="p-3 bg-sage-50 rounded-xl border border-sage-200">
                  <p className="text-sage-800 whitespace-pre-line">{viewingRepair.resolution_notes}</p>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-5 border-t border-charcoal-100 flex-wrap">
              {viewingRepair.status === 'new' && (
                <Button onClick={() => void handleStatusChange(viewingRepair, 'in_progress')}>
                  <PiClockLight className="w-4 h-4" /> Bắt đầu xử lý
                </Button>
              )}
              {viewingRepair.status === 'in_progress' && (
                <Button variant="success" onClick={() => void handleStatusChange(viewingRepair, 'resolved')}>
                  <PiCheckCircleLight className="w-4 h-4" /> Đã hoàn thành
                </Button>
              )}
              {viewingRepair.status === 'resolved' && (
                <Button variant="secondary" onClick={() => void handleStatusChange(viewingRepair, 'closed')}>
                  <PiXLight className="w-4 h-4" /> Đóng yêu cầu
                </Button>
              )}
              {viewingRepair.status !== 'closed' && (
                <Button variant="ghost" onClick={() => {
                  setIsDetailModalOpen(false);
                  openProcessingModal(viewingRepair);
                }}>
                  <PiPencilSimpleLight className="w-4 h-4" /> Cập nhật xử lý
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function StatusBadge({ status }: { status: RepairRequest['status'] }) {
  const variants: Record<RepairRequest['status'], 'info' | 'warning' | 'success' | 'default'> = {
    new: 'info',
    in_progress: 'warning',
    resolved: 'success',
    closed: 'default',
  };
  return <Badge status={status} variant={variants[status]} />;
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
