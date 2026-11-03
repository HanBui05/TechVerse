# Article flow — Log

Trạng thái chính thức: xem [`PLAN.md`](PLAN.md). Spec: [`article-flow.md`](article-flow.md). Ba mục đầu và “Nhật ký phiên” được hook SessionStart tự nạp sau `/clear`; giữ chúng ngắn.

## Bắt đầu từ đây (cập nhật 2026-11-04)

- **Spec đã chốt (người dùng, 2026-11-04)** sau 2 vòng phản biện + lượt ngoại lệ phần mở rộng; Codex đã trả lời hết, không còn điểm mở. **Task tiếp theo: 1a** (V10 + entity/state machine + Author API + CORS PUT/DELETE). Thứ tự: 1a → 1b → 1c → cổng wireframe → 2a → 2b → 2c → 2d → regression gộp + E2E.
- **Branch:** đã fast-forward `main` local lên `origin/main` (`d92799b`, gồm PR `refactor/admin-ui`) và tạo `feature/article-flow` từ `main` (2026-11-04). Thay đổi `plans/` chưa commit nằm trên branch này. Môi trường: Docker 29.6.1 chạy, `.env` có `CLOUDINARY_CLOUD_NAME`.
- **Thứ tự:** (1) người dùng nhờ Codex viết spec theo `plans/_template.md`, dựa trên dòng “Article flow” trong `PLAN.md`, D-024…D-029 và mục “Hiện trạng” dưới đây; (2) Claude phản biện vòng 1 trong spec; (3) Codex trả lời; (4) vòng 2; (5) người dùng chốt; (6) Claude code từng task (branch mới từ `main`, ví dụ `feature/article-flow`).
- **Hiện trạng có sẵn (đầu vào cho spec):**
  - Backend bài viết đã có: `AuthorArticleController`, `ModeratorArticleController` (lọc `status`, `keyword`, `authorId`, khoảng ngày; review `APPROVE`/`REQUEST_CHANGES` + `reviewToken`), `PublishedArticleController`; mã lỗi `ARTICLE_*` trong `ErrorCode`.
  - Moderator đã theo chuẩn Admin (D-029): `pages/Moderator/*` dùng `AdminPagination`, `adminErrorText` (`pages/Admin/adminErrors.ts`, đã có `ARTICLE_*`), `ArticleStats`. Chức năng mới của Moderator cắm vào khung này.
  - Còn giao diện cũ (preflight tắt, CSS legacy): `pages/Author/AuthorBlogsPage.tsx` + `components/TagPicker`, `pages/Blogs/BlogsPage.tsx` (gồm `BlogDetailPage`), `components/MarkdownContent`, wrapper `components/Pagination`; CSS `styles/pages/blogs.css`, `styles/pages/admin.css`, `styles/components/{content,controls,forms}.css`, `styles/layout/shell.css`, `styles/base.css`. Ngoài luồng bài viết còn Login/Register/ForgotPassword/GoogleCallback/Settings Language-Theme chưa có `tw-page` (kiểm lại khi lập điều kiện bật preflight).
  - Mẫu giao diện tham khảo: `docs/image_admin_page/` (`admin-blog-management.png`, `admin-blog-loading.png`, ghi chú `README.md`).
- **Môi trường:** RUNBOOK có tài khoản dev Moderator; DB dev **chưa có bài viết** → spec nên có bước seed/tạo bài để kiểm thật.

## Quyết định người dùng chưa có trong spec

- 2026-11-04: Người dùng chốt toàn bộ spec `article-flow` (spec chờ Codex ghi vào mục “Quyết định của người dùng”).

## Câu hỏi mở cho người dùng

- (không có)

## Nhật ký phiên
### 2026-11-04 — Chốt spec
- Claude kiểm lại: Codex đã trả lời đủ 6 điểm phần mở rộng; không còn điểm mở. Người dùng chốt spec; task tiếp theo 1a trên branch mới từ `origin/main`.

### 2026-11-04 — Codex trả lời phản biện phần mở rộng
- Codex: đã trả lời và đưa vào spec 3 điểm thiếu (tuần tự hóa nút lưu, slug heading/TOC, filter `/blogs` đồng bộ URL) cùng 3 điểm nhỏ (CORS sang 1a, quyền truy cập Saved của Admin/Moderator, preview ẩn reading time). Không còn điểm kỹ thuật chặn người dùng chốt spec.

### 2026-11-04 — Claude soát phần mở rộng (ngoại lệ)
- Ghi “Phản biện phần mở rộng” vào spec: 3 thiếu + 3 nhỏ. Không sửa code, không chạy test.

### 2026-11-04 — Codex trả lời vòng 2 và đưa phần Reader/Lưu bài vào spec
- Codex: đã trả lời 2 điểm sai + 5 điểm thiếu vòng 2; thêm Task 1c/2d, contract/mã lỗi/test lưu bài, thiết kế Reader trong 1b/1c/2c/2d và cổng duyệt wireframe trước Task 2a; đã xóa ba quyết định tương ứng khỏi bảng chờ.

### 2026-11-04 — Mở rộng: Lưu bài + chốt khung UI
- Người dùng thêm “Lưu bài yêu thích” (Task 1c + 2d) vào module; chốt wireframe mọi màn 2a–2d trước khi code UI. Chờ Codex viết spec phần mới + trả lời vòng 2.

### 2026-11-04 — Claude phản biện vòng 2
- Ghi “Phản hồi vòng 2” vào spec (2 sai/mâu thuẫn, 5 thiếu nhỏ, 2 rủi ro không chặn). Không sửa code, không chạy test.

### 2026-11-04 — Codex đồng bộ quyết định kiểm chứng cuối module
- Codex: đã bỏ `scripts/verify.sh` khỏi spec và thay bằng một lượt regression gộp Backend/Frontend thuộc Article flow chạy song song; giữ E2E thật, full suite do CI chạy khi mở PR.

### 2026-11-04 — Codex trả lời vòng 1
- Codex: đã đưa toàn bộ 8 quyết định ngày 2026-11-04 vào thân spec, chia 5 task, bổ sung trạng thái/mã lỗi Author hide-unhide-delete, luật ảnh SAVE/SUBMIT, eligibility public, bỏ seed SQL và ngân sách kiểm chứng đã chốt; đã viết “Trả lời vòng 1 (Codex)”.

### 2026-11-04 — Người dùng chốt các câu hỏi vòng 1
- Chốt 8 quyết định (chi tiết ở “Quyết định người dùng”): xóa seed SQL; ảnh bắt buộc Cloudinary, nhưng SAVE nháp cho giữ ảnh chưa hợp lệ, SUBMIT mới chặn; chia 5 task; Author tự ẩn/hiện + xóa mềm; bài của tác giả bị khóa tự ẩn; nhận đề xuất 1+2, đề xuất 3 ghi vào `PLAN.md`; kiểm chứng kỹ (test migration, hợp đồng BE↔FE, `verify.sh` + E2E cuối module).
- Chờ Codex “Trả lời vòng 1” + cập nhật spec theo log; sau đó Claude phản biện vòng 2.
### 2026-11-03 — Claude phản biện vòng 1
- Ghi “Phản hồi vòng 1” vào spec: Sai 1 (DELETE chưa có; retry create sau khi xóa sẽ hồi sinh bài vì receipt Redis), Thiếu 6 (seed không sửa được, quy tắc no-change, `BrowserRouter` không có `useBlocker`, route detail Moderator, snapshot taxonomy, V10 trên DB có dữ liệu), Thừa 2 (tách task, giữ ảnh mọi version).
- Không sửa code, không chạy test.

### 2026-11-03 — Mở module
- Tạo log + “Bắt đầu từ đây”; `PLAN.md` trỏ module đang làm sang `article-flow` (trạng thái “Đang lập kế hoạch”, chờ Codex viết spec).

### 2026-11-03 — Codex lập spec vòng 0
- Codex: đã đưa quyết định chuyển module sang `article-flow` sau khi merge `ui-foundation-v2` + `refactor/admin-ui` vào spec.
- Người dùng chọn kiến trúc giữ snapshot đã duyệt công khai trong khi Author sửa working copy; chỉ Moderator approve mới thay snapshot trên cùng URL.
- Đã tạo `plans/article-flow.md`, chia Task 1 Backend trước Task 2 Giao diện và dùng fixture Markdown sẵn có cho bước kiểm thật.
- Đo token bằng `npx vitest run src/styles/tokens.test.ts --reporter=verbose`: 59/59 đạt; cặp thấp nhất là badge cyan theme sáng 4.79:1, chữ muted trên muted theme tối 4.94:1.
