import crypto from 'crypto';
import { query, queryOne, run } from '../../db.js';
import { mapRepair } from '../utils/mappers.js';
import { canAccessRoomRecord, tenantForViewer } from '../utils/access.js';

const generateId = () => crypto.randomUUID();

export const registerRepairRoutes = (app, { authenticate, requireAdmin, io }) => {
  app.get('/api/repair_requests', authenticate, async (req, res) => {
    try {
      const tenantId = req.user.role === 'ADMIN'
        ? (req.query.tenant_id ? String(req.query.tenant_id) : null)
        : req.user.id;
      const data = await query(`
        SELECT rr.*, 
               r.so_phong, r.tang, r.dien_tich, r.gia_phong, r.trang_thai as room_status, r.mo_ta as room_desc, r.so_nguoi_toi_da,
               t.ho_ten, t.so_dien_thoai, t.email, t.so_cccd, t.ngay_sinh, t.dia_chi, t.lien_he_khan_cap, t.ghi_chu as ghi_chu_khach
        FROM yeu_cau_sua_chua rr
        JOIN phong r ON rr.phong_id = r.id
        LEFT JOIN khach_thue t ON rr.khach_thue_id = t.id
        ${tenantId ? 'WHERE rr.khach_thue_id = ? OR rr.phong_id IN (SELECT phong_id FROM hop_dong_thue WHERE khach_thue_id = ? AND dang_hoat_dong = 1)' : ''}
        ORDER BY rr.ngay_bao DESC
      `, tenantId ? [tenantId, tenantId] : []);

      const mapped = data.map(item => ({
        ...mapRepair(item),
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
        } : null)
      }));

      res.json(mapped);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/repair_requests/:id', authenticate, async (req, res) => {
    try {
      const item = await queryOne(`
        SELECT rr.*, 
               r.so_phong, r.tang, r.dien_tich, r.gia_phong, r.trang_thai as room_status, r.mo_ta as room_desc, r.so_nguoi_toi_da,
               t.ho_ten, t.so_dien_thoai, t.email, t.so_cccd, t.ngay_sinh, t.dia_chi, t.lien_he_khan_cap, t.ghi_chu as ghi_chu_khach
        FROM yeu_cau_sua_chua rr
        JOIN phong r ON rr.phong_id = r.id
        LEFT JOIN khach_thue t ON rr.khach_thue_id = t.id
        WHERE rr.id = ?
      `, [req.params.id]);

      if (!item) return res.status(404).json({ error: 'Repair request not found' });
      if (!(await canAccessRoomRecord(req.user, item))) return res.status(403).json({ error: 'Không có quyền xem dữ liệu này' });

      res.json({
        ...mapRepair(item),
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
        } : null)
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/repair_requests', authenticate, requireAdmin, async (req, res) => {
    try {
      const id = generateId();
      const { room_id, tenant_id = null, title, description = '', priority = 'medium', status = 'new', assigned_to = null } = req.body;
    
      if (tenant_id) {
        const assigned = await queryOne('SELECT id FROM hop_dong_thue WHERE phong_id = ? AND khach_thue_id = ? AND dang_hoat_dong = 1', [room_id, tenant_id]);
        if (!assigned) {
          return res.status(400).json({ error: 'Người thuê này không có hợp đồng thuê hoạt động tại phòng này.' });
        }
      }

      await run(`
        INSERT INTO yeu_cau_sua_chua (id, phong_id, khach_thue_id, tieu_de, mo_ta, muc_do_uu_tien, trang_thai, nguoi_xu_ly)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [id, room_id, tenant_id, title, description, priority, status, assigned_to]);

      const created = await queryOne('SELECT * FROM yeu_cau_sua_chua WHERE id = ?', [id]);
      io.emit('repair_updated', { id, tenant_id, status, action: 'created' });
      res.status(201).json(mapRepair(created));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/repair_requests/:id', authenticate, requireAdmin, async (req, res) => {
    try {
      const { room_id, tenant_id, title, description, priority, status, assigned_to, resolution_notes, resolved_at } = req.body;
      const existing = await queryOne('SELECT * FROM yeu_cau_sua_chua WHERE id = ?', [req.params.id]);
      if (!existing) return res.status(404).json({ error: 'Repair request not found' });

      let finalResolvedAt = resolved_at;
      if (status === 'resolved' && existing.trang_thai !== 'resolved' && !resolved_at) {
        finalResolvedAt = new Date().toISOString();
      }

      const updated = {
        phong_id: room_id !== undefined ? room_id : existing.phong_id,
        khach_thue_id: tenant_id !== undefined ? tenant_id : existing.khach_thue_id,
        tieu_de: title !== undefined ? title : existing.tieu_de,
        mo_ta: description !== undefined ? description : existing.mo_ta,
        muc_do_uu_tien: priority !== undefined ? priority : existing.muc_do_uu_tien,
        trang_thai: status !== undefined ? status : existing.trang_thai,
        nguoi_xu_ly: assigned_to !== undefined ? assigned_to : existing.nguoi_xu_ly,
        ghi_chu_giai_quyet: resolution_notes !== undefined ? resolution_notes : existing.ghi_chu_giai_quyet,
        ngay_xu_ly_xong: finalResolvedAt !== undefined ? finalResolvedAt : existing.ngay_xu_ly_xong,
      };

      await run(`
        UPDATE yeu_cau_sua_chua
        SET phong_id = ?, khach_thue_id = ?, tieu_de = ?, mo_ta = ?, muc_do_uu_tien = ?, trang_thai = ?, nguoi_xu_ly = ?, ghi_chu_giai_quyet = ?, ngay_xu_ly_xong = ?, ngay_cap_nhat = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [updated.phong_id, updated.khach_thue_id, updated.tieu_de, updated.mo_ta, updated.muc_do_uu_tien, updated.trang_thai, updated.nguoi_xu_ly, updated.ghi_chu_giai_quyet, updated.ngay_xu_ly_xong, req.params.id]);

      const result = await queryOne('SELECT * FROM yeu_cau_sua_chua WHERE id = ?', [req.params.id]);
      io.emit('repair_updated', {
        id: req.params.id,
        tenant_id: result?.khach_thue_id || null,
        status: result?.trang_thai || updated.trang_thai,
        action: 'updated',
      });
      res.json(mapRepair(result));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/repair_requests/:id', authenticate, requireAdmin, async (req, res) => {
    try {
      const existing = await queryOne('SELECT khach_thue_id FROM yeu_cau_sua_chua WHERE id = ?', [req.params.id]);
      await run('DELETE FROM yeu_cau_sua_chua WHERE id = ?', [req.params.id]);
      io.emit('repair_updated', { id: req.params.id, tenant_id: existing?.khach_thue_id || null, action: 'deleted' });
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
};
