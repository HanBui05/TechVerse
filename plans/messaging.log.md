# Messaging — nhật ký

Trạng thái chính thức: xem [`PLAN.md`](PLAN.md). Spec: [`messaging.md`](messaging.md). Ba mục đầu và “Nhật ký phiên” được hook SessionStart tự nạp sau `/clear`; giữ chúng ngắn.

## Bắt đầu từ đây (cập nhật 2026-11-22)

- **Task tiếp:** Người dùng đọc “Phản hồi vòng 1 (Codex)” + “Trả lời vòng 1 (Claude)” trong spec rồi chốt hoặc cho chạy vòng 2; sau đó Task 1a (dùng `/model opus`) · Giao diện: Không
- Nhánh `feature/messaging` (tách từ `main` sau PR #14). Chưa code.

## Quyết định người dùng chưa có trong spec

- **2026-11-22 — Nhắn tin trước khi mua (thay M2 A):** người học đăng nhập được nhắn cho tác giả của một khóa **kể cả khi chưa đăng ký/mua**, để hỏi khóa có phù hợp không. Đã đưa vào thân spec 2026-11-22.

- **2026-11-22 — Thời gian thực: REST + WebSocket kết hợp (thay M3 B):** REST giữ nguyên cho gửi tin, chặn, báo cáo, đánh dấu đã đọc và tải tin (`beforeSeq`/`afterSeq`). Thêm WebSocket chỉ để server đẩy **sự kiện** (“cuộc X có tin mới, seq=N”, “số chưa đọc đổi”, đổi trạng thái chặn/khóa) — **không chở nội dung tin**; trình duyệt nhận sự kiện rồi gọi REST lấy tin. Rớt socket: tự kết nối lại + lấy bù bằng `afterSeq`; polling giữ làm dự phòng, giãn ~30 giây. (Chi tiết kỹ thuật STOMP ban đầu đã đổi sang WebSocket thô + vé một lần, xem nhật ký 2026-11-22; spec Task 1c.) Thứ tự: Task 1a (REST) trước, task WebSocket riêng sau; thiếu thời gian thì dừng ở polling. “Đang gõ”, “đã xem”, online vẫn ngoài phạm vi.

- **2026-11-22 — Chi tiết nhắn trước khi mua (đồng ý cả 4 khuyến nghị):** (1) chống spam: trước khi tác giả trả lời lần đầu, người học gửi tối đa 3 tin; mỗi người mở tối đa 10 cuộc trò chuyện mới/ngày; chỉ mở từ khóa đang công khai; (2) lưu khóa mà người học bấm “Nhắn tác giả” gần nhất, tác giả thấy “Hỏi về: <tên khóa>” và “Đã đăng ký / Chưa đăng ký”; (3) khách bấm “Nhắn tác giả” → đăng nhập rồi quay lại trang khóa; (4) không có nút tắt nhận tin từ người chưa đăng ký, tác giả dùng “Chặn”.

## Câu hỏi mở cho người dùng

- (không có)

## Nhật ký phiên
### 2026-11-22 — Sửa spec theo quyết định mới
- Đối chiếu code thật (V22, lớp `Report*` của forum-reports, `viewer.canStart`, `findActive`, CORS/`webUrl`, chưa có starter WebSocket) rồi sửa `messaging.md`: Hiện trạng, Đường dẫn, Ngoài phạm vi, Ràng buộc (mở không cần mua, khóa đang hỏi, chống spam, thời gian thực), Task 1a (cột ngữ cảnh khóa, `author_replied`, 2 mã lỗi mới, kế hoạch theo luật “Ít class”), Task 1b (tên lớp báo cáo thật), Task 1c mới (vé một lần + WebSocket chỉ đẩy sự kiện, người nhận do server chọn), Task 2a (nút cho người chưa mua, “Hỏi về”, giới hạn chờ trả lời, socket + dự phòng 30 giây).
- Lệch kỹ thuật so với ghi chú trước: chọn WebSocket thô (`TextWebSocketHandler`) + vé một lần thay cho STOMP — không cần thư viện frontend, không có bề mặt đăng ký kênh cần phân quyền.
- Spec ~49 KB, vượt mục tiêu ~30 KB.
- Vòng 1: Codex 9 điểm; Claude chấp nhận 1,2,3,5,6,7,8, một phần 4,9 (từ chối test log vé, tách nhịp Redis khỏi unit, cắt lớn kích thước). Sửa thân spec: giới hạn ngày đếm DB dưới khóa người, vé gắn `sid`+`exp` và kiểm phiên trước mỗi lần đẩy, `GETDEL`, sự kiện chỉ là tín hiệu (`unread` không số), `contextCourse.available`, nhánh 2a không có 1c (5/30 giây).
