# Sidebar Cleanup Log

Trạng thái chính thức: xem [`PLAN.md`](PLAN.md). Spec: mục “Quyết định đã chốt cho `sidebar-cleanup`” trong [`ui-foundation.md`](ui-foundation.md) (làn nhẹ, không có spec riêng).

## Nhật ký

| Giai đoạn | Kết quả |
|---|---|
| Mốc ban đầu | `npm test` trong `app/`: 9 files, 62 tests đạt (khớp số liệu của spec). |
| Test — RED | Thêm 3 test vào `Sidebar.test.tsx` (người học đã đăng nhập, khách, Admin kèm Moderator). Cả 3 đỏ đúng lý do: 9, 7 và 14 đường dẫn chết còn trong sidebar. |
| Code — GREEN | Sidebar người dùng: bỏ 7 mục menu chính, Nhắn tin, Thông báo, nhóm “Tiến độ của tôi”, nhóm “Premium & thanh toán”, công tắc “Nhận thông báo”, cùng state `learningOpen`/`premiumOpen`, `renderItems` và mảng `authenticatedItems`/`learningItems`/`premiumItems`. Admin: bỏ 14 mục và 10 icon import không còn dùng. `styles.css`: bỏ 15 dòng của `.group-trigger`, `.group-icon`, `.nested-nav`, `.nested-item`, `.notification-toggle` và rút gọn 1 selector ở dòng chung. |
| Test — sau code | `npm test`: 9 files, **65 tests đạt** (62 cũ + 3 mới). `npm run build`: đạt. |
| Kiểm tra mồ côi | Tìm toàn `app/src`: không còn tham chiếu tới 5 class trên, `authenticatedItems`, `learningItems`, `premiumItems`. |
| Không đổi | Sidebar Moderator, `PlaceholderPage`, route `*`, `App.tsx` (kiểm bằng `git diff`). |
| Review vòng 1 | `/codex:review --background` (working tree): không có blocker. Codex xác nhận đúng phạm vi đã chốt, giữ đủ mục cần giữ, bỏ hết state/import/dữ liệu/CSS mồ côi. Codex không chạy được test trong sandbox chỉ đọc (Vite không tạo được file tạm); kết quả test dựa trên lần chạy của Claude ở trên. Không cần vòng 2. |

## Kết quả test

- `npm test` (app): PASS, 65/65.
- `npm run build` (app): PASS. Có cảnh báo chunk > 500 kB (851.83 kB), đã có từ trước.
- `scripts/verify.sh` đầy đủ: **chưa chạy** vì Docker daemon chưa chạy (xem “Câu hỏi mở” trong `PLAN.md`); spec của task chỉ yêu cầu `npm test` và `npm run build`.

## Ngoài phạm vi (ghi nhận, không sửa)

- `PlaceholderPage` tìm tên trang bằng `navItems`; các đường dẫn đã xóa (ví dụ `/challenges`) giờ hiện tên mặc định “Trang/Page” thay vì tên mục. Đây là hệ quả của việc xóa, spec yêu cầu giữ nguyên `PlaceholderPage`.
- `Sidebar.tsx` còn nhánh `isAdmin && <NavLink ... admin-nav-item>` không bao giờ chạy (Admin trả về `AdminSidebar` từ trước) và `.admin-nav-item` trong CSS; không thuộc danh sách xóa nên giữ lại.
- `data/navigation.ts` còn `export { Settings }` không ai dùng; không thuộc phạm vi.
- Nhãn nhóm Admin “Người dùng & học viên” và “Bài giảng & học tập” giữ nguyên dù mỗi nhóm chỉ còn 2 mục; đổi tên nhóm là quyết định giao diện, để task sau.
- Test mới chỉ kiểm tra theo đường dẫn và tên link; không kiểm tra giao diện thu gọn/mobile (không đổi hành vi này).
