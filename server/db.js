import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env'), quiet: true });
const isTest = process.env.NODE_ENV === 'test';
const dbPath = isTest ? ':memory:' : (process.env.DATABASE_PATH || join(__dirname, 'hostelmate.sqlite'));

if (!isTest && process.env.RESET_DB_ON_START === 'true' && fs.existsSync(dbPath)) {
  fs.rmSync(dbPath, { force: true });
}

const require = createRequire(import.meta.url);
let db;
let driver = 'sqlite3';
try {
  const sqlite3 = require('sqlite3');
  db = new sqlite3.Database(dbPath);
} catch {
  // Node.js 22+ includes a built-in SQLite driver. This fallback is useful in
  // restricted/offline environments where sqlite3 cannot download its native binary.
  const { DatabaseSync } = require('node:sqlite');
  db = new DatabaseSync(dbPath);
  driver = 'node:sqlite';
  console.warn('sqlite3 native binding unavailable; using node:sqlite fallback.');
}

function normalizeParams(params) {
  return Array.isArray(params) ? params : [params];
}

export const query = (sql, params = []) => {
  if (driver === 'node:sqlite') {
    return Promise.resolve(db.prepare(sql).all(...normalizeParams(params)));
  }
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows));
  });
};

export const queryOne = (sql, params = []) => {
  if (driver === 'node:sqlite') {
    return Promise.resolve(db.prepare(sql).get(...normalizeParams(params)) || null);
  }
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => error ? reject(error) : resolve(row || null));
  });
};

export const run = (sql, params = []) => {
  if (driver === 'node:sqlite') {
    const result = db.prepare(sql).run(...normalizeParams(params));
    return Promise.resolve({ id: Number(result.lastInsertRowid || 0), changes: Number(result.changes || 0) });
  }
  return new Promise((resolve, reject) => {
    db.run(sql, params, function callback(error) {
      if (error) reject(error);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

export const exec = (sql) => {
  if (driver === 'node:sqlite') {
    db.exec(sql);
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    db.exec(sql, (error) => error ? reject(error) : resolve());
  });
};

export const closeDatabase = () => {
  if (driver === 'node:sqlite') {
    db.close();
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    db.close((error) => error ? reject(error) : resolve());
  });
};

const schema = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS nha_tro (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ten_nha_tro TEXT NOT NULL DEFAULT 'HostelMate',
  dia_chi TEXT NOT NULL DEFAULT 'Chưa cập nhật',
  vi_do REAL,
  kinh_do REAL,
  mo_ta TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS phong (
  id TEXT PRIMARY KEY,
  nha_tro_id INTEGER DEFAULT 1 REFERENCES nha_tro(id),
  khu_vuc TEXT NOT NULL DEFAULT 'Cơ sở chính',
  so_phong TEXT NOT NULL,
  tang INTEGER NOT NULL DEFAULT 1,
  dien_tich REAL NOT NULL DEFAULT 1,
  gia_phong REAL NOT NULL DEFAULT 0,
  trang_thai TEXT NOT NULL DEFAULT 'available',
  mo_ta TEXT,
  so_nguoi_toi_da INTEGER NOT NULL DEFAULT 2,
  dieu_hoa INTEGER NOT NULL DEFAULT 0,
  may_giat INTEGER NOT NULL DEFAULT 0,
  noi_that INTEGER NOT NULL DEFAULT 0,
  ban_cong INTEGER NOT NULL DEFAULT 0,
  anh_dai_dien TEXT,
  ngay_tao TEXT DEFAULT CURRENT_TIMESTAMP,
  ngay_cap_nhat TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(khu_vuc, so_phong)
);

CREATE TABLE IF NOT EXISTS khach_thue (
  id TEXT PRIMARY KEY,
  ho_ten TEXT NOT NULL,
  so_dien_thoai TEXT,
  email TEXT,
  so_cccd TEXT,
  ngay_sinh TEXT,
  dia_chi TEXT,
  lien_he_khan_cap TEXT,
  ghi_chu TEXT,
  username TEXT UNIQUE,
  password TEXT,
  google_email TEXT UNIQUE,
  is_locked INTEGER DEFAULT 0,
  ngay_tao TEXT DEFAULT CURRENT_TIMESTAMP,
  ngay_cap_nhat TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'ADMIN',
  tenant_id TEXT REFERENCES khach_thue(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  cccd TEXT,
  date_of_birth TEXT,
  address TEXT,
  token_version INTEGER NOT NULL DEFAULT 0,
  is_locked INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hop_dong_thue (
  id TEXT PRIMARY KEY,
  phong_id TEXT NOT NULL REFERENCES phong(id) ON DELETE CASCADE,
  khach_thue_id TEXT NOT NULL REFERENCES khach_thue(id) ON DELETE CASCADE,
  ngay_bat_dau TEXT NOT NULL,
  ngay_ket_thuc TEXT,
  dang_hoat_dong INTEGER NOT NULL DEFAULT 1,
  tien_dat_coc REAL DEFAULT 0,
  la_nguoi_dai_dien INTEGER NOT NULL DEFAULT 0,
  ngay_het_han_hop_dong TEXT,
  ghi_chu TEXT,
  chu_ky_khach TEXT,
  trang_thai_ky TEXT DEFAULT 'Chưa ký',
  file_hop_dong TEXT,
  ngay_tao TEXT DEFAULT CURRENT_TIMESTAMP,
  ngay_cap_nhat TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(phong_id, khach_thue_id, dang_hoat_dong)
);

CREATE TABLE IF NOT EXISTS chi_so_dien_nuoc (
  id TEXT PRIMARY KEY,
  phong_id TEXT NOT NULL REFERENCES phong(id) ON DELETE CASCADE,
  ngay_ghi_so TEXT NOT NULL,
  so_dien_cu REAL NOT NULL DEFAULT 0,
  so_dien_moi REAL NOT NULL DEFAULT 0,
  so_nuoc_cu REAL NOT NULL DEFAULT 0,
  so_nuoc_moi REAL NOT NULL DEFAULT 0,
  don_gia_dien REAL NOT NULL DEFAULT 3500,
  don_gia_nuoc REAL NOT NULL DEFAULT 15000,
  ngay_tao TEXT DEFAULT CURRENT_TIMESTAMP,
  ngay_cap_nhat TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(phong_id, ngay_ghi_so)
);

CREATE TABLE IF NOT EXISTS hoa_don (
  id TEXT PRIMARY KEY,
  ma_hoa_don TEXT UNIQUE,
  phong_id TEXT NOT NULL REFERENCES phong(id) ON DELETE CASCADE,
  khach_thue_id TEXT REFERENCES khach_thue(id) ON DELETE SET NULL,
  chi_so_dien_nuoc_id TEXT REFERENCES chi_so_dien_nuoc(id) ON DELETE SET NULL,
  thang_hoa_don INTEGER NOT NULL,
  nam_hoa_don INTEGER NOT NULL,
  tien_phong REAL NOT NULL DEFAULT 0,
  tien_dien REAL NOT NULL DEFAULT 0,
  tien_nuoc REAL NOT NULL DEFAULT 0,
  chi_phi_khac REAL DEFAULT 0,
  tong_tien REAL NOT NULL DEFAULT 0,
  trang_thai TEXT NOT NULL DEFAULT 'pending',
  han_thanh_toan TEXT,
  ngay_thanh_toan TEXT,
  phuong_thuc_thanh_toan TEXT,
  sepay_transaction_id TEXT,
  so_tien_da_nhan REAL DEFAULT 0,
  ghi_chu TEXT,
  ngay_tao TEXT DEFAULT CURRENT_TIMESTAMP,
  ngay_cap_nhat TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(phong_id, thang_hoa_don, nam_hoa_don)
);

CREATE TABLE IF NOT EXISTS giao_dich_sepay (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference_code TEXT UNIQUE,
  invoice_id TEXT REFERENCES hoa_don(id) ON DELETE SET NULL,
  amount REAL NOT NULL DEFAULT 0,
  content TEXT,
  raw_payload TEXT,
  status TEXT DEFAULT 'received',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS yeu_cau_sua_chua (
  id TEXT PRIMARY KEY,
  phong_id TEXT NOT NULL REFERENCES phong(id) ON DELETE CASCADE,
  khach_thue_id TEXT REFERENCES khach_thue(id) ON DELETE SET NULL,
  tieu_de TEXT NOT NULL,
  mo_ta TEXT,
  muc_do_uu_tien TEXT NOT NULL DEFAULT 'medium',
  trang_thai TEXT NOT NULL DEFAULT 'new',
  ngay_bao TEXT DEFAULT CURRENT_TIMESTAMP,
  ngay_xu_ly_xong TEXT,
  nguoi_xu_ly TEXT,
  ghi_chu_giai_quyet TEXT,
  ngay_tao TEXT DEFAULT CURRENT_TIMESTAMP,
  ngay_cap_nhat TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT 'all',
  target_tenant_id TEXT REFERENCES khach_thue(id) ON DELETE CASCADE,
  notification_type TEXT DEFAULT 'general',
  reference_id TEXT,
  action_url TEXT,
  is_read INTEGER DEFAULT 0,
  read_at TEXT,
  is_deleted INTEGER DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_recipients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES khach_thue(id) ON DELETE CASCADE,
  is_read INTEGER DEFAULT 0,
  read_at TEXT,
  is_deleted INTEGER DEFAULT 0,
  deleted_at TEXT,
  UNIQUE(notification_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS notification_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  sender_user_id TEXT NOT NULL,
  sender_role TEXT NOT NULL,
  content TEXT NOT NULL,
  is_deleted INTEGER DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id TEXT NOT NULL,
  sender_role TEXT NOT NULL,
  receiver_id TEXT,
  is_group_chat INTEGER DEFAULT 0,
  content TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  is_deleted INTEGER DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS danh_ba_ban_be (
  id TEXT PRIMARY KEY,
  nguoi_gui_id TEXT NOT NULL REFERENCES khach_thue(id) ON DELETE CASCADE,
  nguoi_nhan_id TEXT NOT NULL REFERENCES khach_thue(id) ON DELETE CASCADE,
  trang_thai TEXT DEFAULT 'pending',
  ngay_tao TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(nguoi_gui_id, nguoi_nhan_id)
);

CREATE TABLE IF NOT EXISTS yeu_cau_o_ghep (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  khach_thue_id TEXT NOT NULL REFERENCES khach_thue(id) ON DELETE CASCADE,
  phong_id TEXT NOT NULL REFERENCES phong(id) ON DELETE CASCADE,
  tieu_de TEXT NOT NULL,
  mo_ta TEXT,
  gia_chia_se REAL NOT NULL DEFAULT 0,
  trang_thai TEXT DEFAULT 'open',
  ngay_dang TEXT DEFAULT CURRENT_TIMESTAMP,
  ngay_cap_nhat TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cai_dat (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_phong_status ON phong(trang_thai);
CREATE INDEX IF NOT EXISTS idx_hop_dong_phong ON hop_dong_thue(phong_id, dang_hoat_dong);
CREATE INDEX IF NOT EXISTS idx_hop_dong_khach ON hop_dong_thue(khach_thue_id, dang_hoat_dong);
CREATE INDEX IF NOT EXISTS idx_hoa_don_status ON hoa_don(trang_thai);
CREATE INDEX IF NOT EXISTS idx_hoa_don_tenant ON hoa_don(khach_thue_id);
CREATE INDEX IF NOT EXISTS idx_sua_chua_tenant ON yeu_cau_sua_chua(khach_thue_id);
CREATE INDEX IF NOT EXISTS idx_notification_target ON notifications(target_tenant_id, target_type);
CREATE INDEX IF NOT EXISTS idx_chat_participants ON chat_messages(sender_id, receiver_id);
`;

// Databases created by older versions stored passwords as plain text.
async function hashLegacyPasswords() {
  for (const [table, column] of [['users', 'password_hash'], ['khach_thue', 'password']]) {
    const rows = await query(`SELECT id, ${column} AS value FROM ${table} WHERE ${column} NOT LIKE '$2%' AND ${column} <> ''`);
    for (const row of rows) {
      await run(`UPDATE ${table} SET ${column} = ? WHERE id = ?`, [await bcrypt.hash(String(row.value), 10), row.id]);
    }
  }
}

async function seedAdmin() {
  if (await queryOne("SELECT id FROM users WHERE username = 'admin'")) return;
  const password = process.env.ADMIN_INITIAL_PASSWORD
    || (process.env.NODE_ENV === 'production' ? null : '123456');
  if (!password) throw new Error('ADMIN_INITIAL_PASSWORD is required to create the first admin in production');
  await run(`
    INSERT INTO users (id, username, password_hash, role, full_name)
    VALUES ('admin-default', 'admin', ?, 'ADMIN', 'Quản trị viên')
  `, [await bcrypt.hash(password, 10)]);
}

async function initialize() {
  await exec(schema);
  await run(`INSERT OR IGNORE INTO nha_tro (id, ten_nha_tro, dia_chi) VALUES (1, 'HostelMate', 'Chưa cập nhật')`);
  await seedAdmin();
  await hashLegacyPasswords();
  const defaults = {
    bank_id: process.env.BANK_ID || '',
    bank_account_no: process.env.BANK_ACCOUNT_NO || '',
    bank_account_name: process.env.BANK_ACCOUNT_NAME || '',
    vietqr_template: process.env.VIETQR_TEMPLATE || 'compact2',
    payment_prefix: process.env.PAYMENT_PREFIX || 'HM',
    allowed_account_numbers: process.env.SEPAY_ALLOWED_ACCOUNT_NUMBERS || '',
    landlord_name: process.env.LANDLORD_NAME || 'Chủ trọ HostelMate',
    landlord_phone: process.env.LANDLORD_PHONE || '',
  };
  for (const [key, value] of Object.entries(defaults)) {
    const normalizedValue = String(value ?? '').trim();
    if (normalizedValue) {
      await run(
        'INSERT INTO cai_dat (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [key, normalizedValue]
      );
    } else {
      await run('INSERT OR IGNORE INTO cai_dat (key, value) VALUES (?, ?)', [key, '']);
    }
  }
  if (!isTest) console.log(`SQLite ready: ${dbPath}`);
}

export const dbReady = initialize();
export default db;
