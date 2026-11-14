# Kế hoạch thực hiện TechVerse

Mỗi module có đúng một spec `plans/<module>.md` và một nhật ký `plans/<module>.log.md`. [`PROJECT_CONTEXT.md`](../docs/PROJECT_CONTEXT.md): Codex đọc mục 1–3, 5 trước mọi task; Claude chỉ đọc khi task đụng tới. Lý do các quyết định cũ: [`DECISIONS.md`](DECISIONS.md).

Module đang làm: [course-free](course-free.md)

<!-- Hook SessionStart của Claude đọc đúng dòng trên (dạng `[slug](slug.md)`, “—” nếu không có) để tự nạp mục “Bắt đầu từ đây” của log. Đổi module thì sửa dòng này. -->

## Trạng thái module

| Module | Spec | Trạng thái | Người thực hiện | Task hiện tại | Nhật ký |
|---|---|---|---|---|---|
| Workflow bootstrap | [spec](workflow-bootstrap.md) | Chờ người dùng nhận kết quả | Codex (pilot) | Chờ người dùng nhận (2026-11-02). | [log](workflow-bootstrap.log.md) |
| UI foundation | [spec](ui-foundation.md) | Đang review | Claude | Task 1–3 đã code; chờ review Task 3. | [log](ui-foundation.log.md) |
| Auth login/register | [spec](auth-login-register.md) | Chờ người dùng nhận kết quả | Claude | Review vòng 2 đạt; chờ người dùng nhận. | [log](auth-login-register.log.md) |
| User profile | [spec](user-profile.md) | Chờ người dùng nhận kết quả | Claude | Code + review vòng 1 xong; chờ người dùng nhận. | [log](user-profile.log.md) |
| Sidebar cleanup | — (làn nhẹ, D-012) | Chờ người dùng nhận kết quả | Claude | Code + review vòng 1 xong; chờ người dùng nhận. | [log](sidebar-cleanup.log.md) |
| Seed LF fix | — (làn nhẹ) | Đang review | Claude | Verify đạt; chờ review vòng 1. | — |
| Forgot password UI | — (làn nhẹ, 2026-11-02) | Đang review | Claude | Code + test đạt; chờ review. | — |
| Docs + `.claude` restructure | — (làn nhẹ, 2026-11-02) | Chờ người dùng nhận kết quả | Claude | Xong; chờ người dùng nhận. | — |
| Sidebar + login redirect | — (làn nhẹ, 2026-11-02) | Chờ người dùng nhận kết quả | Claude | Xong; chờ người dùng nhận. | — |
| Course free | [spec](course-free.md) | Đang thực hiện | Claude | Mọi task đã nhận (2026-11-10); còn đồng bộ spec cuối module và rebase/PR, xem log. | [log](course-free.log.md) |
| AI docs optimization | — (làn nhẹ, [brief](ai-docs-optimization.brief.md), 2026-11-13) | Đang thực hiện | Claude | Đang làm; chờ người dùng trả lời câu hỏi mục 5 của brief. | — |

Đã xong: Author profile (Backend) — [spec](author-profile.md), [log](author-profile.log.md) · UI foundation v2 (shadcn) — [spec](ui-foundation-v2.md), [log](ui-foundation-v2.log.md) · Article flow (2026-11-04, PR #2) — [spec](article-flow.md), [log](article-flow.log.md) · AI assist (2026-11-06, PR #3) — [spec](ai-assist.md), [log](ai-assist.log.md).

Trạng thái hợp lệ: `Đề xuất` → `Đang lập kế hoạch` → `Chờ người dùng chốt` → `Đã chốt` → `Đang thực hiện` → `Đang review` → `Chờ người dùng nhận kết quả` → `Hoàn tất`; dùng `Bị chặn` khi không thể tạo ra kết quả để bàn giao vì cần quyết định hoặc môi trường bên ngoài. **Trạng thái chỉ ghi ở bảng này**; ai hoàn thành task thì cập nhật dòng của mình.

## Quy trình riêng của bảng này

- **Làn đầy đủ:** Codex viết spec theo [`_template.md`](_template.md) → Claude phản biện tối đa 2 vòng → người dùng chốt. **Làn nhẹ:** việc cơ học, rủi ro thấp (đổi tên, di chuyển file, sửa tài liệu) — một dòng ở bảng, không spec, Claude làm, Codex review một lần. Người dùng quyết task vào làn nào.
- **Backend trước, giao diện sau** cho chức năng mới: chỉ mở task giao diện khi toàn bộ backend của module xong (API + test đạt); thiếu endpoint thì mở task backend bổ sung trong spec, không sửa backend trong task giao diện. Chức năng đã đầy đủ: sửa giao diện trước.
- Người dùng quyết định tại bốn cổng: chốt plan; bất đồng giữa các AI; chạm giới hạn vòng; nhận kết quả cuối.

## Câu hỏi mở

- **Lộ trình các chức năng còn lại (2026-11-13):** chờ người dùng trả lời [`roadmap.questions.md`](roadmap.questions.md); sau đó Claude viết file hướng cho module tới lượt, Codex viết spec.
- **Thanh toán khóa học:** hướng ở [`course-payment.directions.md`](course-payment.directions.md) (gồm cả hướng cũ 2026-11-06 về đăng ký bán, hoa hồng, không hoàn tiền, video, trợ lý AI của khóa); chờ người dùng chốt mục 7 rồi Codex viết `course-payment.md`.
- **Menu Tác giả khi có tính năng thứ hai (2026-11-04):** đổi mục sidebar “Tác giả” thành nhóm thu gọn (Bài viết của tôi, Khóa học, sau này Doanh thu); không dựng trước.
- **Thông báo cho tác giả (2026-11-04):** báo khi bài được duyệt/trả về/ẩn/gỡ; cần module notification riêng (xem `roadmap.questions.md` T5).
- **Chẩn đoán lỗi Cloudinary (2026-11-04):** task backend reliability: log `status + error.message` của provider (không log secret), ánh xạ 401/403 sang `ARTICLE_STORAGE_UNAVAILABLE`. Chờ người dùng quyết có mở task không.
- **Tăng tốc test backend (cần spec riêng):** gom container Testcontainers singleton + thống nhất `properties` để dùng lại Spring context; có thể cắt phần lớn ~400 giây (ước tính). Chờ người dùng quyết.
- **`.superpowers/`** (lưu trữ cũ, gitignore, 21 MB): chờ người dùng quyết giữ hay xóa.
