import { GoogleGenAI } from '@google/genai';
import { aiTools } from '../ai/tools.js';
import { getSystemPrompt } from '../ai/prompts.js';
import db from '../../db.js'; // Will adapt this path or create a service later

// Helper for Promisified DB queries
const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Implement tool handlers
const handleToolCall = async (callName, args, user) => {
  try {
    switch (callName) {
      case 'search_rooms': {
        const conditions = [];
        const params = [];

        if (args.maxPrice) {
          conditions.push("p.gia_phong <= ?");
          params.push(args.maxPrice);
        }
        if (args.area) {
          conditions.push("n.ten_nha_tro LIKE ?");
          params.push(`%${args.area}%`);
        }
        if (args.airConditioner) conditions.push("p.dieu_hoa = 1");
        if (args.washingMachine) conditions.push("p.may_giat = 1");
        if (args.furnished) conditions.push("p.noi_that = 1");
        if (args.balcony) conditions.push("p.ban_cong = 1");
        if (args.availableOnly) {
          conditions.push("p.trang_thai = ?");
          params.push("available");
        }

        let sql = "SELECT p.id, p.so_phong, p.tang, p.gia_phong, p.trang_thai, p.mo_ta, p.khu_vuc, n.dia_chi, n.ten_nha_tro FROM phong p LEFT JOIN nha_tro n ON p.nha_tro_id = n.id";
        if (conditions.length > 0) {
          sql += " WHERE " + conditions.join(" AND ");
        }
        
        let rooms = await query(sql, params);
        
        // Ẩn địa chỉ nếu phòng đã có người thuê (bảo mật) đối với khách
        if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
          rooms = rooms.map(room => {
            if (room.trang_thai === 'occupied') {
              room.dia_chi = "Bảo mật";
              room.khu_vuc = "Bảo mật";
            }
            return room;
          });
        }

        return { success: true, count: rooms.length, data: rooms };
      }

      case 'get_room_by_code': {
        const conditions = ["p.so_phong = ?"];
        const params = [args.roomCode];
        if (args.area) {
          conditions.push("n.ten_nha_tro LIKE ?");
          params.push(`%${args.area}%`);
        }
        
        let sql = "SELECT p.id, p.so_phong, p.tang, p.gia_phong, p.trang_thai, p.mo_ta, p.dieu_hoa, p.may_giat, p.noi_that, p.ban_cong, p.khu_vuc, n.dia_chi, n.ten_nha_tro FROM phong p LEFT JOIN nha_tro n ON p.nha_tro_id = n.id WHERE " + conditions.join(" AND ");
        const rooms = await query(sql, params);
        if (rooms.length === 0) return { success: false, message: "Không tìm thấy phòng." };
        
        let room = rooms[0];
        // Ẩn địa chỉ nếu phòng đã có người thuê (bảo mật) đối với khách
        if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
          if (room.trang_thai === 'occupied') {
            room.dia_chi = "Bảo mật";
            room.khu_vuc = "Bảo mật";
          }
        }

        return { success: true, data: room };
      }

      case 'get_all_areas': {
        const areas = await query("SELECT id, ten_nha_tro, dia_chi FROM nha_tro");
        return { success: true, count: areas.length, data: areas };
      }

      case 'get_available_rooms': {
        const rooms = await query("SELECT p.so_phong, p.tang, p.gia_phong, p.khu_vuc, n.dia_chi, n.ten_nha_tro FROM phong p LEFT JOIN nha_tro n ON p.nha_tro_id = n.id WHERE p.trang_thai = 'available'");
        return { success: true, count: rooms.length, data: rooms };
      }

      case 'get_my_current_room': {
        if (user.role !== 'TENANT') return { success: false, message: "Chỉ khách thuê mới dùng được tính năng này." };
        const rooms = await query(`
          SELECT p.so_phong, p.gia_phong, h.ngay_bat_dau, h.tien_dat_coc, p.khu_vuc, n.dia_chi
          FROM hop_dong_thue h
          JOIN phong p ON h.phong_id = p.id
          LEFT JOIN nha_tro n ON p.nha_tro_id = n.id
          WHERE h.khach_thue_id = ? AND h.dang_hoat_dong = 1
        `, [user.id]);
        return { success: true, data: rooms };
      }

      case 'get_my_invoices': {
        if (user.role !== 'TENANT') return { success: false, message: "Chỉ khách thuê mới dùng được tính năng này." };
        const invoices = await query(`
          SELECT hd.thang_hoa_don, hd.nam_hoa_don, hd.tien_dien, hd.tien_nuoc, hd.tien_phong, hd.tong_tien, hd.trang_thai, hd.han_thanh_toan
          FROM hoa_don hd
          WHERE hd.khach_thue_id = ?
          ORDER BY hd.nam_hoa_don DESC, hd.thang_hoa_don DESC
          LIMIT 5
        `, [user.id]);
        return { success: true, data: invoices };
      }

      case 'get_my_repair_requests': {
        if (user.role !== 'TENANT') return { success: false, message: "Chỉ khách thuê mới dùng được tính năng này." };
        const requests = await query(`
          SELECT tieu_de, mo_ta, trang_thai, ngay_bao, muc_do_uu_tien
          FROM yeu_cau_sua_chua y
          WHERE y.khach_thue_id = ?
          ORDER BY ngay_bao DESC
          LIMIT 5
        `, [user.id]);
        return { success: true, data: requests };
      }

      case 'get_admin_room_summary': {
        if (user.role !== 'ADMIN' && user.role !== 'MANAGER') return { success: false, message: "Không có quyền." };
        const stats = await query("SELECT trang_thai, COUNT(*) as count FROM phong GROUP BY trang_thai");
        return { success: true, data: stats };
      }

      case 'get_admin_invoice_summary': {
        if (user.role !== 'ADMIN' && user.role !== 'MANAGER') return { success: false, message: "Không có quyền." };
        const stats = await query("SELECT trang_thai, SUM(tong_tien) as total FROM hoa_don GROUP BY trang_thai");
        return { success: true, data: stats };
      }

      case 'admin_get_room_invoices': {
        if (user.role !== 'ADMIN' && user.role !== 'MANAGER') return { success: false, message: "Không có quyền." };
        const conditions = ["p.so_phong = ?"];
        const params = [args.roomCode];
        if (args.area) {
          conditions.push("n.ten_nha_tro LIKE ?");
          params.push(`%${args.area}%`);
        }
        const invoices = await query(`
          SELECT hd.thang_hoa_don, hd.nam_hoa_don, hd.tien_dien, hd.tien_nuoc, hd.tien_phong, hd.tong_tien, hd.trang_thai, hd.han_thanh_toan
          FROM hoa_don hd
          JOIN phong p ON hd.phong_id = p.id
          LEFT JOIN nha_tro n ON p.nha_tro_id = n.id
          WHERE ${conditions.join(" AND ")}
          ORDER BY hd.nam_hoa_don DESC, hd.thang_hoa_don DESC
          LIMIT 10
        `, params);
        return { success: true, data: invoices };
      }

      case 'admin_get_room_repair_requests': {
        if (user.role !== 'ADMIN' && user.role !== 'MANAGER') return { success: false, message: "Không có quyền." };
        const conditions = ["p.so_phong = ?"];
        const params = [args.roomCode];
        if (args.area) {
          conditions.push("n.ten_nha_tro LIKE ?");
          params.push(`%${args.area}%`);
        }
        const requests = await query(`
          SELECT tieu_de, mo_ta, trang_thai, ngay_bao, muc_do_uu_tien
          FROM yeu_cau_sua_chua y
          JOIN phong p ON y.phong_id = p.id
          LEFT JOIN nha_tro n ON p.nha_tro_id = n.id
          WHERE ${conditions.join(" AND ")}
          ORDER BY ngay_bao DESC
          LIMIT 10
        `, params);
        return { success: true, data: requests };
      }

      case 'admin_get_room_tenant': {
        if (user.role !== 'ADMIN' && user.role !== 'MANAGER') return { success: false, message: "Không có quyền." };

        const conditions = ["p.so_phong = ?"];
        const params = [args.roomCode];
        if (args.area) {
          conditions.push("n.ten_nha_tro LIKE ?");
          params.push(`%${args.area}%`);
        }

        const roomCheck = await query("SELECT p.so_phong, p.khu_vuc, n.ten_nha_tro, n.dia_chi FROM phong p LEFT JOIN nha_tro n ON p.nha_tro_id = n.id WHERE " + conditions.join(" AND "), params);
        if (roomCheck.length === 0) {
           return { success: false, message: `Phòng ${args.roomCode} không tồn tại trong hệ thống (hoặc không khớp khu vực).` };
        }

        const tenants = await query(`
          SELECT k.ho_ten, k.so_dien_thoai, h.ngay_bat_dau, h.tien_dat_coc
          FROM khach_thue k
          JOIN hop_dong_thue h ON h.khach_thue_id = k.id
          JOIN phong p ON h.phong_id = p.id
          LEFT JOIN nha_tro n ON p.nha_tro_id = n.id
          WHERE ${conditions.join(" AND ")} AND h.dang_hoat_dong = 1
        `, params);

        if (tenants.length === 0) {
           return { success: true, message: `Phòng ${args.roomCode} thuộc ${roomCheck[0].ten_nha_tro} (Khu vực/Địa chỉ: ${roomCheck[0].khu_vuc}) hiện tại trống, chưa có người thuê.` };
        }

        return { success: true, data: tenants };
      }

      case 'get_roommate_requests': {
        const requests = await query(`
          SELECT y.tieu_de, y.mo_ta, y.gia_chia_se, y.ngay_dang, 
                 p.so_phong, p.dien_tich, p.dieu_hoa, p.may_giat, p.noi_that, p.ban_cong, p.khu_vuc,
                 n.dia_chi, n.ten_nha_tro
          FROM yeu_cau_o_ghep y
          JOIN phong p ON y.phong_id = p.id
          LEFT JOIN nha_tro n ON p.nha_tro_id = n.id
          WHERE y.trang_thai = 'open'
        `);
        return { success: true, count: requests.length, data: requests };
      }

      case 'get_my_roommates': {
        if (user.role !== 'TENANT') return { success: false, message: "Chỉ khách thuê mới dùng được tính năng này." };
        const roommates = await query(`
          SELECT k.ho_ten, k.so_dien_thoai, p.so_phong
          FROM hop_dong_thue h
          JOIN phong p ON h.phong_id = p.id
          JOIN khach_thue k ON h.khach_thue_id = k.id
          WHERE h.dang_hoat_dong = 1 
            AND h.phong_id IN (
              SELECT phong_id FROM hop_dong_thue WHERE khach_thue_id = ? AND dang_hoat_dong = 1
            )
            AND k.id != ?
        `, [user.id, user.id]);
        
        if (roommates.length === 0) {
           return { success: true, message: "Bạn đang ở một mình trong phòng, không có ai ở ghép cùng bạn." };
        }
        return { success: true, data: roommates };
      }

      default:
        return { success: false, message: "Công cụ không tồn tại." };
    }
  } catch (error) {
    console.error("Tool execution error:", error);
    return { success: false, message: "Lỗi hệ thống khi thực thi công cụ." };
  }
};

export const chat = async (req, res) => {
  try {
    const { message, history } = req.body;
    const user = req.user || { role: 'GUEST', id: null }; // From auth middleware

    if (message === undefined || message === null || String(message).trim() === '') {
      return res.status(400).json({ error: 'Nội dung tin nhắn không được để trống' });
    }

    const userMessage = String(message).trim();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Hệ thống AI chưa được cấu hình (Thiếu API Key)' });
    }

    const ai = new GoogleGenAI({ apiKey });
    const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

    // Format history for Gemini SDK
    const formattedHistory = (history || [])
      .filter(msg => msg.content && typeof msg.content === 'string') // Ignore empty
      .map(msg => ({
        role: (msg.role === 'ai' || msg.role === 'assistant') ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

    // Construct the session
    const chatSession = ai.chats.create({
      model: model,
      history: formattedHistory,
      config: {
        systemInstruction: getSystemPrompt(user.role),
        tools: [{ functionDeclarations: aiTools }],
        temperature: 0.1,
      }
    });

    let response = await chatSession.sendMessage({ message: userMessage });

    // Handle Function Calls if any
    while (response.functionCalls && response.functionCalls.length > 0) {
      const call = response.functionCalls[0];
      const result = await handleToolCall(call.name, call.args, user);
      
      // Send the tool response back to Gemini to get the final text response
      response = await chatSession.sendMessage({
        message: [{
          functionResponse: {
            name: call.name,
            response: { result }
          }
        }]
      });
    }

    res.json({ reply: response.text || "Xin lỗi, không có nội dung phản hồi." });

  } catch (error) {
    console.error("AI Chat Error:", error);
    res.status(500).json({ error: 'Lỗi khi xử lý AI chat: ' + error.message });
  }
};
