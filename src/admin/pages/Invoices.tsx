import { useEffect, useState } from 'react';
import {
  PiPlusLight,
  PiReceiptLight,
  PiPencilSimpleLight,
  PiTrashLight,
  PiCheckCircleLight,
  PiClockLight,
  PiWarningCircleLight,
} from 'react-icons/pi';
import { Modal } from '../components/ui/Modal';
import { FilterDropdown } from '../../components/ui/FilterDropdown';
import { Button } from '../components/ui/Button';
import { Input, Badge, Spinner, EmptyState } from '../components/ui/Input';
import {
  getInvoices,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  markInvoicePaid,
  markOverdueInvoices,
  getRooms,
  getMeterReadings,
} from '../lib/api';
import type { Invoice, Room, MeterReading } from '../types';

export function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [deletingInvoice, setDeletingInvoice] = useState<Invoice | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all');
  const [filterMonth, setFilterMonth] = useState<number>(0); // 0 = all
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());

  const [formData, setFormData] = useState({
    room_id: '',
    meter_reading_id: '',
    invoice_month: new Date().getMonth() + 1,
    invoice_year: new Date().getFullYear(),
    room_rent: '' as string | number,
    electricity_cost: '' as string | number,
    water_cost: '' as string | number,
    other_fees: '' as string | number,
    due_date: '',
    notes: '',
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();

    const handleOpenModal = (e: any) => {
      if (e.detail?.action === 'new-invoice') {
        setEditingInvoice(null);
        setIsModalOpen(true);
      }
    };

    const handleApplyFilter = (e: any) => {
      if (e.detail?.filterKey === 'statusFilter') {
        setFilter(e.detail.filterValue);
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
      // Mark any pending invoices past their due date as overdue before fetching
      await markOverdueInvoices().catch(() => {});
      const [invoicesData, roomsData, readingsData] = await Promise.all([
        getInvoices(),
        getRooms(),
        getMeterReadings(),
      ]);
      setInvoices(invoicesData);
      setRooms(roomsData);
      setReadings(readingsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingInvoice(null);
    setFormData({
      room_id: '',
      meter_reading_id: '',
      invoice_month: new Date().getMonth() + 1,
      invoice_year: new Date().getFullYear(),
      room_rent: '',
      electricity_cost: '',
      water_cost: '',
      other_fees: '',
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: '',
    });
    setIsModalOpen(true);
  }

  function openEditModal(invoice: Invoice) {
    setEditingInvoice(invoice);
    setFormData({
      room_id: invoice.room_id,
      meter_reading_id: invoice.meter_reading_id || '',
      invoice_month: invoice.invoice_month,
      invoice_year: invoice.invoice_year,
      room_rent: invoice.room_rent,
      electricity_cost: invoice.electricity_cost,
      water_cost: invoice.water_cost,
      other_fees: invoice.other_fees ?? '',
      due_date: invoice.due_date || '',
      notes: invoice.notes || '',
    });
    setIsModalOpen(true);
  }

  function openDeleteModal(invoice: Invoice) {
    setDeletingInvoice(invoice);
    setIsDeleteModalOpen(true);
  }

  function handleRoomChange(roomId: string) {
    const room = rooms.find((r) => r.id === roomId);
    if (room) {
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      setFormData({
        ...formData,
        room_id: roomId,
        room_rent: room.monthly_rent,
        due_date: dueDate,
      });
    }
  }

  function handleReadingChange(readingId: string) {
    const reading = readings.find((r) => r.id === readingId);
    if (reading) {
      const elecUsage = reading.electricity_new - reading.electricity_old;
      const waterUsage = reading.water_new - reading.water_old;
      const electricityCost = elecUsage * reading.electricity_price_per_unit;
      const waterCost = waterUsage * reading.water_price_per_unit;

      setFormData({
        ...formData,
        meter_reading_id: readingId,
        electricity_cost: electricityCost,
        water_cost: waterCost,
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const room = rooms.find((r) => r.id === formData.room_id);
      const rentVal = parseFloat(formData.room_rent as any) || 0;
      const elecVal = parseFloat(formData.electricity_cost as any) || 0;
      const waterVal = parseFloat(formData.water_cost as any) || 0;
      const otherVal = parseFloat(formData.other_fees as any) || 0;

      const totalAmount = rentVal + elecVal + waterVal + otherVal;

      const data = {
        ...formData,
        room_rent: rentVal,
        electricity_cost: elecVal,
        water_cost: waterVal,
        other_fees: otherVal,
        tenant_id: room?.current_assignment?.tenant_id || null,
        total_amount: totalAmount,
        status: editingInvoice ? editingInvoice.status : ('pending' as const),
      };

      if (editingInvoice) {
        await updateInvoice(editingInvoice.id, data);
      } else {
        await createInvoice(data);
      }
      await loadData();
      setIsModalOpen(false);
    } catch (error) {
      console.error('Failed to save invoice:', error);
      alert('Không thể lưu hóa đơn. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingInvoice) return;
    try {
      await deleteInvoice(deletingInvoice.id);
      await loadData();
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error('Failed to delete invoice:', error);
      alert('Không thể xóa hóa đơn.');
    }
  }

  async function handleMarkPaid(invoice: Invoice) {
    try {
      await markInvoicePaid(invoice.id);
      await loadData();
    } catch (error) {
      console.error('Failed to mark invoice as paid:', error);
      alert('Không thể cập nhật trạng thái.');
    }
  }

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesStatus = filter === 'all' || invoice.status === filter;
    const matchesYear = invoice.invoice_year === filterYear;
    const matchesMonth = filterMonth === 0 || invoice.invoice_month === filterMonth;
    return matchesStatus && matchesYear && matchesMonth;
  });

  const statusCounts = {
    all: invoices.length,
    pending: invoices.filter((i) => i.status === 'pending').length,
    paid: invoices.filter((i) => i.status === 'paid').length,
    overdue: invoices.filter((i) => i.status === 'overdue').length,
  };

  const totalPending = invoices
    .filter((i) => i.status === 'pending')
    .reduce((sum, i) => sum + Number(i.total_amount), 0);

  const totalPaid = invoices
    .filter((i) => i.status === 'paid')
    .reduce((sum, i) => sum + Number(i.total_amount), 0);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-serif lining-nums tabular-nums text-charcoal-900 tracking-wide">Hóa đơn</h1>
          <p className="text-charcoal-400 mt-2 text-sm">Lập và quản lý hóa đơn thanh toán</p>
        </div>
        <Button onClick={openCreateModal}>
          <PiPlusLight className="w-4 h-4" />
          Tạo hóa đơn
        </Button>
      </header>

      {/* Financial Summary */}
      <section className="grid grid-cols-3 gap-6">
        <div className="bg-sage-50 rounded-2xl border border-sage-100 p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-charcoal-500 font-medium">Doanh thu đã thu</p>
              <p className="text-2xl font-semibold text-charcoal-900 mt-2">
                {totalPaid.toLocaleString('vi-VN')}đ
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-sage-50 border border-sage-100 flex items-center justify-center">
              <PiCheckCircleLight className="w-5 h-5 text-sage-600" />
            </div>
          </div>
        </div>
        <div className="bg-amber-50 rounded-2xl border border-amber-100 p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-charcoal-500 font-medium">Chờ thanh toán</p>
              <p className="text-2xl font-semibold text-charcoal-900 mt-2">
                {totalPending.toLocaleString('vi-VN')}đ
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center">
              <PiClockLight className="w-5 h-5 text-amber-600" />
            </div>
          </div>
        </div>
        <div className="bg-rose-50 rounded-2xl border border-rose-100 p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-charcoal-500 font-medium">Quá hạn</p>
              <p className="text-2xl font-semibold text-rose-600 mt-2">
                {statusCounts.overdue} hóa đơn
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center">
              <PiWarningCircleLight className="w-5 h-5 text-rose-600" />
            </div>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="space-y-4">
        <div className="flex gap-2 items-center flex-wrap">
          {(['all', 'pending', 'paid', 'overdue'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-5 py-2.5 text-sm font-medium rounded-xl transition-all ${
                filter === status
                  ? 'bg-white text-charcoal-900 shadow-card border border-charcoal-100'
                  : 'text-charcoal-400 hover:text-charcoal-600 hover:bg-white/50'
              }`}
            >
              {status === 'all' && 'Tất cả'}
              {status === 'pending' && 'Chờ thanh toán'}
              {status === 'paid' && 'Đã thanh toán'}
              {status === 'overdue' && 'Quá hạn'}
              <span className={`ml-2 px-2 py-0.5 rounded-lg text-xs ${
                filter === status ? 'bg-wood-100 text-wood-700' : 'bg-charcoal-100 text-charcoal-500'
              }`}>{statusCounts[status]}</span>
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <FilterDropdown 
                value={filterMonth.toString()}
                onChange={(v) => setFilterMonth(Number(v))}
                options={[
                  { value: '0', label: 'Tất cả tháng' },
                  ...Array.from({ length: 12 }, (_, i) => ({ value: (i + 1).toString(), label: `Tháng ${i + 1}` }))
                ]}
              />
            <FilterDropdown 
                value={filterYear.toString()}
                onChange={(v) => setFilterYear(Number(v))}
                options={Array.from({ length: 11 }, (_, i) => {
                  const y = (new Date().getFullYear() - 5 + i).toString();
                  return { value: y, label: y };
                })}
              />
          </div>
        </div>
      </section>

      {/* Invoice Table */}
      {filteredInvoices.length === 0 ? (
        <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card p-12">
          <EmptyState
            icon={<PiReceiptLight className="w-10 h-10" />}
            title="Chưa có hóa đơn nào"
            description="Bắt đầu tạo hóa đơn thanh toán cho khách thuê"
            action={<Button onClick={openCreateModal}><PiPlusLight className="w-4 h-4" />Tạo hóa đơn</Button>}
          />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-cream-50/50 border-b border-cream-200 text-xs uppercase tracking-widest text-charcoal-500 font-semibold">
                <th className="px-4 py-3">Kỳ hóa đơn</th>
                <th className="px-4 py-3">Phòng</th>
                <th className="px-4 py-3 text-center">Tiền phòng</th>
                <th className="px-4 py-3 text-center">Điện + Nước</th>
                <th className="px-4 py-3 text-center">Tổng</th>
                <th className="px-4 py-3">Hạn</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-cream-50/50 transition-colors group">
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-charcoal-50 flex items-center justify-center text-sm font-medium text-charcoal-600">
                        {invoice.invoice_month}/{invoice.invoice_year.toString().slice(-2)}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <p className="font-serif lining-nums tabular-nums font-medium text-wood-700">P.{invoice.room?.room_number}</p>
                    <p className="text-xs text-charcoal-400 mt-0.5">{invoice.tenant?.full_name || '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-center align-middle text-charcoal-600 font-serif lining-nums tabular-nums font-medium">
                    {invoice.room_rent.toLocaleString('vi-VN')}đ
                  </td>
                  <td className="px-4 py-3 text-center align-middle text-charcoal-600 font-serif lining-nums tabular-nums font-medium">
                    {(invoice.electricity_cost + invoice.water_cost).toLocaleString('vi-VN')}đ
                  </td>
                  <td className="px-4 py-3 text-center align-middle">
                    <p className="font-serif lining-nums tabular-nums text-wood-700 font-bold text-lg">{invoice.total_amount.toLocaleString('vi-VN')}đ</p>
                  </td>
                  <td className="px-4 py-3 text-charcoal-400 align-middle font-serif lining-nums tabular-nums font-medium">
                    {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('vi-VN') : '—'}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <InvoiceStatusBadge status={invoice.status} />
                  </td>
                  <td className="px-4 py-3 align-middle text-right">
                    <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {invoice.status === 'pending' && (
                        <button onClick={() => handleMarkPaid(invoice)} className="px-3 py-1.5 text-xs font-medium text-sage-600 bg-sage-50 hover:bg-sage-100 rounded-lg border border-sage-200 transition-colors">
                          Thanh toán
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(invoice)}
                        className="p-1.5 rounded-lg text-charcoal-400 hover:text-wood-600 hover:bg-wood-50 transition-colors bg-white border border-transparent hover:border-wood-200"
                        disabled={invoice.status === 'paid'}
                        title="Sửa"
                      >
                        <PiPencilSimpleLight className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openDeleteModal(invoice)}
                        className="p-1.5 rounded-lg text-charcoal-400 hover:text-rose-600 hover:bg-rose-50 transition-colors bg-white border border-transparent hover:border-rose-200"
                        disabled={invoice.status === 'paid'}
                        title="Xóa"
                      >
                        <PiTrashLight className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingInvoice ? 'Sửa hóa đơn' : 'Tạo hóa đơn mới'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Chọn phòng"
              name="room_id"
              type="select"
              value={formData.room_id}
              onChange={handleRoomChange}
              required
              options={[
                { value: '', label: '-- Chọn phòng --' },
                ...rooms
                  .filter((r) => r.status === 'occupied')
                  .map((r) => ({
                    value: r.id,
                    label: `Phòng ${r.room_number}${r.current_tenant ? ` - ${r.current_tenant.full_name}` : ''}`,
                  })),
              ]}
            />
            <Input
              label="Chỉ số điện nước (nếu có)"
              name="meter_reading_id"
              type="select"
              value={formData.meter_reading_id}
              onChange={handleReadingChange}
              options={[
                { value: '', label: '-- Không sử dụng --' },
                ...readings
                  .filter((r) => r.room_id === formData.room_id)
                  .map((r) => ({
                    value: r.id,
                    label: `${new Date(r.reading_date).toLocaleDateString('vi-VN')}`,
                  })),
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Kỳ hóa đơn (Tháng)"
              name="invoice_month"
              type="select"
              required
              value={formData.invoice_month.toString()}
              onChange={(v) => setFormData({ ...formData, invoice_month: parseInt(v) || 1 })}
              options={Array.from({ length: 12 }, (_, i) => ({ value: (i + 1).toString(), label: `Tháng ${i + 1}` }))}
            />
            <Input
              label="Kỳ hóa đơn (Năm)"
              name="invoice_year"
              type="select"
              required
              value={formData.invoice_year.toString()}
              onChange={(v) => setFormData({ ...formData, invoice_year: parseInt(v) || new Date().getFullYear() })}
              options={Array.from({ length: 11 }, (_, i) => {
                const year = new Date().getFullYear() - 5 + i;
                return { value: year.toString(), label: year.toString() };
              })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Tiền phòng (VNĐ)"
              name="room_rent"
              type="number"
              value={formData.room_rent}
              onChange={(v) => setFormData({ ...formData, room_rent: v })}
              min={0}
              required
            />
            <Input
              label="Hạn thanh toán"
              name="due_date"
              type="date"
              value={formData.due_date}
              onChange={(v) => setFormData({ ...formData, due_date: v })}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Tiền điện (VNĐ)"
              name="electricity_cost"
              type="number"
              value={formData.electricity_cost}
              onChange={(v) => setFormData({ ...formData, electricity_cost: v })}
              min={0}
            />
            <Input
              label="Tiền nước (VNĐ)"
              name="water_cost"
              type="number"
              value={formData.water_cost}
              onChange={(v) => setFormData({ ...formData, water_cost: v })}
              min={0}
            />
            <Input
              label="Phí khác (VNĐ)"
              name="other_fees"
              type="number"
              value={formData.other_fees}
              onChange={(v) => setFormData({ ...formData, other_fees: v })}
              min={0}
            />
          </div>
          <Input
            label="Ghi chú"
            name="notes"
            type="textarea"
            value={formData.notes}
            onChange={(v) => setFormData({ ...formData, notes: v })}
            rows={2}
          />

          {/* Total */}
          <div className="p-5 bg-cream-100 rounded-xl flex items-center justify-between">
            <span className="font-semibold text-charcoal-700">Tổng tiền:</span>
            <span className="text-2xl font-bold text-wood-600">
              {(
                (parseFloat(formData.room_rent as any) || 0) +
                (parseFloat(formData.electricity_cost as any) || 0) +
                (parseFloat(formData.water_cost as any) || 0) +
                (parseFloat(formData.other_fees as any) || 0)
              ).toLocaleString('vi-VN')}
              đ
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
              {saving ? 'Đang lưu...' : editingInvoice ? 'Cập nhật' : 'Tạo hóa đơn'}
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
            Bạn có chắc muốn xóa hóa đơn <strong className="text-charcoal-900">{deletingInvoice?.invoice_month}/
            {deletingInvoice?.invoice_year}</strong>?
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

function InvoiceStatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'warning' | 'success' | 'danger'> = {
    pending: 'warning',
    paid: 'success',
    overdue: 'danger',
  };
  return <Badge status={status} variant={variants[status]} />;
}
