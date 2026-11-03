# Article flow — Log

Trạng thái chính thức: xem [`PLAN.md`](PLAN.md). Spec: [`article-flow.md`](article-flow.md) (**chưa có — Codex viết**). Ba mục đầu và “Nhật ký phiên” được hook SessionStart tự nạp sau `/clear`; giữ chúng ngắn.

## Bắt đầu từ đây (cập nhật 2026-11-03)

- **Chưa có spec `plans/article-flow.md`.** Claude không tự tạo spec (CLAUDE.md): session mới của Claude chỉ báo người dùng và dừng, hoặc phản biện khi Codex đã viết (skill `plan-review`).
- **Thứ tự:** (1) người dùng nhờ Codex viết spec theo `plans/_template.md`, dựa trên dòng “Article flow” trong `PLAN.md`, D-024…D-029 và mục “Hiện trạng” dưới đây; (2) Claude phản biện vòng 1 trong spec; (3) Codex trả lời; (4) vòng 2; (5) người dùng chốt; (6) Claude code từng task (branch mới từ `main`, ví dụ `feature/article-flow`).
- **Hiện trạng có sẵn (đầu vào cho spec):**
  - Backend bài viết đã có: `AuthorArticleController`, `ModeratorArticleController` (lọc `status`, `keyword`, `authorId`, khoảng ngày; review `APPROVE`/`REQUEST_CHANGES` + `reviewToken`), `PublishedArticleController`; mã lỗi `ARTICLE_*` trong `ErrorCode`.
  - Moderator đã theo chuẩn Admin (D-029): `pages/Moderator/*` dùng `AdminPagination`, `adminErrorText` (`pages/Admin/adminErrors.ts`, đã có `ARTICLE_*`), `ArticleStats`. Chức năng mới của Moderator cắm vào khung này.
  - Còn giao diện cũ (preflight tắt, CSS legacy): `pages/Author/AuthorBlogsPage.tsx` + `components/TagPicker`, `pages/Blogs/BlogsPage.tsx` (gồm `BlogDetailPage`), `components/MarkdownContent`, wrapper `components/Pagination`; CSS `styles/pages/blogs.css`, `styles/pages/admin.css`, `styles/components/{content,controls,forms}.css`, `styles/layout/shell.css`, `styles/base.css`. Ngoài luồng bài viết còn Login/Register/ForgotPassword/GoogleCallback/Settings Language-Theme chưa có `tw-page` (kiểm lại khi lập điều kiện bật preflight).
  - Mẫu giao diện tham khảo: `docs/image_admin_page/` (`admin-blog-management.png`, `admin-blog-loading.png`, ghi chú `README.md`).
- **Môi trường:** RUNBOOK có tài khoản dev Moderator; DB dev **chưa có bài viết** → spec nên có bước seed/tạo bài để kiểm thật.

## Quyết định người dùng chưa có trong spec

- 2026-11-03: người dùng chuyển module đang làm sang `article-flow` sau khi merge `ui-foundation-v2` + `refactor/admin-ui` vào `main`.

## Câu hỏi mở cho người dùng

- (chờ spec)

## Nhật ký phiên
### 2026-11-03 — Mở module
- Tạo log + “Bắt đầu từ đây”; `PLAN.md` trỏ module đang làm sang `article-flow` (trạng thái “Đang lập kế hoạch”, chờ Codex viết spec).
