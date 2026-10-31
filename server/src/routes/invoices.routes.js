import crypto from 'crypto';
import { query, queryOne, run } from '../../db.js';
import { mapInvoice } from '../utils/mappers.js';
import { canAccessRoomRecord, tenantForViewer } from '../utils/access.js';

const generateId = () => crypto.randomUUID();
const PAYMENT_PREFIX = String(process.env.PAYMENT_PREFIX || 'HM').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'HM';

export const registerInvoiceRoutes = (app, { authenticate, requireAdmin }) => {
  app.get('/api/invoices', authenticate, async (req, res) => {
    try {
      const tenantId = req.user.role === 'ADMIN'
        ? (req.query.tenant_id ? String(req.query.tenant_id) : null)
        : req.user.id;
      const data = await query(`
        SELECT i.*, 
               r.so_phong, r.tang, r.dien_tich, r.gia_phong, r.trang_thai as room_status, r.mo_ta as room_desc, r.so_nguoi_toi_da,
               t.ho_ten, t.so_dien_thoai, t.email, t.so_cccd, t.ngay_sinh, t.dia_chi, t.lien_he_khan_cap, t.ghi_chu as ghi_chu_khach,
               mr.ngay_ghi_so, mr.so_dien_cu, mr.so_dien_moi, mr.so_nuoc_cu, mr.so_nuoc_moi, mr.don_gia_dien, mr.don_gia_nuoc
        FROM hoa_don i
        JOIN phong r ON i.phong_id = r.id
        LEFT JOIN khach_thue t ON i.khach_thue_id = t.id
        LEFT JOIN chi_so_dien_nuoc mr ON i.chi_so_dien_nuoc_id = mr.id
        ${tenantId ? 'WHERE i.khach_thue_id = ? OR i.phong_id IN (SELECT phong_id FROM hop_dong_thue WHERE khach_thue_id = ? AND dang_hoat_dong = 1)' : ''}
        ORDER BY i.ngay_tao DESC
      `, tenantId ? [tenantId, tenantId] : []);

      const mapped = data.map(item => ({
        ...mapInvoice(item),
        room: {
          id: item.phong_id,
          room_number: item.so_phong,
          floor: item.tang,
          area_sqm: item.dien_tich,
          monthly_rent: item.gia_phong,
          status: item.room_status,
          description: item.room_desc,
          max_occupants: item.so_nguoi_toi_da,
        },
        tenant: tenantForViewer(req.user, item.khach_thue_id ? {
          id: item.khach_thue_id,
          full_name: item.ho_ten,
          phone: item.so_dien_thoai,
          email: item.email,
          id_card_number: item.so_cccd,
          date_of_birth: item.ngay_sinh,
          address: item.dia_chi,
          emergency_contact: item.lien_he_khan_cap,
          notes: item.ghi_chu_khach,
        } : null),
        meter_reading: item.chi_so_dien_nuoc_id ? {
          id: item.chi_so_dien_nuoc_id,
          room_id: item.phong_id,
          reading_date: item.ngay_ghi_so,
          electricity_old: item.so_dien_cu,
          electricity_new: item.so_dien_moi,
          water_old: item.so_nuoc_cu,
          water_new: item.so_nuoc_moi,
          electricity_price_per_unit: item.don_gia_dien,
          water_price_per_unit: item.don_gia_nuoc,
        } : null
      }));

      res.json(mapped);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/invoices/export', authenticate, requireAdmin, async (req, res) => {
    try {
      const data = await query(`
        SELECT i.*, r.so_phong, t.ho_ten
        FROM hoa_don i
        JOIN phong r ON i.phong_id = r.id
        LEFT JOIN khach_thue t ON i.khach_thue_id = t.id
        ORDER BY i.nam_hoa_don DESC, i.thang_hoa_don DESC
      `);

      let csvContent = 'Mã hóa đơn,Số phòng,Khách thuê,Tháng,Năm,Tiền phòng,Tiền điện,Tiền nước,Phí khác,Tổng cộng,Trạng thái,Hạn thanh toán\n';
    
      data.forEach(item => {
        const statusText = item.trang_thai === 'paid' ? 'Đã thanh toán' : (item.trang_thai === 'overdue' ? 'Quá hạn' : 'Chưa thanh toán');
        csvContent += `${item.id},${item.so_phong || ''},${item.ho_ten || ''},${item.thang_hoa_don},${item.nam_hoa_don},${item.tien_phong || 0},${item.tien_dien || 0},${item.tien_nuoc || 0},${item.chi_phi_khac || 0},${item.tong_tien || 0},${statusText},${item.han_thanh_toan || ''}\n`;
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=danh_sach_hoa_don.csv');
      res.send('\ufeff' + csvContent);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/invoices/:id', authenticate, async (req, res) => {
    try {
      const item = await queryOne(`
        SELECT i.*, 
               r.so_phong, r.tang, r.dien_tich, r.gia_phong, r.trang_thai as room_status, r.mo_ta as room_desc, r.so_nguoi_toi_da,
               t.ho_ten, t.so_dien_thoai, t.email, t.so_cccd, t.ngay_sinh, t.dia_chi, t.lien_he_khan_cap, t.ghi_chu as ghi_chu_khach,
               mr.ngay_ghi_so, mr.so_dien_cu, mr.so_dien_moi, mr.so_nuoc_cu, mr.so_nuoc_moi, mr.don_gia_dien, mr.don_gia_nuoc
        FROM hoa_don i
        JOIN phong r ON i.phong_id = r.id
        LEFT JOIN khach_thue t ON i.khach_thue_id = t.id
        LEFT JOIN chi_so_dien_nuoc mr ON i.chi_so_dien_nuoc_id = mr.id
        WHERE i.id = ?
      `, [req.params.id]);

      if (!item) return res.status(404).json({ error: 'Invoice not found' });
      if (!(await canAccessRoomRecord(req.user, item))) return res.status(403).json({ error: 'Không có quyền xem dữ liệu này' });

      // Repair invoices created by older versions that did not assign a payment code.
      // Persisting it is required so the SePay webhook can match the transfer later.
      if (!String(item.ma_hoa_don || '').trim()) {
        const compactId = String(item.id || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        item.ma_hoa_don = `${PAYMENT_PREFIX}${compactId.slice(-10).padStart(10, '0')}`;
        await run('UPDATE hoa_don SET ma_hoa_don = ?, ngay_cap_nhat = CURRENT_TIMESTAMP WHERE id = ?', [item.ma_hoa_don, item.id]);
      }

      res.json({
        ...mapInvoice(item),
        room: {
          id: item.phong_id,
          room_number: item.so_phong,
          floor: item.tang,
          area_sqm: item.dien_tich,
          monthly_rent: item.gia_phong,
          status: item.room_status,
          description: item.room_desc,
          max_occupants: item.so_nguoi_toi_da,
        },
        tenant: tenantForViewer(req.user, item.khach_thue_id ? {
          id: item.khach_thue_id,
          full_name: item.ho_ten,
          phone: item.so_dien_thoai,
          email: item.email,
          id_card_number: item.so_cccd,
          date_of_birth: item.ngay_sinh,
          address: item.dia_chi,
          emergency_contact: item.lien_he_khan_cap,
          notes: item.ghi_chu_khach,
        } : null),
        meter_reading: item.chi_so_dien_nuoc_id ? {
          id: item.chi_so_dien_nuoc_id,
          room_id: item.phong_id,
          reading_date: item.ngay_ghi_so,
          electricity_old: item.so_dien_cu,
          electricity_new: item.so_dien_moi,
          water_old: item.so_nuoc_cu,
          water_new: item.so_nuoc_moi,
          electricity_price_per_unit: item.don_gia_dien,
          water_price_per_unit: item.don_gia_nuoc,
        } : null
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/invoices', authenticate, requireAdmin, async (req, res) => {
    try {
      const id = generateId();
      const invoiceCode = `${PAYMENT_PREFIX}${Date.now().toString().slice(-10)}`;
      const {
        room_id,
        tenant_id = null,
        meter_reading_id = null,
        invoice_month,
        invoice_year,
        room_rent,
        electricity_cost = 0,
        water_cost = 0,
        other_fees = 0,
        total_amount,
        status = 'pending',
        due_date = null,
        notes = null,
      } = req.body;

      await run(`
        INSERT INTO hoa_don (id, ma_hoa_don, phong_id, khach_thue_id, chi_so_dien_nuoc_id, thang_hoa_don, nam_hoa_don, tien_phong, tien_dien, tien_nuoc, chi_phi_khac, tong_tien, trang_thai, han_thanh_toan, ghi_chu)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [id, invoiceCode, room_id, tenant_id, meter_reading_id, invoice_month, invoice_year, room_rent, electricity_cost, water_cost, other_fees, total_amount, status, due_date, notes]);

      const invoice = await queryOne('SELECT * FROM hoa_don WHERE id = ?', [id]);
      res.status(201).json(mapInvoice(invoice));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/invoices/:id', authenticate, requireAdmin, async (req, res) => {
    try {
      const { room_id, tenant_id, meter_reading_id, invoice_month, invoice_year, room_rent, electricity_cost, water_cost, other_fees, total_amount, status, due_date, notes, paid_date } = req.body;
      const existing = await queryOne('SELECT * FROM hoa_don WHERE id = ?', [req.params.id]);
      if (!existing) return res.status(404).json({ error: 'Invoice not found' });

      const updated = {
        phong_id: room_id !== undefined ? room_id : existing.phong_id,
        khach_thue_id: tenant_id !== undefined ? tenant_id : existing.khach_thue_id,
        chi_so_dien_nuoc_id: meter_reading_id !== undefined ? meter_reading_id : existing.chi_so_dien_nuoc_id,
        thang_hoa_don: invoice_month !== undefined ? invoice_month : existing.thang_hoa_don,
        nam_hoa_don: invoice_year !== undefined ? invoice_year : existing.nam_hoa_don,
        tien_phong: room_rent !== undefined ? room_rent : existing.tien_phong,
        tien_dien: electricity_cost !== undefined ? electricity_cost : existing.tien_dien,
        tien_nuoc: water_cost !== undefined ? water_cost : existing.tien_nuoc,
        chi_phi_khac: other_fees !== undefined ? other_fees : existing.chi_phi_khac,
        tong_tien: total_amount !== undefined ? total_amount : existing.tong_tien,
        trang_thai: status !== undefined ? status : existing.trang_thai,
        han_thanh_toan: due_date !== undefined ? due_date : existing.han_thanh_toan,
        ngay_thanh_toan: paid_date !== undefined ? paid_date : existing.ngay_thanh_toan,
        ghi_chu: notes !== undefined ? notes : existing.ghi_chu,
      };

      await run(`
        UPDATE hoa_don
        SET phong_id = ?, khach_thue_id = ?, chi_so_dien_nuoc_id = ?, thang_hoa_don = ?, nam_hoa_don = ?, tien_phong = ?, tien_dien = ?, tien_nuoc = ?, chi_phi_khac = ?, tong_tien = ?, trang_thai = ?, han_thanh_toan = ?, ngay_thanh_toan = ?, ghi_chu = ?, ngay_cap_nhat = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [updated.phong_id, updated.khach_thue_id, updated.chi_so_dien_nuoc_id, updated.thang_hoa_don, updated.nam_hoa_don, updated.tien_phong, updated.tien_dien, updated.tien_nuoc, updated.chi_phi_khac, updated.tong_tien, updated.trang_thai, updated.han_thanh_toan, updated.ngay_thanh_toan, updated.ghi_chu, req.params.id]);

      const result = await queryOne('SELECT * FROM hoa_don WHERE id = ?', [req.params.id]);
      res.json(mapInvoice(result));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/invoices/:id', authenticate, requireAdmin, async (req, res) => {
    try {
      await run('DELETE FROM hoa_don WHERE id = ?', [req.params.id]);
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/invoices/mark-overdue', authenticate, async (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      await run(`
        UPDATE hoa_don
        SET trang_thai = 'overdue'
        WHERE trang_thai = 'pending'
          AND han_thanh_toan IS NOT NULL
          AND han_thanh_toan < ?
      `, [today]);
      res.json({ message: 'Overdue invoices updated' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/invoices/:id/paid', authenticate, requireAdmin, async (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      await run(`
        UPDATE hoa_don
        SET trang_thai = 'paid', ngay_thanh_toan = ?
        WHERE id = ?
      `, [today, req.params.id]);

      const updated = await queryOne('SELECT * FROM hoa_don WHERE id = ?', [req.params.id]);
      res.json(mapInvoice(updated));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
};
