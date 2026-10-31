import bcrypt from 'bcryptjs';
import { queryOne } from '../../db.js';

// Tenants only see records of their own account or of a room they currently rent.
export const canAccessRoomRecord = async (user, record) => {
  if (user.role === 'ADMIN' || record.khach_thue_id === user.id) return true;
  const rental = await queryOne(
    'SELECT id FROM hop_dong_thue WHERE khach_thue_id = ? AND phong_id = ? AND dang_hoat_dong = 1',
    [user.id, record.phong_id]
  );
  return !!rental;
};

// Roommates share room records, but not each other's personal details.
export const tenantForViewer = (user, tenant) => {
  if (!tenant || user.role === 'ADMIN' || tenant.id === user.id) return tenant;
  return { id: tenant.id, full_name: tenant.full_name };
};

export const hashPassword = (password) => (password ? bcrypt.hash(String(password), 10) : password);
