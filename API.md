# Tài liệu Danh sách REST API - HostelMate

Tài liệu này tổng hợp toàn bộ các API Endpoints được xây dựng bằng **Node.js + Express** và kết nối cơ sở dữ liệu **SQLite** của hệ thống HostelMate.

* **Base URL**: `http://localhost:5000`
* **Định dạng dữ liệu gửi nhận**: `JSON`
* **Xác thực**: đăng nhập qua `POST /api/auth/login`, server đặt cookie httpOnly `token` (hoặc gửi `Authorization: Bearer <token>`)

## Phân quyền

Thiếu đăng nhập trả về `401`, sai quyền trả về `403`.

| Quyền | Endpoint |
| :--- | :--- |
| Công khai | `POST /api/auth/login`, `POST /api/auth/google-login`, `GET /api/health`, `GET /api/landlord/contact`, `GET /api/public/vietqr-image` |
| API key | `POST /api/webhooks/sepay`, `POST /api/payments/webhook` (trả `503` khi chưa cấu hình `SEPAY_WEBHOOK_API_KEY`) |
| Admin và khách thuê | `GET /api/invoices`, `GET /api/invoices/:id`, `GET /api/repair_requests`, `GET /api/repair_requests/:id`, `POST /api/invoices/mark-overdue`, `GET /api/tenant/portal`, `GET /api/contracts/:id/download`, `POST /api/contracts/:id/generate`. Khách thuê chỉ thấy dữ liệu của mình và phòng đang thuê. |
| Khách thuê của hợp đồng | `POST /api/contracts/:id/sign` |
| Khách thuê | `GET/POST/PUT/DELETE /api/tenant/repair_requests` |
| Admin | Các endpoint còn lại trong tài liệu này |

---

## 1. Phân hệ Quản lý Phòng trọ (Rooms API)

Quản lý thông tin chi tiết các phòng trọ, trạng thái thuê và sức chứa của phòng.

| Phương thức | Endpoint | Mô tả chức năng | Body (Yêu cầu) / Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/rooms` | Lấy danh sách tất cả phòng trọ kèm thông tin khách thuê và hợp đồng đang hoạt động | Không |
| `GET` | `/api/rooms/:id` | Lấy thông tin chi tiết một phòng trọ cụ thể | `id` của phòng trên URL |
| `POST` | `/api/rooms` | Thêm phòng trọ mới | `{ room_number, floor, area_sqm, monthly_rent, status, description, max_occupants }` |
| `PUT` | `/api/rooms/:id` | Cập nhật thông tin phòng trọ | Các trường cần sửa đổi |
| `DELETE` | `/api/rooms/:id` | Xóa phòng trọ (từ chối nếu phòng đang có người thuê) | `id` của phòng trên URL |

---

## 2. Phân hệ Quản lý Khách thuê (Tenants API)

Quản lý thông tin hồ sơ cá nhân của khách hàng đăng ký thuê trọ.

| Phương thức | Endpoint | Mô tả chức năng | Body (Yêu cầu) / Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/tenants` | Lấy danh sách tất cả khách thuê trọ | Không |
| `GET` | `/api/tenants/:id` | Lấy chi tiết thông tin một khách thuê | `id` của khách trên URL |
| `POST` | `/api/tenants` | Đăng ký thông tin khách thuê mới | `{ full_name, phone, email, id_card_number, date_of_birth, address, emergency_contact, notes }` |
| `PUT` | `/api/tenants/:id` | Chỉnh sửa thông tin khách thuê | Các trường cần sửa đổi |
| `POST` | `/api/tenants/:id/credentials` | Cấp hoặc reset tài khoản, trả `temporary_password` một lần duy nhất | `{ username? }` |
| `DELETE` | `/api/tenants/:id` | Xóa hồ sơ khách thuê | `id` của khách trên URL |

---

## 3. Phân hệ Quản lý Hợp đồng & Thuê phòng (Room Assignments API)

Xử lý nghiệp vụ nhận phòng, trả phòng, thay đổi khách thuê đại diện và kiểm tra thời hạn hợp đồng.

| Phương thức | Endpoint | Mô tả chức năng | Body (Yêu cầu) / Params |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/room_assignments` | **Gán khách thuê vào phòng** (Tạo hợp đồng). Tự động kiểm tra sức chứa phòng và trạng thái bảo trì. | `{ room_id, tenant_id, start_date, deposit_amount, is_primary, notes, contract_end_date }` |
| `PUT` | `/api/room_assignments/:id/primary` | Thay đổi người đại diện phòng (khách thuê chính) | `{ room_id }` |
| `POST` | `/api/room_assignments/:id/end` | **Thanh lý hợp đồng** (Khách thuê trả phòng rời đi). Tự động chuyển phòng về trạng thái "Trống" nếu không còn ai ở. | Không |
| `PUT` | `/api/room_assignments/:id/extend` | Gia hạn thời hạn hợp đồng thuê phòng | `{ contract_end_date }` |
| `GET` | `/api/room_assignments/expiring` | Lấy danh sách hợp đồng sắp hết hạn | Query param: `?withinDays=30` (Mặc định 30 ngày) |

---

## 4. Phân hệ Chỉ số Điện nước (Meter Readings API)

Lưu trữ số điện, số nước tiêu thụ thực tế của từng phòng để làm căn cứ lập hóa đơn hàng tháng.

| Phương thức | Endpoint | Mô tả chức năng | Body (Yêu cầu) / Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/meter_readings` | Lấy toàn bộ lịch sử nhập chỉ số điện nước | Không |
| `GET` | `/api/meter_readings/room/:roomId` | Lấy lịch sử nhập chỉ số điện nước của riêng 1 phòng | `roomId` trên URL |
| `GET` | `/api/meter_readings/latest/:roomId` | Lấy chỉ số điện nước mới nhất của 1 phòng (để tính tiền tháng mới) | `roomId` trên URL |
| `POST` | `/api/meter_readings` | **Nhập chỉ số điện nước mới**. Tự động ràng buộc chỉ số mới phải lớn hơn hoặc bằng chỉ số cũ. | `{ room_id, reading_date, electricity_old, electricity_new, water_old, water_new, electricity_price_per_unit, water_price_per_unit }` |
| `PUT` | `/api/meter_readings/:id` | Chỉnh sửa chỉ số điện nước đã nhập | Các trường cần sửa đổi |
| `DELETE` | `/api/meter_readings/:id` | Xóa bản ghi chỉ số | `id` bản ghi trên URL |

---

## 5. Phân hệ Quản lý Hóa đơn (Invoices API)

Tự động hóa việc lập phiếu thu tiền phòng trọ và dịch vụ, cập nhật trạng thái đóng tiền của phòng trọ.

| Phương thức | Endpoint | Mô tả chức năng | Body (Yêu cầu) / Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/invoices` | Danh sách tất cả hóa đơn dịch vụ hàng tháng | Không |
| `GET` | `/api/invoices/:id` | Chi tiết thông tin một hóa đơn dịch vụ | `id` hóa đơn trên URL |
| `POST` | `/api/invoices` | **Lập hóa đơn tháng mới** (Tiền phòng + Tiền điện + Tiền nước + Phí khác = Tổng tiền) | `{ room_id, tenant_id, meter_reading_id, invoice_month, invoice_year, room_rent, electricity_cost, water_cost, other_fees, total_amount, status, due_date, notes }` |
| `PUT` | `/api/invoices/:id` | Sửa đổi thông tin hóa đơn | Các trường cần sửa đổi |
| `DELETE` | `/api/invoices/:id` | Xóa hóa đơn | `id` hóa đơn trên URL |
| `POST` | `/api/invoices/mark-overdue` | Quét tự động và đánh dấu các hóa đơn quá hạn chưa trả thành "Quá hạn" | Không |
| `PUT` | `/api/invoices/:id/paid` | **Đánh dấu hóa đơn đã thanh toán** (Tự động cập nhật ngày trả tiền là ngày hôm nay) | Không |

---

## 6. Phân hệ Báo hỏng & Sửa chữa (Repair Requests API)

*Giao diện tiếp nhận sự cố dịch vụ theo tư duy ITIL/Service Management.*

| Phương thức | Endpoint | Mô tả chức năng | Body (Yêu cầu) / Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/repair_requests` | Danh sách tất cả yêu cầu báo hỏng trong hệ thống | Không |
| `GET` | `/api/repair_requests/:id` | Chi tiết thông tin yêu cầu báo hỏng cụ thể | `id` yêu cầu trên URL |
| `POST` | `/api/repair_requests` | **Gửi yêu cầu báo hỏng** (Khách thuê báo hỏng thiết bị phòng) | `{ room_id, tenant_id, title, description, priority }` |
| `PUT` | `/api/repair_requests/:id` | **Cập nhật tiến độ sửa chữa** (Chủ trọ cập nhật từ Mới tạo -> Đang sửa -> Đã xong kèm ghi chú xử lý) | `{ status, assigned_to, resolution_notes }` |
| `DELETE` | `/api/repair_requests/:id` | Xóa yêu cầu sửa chữa | `id` yêu cầu trên URL |
