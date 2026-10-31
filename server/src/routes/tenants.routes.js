import crypto from 'crypto';
import { query, queryOne, run } from '../../db.js';
import { mapTenant } from '../utils/mappers.js';
import { hashPassword } from '../utils/access.js';

const generateId = () => crypto.randomUUID();

export const registerTenantRoutes = (app, { authenticate, requireAdmin }) => {
  app.get('/api/tenants', authenticate, requireAdmin, async (req, res) => {
    try {
      const tenants = await query('SELECT * FROM khach_thue ORDER BY ho_ten');
      res.json(tenants.map(mapTenant));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/tenants/:id', authenticate, requireAdmin, async (req, res) => {
    try {
      const tenant = await queryOne('SELECT * FROM khach_thue WHERE id = ?', [req.params.id]);
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }
      res.json(mapTenant(tenant));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/tenants', authenticate, requireAdmin, async (req, res) => {
    try {
      const id = generateId();
      const { full_name, phone = '', email = '', id_card_number = '', date_of_birth = '', address = '', emergency_contact = '', notes = '', username = null, password = null, google_email = null } = req.body;
    
      await run(`
        INSERT INTO khach_thue (id, ho_ten, so_dien_thoai, email, so_cccd, ngay_sinh, dia_chi, lien_he_khan_cap, ghi_chu, username, password, google_email)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [id, full_name, phone, email, id_card_number, date_of_birth, address, emergency_contact, notes, username, await hashPassword(password), google_email]);

      const tenant = await queryOne('SELECT * FROM khach_thue WHERE id = ?', [id]);
      res.status(201).json(mapTenant(tenant));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/tenants/:id', authenticate, requireAdmin, async (req, res) => {
    try {
      const { full_name, phone, email, id_card_number, date_of_birth, address, emergency_contact, notes, username, password, google_email } = req.body;
      const existing = await queryOne('SELECT * FROM khach_thue WHERE id = ?', [req.params.id]);
      if (!existing) return res.status(404).json({ error: 'Tenant not found' });

      const updated = {
        ho_ten: full_name !== undefined ? full_name : existing.ho_ten,
        so_dien_thoai: phone !== undefined ? phone : existing.so_dien_thoai,
        email: email !== undefined ? email : existing.email,
        so_cccd: id_card_number !== undefined ? id_card_number : existing.so_cccd,
        ngay_sinh: date_of_birth !== undefined ? date_of_birth : existing.ngay_sinh,
        dia_chi: address !== undefined ? address : existing.dia_chi,
        lien_he_khan_cap: emergency_contact !== undefined ? emergency_contact : existing.lien_he_khan_cap,
        ghi_chu: notes !== undefined ? notes : existing.ghi_chu,
        username: username !== undefined ? username : existing.username,
        password: password !== undefined ? await hashPassword(password) : existing.password,
        google_email: google_email !== undefined ? google_email : existing.google_email,
        is_locked: req.body.is_locked !== undefined ? (req.body.is_locked ? 1 : 0) : existing.is_locked,
      };

      await run(`
        UPDATE khach_thue 
        SET ho_ten = ?, so_dien_thoai = ?, email = ?, so_cccd = ?, ngay_sinh = ?, dia_chi = ?, lien_he_khan_cap = ?, ghi_chu = ?, username = ?, password = ?, google_email = ?, is_locked = ?, ngay_cap_nhat = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [updated.ho_ten, updated.so_dien_thoai, updated.email, updated.so_cccd, updated.ngay_sinh, updated.dia_chi, updated.lien_he_khan_cap, updated.ghi_chu, updated.username, updated.password, updated.google_email, updated.is_locked, req.params.id]);

      const tenant = await queryOne('SELECT * FROM khach_thue WHERE id = ?', [req.params.id]);
      res.json(mapTenant(tenant));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Issues a one-time password. Only its hash is stored, so this response is the only chance to read it.
  app.post('/api/tenants/:id/credentials', authenticate, requireAdmin, async (req, res) => {
    try {
      const existing = await queryOne('SELECT username FROM khach_thue WHERE id = ?', [req.params.id]);
      if (!existing) return res.status(404).json({ error: 'Tenant not found' });
      const username = String(req.body?.username || existing.username || '').trim();
      if (!username) return res.status(400).json({ error: 'Thiếu tên đăng nhập' });

      const temporaryPassword = crypto.randomBytes(9).toString('base64url');
      await run(
        'UPDATE khach_thue SET username = ?, password = ?, ngay_cap_nhat = CURRENT_TIMESTAMP WHERE id = ?',
        [username, await hashPassword(temporaryPassword), req.params.id]
      );

      const tenant = await queryOne('SELECT * FROM khach_thue WHERE id = ?', [req.params.id]);
      res.json({ ...mapTenant(tenant), temporary_password: temporaryPassword });
    } catch (error) {
      if (error.message && error.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'Tên đăng nhập này đã tồn tại. Vui lòng sửa tên khách thuê hoặc chọn tên khác.' });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/tenants/:id', authenticate, requireAdmin, async (req, res) => {
    try {
      const activeAssign = await queryOne('SELECT id FROM hop_dong_thue WHERE khach_thue_id = ? AND dang_hoat_dong = 1', [req.params.id]);
      if (activeAssign) {
        return res.status(400).json({ error: 'Không thể xóa khách thuê đang có hợp đồng thuê phòng. Vui lòng thanh lý hợp đồng trước.' });
      }
      const unpaidInvoice = await queryOne(`SELECT id FROM hoa_don WHERE khach_thue_id = ? AND trang_thai IN ('pending', 'overdue')`, [req.params.id]);
      if (unpaidInvoice) {
        return res.status(400).json({ error: 'Không thể xóa khách thuê đang còn nợ hóa đơn chưa thanh toán.' });
      }
      await run('DELETE FROM khach_thue WHERE id = ?', [req.params.id]);
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
};
