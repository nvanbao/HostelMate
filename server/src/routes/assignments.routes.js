import crypto from 'crypto';
import { query, queryOne, run } from '../../db.js';
import { mapAssignment } from '../utils/mappers.js';

const generateId = () => crypto.randomUUID();

export const registerAssignmentRoutes = (app, { authenticate, requireAdmin }) => {
  app.post('/api/room_assignments', authenticate, requireAdmin, async (req, res) => {
    try {
      const { room_id, tenant_id, start_date, deposit_amount, is_primary, notes, contract_end_date } = req.body;

      // Check room status & capacity
      const room = await queryOne('SELECT id, trang_thai, so_nguoi_toi_da FROM phong WHERE id = ?', [room_id]);
      if (!room) return res.status(404).json({ error: 'Room not found' });
      if (room.trang_thai === 'maintenance') {
        return res.status(400).json({ error: 'Phòng đang bảo trì. Không thể thêm người.' });
      }

      // Check current occupancy count
      const currentAssignments = await query('SELECT id, khach_thue_id FROM hop_dong_thue WHERE phong_id = ? AND dang_hoat_dong = 1', [room_id]);
      const maxOccupants = room.so_nguoi_toi_da || 2;
      if (currentAssignments.length >= maxOccupants) {
        return res.status(400).json({ error: `Phòng đã đầy (tối đa ${maxOccupants} người).` });
      }

      // Check if tenant already has an active assignment in a DIFFERENT room
      // (Removed restriction: Tenants can now rent multiple rooms)

      // Check not already in this room
      const sameRoom = await query('SELECT id FROM hop_dong_thue WHERE khach_thue_id = ? AND phong_id = ? AND dang_hoat_dong = 1', [tenant_id, room_id]);
      if (sameRoom.length > 0) {
        return res.status(400).json({ error: 'Người thuê này đã ở phòng này rồi.' });
      }

      // Force primary if it's the first tenant
      let finalIsPrimary = is_primary;
      if (currentAssignments.length === 0) {
        finalIsPrimary = true;
      }

      // If marking as primary, unset any existing primary in the same room
      if (finalIsPrimary) {
        await run('UPDATE hop_dong_thue SET la_nguoi_dai_dien = 0 WHERE phong_id = ? AND dang_hoat_dong = 1', [room_id]);
      }

      const id = generateId();
      await run(`
        INSERT INTO hop_dong_thue (id, phong_id, khach_thue_id, ngay_bat_dau, tien_dat_coc, dang_hoat_dong, la_nguoi_dai_dien, ghi_chu, ngay_het_han_hop_dong)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
      `, [id, room_id, tenant_id, start_date, deposit_amount, finalIsPrimary ? 1 : 0, notes || null, contract_end_date || null]);

      // Update room status to occupied
      await run("UPDATE phong SET trang_thai = 'occupied' WHERE id = ?", [room_id]);

      // --- NOTIFICATION TRIGGER ---
      const newTenant = await queryOne('SELECT ho_ten FROM khach_thue WHERE id = ?', [tenant_id]);
      const roomInfo = await queryOne('SELECT so_phong FROM phong WHERE id = ?', [room_id]);
      for (const assign of currentAssignments) {
        await run(`
          INSERT INTO notifications (sender_id, title, content, target_type, target_tenant_id, notification_type, action_url)
          VALUES ('system', ?, ?, 'tenant', ?, 'general', '/dashboard')
        `, [
          'Thành viên mới',
          `Phòng ${roomInfo?.so_phong} vừa có thêm thành viên mới: ${newTenant?.ho_ten || 'Khách thuê mới'}.`,
          assign.khach_thue_id
        ]);
      }

      // Notify the new tenant too
      await run(`
        INSERT INTO notifications (sender_id, title, content, target_type, target_tenant_id, notification_type, action_url)
        VALUES ('system', ?, ?, 'tenant', ?, 'general', '/dashboard')
      `, [
        'Chào mừng đến với hệ thống',
        `Bạn đã được thêm vào phòng ${roomInfo?.so_phong}. Chúc bạn có những trải nghiệm tuyệt vời.`,
        tenant_id
      ]);
      // ----------------------------

      const createdAssignment = await queryOne('SELECT * FROM hop_dong_thue WHERE id = ?', [id]);
      res.status(201).json(mapAssignment(createdAssignment));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/room_assignments/:id/primary', authenticate, requireAdmin, async (req, res) => {
    try {
      const { room_id } = req.body;
      if (!room_id) return res.status(400).json({ error: 'room_id is required' });

      // Unset all primary in room first
      await run('UPDATE hop_dong_thue SET la_nguoi_dai_dien = 0 WHERE phong_id = ? AND dang_hoat_dong = 1', [room_id]);
      // Set new primary
      await run('UPDATE hop_dong_thue SET la_nguoi_dai_dien = 1 WHERE id = ?', [req.params.id]);

      res.json({ message: 'Primary tenant updated successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/room_assignments/:id/end', authenticate, requireAdmin, async (req, res) => {
    try {
      const assignment = await queryOne('SELECT phong_id, la_nguoi_dai_dien FROM hop_dong_thue WHERE id = ?', [req.params.id]);
      if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

      const todayStr = new Date().toISOString().split('T')[0];
      await run('UPDATE hop_dong_thue SET dang_hoat_dong = 0, ngay_ket_thuc = ? WHERE id = ?', [todayStr, req.params.id]);

      // Check if there are any remaining active assignments in the room
      const remaining = await query('SELECT id FROM hop_dong_thue WHERE phong_id = ? AND dang_hoat_dong = 1 ORDER BY ngay_bat_dau ASC', [assignment.phong_id]);
      if (remaining.length === 0) {
        await run("UPDATE phong SET trang_thai = 'available' WHERE id = ?", [assignment.phong_id]);
      } else if (assignment.la_nguoi_dai_dien === 1) {
        // If the primary tenant checked out, promote the oldest remaining tenant
        await run('UPDATE hop_dong_thue SET la_nguoi_dai_dien = 1 WHERE id = ?', [remaining[0].id]);
      }

      res.json({ message: 'Room assignment ended successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/room_assignments/:id/extend', authenticate, requireAdmin, async (req, res) => {
    try {
      const { contract_end_date } = req.body;
      await run('UPDATE hop_dong_thue SET ngay_het_han_hop_dong = ? WHERE id = ?', [contract_end_date, req.params.id]);
      const updated = await queryOne('SELECT * FROM hop_dong_thue WHERE id = ?', [req.params.id]);
      res.json(mapAssignment(updated));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/room_assignments/expiring', authenticate, requireAdmin, async (req, res) => {
    try {
      const withinDays = parseInt(req.query.withinDays || '30', 10);
      const today = new Date();
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + withinDays);

      const todayStr = today.toISOString().split('T')[0];
      const futureStr = futureDate.toISOString().split('T')[0];

      const data = await query(`
        SELECT ra.*, 
               t.ho_ten, t.so_dien_thoai, t.email, t.so_cccd, t.ngay_sinh, t.dia_chi, t.lien_he_khan_cap, t.ghi_chu as ghi_chu_khach,
               r.so_phong, r.tang, r.dien_tich, r.gia_phong, r.trang_thai as room_status, r.mo_ta as room_desc, r.so_nguoi_toi_da
        FROM hop_dong_thue ra
        JOIN khach_thue t ON ra.khach_thue_id = t.id
        JOIN phong r ON ra.phong_id = r.id
        WHERE ra.dang_hoat_dong = 1
          AND ra.ngay_het_han_hop_dong IS NOT NULL
          AND ra.ngay_het_han_hop_dong >= ?
          AND ra.ngay_het_han_hop_dong <= ?
        ORDER BY ra.ngay_het_han_hop_dong ASC
      `, [todayStr, futureStr]);

      const mapped = data.map(item => ({
        ...mapAssignment(item),
        tenant: {
          id: item.khach_thue_id,
          full_name: item.ho_ten,
          phone: item.so_dien_thoai,
          email: item.email,
          id_card_number: item.so_cccd,
          date_of_birth: item.ngay_sinh,
          address: item.dia_chi,
          emergency_contact: item.lien_he_khan_cap,
          notes: item.ghi_chu_khach,
        },
        room: {
          id: item.phong_id,
          room_number: item.so_phong,
          floor: item.tang,
          area_sqm: item.dien_tich,
          monthly_rent: item.gia_phong,
          status: item.room_status,
          description: item.room_desc,
          max_occupants: item.so_nguoi_toi_da,
        }
      }));

      res.json(mapped);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
};
