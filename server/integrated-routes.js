import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';

const uuid = () => crypto.randomUUID();
const LOCKED_ACCOUNT_MESSAGE = 'Tài khoản đã bị khóa. Vui lòng liên hệ chủ trọ.';

// Failed attempts only, so a shared IP is not locked out by normal logins.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Bạn đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.' },
});

const publicUser = (row, role) => ({
  id: row.id,
  username: row.username,
  role,
  tenant_id: role === 'TENANT' ? row.id : (row.tenant_id || null),
  full_name: row.full_name || row.ho_ten || row.username,
  phone: row.phone || row.so_dien_thoai || '',
  email: row.email || '',
  cccd: row.cccd || row.so_cccd || '',
  date_of_birth: row.date_of_birth || row.ngay_sinh || '',
  address: row.address || row.dia_chi || '',
  is_locked: !!row.is_locked,
});

const mapTenantRepair = (row) => ({
  id: row.id,
  room_id: row.phong_id,
  tenant_id: row.khach_thue_id,
  title: row.tieu_de,
  description: row.mo_ta,
  priority: row.muc_do_uu_tien,
  status: row.trang_thai,
  reported_at: row.ngay_bao,
  resolved_at: row.ngay_xu_ly_xong,
  assigned_to: row.nguoi_xu_ly,
  resolution_notes: row.ghi_chu_giai_quyet,
  created_at: row.ngay_tao,
  updated_at: row.ngay_cap_nhat,
  room: row.so_phong ? {
    id: row.phong_id,
    room_number: row.so_phong,
    floor: row.tang,
    area_sqm: row.dien_tich,
    monthly_rent: row.gia_phong,
    status: row.room_status,
    description: row.room_desc,
    max_occupants: row.so_nguoi_toi_da,
  } : undefined,
  tenant: row.ho_ten ? {
    id: row.khach_thue_id,
    full_name: row.ho_ten,
    phone: row.so_dien_thoai,
    email: row.email,
  } : undefined,
});

const verifyPassword = async (plain, stored) => {
  return bcrypt.compare(String(plain || ''), String(stored || ''));
};

export function setupIntegratedRoutes(app, { query, queryOne, run, io, jwtSecret, googleClientId }) {
  const googleClient = new OAuth2Client(googleClientId || undefined);

  const authenticate = async (req, res, next) => {
    const token = req.cookies?.token || req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Vui lòng đăng nhập' });
    try {
      const payload = jwt.verify(token, jwtSecret);
      const current = payload.role === 'TENANT'
        ? await queryOne('SELECT id, username, is_locked FROM khach_thue WHERE id = ?', [payload.id])
        : await queryOne('SELECT id, username, token_version FROM users WHERE id = ?', [payload.id]);
      if (!current || !current.username) return res.status(401).json({ error: 'Tài khoản không còn tồn tại hoặc đã bị thu hồi' });
      if (current.is_locked) return res.status(401).json({ error: LOCKED_ACCOUNT_MESSAGE });
      if (payload.role !== 'TENANT' && Number(payload.token_version || 0) !== Number(current.token_version || 0)) {
        return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn' });
      }
      req.user = payload;
      next();
    } catch {
      res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn' });
    }
  };

  const requireAdmin = (req, res, next) => {
    if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Chỉ quản trị viên được phép thực hiện thao tác này' });
    next();
  };

  const requireTenant = (req, res, next) => {
    if (req.user?.role !== 'TENANT') return res.status(403).json({ error: 'Chỉ người thuê được phép thực hiện thao tác này' });
    next();
  };

  app.post('/api/auth/login', loginLimiter, async (req, res) => {
    try {
      const username = String(req.body?.username || '').trim();
      const password = String(req.body?.password || '');
      if (!username || !password) return res.status(400).json({ error: 'Vui lòng nhập tài khoản và mật khẩu' });

      const admin = await queryOne(
        'SELECT * FROM users WHERE username = ? OR email = ? OR phone = ?',
        [username, username, username]
      );
      if (admin && await verifyPassword(password, admin.password_hash)) {
        const role = String(admin.role || 'ADMIN').toUpperCase();
        const token = jwt.sign({ id: admin.id, role, token_version: admin.token_version || 0 }, jwtSecret, { expiresIn: '7d' });
        res.cookie('token', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 86400000 });
        return res.json({ user: publicUser(admin, role), require_password_change: false });
      }

      const tenant = await queryOne(
        'SELECT * FROM khach_thue WHERE username = ? OR email = ? OR so_dien_thoai = ?',
        [username, username, username]
      );
      if (!tenant || !tenant.password || !(await verifyPassword(password, tenant.password))) {
        return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu' });
      }

      if (tenant.is_locked) return res.status(403).json({ error: LOCKED_ACCOUNT_MESSAGE });
      const token = jwt.sign({ id: tenant.id, role: 'TENANT', tenant_id: tenant.id }, jwtSecret, { expiresIn: '7d' });
      res.cookie('token', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 86400000 });
      res.json({ user: publicUser(tenant, 'TENANT'), require_password_change: false });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/auth/me', authenticate, async (req, res) => {
    try {
      const row = req.user.role === 'TENANT'
        ? await queryOne('SELECT * FROM khach_thue WHERE id = ?', [req.user.id])
        : await queryOne('SELECT * FROM users WHERE id = ?', [req.user.id]);
      res.json({ user: publicUser(row, req.user.role) });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/auth/me', authenticate, async (req, res) => {
    try {
      const { full_name, phone, email, cccd, date_of_birth, address, password } = req.body || {};
      if (req.user.role === 'TENANT') {
        const existing = await queryOne('SELECT * FROM khach_thue WHERE id = ?', [req.user.id]);
        if (!existing) return res.status(404).json({ error: 'Không tìm thấy người thuê' });
        let nextPassword = existing.password;
        if (password) nextPassword = await bcrypt.hash(String(password), 10);
        await run(`
          UPDATE khach_thue
          SET ho_ten = ?, so_dien_thoai = ?, email = ?, so_cccd = ?, ngay_sinh = ?, dia_chi = ?, password = ?, ngay_cap_nhat = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [
          full_name ?? existing.ho_ten,
          phone ?? existing.so_dien_thoai,
          email ?? existing.email,
          cccd ?? existing.so_cccd,
          date_of_birth ?? existing.ngay_sinh,
          address ?? existing.dia_chi,
          nextPassword,
          req.user.id,
        ]);
        const updated = await queryOne('SELECT * FROM khach_thue WHERE id = ?', [req.user.id]);
        return res.json({ user: publicUser(updated, 'TENANT') });
      }

      const existing = await queryOne('SELECT * FROM users WHERE id = ?', [req.user.id]);
      if (!existing) return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
      let nextPassword = existing.password_hash;
      if (password) nextPassword = await bcrypt.hash(String(password), 10);
      await run(`
        UPDATE users
        SET full_name = ?, phone = ?, email = ?, cccd = ?, date_of_birth = ?, address = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        full_name ?? existing.full_name,
        phone ?? existing.phone,
        email ?? existing.email,
        cccd ?? existing.cccd,
        date_of_birth ?? existing.date_of_birth,
        address ?? existing.address,
        nextPassword,
        req.user.id,
      ]);
      const updated = await queryOne('SELECT * FROM users WHERE id = ?', [req.user.id]);
      res.json({ user: publicUser(updated, 'ADMIN') });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/auth/logout', (_req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
  });

  app.post('/api/auth/change-password', authenticate, async (req, res) => {
    try {
      const { oldPassword, newPassword } = req.body || {};
      if (!newPassword || String(newPassword).length < 6) return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
      if (req.user.role === 'TENANT') {
        const row = await queryOne('SELECT password FROM khach_thue WHERE id = ?', [req.user.id]);
        if (!row || !(await verifyPassword(oldPassword, row.password))) return res.status(400).json({ error: 'Mật khẩu cũ không chính xác' });
        const hashed = await bcrypt.hash(String(newPassword), 10);
        await run('UPDATE khach_thue SET password = ?, ngay_cap_nhat = CURRENT_TIMESTAMP WHERE id = ?', [hashed, req.user.id]);
      } else {
        const row = await queryOne('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
        if (!row || !(await verifyPassword(oldPassword, row.password_hash))) return res.status(400).json({ error: 'Mật khẩu cũ không chính xác' });
        const hashed = await bcrypt.hash(String(newPassword), 10);
        await run('UPDATE users SET password_hash = ?, token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [hashed, req.user.id]);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/auth/google-login', async (req, res) => {
    try {
      if (!googleClientId) return res.status(503).json({ error: 'Chưa cấu hình GOOGLE_CLIENT_ID' });
      const ticket = await googleClient.verifyIdToken({ idToken: req.body?.token, audience: googleClientId });
      const payload = ticket.getPayload();
      const email = payload?.email;
      if (!email) return res.status(401).json({ error: 'Không đọc được email Google' });
      const tenant = await queryOne('SELECT * FROM khach_thue WHERE google_email = ? OR email = ?', [email, email]);
      if (!tenant) return res.status(403).json({ error: 'Email này chưa được chủ trọ liên kết với tài khoản người thuê' });
      if (tenant.is_locked) return res.status(403).json({ error: LOCKED_ACCOUNT_MESSAGE });
      const token = jwt.sign({ id: tenant.id, role: 'TENANT', tenant_id: tenant.id }, jwtSecret, { expiresIn: '7d' });
      res.cookie('token', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 86400000 });
      res.json({ user: publicUser(tenant, 'TENANT') });
    } catch {
      res.status(401).json({ error: 'Đăng nhập Google không hợp lệ' });
    }
  });

  app.get('/api/landlord/contact', async (_req, res) => {
    const rows = await query("SELECT key, value FROM cai_dat WHERE key IN ('landlord_name','landlord_phone')");
    const values = Object.fromEntries(rows.map(r => [r.key, r.value]));
    res.json({ name: values.landlord_name || 'Chủ trọ HostelMate', phone: values.landlord_phone || '' });
  });

  app.get('/api/admin/users', authenticate, requireAdmin, async (_req, res) => {
    const rows = await query('SELECT id, ho_ten, so_dien_thoai, email, username, google_email, ngay_tao FROM khach_thue ORDER BY ngay_tao DESC');
    const tenants = rows.map((row) => ({
      id: row.id,
      tenant_id: row.id,
      username: row.username,
      full_name: row.ho_ten,
      phone: row.so_dien_thoai,
      email: row.email,
      google_email: row.google_email,
      role: 'TENANT',
      created_at: row.ngay_tao,
    }));
    res.json({ data: tenants, pagination: { page: 1, limit: tenants.length || 1, totalItems: tenants.length, totalPages: 1, hasNextPage: false, hasPreviousPage: false } });
  });

  app.post('/api/admin/users', authenticate, requireAdmin, async (req, res) => {
    try {
      const { username, password, full_name, phone, email = '' } = req.body || {};
      if (!username || !password || !full_name) return res.status(400).json({ error: 'Thiếu thông tin tài khoản' });
      const id = uuid();
      await run(`INSERT INTO khach_thue (id, ho_ten, so_dien_thoai, email, username, password) VALUES (?, ?, ?, ?, ?, ?)`,
        [id, full_name, phone || '', email, username, await bcrypt.hash(String(password), 10)]);
      res.status(201).json({ id, username, full_name, phone, email, role: 'TENANT' });
    } catch (error) {
      res.status(400).json({ error: error.message.includes('UNIQUE') ? 'Tên đăng nhập hoặc email đã tồn tại' : error.message });
    }
  });

  // Proxy the VietQR image through the local backend. This avoids browser/ad-blocker
  // failures when loading img.vietqr.io directly from the tenant portal.
  app.get('/api/public/vietqr-image', async (req, res) => {
    const amount = Math.round(Number(req.query.amount || 0));
    const content = String(req.query.content || '').trim().toUpperCase();

    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000000000) {
      return res.status(400).json({ error: 'Số tiền tạo VietQR không hợp lệ' });
    }
    if (!/^[A-Z0-9._ -]{1,50}$/.test(content)) {
      return res.status(400).json({ error: 'Nội dung chuyển khoản không hợp lệ' });
    }

    const rows = await query(
      `SELECT key, value FROM cai_dat WHERE key IN ('bank_id', 'bank_account_no', 'bank_account_name', 'vietqr_template')`
    );
    const settings = Object.fromEntries(rows.map((row) => [row.key, String(row.value || '').trim()]));
    const bankId = settings.bank_id;
    const accountNo = settings.bank_account_no;
    const accountName = settings.bank_account_name;
    const allowedTemplates = new Set(['compact2', 'compact', 'qr_only', 'print']);
    const template = allowedTemplates.has(settings.vietqr_template) ? settings.vietqr_template : 'compact2';

    if (!bankId || !accountNo) {
      return res.status(503).json({ error: 'Chưa cấu hình tài khoản nhận tiền' });
    }

    const params = new URLSearchParams({ amount: String(amount), addInfo: content });
    if (accountName) params.set('accountName', accountName);

    const bankAliases = {
      '970422': 'MB',
      '970415': 'VietinBank',
      '970436': 'Vietcombank',
      '970418': 'BIDV',
      '970405': 'Agribank',
      '970407': 'Techcombank',
      '970416': 'ACB',
      '970423': 'TPBank',
    };
    const bankCandidates = [...new Set([bankId, bankAliases[bankId]].filter(Boolean))];
    const imageCandidates = [];
    for (const bank of bankCandidates) {
      const base = `https://img.vietqr.io/image/${encodeURIComponent(bank)}-${encodeURIComponent(accountNo)}-${encodeURIComponent(template)}`;
      imageCandidates.push(`${base}.jpg?${params.toString()}`);
      imageCandidates.push(`${base}.png?${params.toString()}`);
    }

    let lastError = null;
    for (const url of imageCandidates) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          redirect: 'follow',
          headers: {
            Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'User-Agent': 'Mozilla/5.0 HostelMate-VietQR/1.0',
          },
        });
        if (!response.ok) {
          lastError = new Error(`VietQR HTTP ${response.status}`);
          continue;
        }
        const contentType = response.headers.get('content-type') || '';
        const image = Buffer.from(await response.arrayBuffer());
        if (!contentType.startsWith('image/') || image.length < 500) {
          lastError = new Error('VietQR returned invalid image data');
          continue;
        }
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'private, no-store, max-age=0');
        return res.send(image);
      } catch (error) {
        lastError = error;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    console.error('Unable to proxy VietQR image:', lastError?.message || lastError);
    return res.status(502).json({
      error: 'Không thể kết nối máy chủ ảnh VietQR. Hãy kiểm tra DNS, tường lửa hoặc tiện ích chặn quảng cáo.',
    });
  });

  app.get('/api/settings', authenticate, async (_req, res) => {
    const rows = await query('SELECT key, value FROM cai_dat');
    res.json(Object.fromEntries(rows.map(row => [row.key, row.value])));
  });

  app.put('/api/settings', authenticate, requireAdmin, async (req, res) => {
    for (const [key, value] of Object.entries(req.body || {})) {
      await run('INSERT INTO cai_dat (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, String(value ?? '')]);
    }
    res.json({ success: true });
  });

  // Notification and direct-message modules were intentionally removed from this build.

  app.get('/api/tenant/repair_requests', authenticate, requireTenant, async (req, res) => {
    try {
      const rows = await query(`
        SELECT rr.*,
               r.so_phong, r.tang, r.dien_tich, r.gia_phong,
               r.trang_thai AS room_status, r.mo_ta AS room_desc, r.so_nguoi_toi_da,
               t.ho_ten, t.so_dien_thoai, t.email
        FROM yeu_cau_sua_chua rr
        JOIN phong r ON r.id = rr.phong_id
        JOIN khach_thue t ON t.id = rr.khach_thue_id
        WHERE rr.khach_thue_id = ?
        ORDER BY rr.ngay_bao DESC, rr.ngay_tao DESC
      `, [req.user.id]);
      res.json(rows.map(mapTenantRepair));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/tenant/repair_requests', authenticate, requireTenant, async (req, res) => {
    try {
      const roomId = String(req.body?.room_id || '').trim();
      const title = String(req.body?.title || '').trim();
      const description = String(req.body?.description || '').trim();
      const priority = String(req.body?.priority || 'medium').trim();
      const allowedPriorities = new Set(['low', 'medium', 'high', 'urgent']);

      if (!roomId) return res.status(400).json({ error: 'Vui lòng chọn phòng cần sửa chữa.' });
      if (!title) return res.status(400).json({ error: 'Vui lòng nhập tiêu đề sự cố.' });
      if (!allowedPriorities.has(priority)) return res.status(400).json({ error: 'Mức độ ưu tiên không hợp lệ.' });

      const assignment = await queryOne(`
        SELECT id
        FROM hop_dong_thue
        WHERE phong_id = ? AND khach_thue_id = ? AND dang_hoat_dong = 1
        LIMIT 1
      `, [roomId, req.user.id]);
      if (!assignment) {
        return res.status(400).json({ error: 'Bạn không có hợp đồng thuê đang hoạt động tại phòng này.' });
      }

      const id = uuid();
      await run(`
        INSERT INTO yeu_cau_sua_chua
          (id, phong_id, khach_thue_id, tieu_de, mo_ta, muc_do_uu_tien, trang_thai)
        VALUES (?, ?, ?, ?, ?, ?, 'new')
      `, [id, roomId, req.user.id, title, description || null, priority]);

      const created = await queryOne(`
        SELECT rr.*,
               r.so_phong, r.tang, r.dien_tich, r.gia_phong,
               r.trang_thai AS room_status, r.mo_ta AS room_desc, r.so_nguoi_toi_da,
               t.ho_ten, t.so_dien_thoai, t.email
        FROM yeu_cau_sua_chua rr
        JOIN phong r ON r.id = rr.phong_id
        JOIN khach_thue t ON t.id = rr.khach_thue_id
        WHERE rr.id = ?
      `, [id]);

      io.emit('repair_updated', { id, tenant_id: req.user.id, status: 'new', action: 'created' });
      res.status(201).json(mapTenantRepair(created));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/tenant/repair_requests/:id', authenticate, requireTenant, async (req, res) => {
    try {
      const existing = await queryOne(
        'SELECT * FROM yeu_cau_sua_chua WHERE id = ? AND khach_thue_id = ?',
        [req.params.id, req.user.id]
      );
      if (!existing) return res.status(404).json({ error: 'Không tìm thấy yêu cầu sửa chữa.' });

      if (req.body?.status === 'closed') {
        if (existing.trang_thai !== 'resolved') {
          return res.status(400).json({ error: 'Chỉ xác nhận được yêu cầu đã xử lý xong.' });
        }
        await run(
          "UPDATE yeu_cau_sua_chua SET trang_thai = 'closed', ngay_cap_nhat = CURRENT_TIMESTAMP WHERE id = ? AND khach_thue_id = ?",
          [req.params.id, req.user.id]
        );
        const closed = await queryOne('SELECT * FROM yeu_cau_sua_chua WHERE id = ?', [req.params.id]);
        io.emit('repair_updated', { id: req.params.id, tenant_id: req.user.id, status: 'closed', action: 'updated' });
        return res.json(mapTenantRepair(closed));
      }

      if (!['new', 'in_progress'].includes(existing.trang_thai)) {
        return res.status(400).json({ error: 'Yêu cầu đã hoàn tất nên không thể chỉnh sửa.' });
      }

      const title = req.body?.title !== undefined ? String(req.body.title).trim() : existing.tieu_de;
      const description = req.body?.description !== undefined ? String(req.body.description).trim() : existing.mo_ta;
      const priority = req.body?.priority !== undefined ? String(req.body.priority).trim() : existing.muc_do_uu_tien;
      const allowedPriorities = new Set(['low', 'medium', 'high', 'urgent']);
      if (!title) return res.status(400).json({ error: 'Vui lòng nhập tiêu đề sự cố.' });
      if (!allowedPriorities.has(priority)) return res.status(400).json({ error: 'Mức độ ưu tiên không hợp lệ.' });

      await run(`
        UPDATE yeu_cau_sua_chua
        SET tieu_de = ?, mo_ta = ?, muc_do_uu_tien = ?, ngay_cap_nhat = CURRENT_TIMESTAMP
        WHERE id = ? AND khach_thue_id = ?
      `, [title, description || null, priority, req.params.id, req.user.id]);

      const updated = await queryOne(`
        SELECT rr.*,
               r.so_phong, r.tang, r.dien_tich, r.gia_phong,
               r.trang_thai AS room_status, r.mo_ta AS room_desc, r.so_nguoi_toi_da,
               t.ho_ten, t.so_dien_thoai, t.email
        FROM yeu_cau_sua_chua rr
        JOIN phong r ON r.id = rr.phong_id
        JOIN khach_thue t ON t.id = rr.khach_thue_id
        WHERE rr.id = ?
      `, [req.params.id]);

      io.emit('repair_updated', { id: req.params.id, tenant_id: req.user.id, status: updated.trang_thai, action: 'updated' });
      res.json(mapTenantRepair(updated));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/tenant/repair_requests/:id', authenticate, requireTenant, async (req, res) => {
    try {
      const existing = await queryOne(
        'SELECT * FROM yeu_cau_sua_chua WHERE id = ? AND khach_thue_id = ?',
        [req.params.id, req.user.id]
      );
      if (!existing) return res.status(404).json({ error: 'Không tìm thấy yêu cầu sửa chữa.' });
      if (existing.trang_thai !== 'new') {
        return res.status(400).json({ error: 'Chỉ có thể xóa yêu cầu đang ở trạng thái Mới.' });
      }

      await run('DELETE FROM yeu_cau_sua_chua WHERE id = ? AND khach_thue_id = ?', [req.params.id, req.user.id]);
      io.emit('repair_updated', { id: req.params.id, tenant_id: req.user.id, action: 'deleted' });
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/badges', authenticate, async (req, res) => {
    let invoices = 0;
    let repairs = 0;
    if (req.user.role === 'TENANT') {
      invoices = (await queryOne("SELECT COUNT(*) AS c FROM hoa_don WHERE khach_thue_id=? AND trang_thai IN ('pending','overdue','waiting_confirmation','review_needed')", [req.user.id]))?.c || 0;
      repairs = (await queryOne("SELECT COUNT(*) AS c FROM yeu_cau_sua_chua WHERE khach_thue_id=? AND trang_thai IN ('new','in_progress')", [req.user.id]))?.c || 0;
    } else {
      invoices = (await queryOne("SELECT COUNT(*) AS c FROM hoa_don WHERE trang_thai IN ('pending','overdue','waiting_confirmation','review_needed')"))?.c || 0;
      repairs = (await queryOne("SELECT COUNT(*) AS c FROM yeu_cau_sua_chua WHERE trang_thai IN ('new','in_progress')"))?.c || 0;
    }
    res.json({ chat: 0, notifications: 0, invoices, repairs });
  });

  app.post('/api/invoices/:id/report-payment', authenticate, async (req, res) => {
    const invoice = await queryOne('SELECT * FROM hoa_don WHERE id = ?', [req.params.id]);
    if (!invoice) return res.status(404).json({ error: 'Không tìm thấy hóa đơn' });
    if (req.user.role === 'TENANT' && invoice.khach_thue_id !== req.user.id) return res.status(403).json({ error: 'Không có quyền thao tác hóa đơn này' });
    await run("UPDATE hoa_don SET trang_thai='waiting_confirmation', ngay_cap_nhat=CURRENT_TIMESTAMP WHERE id=?", [req.params.id]);
    io.emit('invoice_updated', { id: req.params.id, status: 'waiting_confirmation' });
    res.json({ success: true, status: 'waiting_confirmation' });
  });

  app.patch('/api/admin/invoices/:id/confirm-payment', authenticate, requireAdmin, async (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    await run("UPDATE hoa_don SET trang_thai='paid', ngay_thanh_toan=?, phuong_thuc_thanh_toan=COALESCE(phuong_thuc_thanh_toan,'Xác nhận thủ công'), ngay_cap_nhat=CURRENT_TIMESTAMP WHERE id=?", [today, req.params.id]);
    io.emit('invoice_updated', { id: req.params.id, status: 'paid' });
    res.json({ success: true, status: 'paid' });
  });

  const handleSepayWebhook = async (req, res) => {
    try {
      const configuredKey = String(process.env.SEPAY_WEBHOOK_API_KEY || '').trim();
      const authorization = String(req.headers.authorization || '').trim();
      const provided = String(
        req.headers['x-api-key'] ||
        req.headers['api-key'] ||
        authorization.replace(/^Apikey\s+/i, '').replace(/^Bearer\s+/i, '')
      ).trim();

      if (!configuredKey) return res.status(503).json({ success: false, message: 'Chưa cấu hình SEPAY_WEBHOOK_API_KEY' });
      const sameLength = Buffer.byteLength(provided) === Buffer.byteLength(configuredKey);
      const validKey = sameLength && crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(configuredKey));
      if (!validKey) return res.status(401).json({ success: false, message: 'Webhook API key không hợp lệ' });

      const data = req.body || {};
      const allowedAccounts = String(process.env.SEPAY_ALLOWED_ACCOUNT_NUMBERS || '')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean);
      const incomingAccount = String(data.accountNumber || data.account_number || data.bankAccountNumber || data.subAccount || '').trim();

      if (allowedAccounts.length > 0) {
        if (!incomingAccount) return res.status(400).json({ success: false, message: 'Webhook thiếu accountNumber' });
        if (!allowedAccounts.includes(incomingAccount)) {
          return res.status(403).json({ success: false, message: 'Giao dịch không thuộc tài khoản được cho phép' });
        }
      }

      const transferType = String(data.transferType || data.transfer_type || 'in').toLowerCase();
      if (transferType !== 'in') return res.json({ success: true });

      const paymentCode = String(data.code || '').toUpperCase();
      const content = String(data.transactionContent || data.content || data.description || '').toUpperCase();
      const searchableContent = `${paymentCode} ${content}`.replace(/[^A-Z0-9]/g, '');
      const amount = Number(data.amountIn ?? data.transferAmount ?? data.amount ?? 0);
      const transactionId = data.id ?? data.referenceCode ?? data.reference_number;
      const reference = String(transactionId || crypto.createHash('sha1').update(JSON.stringify(data)).digest('hex'));

      const existed = await queryOne('SELECT id FROM giao_dich_sepay WHERE reference_code=?', [reference]);
      if (existed) return res.json({ success: true });

      const candidates = await query("SELECT * FROM hoa_don WHERE trang_thai <> 'paid' ORDER BY ngay_tao DESC");
      const invoice = candidates.find(item => {
        const codes = [item.ma_hoa_don, `HD${String(item.id).replace(/-/g, '').slice(0, 8)}`, String(item.id)]
          .filter(Boolean)
          .map(value => String(value).toUpperCase().replace(/[^A-Z0-9]/g, ''));
        return codes.some(code => code && searchableContent.includes(code));
      });

      await run(
        'INSERT INTO giao_dich_sepay (reference_code, invoice_id, amount, content, raw_payload, status) VALUES (?, ?, ?, ?, ?, ?)',
        [reference, invoice?.id || null, amount, content, JSON.stringify(data), invoice ? 'matched' : 'unmatched']
      );

      if (!invoice) return res.json({ success: true });

      const received = Number(invoice.so_tien_da_nhan || 0) + amount;
      const paid = received >= Number(invoice.tong_tien || 0);
      const status = paid ? 'paid' : 'review_needed';
      const paidDate = paid ? new Date().toISOString().slice(0, 10) : invoice.ngay_thanh_toan;
      await run(
        `UPDATE hoa_don
         SET so_tien_da_nhan=?, trang_thai=?, ngay_thanh_toan=?,
             phuong_thuc_thanh_toan='SePay', sepay_transaction_id=?, ngay_cap_nhat=CURRENT_TIMESTAMP
         WHERE id=?`,
        [received, status, paidDate, reference, invoice.id]
      );
      io.emit('invoice_updated', { id: invoice.id, status, received });
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  };

  app.post('/api/webhooks/sepay', handleSepayWebhook);
  app.post('/api/payments/webhook', handleSepayWebhook);

  app.get('/api/health', async (_req, res) => {
    const counts = {};
    for (const table of ['phong','khach_thue','hop_dong_thue','hoa_don','yeu_cau_sua_chua']) {
      counts[table] = (await queryOne(`SELECT COUNT(*) AS c FROM ${table}`))?.c || 0;
    }
    res.json({ status: 'ok', database: counts });
  });

  return { authenticate, requireAdmin };

  return { authenticate, requireAdmin, requireTenant };
}
