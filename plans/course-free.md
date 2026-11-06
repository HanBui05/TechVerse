# Course free

Trạng thái: xem [`PLAN.md`](PLAN.md). Spec do Codex viết; Claude chỉ ghi vào mục “Phản hồi”.

**Mục tiêu:** Hoàn thiện vertical slice khóa học miễn phí: Tác giả đã duyệt tạo và sắp xếp khóa → chương → bài học; Moderator duyệt cả khóa theo snapshot bất biến; Guest xem tổng quan/học thử; người dùng đăng nhập bắt đầu học không qua bước đăng ký, có “Khóa học của tôi” và tiến độ bài/chương/khóa.
**Làn:** Đầy đủ
**Giai đoạn:** Task 1a → 1b → 1c — Backend; cổng wireframe; Task 2a → 2b → 2c — Giao diện. Chỉ mở Giao diện sau khi toàn bộ Backend đã xong và được review.
**Đổi giao diện:** Có

## Phương án nghiệp vụ đề xuất

- **Working copy + snapshot toàn aggregate** như `article-flow`: Public/Learner chỉ đọc snapshot hiện hành. Mọi sửa/thêm/xóa/reorder sau xuất bản tạo `hasUnpublishedChanges`; Moderator duyệt cả khóa mới tạo version kế tiếp. Bài đã publish được archive để giữ ID cho progress, nhưng vắng khỏi version mới.
- Guest/tài khoản chưa bắt đầu chỉ xem tổng quan và lesson `isPreview=true`, không tạo enrollment. Bấm “Bắt đầu học” hoặc mở bài thường tạo idempotent enrollment `FREE`; không có form đăng ký.
- Đề xuất `PUT` hoàn thành và `DELETE` bỏ hoàn thành, đều idempotent. Mẫu số là lesson của snapshot hiện hành; progress lịch sử không bị xóa. Giá luôn 0/VND và không xuất hiện trong API/UI module.

## Phần dùng lại và phần phải khái quát

| Nền | Dùng lại / thay đổi bắt buộc |
|---|---|
| `ArticleContentService` | Giữ parser, import `.md/.txt` UTF-8 ≤1 MiB, cấm NUL/raw HTML/link nguy hiểm, reading time/image issues; tách lõi Markdown dùng chung nhưng giữ contract article. Content lesson nullable, khi có dùng đúng validator. |
| `ArticleImageService` + storage/cleanup/rate limit | Giữ JPEG/PNG/WebP ≤5 MiB, Cloudinary, `Upload-Key`, giới hạn 50; tách scope `ARTICLE|COURSE|LESSON`, cấm tham chiếu asset chéo. |
| `article-flow` | Giữ hai trục trạng thái, review token, history append-only, HIDE/RESTORE/REMOVE; snapshot khóa đóng băng metadata/tag/toàn bộ curriculum trong một transaction. |
| `ai-assist` | Giữ outline → SSE draft, quota/cancel/receipt 24 giờ; thêm `targetType=LESSON`, claim receipt một lần khi save lesson. Lesson kế thừa taxonomy course; không tạo ảnh/endpoint/quota AI mới. |
| UI article | Tách editor Markdown/preview/import/upload/autosave dùng chung; lesson thêm video và điều kiện video hoặc content; giữ hành vi article. |

## Ma trận quyền

| Hành động | Guest | Learner | Author chủ khóa | Moderator | Admin |
|---|---:|---:|---:|---:|---:|
| Xem list/tổng quan khóa đang công khai | Có | Có | Có như Reader nếu không có role quản lý | Không qua Reader UI | Không qua Reader UI |
| Xem bài `isPreview=true` của snapshot hiện hành | Có | Có, chưa tạo enrollment | Có với khóa khác | Qua màn review, không qua Reader UI | Không |
| Bắt đầu/học đủ khóa, xem “Khóa học của tôi” | Không | Có | Có với khóa của người khác nếu không có role quản lý | Không | Không |
| Đánh dấu/bỏ hoàn thành | Không | Có khi có enrollment active | Có với khóa khác như trên | Không | Không |
| CRUD working copy, import/upload/AI, submit/withdraw/discard/ẩn-hiện | Không | Không | Chỉ khóa mình; cần role `AUTHOR` và profile `APPROVED`, riêng read/delete theo policy đình chỉ của article-flow | Không | Không |
| Xem queue/detail/history; APPROVE/REQUEST_CHANGES/HIDE/RESTORE/REMOVE | Không | Không | Không | Có role `MODERATOR`; không thấy tiền | Chỉ khi đồng thời có role `MODERATOR` |
| Quản lý giá/điều khoản/hoa hồng | Không | Không | Không | Không | Không trong module này |

Tài khoản có role `ADMIN` hoặc `MODERATOR` là tài khoản quản lý theo `article-flow`: backend chặn enrollment/progress bằng `ACCESS_DENIED`; frontend không hiện menu/trang Reader khóa học. `ADMIN` không tự có quyền duyệt nếu thiếu `MODERATOR`.

## Đường dẫn thuộc module

Chỉ sửa các đường dẫn dưới đây; class mới đặt đúng package layered architecture.

### Backend và schema

- `server/src/main/resources/db/migration/V12__add_free_course_lifecycle.sql` (tạo; không sửa V1–V11)
- `server/src/main/java/com/techverse/server/{entity,enums,dto,repository,service,controller}/**/*{Course,Lesson}*.java` (tạo), gồm chapter/tag/snapshot/history
- `server/src/main/java/com/techverse/server/configuration/SecurityConfiguration.java`
- `server/src/main/java/com/techverse/server/exception/ErrorCode.java`
- `server/src/main/java/com/techverse/server/service/impl/{ArticleContentService,ArticleImageService,ArticleImageCleanupService,ArticleAccessService}.java`
- `server/src/main/java/com/techverse/server/{controller/AuthorAiController.java,service/AuthorAiService.java,service/impl/Ai*.java,dto/request/Ai*.java}` và receipt/response AI liên quan
- `server/src/test/java/com/techverse/server/{course,author,moderator,ai}/**/*{Course,Lesson,Ai}*Test.java` (tạo/sửa) và `author/{ArticleContentServiceTest,AuthorArticleIntegrationTest}.java`

### Giao diện

- `plans/course-free.wireframe.md` (tạo ở cổng wireframe; chỉ đọc khi code UI)
- `app/src/App.tsx`, `app/src/data/navigation.ts`, `app/src/data/managementI18n.ts`
- `app/src/components/layout/{Sidebar,ModeratorSidebar}.tsx` và test trực tiếp
- `app/src/components/MarkdownContent.tsx` và test; editor/TOC dùng chung (tạo)
- `app/src/{types/courses.ts,services/courseService.ts,data/courseI18n.ts}` và test (tạo)
- `app/src/pages/{Author/Courses,Moderator/Courses,Courses}/**` và test (tạo)
- `app/src/pages/Author/{ArticleEditorPage,AiArticlePage}.tsx` và test nếu chạm caller
- `app/src/components/articles/AiOutlineEditor.tsx` và test nếu tách dùng chung
- `app/src/styles/tokens.test.ts` (chỉ sửa khi bổ sung token; không đổi ngưỡng 4.5:1)
- `.playwright-mcp/jb-course.png`, `.playwright-mcp/jb-lesson.png` (chỉ đọc, không commit thay đổi)

## Ngoài phạm vi

- Giá, đặt giá, đăng ký bán, điều khoản bán, hoa hồng, đơn hàng, thanh toán (`course-payment`, `course-commission`); không hoàn tiền đã chốt. **Không xóa** `refunds`/function/trigger trong V12; việc đó thuộc migration của `course-payment`.
- Video trả phí/provider có signed token, upload trực tiếp, webhook/transcode. Bản này chỉ lưu YouTube `provider=YOUTUBE` + `videoId` và nhúng `youtube-nocookie.com`.
- Lưu/yêu thích khóa, đánh giá sao, bình luận, ghi chú, chứng chỉ, quiz/bài tập.
- Trợ lý AI của khóa (`course-ai-tutor`): không thêm chat, embedding, pgvector, chunk hay index. V12 chỉ cần giữ snapshot nội dung bất biến, stable `courseId/lessonId`, `content_fingerprint`, `version_number` để bước “Hỏi AI về bài này” và RAG sau truy xuất đúng version mà không đổi cấu trúc nội dung.
- Notification cho Author khi được duyệt/trả về/ẩn/gỡ; analytics thời lượng/video; tự động đánh dấu hoàn thành theo video.

## Ràng buộc chung

- Được đổi API: **Có**. Được đổi DB: **Có**, chỉ bằng V12; không sửa V1–V11 và không sửa `docs/technical/db/final.sql` trong module này.
- Backend mới xong và review hết Task 1a–1c mới mở wireframe/UI; thiếu endpoint trong UI phải quay lại task Backend bổ sung trong spec.
- `courses.price_amount=0`, `currency=VND` được kiểm cả DB và service. Không trả trường tiền cho Moderator/public trong module.
- YouTube chỉ chấp nhận URL HTTPS của `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`, `youtube.com/embed/`; chuẩn hóa đúng một video ID 11 ký tự `[A-Za-z0-9_-]`, từ chối playlist/time/host giả/userinfo/port. Chỉ lưu provider + ID, không lưu URL đầu vào.
- Snapshot/version/history append-only. Public query không đọc working tables cho nội dung hiển thị. Tạo version, đổi pointer và ghi history nằm trong một transaction/row lock.
- `course_enrollments` FREE được tạo idempotent; không revoke trong module. Progress chỉ hợp lệ cho lesson thuộc snapshot hiện hành và enrollment active; tính `floor(completed/currentTotal*100)`, khóa 0 bài không được submit.
- Giữ nguyên `ApiResponse`/`ErrorResponse`, auth refresh, bài viết hiện tại, quota AI và contract public article. Không gọi YouTube API/oEmbed và không cần API key.

## Task 1a — Schema, domain và lifecycle version

**Giai đoạn:** Backend
**Đổi giao diện:** Không

### Phạm vi

- V12 thêm `course_chapters`, `course_tags`, snapshot metadata/tag/chapter/lesson và `course_moderation_history`; đổi `courses` sang hai trục trạng thái như article.
- `lessons`: thêm `chapter_id`, `summary`, nullable `content`, `video_provider`, `video_id`, `is_preview`, `content_fingerprint`, `ai_assisted`, `archived_at`; bỏ `video_url`, thay unique position theo chapter. Thêm constraint ít nhất một trong content/video và provider/video ID đi cùng nhau.
- Snapshot lesson giữ `lesson_id` ổn định + nội dung/metadata/video/preview/thứ tự bất biến; progress hiện có tiếp tục FK tới `lessons.id`.

### Quy tắc nghiệp vụ và mã lỗi

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Câu hiển thị tương ứng |
|---|---|---|---|
| `title` khóa/bài | Trim; 1–255 ký tự, không rỗng | 400 `VALIDATION_ERROR` | “Tiêu đề phải có từ 1 đến 255 ký tự.” |
| `summary` khóa | Trim; 1–500 ký tự | 400 `VALIDATION_ERROR` | “Mô tả ngắn phải có từ 1 đến 500 ký tự.” |
| `description` khóa | Markdown 1–1 MiB UTF-8, cùng rule bài viết | 400 `COURSE_CONTENT_INVALID` / `COURSE_CONTENT_TOO_LARGE` | “Mô tả khóa học không hợp lệ.” / “Nội dung không được vượt quá 1 MiB.” |
| `level` | `BEGINNER|INTERMEDIATE|ADVANCED` | 400 `VALIDATION_ERROR` | “Trình độ khóa học không hợp lệ.” |
| topic/tag | 1 topic active; 0–10 tag active, khác nhau | 400 `VALIDATION_ERROR`; 409 `COURSE_TAXONOMY_INACTIVE` | “Chủ đề hoặc thẻ không còn khả dụng.” |
| chương | Tên 1–255; position nguyên dương, duy nhất trong khóa | 400 `VALIDATION_ERROR` | “Thông tin chương không hợp lệ.” |
| bài học | Summary tùy chọn ≤500; position nguyên dương duy nhất trong chương; content hoặc video ít nhất một | 400 `VALIDATION_ERROR` / `LESSON_CONTENT_REQUIRED` | “Bài học phải có video hoặc nội dung.” |
| video | URL theo allowlist chung; lưu `YOUTUBE` + ID 11 ký tự | 400 `LESSON_VIDEO_INVALID` | “Liên kết YouTube không hợp lệ.” |
| submit khóa | Có ≥1 chương, mỗi chương ≥1 bài; metadata/ảnh/nội dung/asset hợp lệ; giá đúng 0 | 409 `COURSE_NOT_READY` / `COURSE_PRICE_MUST_BE_FREE` | “Khóa học chưa đủ điều kiện gửi duyệt.” |

### Kế hoạch thực thi

- **File cần đụng:** V12 + entity/enum course — working/snapshot/history/index/constraint và method edit/submit/approve/archive; không backfill, dừng nếu đã có course/lesson theo D-022.
- **Phần dùng lại:** V10, `ArticleLifecycleTest`, trigger append-only.
- **Bẫy:** giữ source ID, không cascade-delete lesson đã publish; reorder tránh va unique tạm thời; V12 không xóa/tách payment/refunds.

### Xong khi

- [ ] `FreeCourseMigrationTest` dựng V1→V12, kiểm bảng/constraint/index, content/video/position/giá 0, append-only; V12 dừng nếu có course/lesson và không đụng payment/refunds.
- [ ] `CourseLifecycleTest` (unit) kiểm edit/submit/withdraw/request changes/approve version; working không đổi snapshot.
- [ ] Unit test kiểm archive lesson giữ ID/progress nhưng version mới bỏ khỏi mẫu số; draft được xóa cứng.
- [ ] Unit test parser YouTube phủ đúng host/path hợp lệ và host giả, ID sai, query/playlist/time/userinfo/port bị từ chối.
- [ ] `FreeCourseMigrationTest`, `CourseLifecycleTest`, `ArticleLifecycleTest` đạt; full backend do CI, không chạy `scripts/verify.sh`.

## Task 1b — API Author, Markdown/ảnh dùng chung và AI handoff bài học

**Giai đoạn:** Backend
**Đổi giao diện:** Không

### Phạm vi endpoint

| Method + path | Hành vi |
|---|---|
| `GET /api/v1/author/courses/options` | Topic/tag active, dùng chung nguồn options article. |
| `POST /api/v1/author/courses/import` | Import Markdown/text, chưa lưu; contract validator như article. |
| `POST /api/v1/author/courses` | Tạo working course với UUID `Idempotency-Key`; `action=SAVE|SUBMIT`. |
| `GET /api/v1/author/courses` / `GET /{id}` | List/detail khóa mình; detail trả working tree, published version và `hasUnpublishedChanges`. |
| `PATCH /api/v1/author/courses/{id}` | Partial SAVE/SUBMIT metadata; SUBMIT duyệt toàn tree. |
| `POST /{id}/chapters`, `PATCH|DELETE /{id}/chapters/{chapterId}` | Tạo/sửa/archive chương; delete chỉ khi draft hoặc archive cả subtree đã từng publish. |
| `PUT /{id}/chapters:reorder` | Body là toàn bộ chapter ID đúng một lần, ghi position atomically. |
| `POST /{id}/chapters/{chapterId}/lessons`, `PATCH|DELETE /{id}/lessons/{lessonId}` | CRUD bài thuộc đúng khóa/chương; UUID `Idempotency-Key` khi create. |
| `PUT /{id}/chapters/{chapterId}/lessons:reorder` | Body là toàn bộ lesson active của chương đúng một lần. |
| `POST /{id}/images`, `POST /{id}/lessons/{lessonId}/images` | Upload cover/ảnh Markdown, `Upload-Key`; scope resource tách biệt. |
| `POST /{id}/withdraw`, `POST /{id}/discard`, `PATCH /{id}/publication`, `DELETE /{id}` | Theo semantics article-flow; public snapshot giữ nguyên khi withdraw/discard/edit. |
| `GET /{id}/history` | Lịch sử mới nhất trước. |
| `POST /api/v1/author/ai/outlines`, `POST /drafts:stream` | Thêm `targetType=LESSON`; generation/quota/cancel hiện có giữ nguyên. |

### Quy tắc nghiệp vụ và mã lỗi

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Câu hiển thị tương ứng |
|---|---|---|---|
| Owner/quyền | Write cần AUTHOR + profile APPROVED + chủ khóa; suspended chỉ read/delete như article | 403 `ACCESS_DENIED` | “Bạn không có quyền thực hiện thao tác này.” |
| ID/resource | Không tồn tại hoặc không thuộc owner trả cùng 404 | 404 `COURSE_NOT_FOUND` / `LESSON_NOT_FOUND` | “Không tìm thấy khóa học.” / “Không tìm thấy bài học.” |
| State | Pending không sửa/reorder; transition sai hoặc đã removed | 409 `COURSE_INVALID_STATE` | “Trạng thái khóa học đã thay đổi. Hãy tải lại.” |
| Reorder | Danh sách thiếu, thừa, lặp hoặc chứa ID khác parent | 400 `COURSE_ORDER_INVALID` | “Thứ tự chương hoặc bài học không hợp lệ.” |
| Create retry | Cùng key + payload trả receipt cũ; cùng key khác payload conflict | 409 `IDEMPOTENCY_KEY_REUSED` | “Yêu cầu lưu đã được dùng cho dữ liệu khác.” |
| Ảnh | Giữ định dạng/kích thước/rate limit/50 ảnh của article; asset phải đúng scope | Mã ảnh hiện có tương ứng | Dùng cùng copy editor bài viết. |
| AI lesson | `targetType=LESSON`; content completed qua validator chung, không ảnh; receipt chỉ claim bởi lesson cùng owner, một lần | 400/409 `AI_HANDOFF_INVALID` | “Bản nháp AI không còn hợp lệ. Hãy tạo lại.” |
| Video/content | `videoUrl` nullable; backend parse rồi chỉ response provider/videoId; content nullable nhưng không được blank | 400 `LESSON_CONTENT_REQUIRED` / `LESSON_VIDEO_INVALID` | Như Task 1a. |

### Kế hoạch thực thi

- **File cần đụng:** Author course CRUD/reorder/idempotency; lõi content/image generic có facade article; AI request/receipt thêm target lesson.
- **Phần dùng lại:** article service/access/receipt/rate-limit Lua, image storage và Markdown validator.
- **Bẫy:** autosave không tạo snapshot; SUBMIT lock aggregate và recheck; không giữ lock khi gọi AI, chỉ claim receipt sau khi fingerprint khớp.

### Xong khi

- [ ] `LessonContentServiceTest` kiểm Markdown/image/video, import/reading time, video-only và asset scope.
- [ ] `AuthorCourseIntegrationTest` kiểm 3–5 luồng create idempotent, CRUD/reorder, quyền, SAVE/SUBMIT; edit/archive sau publish không đổi public; withdraw/discard/hide/delete đúng.
- [ ] Test AI unit/controller kiểm `ARTICLE` không đổi, `LESSON` dùng chung quota/stream/validator và chặn receipt sai/reuse.
- [ ] `AuthorArticleIntegrationTest`, `ArticleContentServiceTest` giữ contract article sau khi tách dịch vụ.
- [ ] OpenAPI/DTO không nhận `priceAmount`, raw `videoUrl` không được lưu, response chỉ trả `provider/videoId`; Moderator không có trường tiền.
- [ ] Các lớp vừa nêu cùng `AuthorAiControllerTest`, `AiOutlineServiceTest`, `AiDraftStreamServiceTest`, `AiGeneratedContentValidatorTest` đạt; full backend do CI.

## Task 1c — API Moderator, public course và học/progress

**Giai đoạn:** Backend
**Đổi giao diện:** Không

### Phạm vi endpoint

| Method + path | Quyền/hành vi |
|---|---|
| `GET /api/v1/moderator/courses`, `GET /{id}`, `GET /{id}/history` | MODERATOR list/filter/detail working + published snapshot + review token/history; không trả tiền. |
| `PATCH /api/v1/moderator/courses/{id}/review` | `APPROVE|REQUEST_CHANGES`; approve snapshot toàn aggregate. |
| `PATCH /api/v1/moderator/courses/{id}/publication` | `HIDE|RESTORE|REMOVE`, review token; lý do theo article-flow. |
| `GET /api/v1/courses`, `GET /api/v1/courses/{id}` | Public list/tổng quan snapshot visible; lọc keyword/topic/tag/level, sort newest/oldest. |
| `GET /api/v1/courses/{courseId}/lessons/{lessonId}` | Guest chỉ preview; Learner có active enrollment đọc mọi bài snapshot hiện hành. |
| `POST /api/v1/courses/{id}/start` | Auth Reader; tạo/khôi phục-free enrollment idempotent và trả lesson đầu + progress. |
| `GET /api/v1/me/courses` | Auth Reader; khóa có enrollment FREE active, mới học gần nhất trước. |
| `PUT|DELETE /api/v1/courses/{courseId}/lessons/{lessonId}/completion` | Hoàn thành/bỏ hoàn thành idempotent; trả progress khóa + chương. |

### Quy tắc nghiệp vụ và mã lỗi

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Câu hiển thị tương ứng |
|---|---|---|---|
| Review token | Khớp working fingerprint/trạng thái; stale không ghi gì | 409 `COURSE_REVIEW_STALE` | “Khóa học đã thay đổi. Hãy tải lại trước khi duyệt.” |
| APPROVE | Author/profile/taxonomy/asset/tree còn hợp lệ; snapshot + pointer + history atomically | 409 `COURSE_NOT_READY` | “Khóa học không còn đủ điều kiện xuất bản.” |
| REQUEST_CHANGES/HIDE/REMOVE | Note trim 10–2000; RESTORE không cần note | 400 `VALIDATION_ERROR` | “Lý do phải có từ 10 đến 2.000 ký tự.” |
| Public visibility | Chỉ snapshot `PUBLISHED`, author active/profile không suspended; trạng thái khác che bằng 404 | 404 `COURSE_NOT_FOUND` | “Không tìm thấy khóa học.” |
| Preview | Guest/auth chưa enroll chỉ đọc lesson snapshot `isPreview=true`; response không lộ nội dung bài khác | 403 `LESSON_PREVIEW_ONLY` | “Hãy đăng nhập và bắt đầu khóa học để xem bài này.” |
| Start | Chỉ course visible/free; một active FREE enrollment/user/course; retry trả cùng kết quả | 404 `COURSE_NOT_FOUND`; 403 `ACCESS_DENIED` | “Không thể bắt đầu khóa học này.” |
| Completion | Cần enrollment active; lesson thuộc snapshot hiện hành; PUT/DELETE idempotent | 409 `COURSE_ENROLLMENT_REQUIRED`; 404 `LESSON_NOT_FOUND` | “Hãy bắt đầu khóa học trước.” |
| Progress | `x=current completed stable lesson IDs`, `y=current snapshot lessons`, `% = floor(x*100/y)`; chapter tương tự | — | Hiện `x/y (%)`, `Đã học x/y bài`. |

### Kế hoạch thực thi

- **File cần đụng:** Moderator queue/token/approval/publication/history; public/learning snapshot DTO, preview, enrollment/progress.
- **Phần dùng lại:** lifecycle/filter/history/visibility của article.
- **Bẫy:** không serialize working data; lesson phải thuộc current version; xử lý concurrent start/completion idempotent, không trả 500.

### Xong khi

- [ ] `ModeratorCourseIntegrationTest` kiểm 3–5 luồng review/stale/publication; snapshot tree bất biến, không tiền.
- [ ] `PublishedCourseIntegrationTest` kiểm snapshot visible/filter/preview; hidden/removed/suspended che 404.
- [ ] `CourseLearningIntegrationTest` kiểm start FREE idempotent, không đăng ký, “Khóa học của tôi”, manager 403.
- [ ] Cùng lớp kiểm completion toggle, progress sau version/archive và chặn lesson ngoài snapshot/enrollment.
- [ ] Regression `ModeratorArticleIntegrationTest`, `PublishedArticleIntegrationTest` giữ nguyên sau khi dùng chung lifecycle/visibility helper.
- [ ] Năm lớp course/article integration vừa nêu đạt; full backend do CI.

## Cổng wireframe trước Task 2a

**Giai đoạn:** Giao diện
**Đổi giao diện:** Có

### Phạm vi

- Tạo `plans/course-free.wireframe.md` trước code, bám ảnh JavaBuilder đã chụp: public overview; trang học 3 cột; “Khóa học của tôi”; workspace/editor curriculum Author; queue/detail Moderator.
- Wireframe desktop/mobile, dark/light; đủ loading/empty/error/403/404/pending/changes requested/hidden, preview, chưa bắt đầu, đang học, hoàn tất và AI handoff.

### Xong khi

- [ ] Wireframe thể hiện đầy đủ route, responsive/collapse, focus order và hành động chính; không dựng chức năng ngoài backend.
- [ ] Người dùng duyệt wireframe bằng lời; quyết định được ghi log trước khi mở Task 2a.

## Task 2a — Giao diện Author quản lý khóa/chương/bài

**Giai đoạn:** Giao diện
**Đổi giao diện:** Có

### Phạm vi

- Route `/author/courses`, `/author/courses/new`, `/author/courses/:id/edit`; form metadata, cover, curriculum reorder, lesson editor video + Markdown/import/ảnh/preview/AI, autosave/idempotency, submit/withdraw/discard/publication/history.
- Menu Tác giả đổi thành nhóm thu gọn chứa “Bài viết của tôi” và “Khóa học”; không thêm Doanh thu.

### Quy tắc nghiệp vụ và mã lỗi

Frontend validate đúng bảng Task 1a/1b; server là nguồn cuối. `courseI18n` ánh xạ đủ mã lỗi, unknown dùng fallback có retry; không parse message backend.

### Kế hoạch thực thi

- **File cần đụng:** types/service/i18n, workspace/editor/tree/reorder, lesson editor, route/navigation.
- **Phần dùng lại:** editor/TagPicker/upload/import/autosave/idempotency, AI stream/quota, status/history article.
- **Bẫy:** giữ mọi class `className`/thứ tự CSS khi tách component; write mutex; reorder dùng được bằng bàn phím; response cũ không ghi đè selection mới.

### Copy vi/en

| Khóa / trạng thái | vi | en |
|---|---|---|
| authorCourses | Khóa học | Courses |
| newCourse / submit | Tạo khóa học / Gửi duyệt | Create course / Submit for review |
| previewLesson | Học thử | Preview |
| contentRequired | Bài học phải có video hoặc nội dung. | A lesson must include a video or content. |
| unpublishedChanges | Có thay đổi chưa xuất bản | Unpublished changes |
| AI lesson handoff | Dùng bản nháp này cho bài học | Use this draft for the lesson |

### UI

- Theo wireframe đã duyệt, shadcn/ui + Tailwind/token; không gradient. Cặp chữ/nền dùng token đã được `tokens.test.ts` kiểm ≥4.5:1; touch target ≥44×44 px.
- Desktop curriculum + editor rõ phân cấp; mobile không cuộn ngang, action sticky không che nội dung, sidebar curriculum thành Sheet/Accordion có focus trap.

### Xong khi

- [ ] Service/i18n test đủ endpoint/error Author, idempotency/upload key, video và AI handoff dùng chung quota.
- [ ] Workspace test khoảng 5 luồng chính: list/filter/create, state/action, pending/changes, withdraw/discard, hide-unhide/delete.
- [ ] Editor test khoảng 5 luồng: metadata; CRUD/reorder keyboard chapter/lesson; video/content validation; Markdown/import/upload/autosave mutex; submit toàn tree.
- [ ] AI lesson test kiểm restore/stream/cancel/hash/claim và regression AI article.
- [ ] Navigation/App test kiểm nhóm Tác giả thu gọn, AUTHOR route và không hiện cho role khác; article route vẫn hoạt động.
- [ ] Kiểm mắt một lượt dark/light × desktop + mobile cho workspace/editor; ghi “Chưa kiểm” nếu thiếu môi trường.
- [ ] Test service/i18n/Author Course/editor/article callers/navigation/App và `npm run build` đạt; không full `npm test`.

## Task 2b — Giao diện Moderator duyệt khóa

**Giai đoạn:** Giao diện
**Đổi giao diện:** Có

### Phạm vi

- Route `/moderator/courses`, `/moderator/courses/:id`; queue/filter, detail working so với published version, tree preview, history, approve/request changes/hide/restore/remove trong khung Moderator hiện có.

### Quy tắc nghiệp vụ và mã lỗi

Client dẫn chiếu Task 1c: review token stale bắt buộc tải lại; không retry mutation tự động; không render/đề cập giá, doanh thu, ngân hàng hoặc hoa hồng.

### Kế hoạch thực thi

- **File cần đụng:** list/detail/test, route/sidebar/i18n; dùng lại badge/filter/comparison/dialog/BackToTopButton article.
- **Bẫy:** diff cả cấu trúc/thứ tự/preview/video/content; khóa action khi request chạy.

### Copy vi/en

| Khóa / trạng thái | vi | en |
|---|---|---|
| moderationCourses | Duyệt khóa học | Course moderation |
| approve / requestChanges | Duyệt khóa / Yêu cầu sửa | Approve course / Request changes |
| stale | Khóa học đã thay đổi. Hãy tải lại trước khi duyệt. | The course changed. Reload before reviewing. |

### UI

- List/detail theo khung Admin/Moderator; desktop so sánh dễ quét, mobile xếp tuần tự working rồi published; breadcrumb và BackToTopButton như article.
- Badge/tone dùng token tương phản ≥4.5:1; dialog lý do có focus/error rõ, action nguy hiểm không chỉ phân biệt bằng màu.

### Xong khi

- [ ] List test khoảng 5 luồng chính cho mặc định pending, filter/state, loading/empty/error và không có dữ liệu tiền.
- [ ] Detail test kiểm metadata/tree diff, snapshot, history/token và mọi action review/publication.
- [ ] Stale token/validation/API error map đúng vi/en, không mutation retry tự động; action được khóa khi pending.
- [ ] App/sidebar test route chỉ MODERATOR; ADMIN chỉ vào được khi đồng thời có role MODERATOR.
- [ ] Kiểm mắt một lượt dark/light × desktop + mobile cho list/detail.
- [ ] Test hai trang Moderator, sidebar/App, i18n và `npm run build` đạt.

## Task 2c — Giao diện public, trang học và tiến độ

**Giai đoạn:** Giao diện
**Đổi giao diện:** Có

### Phạm vi

- `/courses`, `/courses/:id`, `/courses/:courseId/lessons/:lessonId`, `/me/courses`.
- Tổng quan: header nhỏ, info card, số chương/bài/ngày cập nhật, accordion + mở rộng tất cả + “Học thử”. Trang học: 3 cột như yêu cầu; nhúng `youtube-nocookie.com/embed/<id>`, không link chuyển YouTube.

### Quy tắc nghiệp vụ và mã lỗi

| Tình huống | Client | Copy vi | Copy en |
|---|---|---|---|
| Guest mở bài không preview | Giữ return URL, chuyển login khi người dùng chọn bắt đầu | Đăng nhập để bắt đầu khóa học. | Sign in to start this course. |
| Chưa enroll bấm bắt đầu/bài thường | Gọi `/start` một lần rồi mở lesson; retry idempotent | Bắt đầu học | Start learning |
| Completion | PUT khi chưa xong, DELETE khi đã xong; lỗi giữ trạng thái server gần nhất | Hoàn thành bài học / Đánh dấu chưa hoàn thành | Complete lesson / Mark as incomplete |
| Course/lesson 404 | Không lộ hidden/removed/private | Không tìm thấy khóa học hoặc bài học. | Course or lesson not found. |
| Preview | Không tạo enrollment/progress; hiện badge | Học thử | Preview |

### Kế hoạch thực thi

- **File cần đụng:** public/my-course/lesson pages và course/curriculum/progress/TOC/video component, service/types/i18n/routes.
- **Phần dùng lại:** Markdown/TOC/Pagination/BackToTop/Reader policy/token article.
- **Bẫy:** iframe chỉ từ provider + validated ID, có title/sandbox/referrer/allow; mobile bỏ đúng grid/sticky/overflow để tránh nested scroll.

### Copy vi/en

| Khóa | vi | en |
|---|---|---|
| courseCatalog / myCourses | Khóa học / Khóa học của tôi | Courses / My courses |
| curriculum / expandAll | Nội dung khóa học / Mở rộng tất cả | Course content / Expand all |
| progress | Tiến độ {x}/{y} ({percent}%) | Progress {x}/{y} ({percent}%) |
| chapterProgress | Đã học {x}/{y} bài | {x}/{y} lessons completed |
| previous / next | Bài trước / Bài tiếp theo | Previous lesson / Next lesson |

### UI

- Tổng quan và lesson bám JavaBuilder theo các khối đã nêu, không sao chép branding. Trang học desktop: trái curriculum/search/progress, giữa nội dung, phải TOC; sidebar trái thu gọn được.
- Mobile: curriculum và TOC thành control mở rõ nhãn; video 16:9; previous/next và completion dễ chạm; hỗ trợ `prefers-reduced-motion`.
- Tất cả chữ/nền qua token có contrast ≥4.5:1; focus ring, heading landmark, iframe title và trạng thái tiến độ có accessible name/live region phù hợp.

### Xong khi

- [ ] Service/i18n test public list/detail/preview/start/my courses/completion và lỗi Task 1c.
- [ ] Catalog + overview test khoảng 5 luồng: filter/list, info/accordion/expand, preview, Guest/start, 404.
- [ ] Lesson page test khoảng 5 luồng: search/navigation, collapse, YouTube nocookie, Markdown+TOC, completion toggle/progress và previous/next.
- [ ] “Khóa học của tôi” test loading/empty/error, progress và thứ tự activity; preview-only không xuất hiện nếu chưa start.
- [ ] App/navigation test Guest public route, authenticated Reader/my courses, return URL; manager account không thấy/không gọi learning API.
- [ ] Kiểm tĩnh iframe không dùng `youtube.com` hay raw `videoUrl`; Public DTO/component không tham chiếu working content hoặc trường tiền.
- [ ] Kiểm mắt một lượt dark/light × desktop + mobile cho catalog, overview, my courses và lesson; chỉ các trang thực sự đổi.
- [ ] Test service/i18n/public/overview/my courses/lesson/Markdown/App và `npm run build` đạt.

## Câu hỏi mở cần người dùng chốt

1. **Bỏ hoàn thành:** đề xuất `DELETE completion` để sửa nhầm; nếu tiến độ chỉ được tăng thì bỏ action này.
2. **Mô tả bài học:** layout có mô tả ngắn nhưng yêu cầu dữ liệu chưa nêu. Đề xuất `lessons.summary` tùy chọn ≤500; xác nhận nhập riêng hay bỏ dòng khi trống.
3. **Học thử/enrollment:** đề xuất preview không tạo enrollment; chỉ bấm bắt đầu/mở bài thường mới ghi “Khóa học của tôi”.
4. **Owner tự học:** đề xuất owner preview working trong editor, không enrollment khóa mình; xác nhận có cần học snapshot như Learner.
5. **Xóa trước lần publish đầu:** đề xuất hard delete như article-flow; xác nhận course từng gửi duyệt nhưng chưa approve có cần giữ history.
6. **Mô tả dài của khóa:** spec đề xuất Markdown dùng validator chung; yêu cầu ban đầu chưa chốt plain text hay Markdown.

## Rủi ro và điểm yếu còn lại

- YouTube “Không công khai” vẫn lộ ID và có thể bị chia sẻ; không phải kiểm soát truy cập.
- Snapshot curriculum tăng schema/query; phải tránh N+1 và lộ working data.
- Stable lesson ID giữ progress, nên sửa lớn cùng ID không reset completion; muốn reset theo version cần thiết kế khác.
- Khái quát image/content/AI chạm article đã ổn định, là vùng rủi ro cao nhất. AI tutor chỉ được để sẵn ID/version/fingerprint, không dựng chunk/index.

## Phản hồi vòng 1 (Claude)

Đúng / Sai / Thiếu / Thừa:

### Đề xuất ngoài spec (không chặn chốt)

Tối đa ~3 ý; mỗi ý: lợi ích, công sức, làm ngay hay tách module sau.

## Trả lời vòng 1 (Codex)

## Phản hồi vòng 2 (Claude)

## Trả lời vòng 2 (Codex)

## Quyết định của người dùng

Chốt theo: ...

Sau khi chốt, chuyển nguyên bốn mục “Phản hồi/Trả lời vòng 1/2” sang `plans/course-free.review.md`; spec chỉ giữ tối đa 5 dòng kết luận tại mục này.
