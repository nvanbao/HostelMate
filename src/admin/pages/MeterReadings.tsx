import { useEffect, useState } from 'react';
import {
  PiPlusLight,
  PiLightningLight,
  PiDropLight,
  PiPencilSimpleLight,
  PiTrashLight,
  PiCalendarBlankLight,
} from 'react-icons/pi';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Input, Badge, Spinner, EmptyState } from '../components/ui/Input';
import {
  getMeterReadings,
  createMeterReading,
  updateMeterReading,
  deleteMeterReading,
  getRooms,
  getLatestMeterReading,
} from '../lib/api';
import type { MeterReading, Room } from '../types';

export function MeterReadings() {
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingReading, setEditingReading] = useState<MeterReading | null>(null);
  const [deletingReading, setDeletingReading] = useState<MeterReading | null>(null);

  const [formData, setFormData] = useState({
    room_id: '',
    reading_date: new Date().toISOString().split('T')[0],
    electricity_old: '' as string | number,
    electricity_new: '' as string | number,
    water_old: '' as string | number,
    water_new: '' as string | number,
    electricity_price_per_unit: 3500 as string | number,
    water_price_per_unit: 15000 as string | number,
  });

  const [saving, setSaving] = useState(false);
  const [loadingPrevious, setLoadingPrevious] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [readingsData, roomsData] = await Promise.all([
        getMeterReadings(),
        getRooms(),
      ]);
      setReadings(readingsData);
      setRooms(roomsData.filter((r) => r.status === 'occupied'));
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadPreviousReading(roomId: string) {
    if (!roomId) {
      setFormData({
        ...formData,
        room_id: roomId,
        electricity_old: '',
        water_old: '',
      });
      return;
    }

    setLoadingPrevious(true);
    try {
      const latest = await getLatestMeterReading(roomId);
      setFormData({
        ...formData,
        room_id: roomId,
        electricity_old: latest ? latest.electricity_new : '',
        water_old: latest ? latest.water_new : '',
        electricity_price_per_unit: latest?.electricity_price_per_unit || 3500,
        water_price_per_unit: latest?.water_price_per_unit || 15000,
      });
    } catch (error) {
      console.error('Failed to load previous reading:', error);
    } finally {
      setLoadingPrevious(false);
    }
  }

  function openCreateModal() {
    setEditingReading(null);
    setFormData({
      room_id: '',
      reading_date: new Date().toISOString().split('T')[0],
      electricity_old: '',
      electricity_new: '',
      water_old: '',
      water_new: '',
      electricity_price_per_unit: 3500,
      water_price_per_unit: 15000,
    });
    setIsModalOpen(true);
  }

  function openEditModal(reading: MeterReading) {
    setEditingReading(reading);
    setFormData({
      room_id: reading.room_id,
      reading_date: reading.reading_date,
      electricity_old: reading.electricity_old ?? '',
      electricity_new: reading.electricity_new ?? '',
      water_old: reading.water_old ?? '',
      water_new: reading.water_new ?? '',
      electricity_price_per_unit: reading.electricity_price_per_unit ?? 3500,
      water_price_per_unit: reading.water_price_per_unit ?? 15000,
    });
    setIsModalOpen(true);
  }

  function openDeleteModal(reading: MeterReading) {
    setDeletingReading(reading);
    setIsDeleteModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload = {
      ...formData,
      electricity_old: parseFloat(formData.electricity_old as any),
      electricity_new: parseFloat(formData.electricity_new as any),
      water_old: parseFloat(formData.water_old as any),
      water_new: parseFloat(formData.water_new as any),
      electricity_price_per_unit: parseFloat(formData.electricity_price_per_unit as any) || 0,
      water_price_per_unit: parseFloat(formData.water_price_per_unit as any) || 0,
    };

    if (isNaN(payload.electricity_old) || isNaN(payload.electricity_new) || 
        isNaN(payload.water_old) || isNaN(payload.water_new)) {
      alert('Vui lòng nhập đầy đủ tất cả chỉ số điện cũ, mới và nước cũ, mới. Không được để trống.');
      return;
    }

    if (payload.electricity_new < payload.electricity_old) {
      alert(`Chỉ số điện mới (${payload.electricity_new}) phải lớn hơn hoặc bằng chỉ số cũ (${payload.electricity_old})`);
      return;
    }
    if (payload.water_new < payload.water_old) {
      alert(`Chỉ số nước mới (${payload.water_new}) phải lớn hơn hoặc bằng chỉ số cũ (${payload.water_old})`);
      return;
    }

    setSaving(true);
    try {
      if (editingReading) {
        await updateMeterReading(editingReading.id, payload);
      } else {
        await createMeterReading(payload);
      }
      await loadData();
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('Failed to save reading:', error);
      const msg = error?.response?.data?.error || error?.message || 'Không thể lưu chỉ số. Vui lòng thử lại.';
      alert(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingReading) return;
    try {
      await deleteMeterReading(deletingReading.id);
      await loadData();
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error('Failed to delete reading:', error);
      alert('Không thể xóa chỉ số.');
    }
  }

  const elecOld = parseFloat(formData.electricity_old as any);
  const elecNew = parseFloat(formData.electricity_new as any);
  const watOld = parseFloat(formData.water_old as any);
  const watNew = parseFloat(formData.water_new as any);
  const elecPrice = parseFloat(formData.electricity_price_per_unit as any) || 0;
  const watPrice = parseFloat(formData.water_price_per_unit as any) || 0;

  const hasElecError = !isNaN(elecNew) && !isNaN(elecOld) && elecNew < elecOld;
  const hasWaterError = !isNaN(watNew) && !isNaN(watOld) && watNew < watOld;
  const electricityUsage = !isNaN(elecNew) && !isNaN(elecOld) ? Math.max(0, elecNew - elecOld) : 0;
  const waterUsage = !isNaN(watNew) && !isNaN(watOld) ? Math.max(0, watNew - watOld) : 0;
  const electricityCost = electricityUsage * elecPrice;
  const waterCost = waterUsage * watPrice;

  if (loading) return <Spinner />;

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-serif lining-nums tabular-nums text-charcoal-900 tracking-wide">Điện nước</h1>
          <p className="text-charcoal-400 mt-2 text-sm">Nhập và theo dõi chỉ số điện nước hàng tháng</p>
        </div>
        <Button onClick={openCreateModal}>
          <PiPlusLight className="w-4 h-4" />
          Nhập chỉ số
        </Button>
      </header>

      {readings.length === 0 ? (
        <EmptyState
          icon={<PiLightningLight className="w-8 h-8" />}
          title="Chưa có chỉ số nào"
          description="Bắt đầu nhập chỉ số điện nước để tạo hóa đơn"
          action={
            <Button onClick={openCreateModal} variant="secondary">
              <PiPlusLight className="w-4 h-4" />
              Thêm mới
            </Button>
          }
        />
      ) : (
        <div className="bg-white rounded-2xl border border-charcoal-100 overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-cream-50/50 border-b border-cream-200 text-xs uppercase tracking-widest text-charcoal-500 font-semibold">
                  <th className="px-4 py-3">Ngày</th>
                  <th className="px-4 py-3">Phòng</th>
                  <th className="px-4 py-3 text-center">Điện (kWh)</th>
                  <th className="px-4 py-3 text-center">Tiền điện</th>
                  <th className="px-4 py-3 text-center">Nước (m³)</th>
                  <th className="px-4 py-3 text-center">Tiền nước</th>
                  <th className="px-4 py-3 text-center">Tổng tiền</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100">
                {readings.map((reading) => {
                  const elecUsage = reading.electricity_new - reading.electricity_old;
                  const waterUsage = reading.water_new - reading.water_old;
                  const elecCost = elecUsage * reading.electricity_price_per_unit;
                  const waterCost = waterUsage * reading.water_price_per_unit;
                  const total = elecCost + waterCost;

                  return (
                    <tr key={reading.id} className="hover:bg-cream-50/50 transition-colors group">
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-2">
                          <PiCalendarBlankLight className="w-4 h-4 text-charcoal-400" />
                          <span className="font-serif lining-nums tabular-nums text-charcoal-900 font-medium">
                            {new Date(reading.reading_date).toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <span className="font-serif lining-nums tabular-nums font-medium text-wood-700">P.{reading.room?.room_number || ''}</span>
                      </td>
                      <td className="px-4 py-3 text-center align-middle">
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="flex items-center justify-center gap-1.5">
                            <PiLightningLight className="w-4 h-4 text-amber-500" />
                            <span className="font-serif lining-nums tabular-nums text-charcoal-900 font-semibold text-lg">{elecUsage}</span>
                          </div>
                          <div className="text-[10px] text-charcoal-400 font-mono tracking-wider">
                            {reading.electricity_old} → {reading.electricity_new}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center align-middle">
                        <span className="font-serif lining-nums tabular-nums text-charcoal-900 font-medium">{elecCost.toLocaleString('vi-VN')}đ</span>
                      </td>
                      <td className="px-4 py-3 text-center align-middle">
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="flex items-center justify-center gap-1.5">
                            <PiDropLight className="w-4 h-4 text-blue-500" />
                            <span className="font-serif lining-nums tabular-nums text-charcoal-900 font-semibold text-lg">{waterUsage}</span>
                          </div>
                          <div className="text-[10px] text-charcoal-400 font-mono tracking-wider">
                            {reading.water_old} → {reading.water_new}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center align-middle">
                        <span className="font-serif lining-nums tabular-nums text-charcoal-900 font-medium">{waterCost.toLocaleString('vi-VN')}đ</span>
                      </td>
                      <td className="px-4 py-3 text-center align-middle">
                        <span className="font-serif lining-nums tabular-nums text-wood-700 font-bold text-lg">{total.toLocaleString('vi-VN')}đ</span>
                      </td>
                      <td className="px-4 py-3 align-middle text-right">
                        <div className="flex justify-end items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEditModal(reading)}
                            className="p-1.5 rounded-lg text-charcoal-400 hover:text-wood-600 hover:bg-wood-50 transition-colors bg-white border border-transparent hover:border-wood-200"
                            title="Sửa"
                          >
                            <PiPencilSimpleLight className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openDeleteModal(reading)}
                            className="p-1.5 rounded-lg text-charcoal-400 hover:text-rose-600 hover:bg-rose-50 transition-colors bg-white border border-transparent hover:border-rose-200"
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
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingReading ? 'Sửa chỉ số' : 'Nhập chỉ số điện nước'}
        size="xl"
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Chọn phòng"
              name="room_id"
              type="select"
              value={formData.room_id}
              onChange={(v) => loadPreviousReading(v)}
              required
              disabled={!!editingReading}
              options={[
                { value: '', label: '-- Chọn phòng --' },
                ...rooms.map((r) => ({
                  value: r.id,
                  label: `Phòng ${r.room_number}`,
                })),
              ]}
            />
            <Input
              label="Ngày ghi chỉ số"
              name="reading_date"
              type="date"
              value={formData.reading_date}
              onChange={(v) => setFormData({ ...formData, reading_date: v })}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Electricity Section */}
            <div className="p-5 bg-amber-50 rounded-xl border border-amber-200 flex flex-col h-full">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-amber-200 flex items-center justify-center">
                  <PiLightningLight className="w-4 h-4 text-amber-700" />
                </div>
                <h4 className="font-semibold text-charcoal-900">Điện</h4>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <Input
                  label="Chỉ số cũ (kWh)"
                  name="electricity_old"
                  type="number"
                  value={formData.electricity_old}
                  onChange={(v) => setFormData({ ...formData, electricity_old: v })}
                  min={0}
                  disabled={loadingPrevious}
                />
                <Input
                  label="Chỉ số mới (kWh)"
                  name="electricity_new"
                  type="number"
                  value={formData.electricity_new}
                  onChange={(v) => setFormData({ ...formData, electricity_new: v })}
                  min={Number(formData.electricity_old) || 0}
                  required
                />
              </div>
              <Input
                label="Đơn giá (đ/kWh)"
                name="electricity_price"
                type="number"
                value={formData.electricity_price_per_unit}
                onChange={(v) => setFormData({ ...formData, electricity_price_per_unit: v })}
                min={0}
              />
              {hasElecError && (
                <p className="mt-3 text-sm text-rose-600 font-medium">
                  Chỉ số mới phải lớn hơn hoặc bằng chỉ số cũ ({formData.electricity_old} kWh)
                </p>
              )}
              <div className="mt-auto pt-4 flex items-center justify-between text-sm">
                <span className="text-charcoal-600">Thành tiền:</span>
                <span className={`font-bold ${hasElecError ? 'text-rose-500' : 'text-charcoal-900'}`}>
                  {hasElecError ? 'Chỉ số không hợp lệ' : `${electricityCost.toLocaleString('vi-VN')}đ (${electricityUsage} kWh)`}
                </span>
              </div>
            </div>

            {/* Water Section */}
            <div className="p-5 bg-blue-50 rounded-xl border border-blue-200 flex flex-col h-full">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-200 flex items-center justify-center">
                  <PiDropLight className="w-4 h-4 text-blue-700" />
                </div>
                <h4 className="font-semibold text-charcoal-900">Nước</h4>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <Input
                  label="Chỉ số cũ (m³)"
                  name="water_old"
                  type="number"
                  value={formData.water_old}
                  onChange={(v) => setFormData({ ...formData, water_old: v })}
                  min={0}
                  disabled={loadingPrevious}
                />
                <Input
                  label="Chỉ số mới (m³)"
                  name="water_new"
                  type="number"
                  value={formData.water_new}
                  onChange={(v) => setFormData({ ...formData, water_new: v })}
                  min={Number(formData.water_old) || 0}
                  required
                />
              </div>
              <Input
                label="Đơn giá (đ/m³)"
                name="water_price"
                type="number"
                value={formData.water_price_per_unit}
                onChange={(v) => setFormData({ ...formData, water_price_per_unit: v })}
                min={0}
              />
              {hasWaterError && (
                <p className="mt-3 text-sm text-rose-600 font-medium">
                  Chỉ số mới phải lớn hơn hoặc bằng chỉ số cũ ({formData.water_old} m³)
                </p>
              )}
              <div className="mt-auto pt-4 flex items-center justify-between text-sm">
                <span className="text-charcoal-600">Thành tiền:</span>
                <span className={`font-bold ${hasWaterError ? 'text-rose-500' : 'text-charcoal-900'}`}>
                  {hasWaterError ? 'Chỉ số không hợp lệ' : `${waterCost.toLocaleString('vi-VN')}đ (${waterUsage} m³)`}
                </span>
              </div>
            </div>
          </div>

          {/* Total */}
          <div className="p-5 bg-cream-100 rounded-xl flex items-center justify-between">
            <span className="font-semibold text-charcoal-700">Tổng cộng:</span>
            <span className="text-2xl font-bold text-wood-600">
              {(electricityCost + waterCost).toLocaleString('vi-VN')}đ
            </span>
          </div>

          <div className="flex gap-3 pt-5 border-t border-charcoal-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Đang lưu...' : editingReading ? 'Cập nhật' : 'Lưu chỉ số'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Xác nhận xóa"
        size="sm"
      >
        <div className="p-6">
          <p className="text-charcoal-600">
            Bạn có chắc muốn xóa chỉ sốĐã đóngày{' '}
            <strong className="text-charcoal-900">{deletingReading?.reading_date}</strong>?
          </p>
          <div className="flex gap-3 mt-6">
            <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>
              Hủy
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Xóa
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

