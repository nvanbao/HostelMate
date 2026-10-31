import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const setupContracts = (app, queryAll, queryOne, run, { authenticate }) => {
  const canAccessContract = (user, contract) => user.role === 'ADMIN' || contract.khach_thue_id === user.id;

  const contractsDir = path.join(__dirname, 'uploads', 'contracts');
  fs.mkdirSync(contractsDir, { recursive: true });

  async function generateContractPdf(contractId) {
    const contract = await queryOne('SELECT * FROM hop_dong_thue WHERE id = ?', [contractId]);
    if (!contract) return null;
    const tenant = await queryOne('SELECT * FROM khach_thue WHERE id = ?', [contract.khach_thue_id]);
    const room = await queryOne('SELECT * FROM phong WHERE id = ?', [contract.phong_id]);
    if (!tenant || !room) return null;

    const fileName = `contract_${contractId}.pdf`;
    const filePath = path.join(contractsDir, fileName);
    const fontPath = [
      'C:\\Windows\\Fonts\\arial.ttf',
      '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf',
    ].find((candidate) => fs.existsSync(candidate));

    await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 52, size: 'A4' });
      const stream = fs.createWriteStream(filePath);
      stream.on('finish', resolve);
      stream.on('error', reject);
      doc.on('error', reject);
      doc.pipe(stream);
      if (fontPath) doc.font(fontPath);

      doc.fontSize(17).text('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { align: 'center' });
      doc.fontSize(12).text('Độc lập - Tự do - Hạnh phúc', { align: 'center' });
      doc.moveDown(1.5);
      doc.fontSize(19).text('HỢP ĐỒNG THUÊ PHÒNG TRỌ', { align: 'center' });
      doc.moveDown(1.5);
      doc.fontSize(11.5);
      doc.text(`Ngày lập: ${new Date().toLocaleDateString('vi-VN')}`);
      doc.moveDown();
      doc.text('BÊN CHO THUÊ (BÊN A)', { underline: true });
      doc.text('Đại diện: Chủ trọ HostelMate');
      doc.moveDown();
      doc.text('BÊN THUÊ (BÊN B)', { underline: true });
      doc.text(`Họ và tên: ${tenant.ho_ten || 'Chưa cập nhật'}`);
      doc.text(`Số điện thoại: ${tenant.so_dien_thoai || 'Chưa cập nhật'}`);
      doc.text(`CCCD: ${tenant.so_cccd || 'Chưa cập nhật'}`);
      doc.text(`Địa chỉ: ${tenant.dia_chi || 'Chưa cập nhật'}`);
      doc.moveDown();
      doc.text('THÔNG TIN THUÊ PHÒNG', { underline: true });
      doc.text(`Phòng: ${room.so_phong} - ${room.khu_vuc || 'Cơ sở chính'}`);
      doc.text(`Giá thuê: ${Number(room.gia_phong || 0).toLocaleString('vi-VN')} VNĐ/tháng`);
      doc.text(`Tiền đặt cọc: ${Number(contract.tien_dat_coc || 0).toLocaleString('vi-VN')} VNĐ`);
      doc.text(`Ngày bắt đầu: ${contract.ngay_bat_dau || 'Chưa cập nhật'}`);
      doc.text(`Ngày hết hạn: ${contract.ngay_het_han_hop_dong || contract.ngay_ket_thuc || 'Không xác định'}`);
      doc.moveDown(1.5);
      doc.text('Hai bên cam kết thực hiện đúng các thỏa thuận về thanh toán, sử dụng phòng, bảo quản tài sản và nội quy nhà trọ.');
      doc.moveDown(3);
      doc.text('BÊN A', 90, doc.y, { width: 160, align: 'center' });
      doc.text('BÊN B', 350, doc.y - 14, { width: 160, align: 'center' });
      doc.moveDown(1.5);

      if (contract.chu_ky_khach) {
        try {
          const base64Data = String(contract.chu_ky_khach).split(',')[1];
          if (base64Data) doc.image(Buffer.from(base64Data, 'base64'), 365, doc.y, { width: 125, height: 60, fit: [125, 60] });
        } catch (error) {
          console.warn('Không thể chèn chữ ký vào hợp đồng:', error.message);
        }
      }
      doc.end();
    });

    await run('UPDATE hop_dong_thue SET file_hop_dong = ?, ngay_cap_nhat = CURRENT_TIMESTAMP WHERE id = ?', [fileName, contractId]);
    return { fileName, filePath };
  }

  app.post('/api/contracts/:id/generate', authenticate, async (req, res) => {
    try {
      const contract = await queryOne('SELECT khach_thue_id FROM hop_dong_thue WHERE id = ?', [req.params.id]);
      if (!contract) return res.status(404).json({ error: 'Contract not found' });
      if (!canAccessContract(req.user, contract)) return res.status(403).json({ error: 'Không có quyền với hợp đồng này' });
      const generated = await generateContractPdf(req.params.id);
      if (!generated) return res.status(404).json({ error: 'Contract not found' });
      res.json({ success: true, fileName: generated.fileName });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/contracts/:id/download', authenticate, async (req, res) => {
    try {
      const contract = await queryOne('SELECT * FROM hop_dong_thue WHERE id = ?', [req.params.id]);
      if (!contract) return res.status(404).send('Not found');
      if (!canAccessContract(req.user, contract)) return res.status(403).send('Forbidden');
      let filePath = contract.file_hop_dong ? path.join(contractsDir, contract.file_hop_dong) : '';
      if (!filePath || !fs.existsSync(filePath)) {
        const generated = await generateContractPdf(req.params.id);
        if (!generated) return res.status(404).send('Not found');
        filePath = generated.filePath;
      }
      res.download(filePath, `Hop_dong_${req.params.id}.pdf`);
    } catch (error) {
      res.status(500).send(error.message || 'Server Error');
    }
  });

  app.post('/api/contracts/:id/sign', authenticate, async (req, res) => {
    try {
      const { signatureBase64 } = req.body || {};
      if (!signatureBase64) return res.status(400).json({ error: 'Signature is required' });
      const contract = await queryOne('SELECT id, khach_thue_id FROM hop_dong_thue WHERE id = ?', [req.params.id]);
      if (!contract) return res.status(404).json({ error: 'Contract not found' });
      if (contract.khach_thue_id !== req.user.id) return res.status(403).json({ error: 'Chỉ người thuê của hợp đồng mới được ký' });
      await run("UPDATE hop_dong_thue SET chu_ky_khach = ?, trang_thai_ky = 'Đã ký', ngay_cap_nhat = CURRENT_TIMESTAMP WHERE id = ?", [signatureBase64, req.params.id]);
      const generated = await generateContractPdf(req.params.id);
      res.json({ success: true, fileName: generated?.fileName || null });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/tenant/portal', authenticate, async (req, res) => {
    try {
      const tenant_id = req.user.role === 'ADMIN' ? req.query.tenant_id : req.user.id;
      if (!tenant_id) return res.status(400).json({ error: 'tenant_id required' });
      const assignments = await queryAll('SELECT * FROM hop_dong_thue WHERE khach_thue_id = ? AND dang_hoat_dong = 1', [tenant_id]);
      const rentals = [];

      for (const assignment of assignments) {
        const rawRoom = await queryOne('SELECT * FROM phong WHERE id = ?', [assignment.phong_id]);
        const room = rawRoom ? { ...rawRoom, room_number: rawRoom.so_phong, area: rawRoom.khu_vuc } : null;
        const latestReading = await queryOne('SELECT don_gia_dien, don_gia_nuoc FROM chi_so_dien_nuoc WHERE phong_id = ? ORDER BY ngay_ghi_so DESC LIMIT 1', [assignment.phong_id]);
        const ownerAssignment = await queryOne('SELECT khach_thue_id FROM hop_dong_thue WHERE phong_id = ? AND dang_hoat_dong = 1 AND la_nguoi_dai_dien = 1', [assignment.phong_id]);
        const owner = ownerAssignment ? await queryOne('SELECT ho_ten FROM khach_thue WHERE id = ?', [ownerAssignment.khach_thue_id]) : null;
        const occupants = await queryAll('SELECT id FROM hop_dong_thue WHERE phong_id = ? AND dang_hoat_dong = 1', [assignment.phong_id]);
        const members = await queryAll(`
          SELECT k.id, k.ho_ten, h.la_nguoi_dai_dien
          FROM hop_dong_thue h
          JOIN khach_thue k ON h.khach_thue_id = k.id
          WHERE h.phong_id = ? AND h.dang_hoat_dong = 1
        `, [assignment.phong_id]);

        rentals.push({
          assignment,
          room,
          dien_nuoc_info: latestReading || { don_gia_dien: 3500, don_gia_nuoc: 15000 },
          chu_hop_dong: owner?.ho_ten || null,
          so_nguoi_o: occupants.length,
          members,
        });
      }

      const invoices = await queryAll(`
        SELECT * FROM hoa_don
        WHERE phong_id IN (
          SELECT phong_id FROM hop_dong_thue
          WHERE khach_thue_id = ? AND dang_hoat_dong = 1
        )
        AND trang_thai IN ('pending', 'overdue', 'waiting_confirmation', 'review_needed')
        ORDER BY nam_hoa_don DESC, thang_hoa_don DESC
      `, [tenant_id]);

      const unpaidInvoices = invoices.map((invoice) => ({
        id: invoice.id,
        ma_hoa_don: invoice.ma_hoa_don,
        room_id: invoice.phong_id,
        tenant_id: invoice.khach_thue_id,
        meter_reading_id: invoice.chi_so_dien_nuoc_id,
        invoice_month: invoice.thang_hoa_don,
        invoice_year: invoice.nam_hoa_don,
        room_rent: invoice.tien_phong,
        electricity_cost: invoice.tien_dien,
        water_cost: invoice.tien_nuoc,
        other_fees: invoice.chi_phi_khac,
        total_amount: invoice.tong_tien,
        status: invoice.trang_thai,
        due_date: invoice.han_thanh_toan,
        paid_date: invoice.ngay_thanh_toan,
        notes: invoice.ghi_chu,
        created_at: invoice.ngay_tao,
        updated_at: invoice.ngay_cap_nhat,
      }));

      res.json({ rentals, unpaidInvoices });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
};
