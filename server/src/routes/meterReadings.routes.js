import crypto from 'crypto';
import { query, queryOne, run } from '../../db.js';
import { mapReading } from '../utils/mappers.js';

const generateId = () => crypto.randomUUID();

export const registerMeterReadingRoutes = (app, { authenticate, requireAdmin }) => {
  app.get('/api/meter_readings', authenticate, requireAdmin, async (req, res) => {
    try {
      const data = await query(`
        SELECT mr.*, r.so_phong, r.tang, r.dien_tich, r.gia_phong, r.trang_thai as room_status, r.mo_ta as room_desc, r.so_nguoi_toi_da
        FROM chi_so_dien_nuoc mr
        JOIN phong r ON mr.phong_id = r.id
        ORDER BY mr.ngay_ghi_so DESC
      `);

      const mapped = data.map(item => ({
        ...mapReading(item),
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

  app.get('/api/meter_readings/room/:roomId', authenticate, requireAdmin, async (req, res) => {
    try {
      const data = await query('SELECT * FROM chi_so_dien_nuoc WHERE phong_id = ? ORDER BY ngay_ghi_so DESC', [req.params.roomId]);
      res.json(data.map(mapReading));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/meter_readings/latest/:roomId', authenticate, requireAdmin, async (req, res) => {
    try {
      const row = await queryOne('SELECT * FROM chi_so_dien_nuoc WHERE phong_id = ? ORDER BY ngay_ghi_so DESC LIMIT 1', [req.params.roomId]);
      res.json(mapReading(row));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/meter_readings', authenticate, requireAdmin, async (req, res) => {
    try {
      const id = generateId();
      const { room_id, reading_date, electricity_old, electricity_new, water_old, water_new, electricity_price_per_unit = 3500, water_price_per_unit = 15000 } = req.body;

      if (!room_id || !reading_date || 
          electricity_old === undefined || electricity_old === null || electricity_old === '' ||
          electricity_new === undefined || electricity_new === null || electricity_new === '' ||
          water_old === undefined || water_old === null || water_old === '' ||
          water_new === undefined || water_new === null || water_new === '') {
        return res.status(400).json({ error: 'Các trường chỉ số điện nước không được để trống.' });
      }

      if (Number(electricity_old) < 0 || Number(electricity_new) < 0 || Number(water_old) < 0 || Number(water_new) < 0) {
        return res.status(400).json({ error: 'Các chỉ số điện nước không được là số âm.' });
      }
    
      const monthPrefix = reading_date.substring(0, 7);
      const existingReading = await queryOne(`SELECT id FROM chi_so_dien_nuoc WHERE phong_id = ? AND ngay_ghi_so LIKE ?`, [room_id, `${monthPrefix}%`]);
      if (existingReading) {
        return res.status(400).json({ error: `Phòng này đã được chốt chỉ số điện nước trong tháng ${monthPrefix.split('-').reverse().join('/')}.` });
      }
      if (Number(electricity_new) < Number(electricity_old)) {
        return res.status(400).json({ error: 'Chỉ số điện mới không được nhỏ hơn chỉ số cũ.' });
      }
      if (Number(water_new) < Number(water_old)) {
        return res.status(400).json({ error: 'Chỉ số nước mới không được nhỏ hơn chỉ số cũ.' });
      }

      await run(`
        INSERT INTO chi_so_dien_nuoc (id, phong_id, ngay_ghi_so, so_dien_cu, so_dien_moi, so_nuoc_cu, so_nuoc_moi, don_gia_dien, don_gia_nuoc)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [id, room_id, reading_date, electricity_old, electricity_new, water_old, water_new, electricity_price_per_unit, water_price_per_unit]);

      const created = await queryOne('SELECT * FROM chi_so_dien_nuoc WHERE id = ?', [id]);
      res.status(201).json(mapReading(created));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/meter_readings/:id', authenticate, requireAdmin, async (req, res) => {
    try {
      const { room_id, reading_date, electricity_old, electricity_new, water_old, water_new, electricity_price_per_unit, water_price_per_unit } = req.body;
      const existing = await queryOne('SELECT * FROM chi_so_dien_nuoc WHERE id = ?', [req.params.id]);
      if (!existing) return res.status(404).json({ error: 'Reading not found' });

      const updated = {
        phong_id: room_id !== undefined ? room_id : existing.phong_id,
        ngay_ghi_so: reading_date !== undefined ? reading_date : existing.ngay_ghi_so,
        so_dien_cu: electricity_old !== undefined ? electricity_old : existing.so_dien_cu,
        so_dien_moi: electricity_new !== undefined ? electricity_new : existing.so_dien_moi,
        so_nuoc_cu: water_old !== undefined ? water_old : existing.so_nuoc_cu,
        so_nuoc_moi: water_new !== undefined ? water_new : existing.so_nuoc_moi,
        don_gia_dien: electricity_price_per_unit !== undefined ? electricity_price_per_unit : existing.don_gia_dien,
        don_gia_nuoc: water_price_per_unit !== undefined ? water_price_per_unit : existing.don_gia_nuoc,
      };

      if (!updated.phong_id || !updated.ngay_ghi_so || 
          updated.so_dien_cu === undefined || updated.so_dien_cu === null || updated.so_dien_cu === '' ||
          updated.so_dien_moi === undefined || updated.so_dien_moi === null || updated.so_dien_moi === '' ||
          updated.so_nuoc_cu === undefined || updated.so_nuoc_cu === null || updated.so_nuoc_cu === '' ||
          updated.so_nuoc_moi === undefined || updated.so_nuoc_moi === null || updated.so_nuoc_moi === '') {
        return res.status(400).json({ error: 'Các trường chỉ số điện nước không được để trống.' });
      }

      if (Number(updated.so_dien_moi) < Number(updated.so_dien_cu)) {
        return res.status(400).json({ error: 'Chỉ số điện mới không được nhỏ hơn chỉ số cũ.' });
      }
      if (Number(updated.so_nuoc_moi) < Number(updated.so_nuoc_cu)) {
        return res.status(400).json({ error: 'Chỉ số nước mới không được nhỏ hơn chỉ số cũ.' });
      }

      await run(`
        UPDATE chi_so_dien_nuoc
        SET phong_id = ?, ngay_ghi_so = ?, so_dien_cu = ?, so_dien_moi = ?, so_nuoc_cu = ?, so_nuoc_moi = ?, don_gia_dien = ?, don_gia_nuoc = ?, ngay_cap_nhat = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [updated.phong_id, updated.ngay_ghi_so, updated.so_dien_cu, updated.so_dien_moi, updated.so_nuoc_cu, updated.so_nuoc_moi, updated.don_gia_dien, updated.don_gia_nuoc, req.params.id]);

      const result = await queryOne('SELECT * FROM chi_so_dien_nuoc WHERE id = ?', [req.params.id]);
      res.json(mapReading(result));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/meter_readings/:id', authenticate, requireAdmin, async (req, res) => {
    try {
      await run('DELETE FROM chi_so_dien_nuoc WHERE id = ?', [req.params.id]);
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
};
