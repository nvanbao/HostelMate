import crypto from 'crypto';
import { query, queryOne, run } from '../../db.js';
import { mapRoom } from '../utils/mappers.js';

const generateId = () => crypto.randomUUID();

export const registerRoomRoutes = (app, { authenticate, requireAdmin }) => {
  app.get('/api/rooms', authenticate, requireAdmin, async (req, res) => {
    try {
      const rooms = await query('SELECT * FROM phong ORDER BY so_phong');
    
      // Fetch all active assignments for mapping
      const assignments = await query(`
        SELECT ra.*, t.ho_ten, t.so_dien_thoai, t.email, t.so_cccd, t.ngay_sinh, t.dia_chi, t.lien_he_khan_cap, t.ghi_chu as ghi_chu_khach
        FROM hop_dong_thue ra
        JOIN khach_thue t ON ra.khach_thue_id = t.id
        WHERE ra.dang_hoat_dong = 1
      `);

      // Map assignments and tenants to rooms
      const mappedRooms = rooms.map(room => {
        const roomAssignments = assignments
          .filter(a => a.phong_id === room.id)
          .map(a => ({
            id: a.id,
            room_id: a.phong_id,
            tenant_id: a.khach_thue_id,
            start_date: a.ngay_bat_dau,
            end_date: a.ngay_ket_thuc,
            is_active: !!a.dang_hoat_dong,
            is_primary: !!a.la_nguoi_dai_dien,
            deposit_amount: a.tien_dat_coc,
            notes: a.ghi_chu,
            contract_end_date: a.ngay_het_han_hop_dong,
            tenant: {
              id: a.khach_thue_id,
              full_name: a.ho_ten,
              phone: a.so_dien_thoai,
              email: a.email,
              id_card_number: a.so_cccd,
              date_of_birth: a.ngay_sinh,
              address: a.dia_chi,
              emergency_contact: a.lien_he_khan_cap,
              notes: a.ghi_chu_khach,
            }
          }));

        // Sort so primary is first
        roomAssignments.sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
        const tenants = roomAssignments.map(a => a.tenant);
        const activeAssignments = roomAssignments;
        const roomDetails = mapRoom(room);

        return {
          ...roomDetails,
          current_tenant: tenants[0] || null,
          current_assignment: activeAssignments[0] || null,
          tenants,
          active_assignments: activeAssignments,
        };
      });

      res.json(mappedRooms);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/rooms/:id', authenticate, requireAdmin, async (req, res) => {
    try {
      const room = await queryOne('SELECT * FROM phong WHERE id = ?', [req.params.id]);
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }

      const assignments = await query(`
        SELECT ra.*, t.ho_ten, t.so_dien_thoai, t.email, t.so_cccd, t.ngay_sinh, t.dia_chi, t.lien_he_khan_cap, t.ghi_chu as ghi_chu_khach
        FROM hop_dong_thue ra
        JOIN khach_thue t ON ra.khach_thue_id = t.id
        WHERE ra.phong_id = ? AND ra.dang_hoat_dong = 1
      `, [room.id]);

      const activeAssignments = assignments.map(a => ({
        id: a.id,
        room_id: a.phong_id,
        tenant_id: a.khach_thue_id,
        start_date: a.ngay_bat_dau,
        end_date: a.ngay_ket_thuc,
        is_active: !!a.dang_hoat_dong,
        is_primary: !!a.la_nguoi_dai_dien,
        deposit_amount: a.tien_dat_coc,
        notes: a.ghi_chu,
        contract_end_date: a.ngay_het_han_hop_dong,
        tenant: {
          id: a.khach_thue_id,
          full_name: a.ho_ten,
          phone: a.so_dien_thoai,
          email: a.email,
          id_card_number: a.so_cccd,
          date_of_birth: a.ngay_sinh,
          address: a.dia_chi,
          emergency_contact: a.lien_he_khan_cap,
          notes: a.ghi_chu_khach,
        }
      }));

      activeAssignments.sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
      const currentAssignment = activeAssignments[0] || null;

      res.json({
        ...mapRoom(room),
        current_tenant: currentAssignment?.tenant || null,
        current_assignment: currentAssignment || null,
        active_assignments: activeAssignments,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/rooms', authenticate, requireAdmin, async (req, res) => {
    try {
      const id = generateId();
      const { room_number, floor = 1, area_sqm = 0, monthly_rent = 0, status = 'available', description = '', max_occupants = 2, location = 'Cơ sở chính' } = req.body;
    
      await run(`
        INSERT INTO phong (id, so_phong, tang, dien_tich, gia_phong, trang_thai, mo_ta, so_nguoi_toi_da, khu_vuc)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [id, room_number, floor, area_sqm, monthly_rent, status, description, max_occupants, location]);

      const room = await queryOne('SELECT * FROM phong WHERE id = ?', [id]);
      res.status(201).json(mapRoom(room));
    } catch (error) {
      if (error.message && error.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'Mã phòng này đã tồn tại trong hệ thống. Vui lòng chọn mã khác!' });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/rooms/:id', authenticate, requireAdmin, async (req, res) => {
    try {
      const { room_number, floor, area_sqm, monthly_rent, status, description, max_occupants, location } = req.body;
    
      const existing = await queryOne('SELECT * FROM phong WHERE id = ?', [req.params.id]);
      if (!existing) {
        return res.status(404).json({ error: 'Room not found' });
      }

      const updated = {
        so_phong: room_number !== undefined ? room_number : existing.so_phong,
        tang: floor !== undefined ? floor : existing.tang,
        dien_tich: area_sqm !== undefined ? area_sqm : existing.dien_tich,
        gia_phong: monthly_rent !== undefined ? monthly_rent : existing.gia_phong,
        trang_thai: status !== undefined ? status : existing.trang_thai,
        mo_ta: description !== undefined ? description : existing.mo_ta,
        so_nguoi_toi_da: max_occupants !== undefined ? max_occupants : existing.so_nguoi_toi_da,
        khu_vuc: location !== undefined ? location : existing.khu_vuc,
      };

      await run(`
        UPDATE phong 
        SET so_phong = ?, tang = ?, dien_tich = ?, gia_phong = ?, trang_thai = ?, mo_ta = ?, so_nguoi_toi_da = ?, khu_vuc = ?, ngay_cap_nhat = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [updated.so_phong, updated.tang, updated.dien_tich, updated.gia_phong, updated.trang_thai, updated.mo_ta, updated.so_nguoi_toi_da, updated.khu_vuc, req.params.id]);

      const room = await queryOne('SELECT * FROM phong WHERE id = ?', [req.params.id]);
      res.json(mapRoom(room));
    } catch (error) {
      if (error.message && error.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'Mã phòng này đã tồn tại trong hệ thống. Vui lòng chọn mã khác!' });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/rooms/:id', authenticate, requireAdmin, async (req, res) => {
    try {
      const activeAssign = await queryOne('SELECT id FROM hop_dong_thue WHERE phong_id = ? AND dang_hoat_dong = 1', [req.params.id]);
      if (activeAssign) {
        return res.status(400).json({ error: 'Không thể xóa phòng đang có người thuê. Vui lòng thanh lý hợp đồng trước.' });
      }
      await run('DELETE FROM phong WHERE id = ?', [req.params.id]);
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
};
