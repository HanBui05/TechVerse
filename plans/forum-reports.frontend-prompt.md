# Prompt giao frontend module forum-reports (Task 2a, 2b)

Người dùng chốt 2026-11-21: frontend của module này giao cho một AI khác theo prompt dưới; bỏ cổng wireframe cho module này, AI tự thiết kế theo hướng dẫn trong prompt. Dán nguyên khối dưới cho AI đó.

---

Bạn làm **frontend** cho module “Hỏi đáp (diễn đàn) + Báo cáo vi phạm” của TechVerse (React + TypeScript + Vite, shadcn/ui + Tailwind v4) trong thư mục `app/`. Backend đã xong, đã test và review; bạn chỉ nối giao diện vào API có sẵn. Trả lời người dùng bằng tiếng Việt.

## 1. Luật cứng (vi phạm = làm lại)

1. **Không sửa bất kỳ file nào trong `server/`** (Java, migration, cấu hình, test). Thấy API thiếu hoặc sai so với nhu cầu giao diện: dừng lại, ghi rõ endpoint + điều cần đổi vào câu trả lời, không tự “vá” ở frontend bằng cách đoán dữ liệu.
2. Chỉ tạo/sửa file trong phạm vi ở mục 3. Không đụng trang/module khác ngoài các điểm nối đã liệt kê.
3. Không thêm thư viện UI, form, state hay icon mới. Dùng primitive sẵn có trong `app/src/components/ui/` (shadcn) và utility Tailwind theo token.
4. Màu chỉ lấy từ token trong `app/src/styles/tokens.css` (không hex/rgb/hsl, không `text-white`/`bg-black`). Không viết file CSS mới. Hỗ trợ cả dark và light.
5. Quyền hiện nút **chỉ** dựa vào cờ `viewer.*` server trả về (`canEdit`, `canDelete`, `canReport`, `canAccept`, `canAnswer`, `canReact`). Không tự suy quyền từ role hay từ việc “có phải bài của mình không”. Ngoại lệ duy nhất: nút “Ẩn” của Moderator hiện khi tài khoản có role `MODERATOR`.
6. Không commit, không push trừ khi người dùng yêu cầu. Nếu được yêu cầu commit: message dạng `feat(app): ...`, không nhắc AI/agent, không `Co-Authored-By`.

## 2. Đọc trước khi code (bắt buộc, theo thứ tự)

**Luật dự án:** `CLAUDE.md`/`AGENTS.md` (gốc repo), `.claude/rules/frontend.md`, `docs/design/UI_GUIDE.md`, skill/tài liệu `.claude/skills/ui-components/` (danh mục primitive, Badge tone, mẫu bố cục). Chạy app thật: `docs/RUNBOOK.md`.

**Spec (nguồn sự thật về nghiệp vụ, mã lỗi, copy):** `plans/forum-reports.md` — đọc mục “Ràng buộc chung”, bảng “Quy tắc nghiệp vụ và mã lỗi” của Task 1a, 1b, 1c (cột “Copy hiển thị” là câu hiện cho người dùng), và toàn bộ Task 2a, 2b (phạm vi, copy vi/en, “Xong khi”). Bỏ qua câu “Theo wireframe đã duyệt” và mục “Cổng wireframe”: người dùng đã bỏ bước này. Lệch nghiệp vụ đã có: `plans/forum-reports.log.md` mục “Lệch khác spec” (thắng spec khi khác nhau).

**Backend (chỉ đọc, để biết đúng route, body, shape JSON):**
- `server/src/main/java/com/techverse/server/controller/ForumController.java` — `/api/v1/forum/**`: danh sách/chi tiết/tạo/sửa/xóa bài hỏi, trả lời, chọn lời giải, react (`PUT`/`DELETE /posts/{id}/reaction`, `GET /posts/{id}/reactions`), `GET /options` (chủ đề).
- `.../controller/ReportController.java` — gửi báo cáo.
- `.../controller/ModeratorReportController.java` — `/api/v1/moderator/reports` (hàng đợi, xử lý) và `/api/v1/moderator/forum/posts` (ẩn/hiện trực tiếp, danh sách đang ẩn).
- `.../dto/request/ForumRequest.java`, `ReportRequest.java` — tên trường, giới hạn độ dài, giá trị hợp lệ (làm validation client khớp đúng các biên này).
- `.../dto/response/ForumResponse.java`, `ReportResponse.java`, `PageResponse.java`, `ApiResponse.java` — shape dữ liệu trả về. Lưu ý: bài hỏi đã xóa nhưng còn câu trả lời thì vắng `title`/`content`/`author`/`reactions`; `reactions.mine` luôn có mặt, `null` khi chưa react; `counts` luôn đủ 4 khóa.
- `.../exception/ErrorCode.java` — các mã `FORUM_*`, `REPORT_*`, `ACCESS_DENIED`, `VALIDATION_ERROR`, `MALFORMED_REQUEST`, `AUTH_*` và HTTP status tương ứng.
- `.../configuration/SecurityConfiguration.java` — route nào công khai (GET diễn đàn), route nào cần đăng nhập/role.

**Frontend có sẵn để bắt chước (đọc cách làm, dùng lại, không sửa trừ khi nằm ở mục 3):**
- Gọi API + lỗi: `app/src/services/api/`, `app/src/services/articleService.ts` (mẫu service + test), `app/src/services/returnTo.ts`.
- i18n: `app/src/data/i18n.ts`, `app/src/data/articleI18n.ts` (mẫu tách file copy theo miền, có test).
- Danh sách + bộ lọc trên URL + phân trang: `app/src/pages/Blogs/BlogsPage.tsx`; chi tiết bài: `pages/Blogs/BlogDetailPage.tsx`.
- Markdown: `app/src/components/MarkdownContent.tsx` (hiển thị), `components/articles/ArticlePreview.tsx` và `pages/Author/ArticleEditorPage.tsx` (soạn + xem trước — dùng lại phần soạn/xem trước, **không** kèm tải ảnh vì nội dung diễn đàn cấm ảnh).
- Màn Moderator mẫu (bố cục, bộ lọc, hộp thoại lý do): `pages/Moderator/ModeratorArticlesPage.tsx`, `pages/Moderator/Courses/ModeratorCoursesPage.tsx`.
- Dùng chung: `components/UserAvatar.tsx`, `EmptyState.tsx`, `Pagination.tsx`, `ui/alert-dialog`, `ui/dialog`, `ui/sheet`, `ui/badge`, `lib/utils` (`toneFor`, `statusTone`).
- Định tuyến và shell: `app/src/App.tsx` (`ReaderRoute`, `RoleRoute`), `data/navigation.ts`, `components/layout/{Sidebar,ModeratorSidebar,AdminSidebar}.tsx`.

## 3. Code vào đâu

| Việc | File |
|---|---|
| Kiểu dữ liệu | `app/src/types/forum.ts` (mới) |
| Gọi API diễn đàn + báo cáo + moderator | `app/src/services/forumService.ts` (+ `forumService.test.ts`) |
| Copy vi/en + câu lỗi theo mã | `app/src/data/forumI18n.ts` (+ `forumI18n.test.ts`); mục menu staff thêm vào `data/managementI18n.ts` |
| Trang diễn đàn | `app/src/pages/Forum/` — danh sách, chi tiết, form tạo/sửa (+ test cùng thư mục) |
| Trang Moderator báo cáo | `app/src/pages/Moderator/Reports/` (+ test) |
| Điểm nối | `App.tsx` (route), `data/navigation.ts`, `Sidebar.tsx`, `ModeratorSidebar.tsx`, `AdminSidebar.tsx` (mục menu) và test trực tiếp của chúng |

Luật “ít file”: component con chỉ dùng một chỗ để chung file với trang; chỉ tách file khi dùng lại ở ≥ 2 nơi (ví dụ thanh react dùng cho cả bài hỏi lẫn câu trả lời, hộp thoại báo cáo).

**Route:** `/forum`, `/forum/new` (khai **trước** `/forum/:id`), `/forum/:id`, `/forum/:id/edit` — **không** bọc `ReaderRoute` (Admin/Moderator cũng vào được); tạo/sửa cần đăng nhập. `/moderator/reports` bọc `RoleRoute allowed={['MODERATOR']}`. Menu: “Hỏi đáp” ở sidebar người dùng, `ModeratorSidebar`, `AdminSidebar`; “Báo cáo vi phạm” ở `ModeratorSidebar`.

## 4. Giao diện — hướng thiết kế (bạn tự sáng tạo trong khuôn này)

Tinh thần: **sạch, gọn, dễ đọc, nhất quán với phần còn lại của TechVerse**; không màu mè, không gradient, không hiệu ứng thừa. Tham khảo cách các trang hỏi đáp thực tế tổ chức nội dung (Stack Overflow, GitHub Discussions, diễn đàn Discourse; react kiểu Facebook/GitHub) nhưng phải trông như một phần của TechVerse, không sao chép giao diện của họ. Dùng màu token sẵn có; màu nhấn chỉ cho trạng thái quan trọng (đã giải quyết, lời giải, lỗi).

- **`/forum` danh sách:** đầu trang có tiêu đề + nút “Đặt câu hỏi”; thanh lọc gọn (chủ đề, ô tìm, Tất cả/Chưa giải quyết/Đã giải quyết, “Bài của tôi” khi đã đăng nhập), mọi bộ lọc nằm trên URL. Mỗi bài là một dòng/thẻ thoáng: tiêu đề nổi bật, đoạn trích ngắn, chủ đề, tác giả + thời gian, số câu trả lời, tổng react, nhãn “Đã giải quyết”. Phân trang ở cuối.
- **`/forum/:id` chi tiết:** cột nội dung chính dễ đọc (độ rộng dòng vừa phải). Bài hỏi ở trên, rồi danh sách câu trả lời (lời giải đứng đầu, có nhãn và viền/nền nhấn nhẹ), cuối là ô trả lời Markdown có xem trước. Hành động của từng bài (sửa, xóa, chọn/bỏ lời giải, báo cáo, ẩn) gom gọn — ví dụ nút phụ hoặc menu “…” — không để một hàng nút dày đặc. Sửa câu trả lời ngay tại chỗ. Guest thấy lời mời đăng nhập (giữ `returnTo`) thay ô trả lời. Bài hỏi đã xóa: khối trạng thái “đã xóa”, không có ô trả lời.
- **React:** dưới mỗi bài hỏi/câu trả lời có một nút react (bấm mở bộ chọn 4 biểu tượng 👍 ❤️ 😂 😡; bấm lại loại đang chọn = bỏ, chọn loại khác = đổi; loại đang chọn được làm nổi) và cụm số đếm nhỏ (chỉ hiện các loại > 0). Bấm cụm số đếm mở hộp thoại “Người đã bày tỏ cảm xúc”: tab Tất cả + từng loại kèm số, danh sách ảnh/tên/biểu tượng, “Xem thêm”; trên mobile dùng tấm trượt từ dưới (`Sheet`). Guest bấm react → lời mời đăng nhập. Cập nhật số đếm từ response của API, không tự cộng trừ đoán.
- **`/forum/new`, `/forum/:id/edit`:** form một cột: tiêu đề, chủ đề, nội dung Markdown có tab/khung xem trước; cảnh báo khi rời trang chưa lưu.
- **`/moderator/reports`:** theo khung các màn Moderator sẵn có. Ba tab trên URL (Chờ xử lý / Đã xử lý có lọc / Nội dung đang ẩn). Mỗi báo cáo là một thẻ: lý do (Badge), mô tả, người báo cáo, thời gian, “+n báo cáo khác”, nội dung bài bị báo cáo (Markdown, thu gọn khi dài), người đăng, liên kết “Mở trong diễn đàn” hoặc nhãn “Không còn công khai”, hai nút “Ẩn nội dung” / “Bỏ qua” mở hộp thoại ghi chú.
- **Mọi màn:** đủ trạng thái tải (skeleton), rỗng (`EmptyState`), lỗi (câu theo mã lỗi + thử lại), đang gửi (khóa nút). Desktop và mobile 390px: trang không cuộn ngang (khối code cuộn ngang trong khung riêng), vùng chạm ≥ 44px trên thiết bị cảm ứng (theo `frontend.md`).

Copy: dùng đúng bảng copy vi/en trong spec Task 2a/2b; câu lỗi lấy từ cột “Copy hiển thị” của bảng 1a/1b/1c (react dùng câu của 1c khi trùng mã), mã không có câu riêng dùng câu dự phòng “Yêu cầu không hợp lệ. Hãy tải lại trang.”. Câu nào spec chưa có thì tự viết ngắn gọn, cùng giọng, ghi lại trong báo cáo cuối.

## 5. Hành vi bắt buộc

- Sau mỗi thao tác ghi (đăng, sửa, xóa, chọn lời giải, báo cáo, ẩn/hiện, xử lý báo cáo) tải lại dữ liệu từ server; riêng react dùng `{counts, mine}` trong response.
- Không tự retry thao tác ghi. `REPORT_ALREADY_HANDLED` hiện thông báo kèm nút tải lại. Ghi chú bắt buộc khi ẩn, validation client khớp biên của `ForumRequest`/`ReportRequest`.
- Xóa có hộp thoại xác nhận (`AlertDialog`); báo cáo lý do “Khác” bắt buộc mô tả.

## 6. Kiểm chứng và bàn giao

- Viết test trước theo “Xong khi” của Task 2a, 2b trong spec (unit cho service/i18n/validation/hiển thị nút theo `viewer.*`; test trang ~5 ca mỗi màn). Test bám role/label/state, không assert class Tailwind; chuỗi > 20 ký tự dùng `user.paste`.
- Chỉ chạy test liên quan: `cd app && npx vitest run <các file test đã thêm/sửa + test của Sidebar/ModeratorSidebar/AdminSidebar/App bị sửa>` và `npm run build`. Không chạy full `npm test`.
- Nếu chạy được app (theo `docs/RUNBOOK.md`): xem bằng mắt dark/light × desktop/mobile một lượt; không chạy được thì ghi “chưa kiểm bằng mắt” kèm lý do.
- Cuối cùng ghi vào `plans/forum-reports.log.md` (mục “Nhật ký phiên”, ≤ 6 dòng mỗi task): file đã tạo/sửa, lệnh test + số đạt/lỗi, phần chưa kiểm, câu copy tự viết, API nào thấy thiếu (nếu có). Báo cáo cho người dùng bằng tiếng Việt, kèm `git status --short` chứng minh không có file `server/` nào bị đổi.

---

# Prompt sửa vòng 1 (sau review Claude + Codex, 2026-11-21)

Dán nguyên khối dưới cho AI đã làm frontend.

---

Code frontend module diễn đàn (Task 2a, 2b) đã được Claude và Codex review, kết luận **needs-attention**. Sửa đúng 6 lỗi dưới đây, **không làm thêm gì khác**. Trả lời bằng tiếng Việt.

## Luật

- Vẫn giữ toàn bộ luật cứng của prompt gốc (phần trên của `plans/forum-reports.frontend-prompt.md`): không sửa `server/`, không thêm thư viện, quyền theo `viewer.*`, màu theo token, không commit/push.
- Chỉ sửa các file: `app/src/services/forumService.ts`, `app/src/pages/Forum/ForumQuestionEditorPage.tsx`, `app/src/pages/Forum/ForumQuestionDetailPage.tsx`, `app/src/pages/Moderator/Reports/ModeratorReportsPage.tsx`, copy mới (nếu cần) trong `app/src/data/forumI18n.ts`, và các file test tương ứng (`forumService.test.ts`, `forumI18n.test.ts`, `ForumPages.test.tsx`, `ModeratorReportsPage.test.tsx`). Không đổi bố cục hay style ngoài phần cần cho lỗi.
- Mỗi lỗi: **viết test tái hiện trước, chạy thấy đỏ đúng lý do**, rồi sửa tối thiểu cho xanh.

## 6 lỗi cần sửa

1. **Kiểm Markdown chặn nhầm nội dung hợp lệ** — `forumService.ts:40-48` (`isForumMarkdownInvalid`). Client kiểm ảnh trước khi bỏ code, không nhận code thụt 4 dấu cách hay rào `~~~`, nên chặn ví dụ code chứa `![alt](url)` hoặc thẻ HTML mà backend vẫn nhận (backend `ArticleContentService` chỉ từ chối node ảnh/HTML thật trong cây Markdown).
   Cách sửa: **bỏ kiểm ảnh, HTML thô và link nguy hiểm ở client**; client chỉ giữ độ dài sau trim và ký tự NUL. Backend là nơi quyết định: lỗi `FORUM_CONTENT_INVALID` (400) phải hiện câu "Nội dung chứa định dạng không được hỗ trợ." ngay dưới ô nội dung đang soạn (câu hỏi, câu trả lời mới, câu trả lời đang sửa tại chỗ), không mất nội dung đã gõ.
   Test: nội dung có `![alt](url)` trong khối ``` , trong khối `~~~` và trong code thụt 4 dấu cách, có `<div>` trong code → client cho qua; server trả `FORUM_CONTENT_INVALID` → hiện đúng câu, giữ nội dung.

2. **Trang sửa mở dù server không cho sửa** — `ForumQuestionEditorPage.tsx:72-85`. Sau khi tải chi tiết, nếu `detail.viewer.canEdit` là `false` thì không hiện form; hiện trạng thái "Bạn không có quyền." kèm nút quay lại bài (`/forum/:id`). Bài hỏi đã xóa giữ xử lý hiện tại.
   Test: mở thẳng `/forum/:id/edit` với `canEdit: false` → không có ô tiêu đề, thấy câu không có quyền và liên kết quay lại.

3. **Lỗi 404/409 để lại dữ liệu cũ trên trang chi tiết** — `ForumQuestionDetailPage.tsx` (react ở dòng ~269-275, cùng các thao tác ghi: trả lời, sửa, xóa, chọn lời giải, báo cáo, ẩn). Khi thao tác lỗi với 404 (`FORUM_POST_NOT_FOUND`, `REPORT_TARGET_NOT_FOUND`) hoặc 409 trạng thái (`FORUM_QUESTION_CLOSED`, `FORUM_ANSWER_INVALID`, `FORUM_STATE_INVALID`): vẫn hiện câu lỗi theo mã, **đồng thời tải lại chi tiết từ server** (bài hỏi không còn thì về trạng thái "không tìm thấy" sẵn có). Thanh react nhận dữ liệu mới từ lần tải lại. Lỗi khác (429, 503, validation) không tải lại.
   Test: react nhận 409 `FORUM_QUESTION_CLOSED` → hiện câu react riêng và gọi lại `questionDetail`; trả lời nhận 404 → tải lại, chi tiết 404 → hiện "không tìm thấy".

4. **`FORUM_STATE_INVALID` ở trang Moderator giữ hộp thoại, không tải lại** — `ModeratorReportsPage.tsx`, luồng "Hiện lại" (và xử lý báo cáo nếu nhận mã này). Đóng hộp thoại, hiện thông báo theo mã (câu "Không thực hiện được ở trạng thái hiện tại.") và tải lại danh sách, giống cách đang xử lý `REPORT_ALREADY_HANDLED`.
   Test: hiện lại nhận 409 `FORUM_STATE_INVALID` → hộp thoại đóng, thấy thông báo, danh sách được gọi lại.

5. **Xử lý mục cuối ở trang > 0 làm hàng đợi trông rỗng** — `ModeratorReportsPage.tsx:518` và `load()`. Sau khi tải lại, nếu trang hiện tại không có mục nào mà `page > 0` và `totalPages > 0`, đưa URL về trang cuối hợp lệ (`totalPages - 1`) rồi tải lại; nếu `totalPages = 0` thì về trang 0 và hiện trạng thái rỗng. Áp cho cả tab báo cáo lẫn tab nội dung đang ẩn.
   Test: đang ở `page=1` với 1 mục, xử lý xong server trả trang 1 rỗng `totalPages: 1` → URL về trang đầu, thấy các mục của trang 0.

6. **Response cũ ghi đè tab Moderator đang xem** — `ModeratorReportsPage.tsx:122-139`. Chỉ áp kết quả (dữ liệu, lỗi, cờ loading) của request mới nhất; bỏ qua response của tab/bộ lọc/trang cũ về muộn (dùng biến `live`/id request như `ForumListPage` đang làm, hoặc `AbortController`).
   Test: chuyển từ "Chờ xử lý" sang "Đã xử lý", response OPEN về **sau** response ACTIONED → tab "Đã xử lý" vẫn hiện dữ liệu ACTIONED, không có nút "Ẩn nội dung"/"Bỏ qua".

7. *(Kèm theo, cùng lý do với lỗi 6 của Codex)* **Lỗi tải chủ đề làm form tạo kẹt im lặng** — `ForumQuestionEditorPage.tsx:96-98`. Nếu `GET /forum/options` lỗi: hiện câu lỗi theo mã kèm nút "Thử lại" cạnh ô chủ đề, và khóa nút đăng tới khi tải được.
   Test: `options` lỗi → thấy câu lỗi + nút thử lại, nút đăng bị khóa; bấm thử lại thành công → chọn được chủ đề.

Không cần sửa: chuyển về `/forum` sau khi Moderator ẩn bài hỏi (giữ nguyên).

## Kiểm chứng và bàn giao

- Chạy: `cd app && npx vitest run src/services/forumService.test.ts src/data/forumI18n.test.ts src/pages/Forum/ForumPages.test.tsx src/pages/Moderator/Reports/ModeratorReportsPage.test.tsx src/components/layout/Sidebar.test.tsx` và `npm run build`. Cả hai phải đạt.
- Ghi vào `plans/forum-reports.log.md`, mục “Nhật ký phiên”, thêm `### 2026-11-21 — Sửa review vòng 1 (Task 2a, 2b)` (≤ 6 dòng): từng lỗi đã sửa (một dòng gộp), lệnh test + số đạt/lỗi, build, phần chưa kiểm.
- Báo cáo cho người dùng bằng tiếng Việt: bảng 7 mục (đã sửa / test nào chứng minh), output test + build, `git status --short` chứng minh không có file `server/` nào bị đổi.

---

# Prompt sửa vòng 2 (sau Codex review vòng 2, 2026-11-21)

Dán nguyên khối dưới cho AI đã làm frontend.

---

Codex review vòng 2 phần sửa frontend diễn đàn: còn 2 lỗi trung bình + 1 lỗi nhỏ. Sửa đúng 3 mục dưới, **không làm thêm gì khác**. Trả lời bằng tiếng Việt. Giữ toàn bộ luật cứng của prompt gốc (không sửa `server/`, không thêm thư viện, không commit/push). Mỗi mục: viết test tái hiện trước, thấy đỏ đúng lý do, rồi sửa tối thiểu.

1. **Câu lỗi và bản nháp biến mất sau khi tải lại** — `app/src/pages/Forum/ForumQuestionDetailPage.tsx:660-683` (`submitAnswer`, `saveEditAnswer`).
   - Gửi câu trả lời nhận lỗi trạng thái (vd. `FORUM_QUESTION_CLOSED`), tải lại trả bài đã xóa hoặc `viewer.canAnswer = false` → ô soạn và `answerError` biến mất.
   - Sửa câu trả lời nhận 404 (câu trả lời đã bị xóa/ẩn) → câu trả lời không còn trong `question.answers` nên `editingError` và nội dung đang sửa biến mất.
   Cách sửa: khi lỗi khiến ô soạn hoặc câu trả lời đang sửa không còn hiển thị sau tải lại, đưa câu lỗi lên vùng thông báo đầu trang (khối `error` sẵn có) và giữ bản nháp ở một khối chỉ đọc ngay dưới thông báo đó (nội dung đã gõ + nút "Sao chép" dùng `CopyButton` export sẵn từ `app/src/components/MarkdownContent.tsx`), để người dùng lấy lại được. Khối này có nút đóng. Trường hợp ô soạn vẫn còn thì giữ cách hiện tại.
   Test: (a) trả lời nhận 409 `FORUM_QUESTION_CLOSED`, tải lại trả `deleted: true` → thấy câu lỗi và bản nháp; (b) sửa câu trả lời nhận 404, tải lại không còn câu trả lời đó → thấy câu lỗi và nội dung đang sửa.

2. **Tab Moderator mới vẫn hiện dữ liệu và nút của tab cũ** — `app/src/pages/Moderator/Reports/ModeratorReportsPage.tsx:362-368`. Skeleton chỉ hiện khi chưa có dữ liệu, nên khi đổi tab/trạng thái/lý do/trang thì danh sách cũ (kể cả nút "Ẩn nội dung"/"Bỏ qua" của báo cáo OPEN) vẫn hiện dưới tab mới, và vẫn còn đó nếu request mới lỗi.
   Cách sửa: gắn dữ liệu với bộ lọc đã tải (lưu khóa bộ lọc cùng dữ liệu); chỉ hiện danh sách khi khóa khớp bộ lọc hiện tại, ngược lại hiện skeleton khi đang tải hoặc khối lỗi khi lỗi. Không còn nút thao tác nào trên dữ liệu không khớp bộ lọc hiện tại.
   Test: (a) đổi từ "Chờ xử lý" sang "Đã xử lý" khi request mới chưa về → không có nút "Ẩn nội dung"/"Bỏ qua", thấy trạng thái đang tải; (b) request của tab mới lỗi → thấy khối lỗi, không còn danh sách cũ.

3. **Trang sửa khóa nút lưu khi tải chủ đề lỗi** — `app/src/pages/Forum/ForumQuestionEditorPage.tsx:134`. Khi đang sửa bài đã có chủ đề, lỗi `GET /forum/options` không được khóa nút lưu (vẫn hiện câu lỗi + "Thử lại"); chỉ khóa ở trang tạo mới.
   Test: `/forum/:id/edit` với `options` lỗi → nút "Lưu" bấm được và gửi `PATCH` giữ chủ đề cũ.

## Kiểm chứng và bàn giao

- Chạy: `cd app && npx vitest run src/services/forumService.test.ts src/data/forumI18n.test.ts src/pages/Forum/ForumPages.test.tsx src/pages/Moderator/Reports/ModeratorReportsPage.test.tsx src/components/layout/Sidebar.test.tsx` và `npm run build`. Cả hai phải đạt.
- Ghi vào `plans/forum-reports.log.md`, mục “Nhật ký phiên”, thêm `### 2026-11-21 — Sửa review vòng 2 (Task 2a, 2b)` (≤ 5 dòng): 3 mục đã sửa, lệnh test + số đạt/lỗi, build, phần chưa kiểm.
- Báo cáo cho người dùng bằng tiếng Việt: bảng 3 mục (đã sửa / test nào chứng minh), output test + build, `git status --short` chứng minh không có file `server/` nào bị đổi.
