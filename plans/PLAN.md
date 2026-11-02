# Kế hoạch thực hiện TechVerse

Đọc [`PROJECT_CONTEXT.md`](../docs/PROJECT_CONTEXT.md) trước khi nhận task. Mỗi module có đúng một spec `plans/<module>.md` và một nhật ký `plans/<module>.log.md`.

## Trạng thái module

| Module | Spec | Trạng thái | Người thực hiện | Task hiện tại | Xong khi | Nhật ký |
|---|---|---|---|---|---|---|
| Workflow bootstrap | [`plans/workflow-bootstrap.md`](workflow-bootstrap.md) | Chờ người dùng nhận kết quả | Codex (pilot) | Đã dựng khung, luật, script và chạy pilot | Kết quả/test/review đã ghi; full verify còn cần Docker | [`plans/workflow-bootstrap.log.md`](workflow-bootstrap.log.md) |
| UI foundation | [`plans/ui-foundation.md`](ui-foundation.md) | Đang review | Claude | Task 1 đã review (không blocker). Task 2 (token, palette, font, theme bootstrap) code xong: `npm test` 76/76, build đạt, 0 literal màu ngoài `tokens.css`, mọi cặp chữ/nền ≥ 4.5:1; Codex review vòng 1 có 1 phát hiện (vòng sáng focus dùng `--primary`) đã sửa. Task 3 (trang chủ + 4 yêu cầu bổ sung D-016) code xong: `npm test` 81/81, build đạt, 0 literal màu ngoài `tokens.css`; chờ `/codex:review --background` rồi người dùng nhận kết quả | Token/font mới, CSS module hóa, placeholder/community Home đã bỏ, frontend test/build đạt | [`plans/ui-foundation.log.md`](ui-foundation.log.md) |
| Auth login/register | [`plans/auth-login-register.md`](auth-login-register.md) | Đang lập kế hoạch | Chưa giao | Claude đã ghi phản hồi vòng 1 (7 điểm thiếu, 1 rủi ro cần người dùng xác nhận); chờ Codex trả lời. Chỉ code sau khi `ui-foundation` hoàn tất cổng nhận kết quả | Tab auth có chuyển động, typography Inter rõ cấp, cảnh báo VI/EN chung, toggle mật khẩu đúng; test/build đạt | — |
| Sidebar cleanup | — (làn nhẹ, không cần spec riêng; chi tiết ở D-012 và mục “Quyết định đã chốt cho sidebar-cleanup” của [`plans/ui-foundation.md`](ui-foundation.md)) | Chờ người dùng nhận kết quả | Claude | Code xong: đã xóa 20 mục người dùng, 14 mục Admin, CSS/state/import mồ côi; `npm test` 65/65 và `npm run build` đạt; Codex review vòng 1 không có blocker. Người dùng xem bằng mắt rồi commit/push | Chỉ còn mục có route thật; không còn CSS/state/import mồ côi; `npm test` và `npm run build` đạt | [`plans/sidebar-cleanup.log.md`](sidebar-cleanup.log.md) |

Trạng thái hợp lệ: `Đề xuất` → `Đang lập kế hoạch` → `Chờ người dùng chốt` → `Đã chốt` → `Đang thực hiện` → `Đang review` → `Chờ người dùng nhận kết quả` → `Hoàn tất`; dùng `Bị chặn` khi không thể tạo ra kết quả để bàn giao vì cần quyết định hoặc môi trường bên ngoài.

## Quy trình

- **Chọn module:** từ bảng trên hoặc từ người dùng. Chưa có spec thì dừng và báo; chỉ Codex viết spec, theo mẫu [`plans/_template.md`](_template.md).
- **Plan (làn đầy đủ):** Codex viết spec → Claude phản biện vòng 1 (ghi trong spec) → Codex trả lời → Claude vòng 2 → Codex trả lời → người dùng chốt. Tối đa 2 vòng.
- **Làn nhẹ:** việc cơ học, rủi ro thấp (đổi tên, di chuyển file, sửa tài liệu). Ghi một dòng task ở bảng trên, không cần Codex lập plan; Claude làm, chạy verify, Codex review một lần. Người dùng quyết định task vào làn nào.
- **Thứ tự backend và giao diện:**
  - Chức năng **đã đầy đủ** (auth, hồ sơ, tác giả, bài viết, admin taxonomy): sửa giao diện trước.
  - Chức năng **mới**: làm backend trước. Chỉ khi toàn bộ backend của module xong (API + test đạt) mới mở task giao diện; không làm giao diện song song hay xen kẽ.
  - Task giao diện của module mới dùng API đã làm xong. Nếu thiếu dữ liệu hoặc endpoint, dừng task giao diện và mở task backend bổ sung trong spec, không sửa backend ngay trong task giao diện.
  - Mỗi module mới ghi hai task riêng trong spec: “Backend” rồi “Giao diện” (ghi `Giai đoạn` trong mẫu).
- **Trạng thái chỉ ghi ở bảng này.** Spec chứa nội dung và “Xong khi”; log chứa nhật ký. Ai hoàn thành task thì người đó cập nhật dòng trạng thái.
- **Skill:** `brainstorming` do Codex dùng cho tính năng mới hoặc yêu cầu chưa rõ; không dùng ở bước phản biện của Claude. Claude code bằng TDD + Ponytail; giao diện dùng `ui-ux-pro-max` theo [`docs/UI_GUIDE.md`](../docs/UI_GUIDE.md).

## Cổng người dùng

Người dùng quyết định tại bốn cổng: chốt plan; xử lý bất đồng giữa Planner/Reviewer/Implementer; khi chạm giới hạn vòng lặp; nhận kết quả cuối.

## Nhật ký quyết định

| ID | Ngày | Quyết định | Lý do | Trạng thái |
|---|---|---|---|---|
| D-001 | 2026-11-02 | Plan chỉ nằm trong `plans/`; không tạo `docs/superpowers/plans/` | Một nguồn sự thật, tránh plan song song | Đã chốt |
| D-002 | 2026-11-02 | Tranh luận tối đa 2 vòng; review tối đa 2 vòng/task; sửa test tối đa 3 lần | Chống vòng lặp luẩn quẩn | Đã chốt |
| D-003 | 2026-11-02 | `scripts/verify.sh` dùng Gradle Wrapper và npm | Repository không có Maven Wrapper; đây là lệnh tương đương chạy thật | Đã chốt |
| D-004 | 2026-11-02 | Review gate luôn tắt; mỗi task dùng một session mới (`/clear`) | Giữ quyền quyết định ở người dùng, tránh tích lũy ngữ cảnh | Đã chốt |
| D-005 | 2026-11-02 | Codex lập plan trước, Claude phản biện 2 vòng ngay trong file spec, người dùng chốt | Phản hồi không mất khi `/clear` | Đã chốt |
| D-006 | 2026-11-02 | Hai làn: nhẹ và đầy đủ | Tiết kiệm token cho việc nhỏ | Đã chốt |
| D-007 | 2026-11-02 | Trạng thái module chỉ ở `PLAN.md` | Ba nơi ghi trạng thái đã lệch nhau | Đã chốt |
| D-008 | 2026-11-02 | Chỉ dùng `ui-ux-pro-max` cho UI; không dùng `ui-styling`; không thêm Tailwind | Dự án dùng CSS thường; web mẫu chỉ tham khảo bố cục | Đã chốt |
| D-009 | 2026-11-02 | Spec không liệt kê skill của người code, trừ yêu cầu đầu ra (đổi giao diện) | Tránh lặp và lệch với `CLAUDE.md` | Đã chốt |
| D-010 | 2026-11-02 | Bảng màu UI theo web mẫu `javabuilder.online` (sáng, xanh dương); giữ CSS thường | Người dùng chọn hướng này | Đã chốt |
| D-011 | 2026-11-02 | Chức năng đầy đủ: sửa giao diện trước. Chức năng mới: backend trước, giao diện sau khi backend của cả module xong | Tránh sửa backend rải rác khi đang làm giao diện | Đã chốt |
| D-012 | 2026-11-02 | Trước `ui-foundation`, làm làn nhẹ xóa 20 mục người dùng và 14 mục Admin không có route thật; xóa “Giới thiệu”; giữ nguyên Moderator và `PlaceholderPage`/route `*`. Mỗi module mới tự thêm lại mục menu ở task Giao diện | Tránh menu dẫn tới trang “đang phát triển” và tránh di chuyển CSS chết khi tách `styles.css` | Đã chốt |
| D-013 | 2026-11-02 | Theme **tối là mặc định** (thay phần “sáng mặc định” của D-010); vẫn giữ chế độ sáng chọn được. Bảng màu theo web mẫu giữ nguyên | Ảnh mẫu người dùng chọn là tối, TechVerse đang mặc định tối; đo trực tiếp JavaBuilder cho thấy nền `#0f172a` | Đã chốt |
| D-014 | 2026-11-02 | Font toàn giao diện là **Inter** (thay DM Sans và Space Grotesk) | Khớp trang mẫu; font tiêu đề cũ ở cỡ lớn tạo cảm giác “AI” | Đã chốt |
| D-015 | 2026-11-02 | Bỏ khỏi trang chủ khối “Featured content” (thẻ nổi bật trống) và mục “Khóa học nổi bật” trống cho tới khi có dữ liệu thật | Khối giữ chỗ trông chưa hoàn thiện; cùng nguyên tắc D-012 | Đã chốt |
| D-016 | 2026-11-02 | Bỏ toàn bộ khu community trên Home, gồm GitHub repository card và Discord placeholder; chỉ thêm lại trong task của chức năng thật sau này | Không giữ giao diện hoặc liên kết rời rạc khi chưa có chức năng tương ứng | Đã chốt |
| D-016 | 2026-11-02 | Task 3 `ui-foundation` thêm 4 yêu cầu của người dùng: giảm cỡ h1 hero, mô tả hero dài hơn, padding hero lớn hơn, tech tag nhiều màu như trang mẫu | Giao diện trang chủ còn đơn điệu và tiêu đề quá to | Đã chốt |

## Câu hỏi mở

- **Docker:** đã cài nhưng daemon chưa chạy (kiểm tra 2026-11-02: không kết nối được `dockerDesktopLinuxEngine`). Phải mở Docker Desktop trước khi chạy `scripts/verify.sh`; chưa có lần chạy nào thấy 18 test tích hợp đạt. `scripts/verify.sh` giữ nguyên.
- **`.superpowers/`:** thư mục lưu trữ cũ (đã gitignore, 21 MB); chờ người dùng quyết định giữ hay xóa.
- **Module đầu tiên** cần cải tổ: chưa chọn.
- **Tên nhánh** của task do Codex làm (log cũ dùng `codex/...`, `PROJECT_CONTEXT.md` quy định `feature/`, `fix/`, `chore/`): chưa đối chiếu với `docs/GIT_WORKFLOW.md`.
- Codex đã có `superpowers:brainstorming` (người dùng xác nhận).
