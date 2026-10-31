# HostelMate

Hệ thống web quản lý phòng trọ cho chủ trọ và khách thuê: phòng, hợp đồng, chỉ số điện nước, hóa đơn thanh toán bằng VietQR, yêu cầu sửa chữa và chatbot AI.

> **Nguồn gốc dự án:** HostelMate bắt đầu là đồ án nhóm 4 người của môn Software Process and Quality Management (CMU-SE 433, Đại học Duy Tân, 07/2026). Repo này là bản do Nguyễn Văn Bảo tiếp tục phát triển sau đồ án, tập trung vào bảo mật, cấu trúc backend và kiểm thử.

![Tổng quan Admin](docs/screenshots/admin-dashboard.jpg)

| Quản lý hóa đơn | Trang khách thuê |
|---|---|
| ![Hóa đơn](docs/screenshots/admin-invoices.jpg) | ![Khách thuê](docs/screenshots/tenant-dashboard.jpg) |

## Tính năng

**Chủ trọ (Admin)**
- Thống kê phòng, doanh thu và các việc cần xử lý
- Quản lý phòng, người thuê, hợp đồng (xếp phòng, gia hạn, thanh lý)
- Cấp, reset, khóa và thu hồi tài khoản khách thuê
- Ghi chỉ số điện nước, tạo và xác nhận hóa đơn, xuất CSV
- Tiếp nhận, phân công và theo dõi yêu cầu sửa chữa theo thời gian thực

**Khách thuê**
- Xem phòng đang thuê, người ở cùng và hợp đồng
- Ký hợp đồng trực tuyến và tải PDF
- Xem hóa đơn, thanh toán bằng mã VietQR
- Gửi và theo dõi yêu cầu sửa chữa
- Hỏi chatbot Gemini về dữ liệu của chính mình (cần `GEMINI_API_KEY`)

## Công nghệ

| Phần | Công nghệ |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express, Socket.IO, PDFKit |
| Cơ sở dữ liệu | SQLite |
| Xác thực | JWT trong cookie httpOnly, bcrypt, Google Sign-In |
| Kiểm thử và CI | Jest, Supertest, Vitest, ESLint, GitHub Actions |

## Kiến trúc

```mermaid
flowchart LR
    Browser["React SPA"] -->|REST, cookie JWT| API["Express API"]
    Browser <-->|Socket.IO đã xác thực| API
    API --> DB[("SQLite")]
    API --> PDF["PDFKit: hợp đồng"]
    API --> AI["Gemini: chatbot"]
    Bank["SePay webhook"] -.->|chưa nối tài khoản thật| API
```

```text
server/
  server.js             Khởi tạo app, middleware, đăng ký route
  db.js                 Schema, seed và lớp truy vấn SQLite
  integrated-routes.js  Xác thực, cài đặt, yêu cầu của khách thuê, webhook SePay
  contracts.js          Hợp đồng PDF, chữ ký, cổng khách thuê
  src/routes/           Phòng, người thuê, hợp đồng, điện nước, hóa đơn, sửa chữa, AI
  src/middleware/       Xác thực HTTP và Socket.IO
  src/utils/            Ánh xạ dữ liệu, kiểm tra quyền truy cập
  tests/                Test tích hợp API
src/
  admin/                Giao diện chủ trọ
  pages/, components/   Giao diện khách thuê và thành phần dùng chung
```

## Chạy dự án

Yêu cầu Node.js 20 trở lên.

```bash
npm install
npm --prefix server install
cp .env.example .env
npm run dev:all
```

Mở `http://localhost:5173` và đăng nhập bằng `admin` / `123456`. Tài khoản này chỉ tự tạo ở môi trường phát triển. Database ban đầu trống; hãy tạo phòng, người thuê rồi cấp tài khoản cho khách trong mục **Tài khoản**. Mật khẩu khách thuê chỉ hiển thị ngay sau khi cấp.

Trên Windows có thể chạy `START_HOSTELMATE.bat`. Lệnh `npm run reset-db` đưa database về trạng thái sạch.

### Triển khai

Ở production, backend phục vụ luôn frontend đã build nên chỉ cần một tiến trình:

```bash
npm install && npm --prefix server install
npm run build
NODE_ENV=production JWT_SECRET=<chuoi-ngau-nhien> ADMIN_INITIAL_PASSWORD=<mat-khau> node server/server.js
```

Server từ chối khởi động nếu thiếu `JWT_SECRET`, hoặc thiếu `ADMIN_INITIAL_PASSWORD` khi chưa có Admin. Cookie đăng nhập yêu cầu HTTPS. Cần ổ đĩa bền vững cho file SQLite (đặt qua `DATABASE_PATH`) và thư mục `server/uploads`.

## Thanh toán

Mã **VietQR** được tạo ngay trên trình duyệt theo chuẩn EMVCo, từ thông tin ngân hàng trong `.env`. Admin xác nhận thanh toán thủ công trên trang hóa đơn.

**Webhook SePay chỉ được kiểm thử bằng dữ liệu giả lập và hiện chưa nối với tài khoản thật.** Phần logic đã có và được test:

- Xác thực API key, từ chối mọi request khi chưa cấu hình key
- Bỏ qua giao dịch chuyển ra và giao dịch không khớp mã hóa đơn
- Chống xử lý trùng theo mã giao dịch
- Cộng dồn khi chuyển thiếu: hóa đơn sang `review_needed`, đủ tiền mới sang `paid`
- Cập nhật giao diện qua Socket.IO

```mermaid
sequenceDiagram
    participant T as Khách thuê
    participant B as Ngân hàng
    participant S as SePay
    participant A as API
    T->>B: Quét VietQR, chuyển khoản kèm mã HM...
    B->>S: Biến động số dư
    S->>A: POST /api/webhooks/sepay
    A->>A: Xác thực key, chống trùng, khớp hóa đơn
    A-->>T: Socket.IO invoice_updated
```

## Bảo mật

- API yêu cầu đăng nhập và phân quyền theo vai trò; khách thuê chỉ truy cập được dữ liệu của mình và phòng đang thuê
- Mật khẩu băm bằng bcrypt, không bao giờ trả về qua API; mật khẩu tạm được sinh ngẫu nhiên ở server
- Giới hạn số lần đăng nhập sai; tài khoản bị khóa mất phiên đăng nhập ngay
- Kết nối Socket.IO phải có token hợp lệ

## Kiểm thử

```bash
npm run lint
npm run typecheck
npm test
npm run test:server -- --coverage
```

Có 68 test backend và 3 test frontend. Coverage backend đo trên toàn bộ mã server là **khoảng 64% số dòng**, CI yêu cầu tối thiểu 60%. Phần chưa được phủ nhiều nhất là chatbot AI, đăng nhập Google và proxy ảnh VietQR. Giao diện React chưa có test tự động, hiện mới có test cho phần tạo mã VietQR.

## Hướng phát triển

- Thêm test cho giao diện và luồng đầu cuối bằng Playwright
- Chuyển sang PostgreSQL khi có nhiều cơ sở
- Hợp nhất bộ component UI của Admin và khách thuê
- Tách `integrated-routes.js` theo từng phân hệ

Tài liệu endpoint: [API.md](API.md).
