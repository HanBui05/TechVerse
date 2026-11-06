# Course free

Trạng thái: xem [`PLAN.md`](PLAN.md). Spec do Codex viết; Claude chỉ ghi vào mục “Phản hồi”.

**Mục tiêu:** Vertical slice khóa miễn phí: Author tạo khóa/chương/bài; Moderator duyệt snapshot; Guest xem/học thử; Learner bắt đầu không qua form đăng ký, có “Khóa học của tôi” và tiến độ.
**Làn:** Đầy đủ
**Giai đoạn:** Task 1a → 1b → 1c — Backend; cổng wireframe; Task 2a → 2b → 2c — Giao diện. Chỉ mở Giao diện sau khi toàn bộ Backend đã xong và được review.
**Đổi giao diện:** Có

## Phương án nghiệp vụ đề xuất

- Working copy + snapshot như `article-flow`; Reader chỉ đọc snapshot. Sửa sau publish đặt `hasUnpublishedChanges`; approve tạo version; archive giữ lesson ID/progress nhưng bỏ khỏi version mới.
- Guest xem overview/preview, không enrollment. Start/bài thường tạo FREE enrollment idempotent. Completion idempotent, mẫu số theo snapshot hiện hành. API/UI không hiện giá 0/VND.

## Phần dùng lại và phần phải khái quát

| Nền | Dùng lại / thay đổi bắt buộc |
|---|---|
| `ArticleContentService` | Tách lõi Markdown dùng chung, giữ contract article: `.md/.txt` UTF-8 ≤1 MiB, cấm NUL/raw HTML/link nguy hiểm; lesson nullable nhưng nếu có dùng cùng validator. |
| `ArticleImageService` + storage/cleanup/rate limit | Giữ JPEG/PNG/WebP ≤5 MiB, Cloudinary, `Upload-Key`; tách scope `ARTICLE|COURSE|LESSON`, cấm asset chéo. Cleanup phải nhận scope và giữ mọi ảnh còn được working/snapshot article/course/lesson tham chiếu. |
| `article-flow` | Giữ hai trục trạng thái, token/history/publication; snapshot metadata/tag/curriculum trong một transaction. |
| `ai-assist` | Giữ outline→SSE/quota/cancel/receipt 24h; thêm `LESSON`, taxonomy theo course; không endpoint/quota mới. |
| UI article | Tách editor/preview/import/upload/autosave dùng chung; lesson thêm video hoặc content; article không đổi. |

## Ma trận quyền

- Guest xem list/tổng quan và preview snapshot hiện hành, không enrollment. Learner có thể start/học/progress; Author không mang role quản lý có thể học khóa khác.
- Author `APPROVED` CRUD/import/upload/AI/lifecycle chỉ khóa mình; read/delete khi suspended theo article-flow; owner chỉ preview working, không enrollment khóa mình.
- `MODERATOR` duyệt/publication qua màn quản lý, không Reader UI hay dữ liệu tiền; `ADMIN` chỉ duyệt nếu đồng thời có `MODERATOR`.
- Tài khoản có role `ADMIN` hoặc `MODERATOR` bị backend chặn enrollment/progress bằng `ACCESS_DENIED` và frontend ẩn Reader course. Không role nào quản lý giá/điều khoản/hoa hồng trong module.

## Đường dẫn thuộc module

Chỉ sửa các đường dẫn dưới đây; class mới đặt đúng package layered architecture.

### Backend và schema

- `server/src/main/resources/db/migration/V12__add_free_course_lifecycle.sql` (tạo); `server/src/main/java/com/techverse/server/{entity,enums,dto,repository,service,controller}/**/*{Course,Lesson}*.java` (tạo, gồm chapter/tag/snapshot/history)
- `server/src/main/java/com/techverse/server/configuration/SecurityConfiguration.java`
- `server/src/main/java/com/techverse/server/exception/ErrorCode.java`
- `server/src/main/java/com/techverse/server/service/impl/{ArticleContentService,ArticleImageService,ArticleImageCleanupService,ArticleAccessService,AuthorArticleServiceImpl,ModeratorArticleServiceImpl,PublishedArticleServiceImpl,ArticleRateLimitService,CloudinaryArticleImageStorage}.java`
- `server/src/main/java/com/techverse/server/{service/ArticleImageStorage.java,dto/internal/ArticleImageAsset.java,repository/AiCompletedGenerationRepository.java,controller/AuthorAiController.java,service/AuthorAiService.java,service/impl/Ai*.java,dto/request/Ai*.java}` và response AI liên quan
- `server/src/test/java/com/techverse/server/{course,author,moderator,ai}/**/*{Course,Lesson,Ai}*Test.java` (tạo/sửa), `author/{ArticleContentServiceTest,AuthorArticleIntegrationTest}.java`, `article/{ArticleLifecycleTest,PublishedArticleIntegrationTest,ArticleIntegrationTestBase}.java`

### Giao diện

- `plans/course-free.wireframe.md` (tạo); `app/src/App.tsx`, `app/src/data/{navigation,managementI18n}.ts`
- `app/src/components/layout/{Sidebar,ModeratorSidebar}.tsx`, `app/src/components/MarkdownContent.tsx`, editor/TOC dùng chung và test trực tiếp
- `app/src/{types/courses.ts,services/courseService.ts,data/courseI18n.ts}` và test (tạo)
- `app/src/{types/aiAssist.ts,services/{aiAssistService,articleService}.ts,data/aiAssistI18n.ts}` và test trực tiếp
- `app/src/pages/{Author/Courses,Moderator/Courses,Courses}/**` và test (tạo)
- `app/src/pages/Author/{ArticleEditorPage,AiArticlePage}.tsx` và test nếu chạm caller
- `app/src/components/articles/AiOutlineEditor.tsx` và test nếu tách dùng chung
- `app/src/styles/tokens.test.ts` (chỉ sửa khi bổ sung token; không đổi ngưỡng 4.5:1)
- `.playwright-mcp/jb-course.png`, `.playwright-mcp/jb-lesson.png` (chỉ đọc, không commit thay đổi)

## Ngoài phạm vi

- Giá/đặt giá/đăng ký bán/điều khoản/hoa hồng/đơn hàng/thanh toán (`course-payment`, `course-commission`); V12 không xóa `refunds`/function/trigger.
- Video trả phí/provider có signed token, upload trực tiếp, webhook/transcode. Bản này chỉ lưu YouTube `provider=YOUTUBE` + `videoId` và nhúng `youtube-nocookie.com`.
- Lưu/yêu thích khóa, đánh giá sao, bình luận, ghi chú, chứng chỉ, quiz/bài tập.
- `course-ai-tutor`: không chat/embedding/pgvector/chunk/index; V12 chỉ giữ snapshot, stable ID, fingerprint và version cho RAG sau.
- Thời lượng ước tính khóa/bài (tách module sau); notification Author; analytics video; tự động hoàn thành theo video.

## Ràng buộc chung

- Được đổi API/DB: **Có**, DB chỉ qua V12; không sửa V1–V11 hay `docs/technical/db/final.sql`.
- Backend mới xong và review hết Task 1a–1c mới mở wireframe/UI; thiếu endpoint trong UI phải quay lại task Backend bổ sung trong spec.
- `courses.price_amount=0`, `currency=VND` được kiểm cả DB và service. Không trả trường tiền cho Moderator/public trong module.
- YouTube chỉ nhận HTTPS `youtube.com/watch?v=`, `youtu.be/`, `/shorts/`, `/embed/`; ID đúng 11 ký tự `[A-Za-z0-9_-]`; từ chối playlist/time/host giả/userinfo/port; chỉ lưu provider+ID.
- Snapshot/version/history append-only. Public query không đọc working tables cho nội dung hiển thị. Tạo version, đổi pointer và ghi history nằm trong một transaction/row lock.
- Enrollment FREE idempotent, không revoke; có `last_lesson_id` + `last_accessed_at`. Chỉ Learner enrolled mở lesson hiện hành mới cập nhật; preview chưa enroll thì không. Owner không học khóa mình. Progress chỉ nhận lesson hiện hành, tính `floor(completed/currentTotal*100)`; khóa 0 bài không submit.
- Giữ nguyên `ApiResponse`/`ErrorResponse`, auth refresh, bài viết hiện tại, quota AI và contract public article. Không gọi YouTube API/oEmbed và không cần API key.

## Task 1a — Schema, domain và lifecycle version

**Giai đoạn:** Backend
**Đổi giao diện:** Không

### Phạm vi

- V12 thêm `course_chapters`, `course_tags`, snapshot metadata/tag/chapter/lesson và `course_moderation_history`; đổi `courses` sang hai trục trạng thái như article.
- V12 thêm `course_enrollments.last_lesson_id` nullable FK `lessons(id)` và `last_accessed_at`.
- `course_chapters` và `lessons` có `archived_at`; lesson thêm `chapter_id`, `summary`, nullable `content`, `video_provider`, `video_id`, `is_preview`, `content_fingerprint`, `ai_assisted`; bỏ `video_url`, unique position theo chapter, bắt buộc content hoặc video và cặp provider/ID hợp lệ.
- Snapshot chapter giữ `chapter_id`; snapshot lesson giữ `lesson_id` ổn định cùng nội dung/metadata/video/preview/thứ tự. Progress tiếp tục FK tới `lessons.id`.

### Quy tắc nghiệp vụ và mã lỗi

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Câu hiển thị tương ứng |
|---|---|---|---|
| `title` khóa/bài | Trim; 1–255 ký tự, không rỗng | 400 `VALIDATION_ERROR` | “Tiêu đề phải có từ 1 đến 255 ký tự.” |
| `summary` khóa | Trim; 1–500 ký tự | 400 `VALIDATION_ERROR` | “Mô tả ngắn phải có từ 1 đến 500 ký tự.” |
| `description` khóa | Markdown 1–1 MiB UTF-8, cùng rule bài viết | 400 `COURSE_CONTENT_INVALID`; 413 `COURSE_FILE_TOO_LARGE` | “Mô tả khóa học không hợp lệ.” / “Nội dung không được vượt quá 1 MiB.” |
| `level` | `BEGINNER|INTERMEDIATE|ADVANCED` | 400 `VALIDATION_ERROR` | “Trình độ khóa học không hợp lệ.” |
| topic/tag | 1 topic active; 0–10 tag active, khác nhau | 400 `VALIDATION_ERROR`; 409 `COURSE_TAXONOMY_INACTIVE` | “Chủ đề hoặc thẻ không còn khả dụng.” |
| chương | Tên 1–255; position nguyên dương, duy nhất trong khóa | 400 `VALIDATION_ERROR` | “Thông tin chương không hợp lệ.” |
| bài học | Summary tùy chọn ≤500; position nguyên dương duy nhất trong chương; content hoặc video ít nhất một | 400 `VALIDATION_ERROR` / `LESSON_CONTENT_REQUIRED` | “Bài học phải có video hoặc nội dung.” |
| video | URL theo allowlist chung; lưu `YOUTUBE` + ID 11 ký tự | 400 `LESSON_VIDEO_INVALID` | “Liên kết YouTube không hợp lệ.” |
| submit khóa | Có ≥1 chương, mỗi chương ≥1 bài; metadata/ảnh/nội dung/asset hợp lệ; giá được DB khóa ở 0 | 409 `COURSE_NOT_READY` | “Khóa học chưa đủ điều kiện gửi duyệt.” |

### Kế hoạch thực thi

- V12 + domain working/snapshot/history; dùng V10, `ArticleLifecycleTest`, trigger append-only. Không backfill; dừng nếu đã có course/lesson; giữ source ID, lesson published và payment/refunds; reorder tránh unique tạm.

### Xong khi

- [ ] `FreeCourseMigrationTest` dựng V1→V12, kiểm bảng/constraint/index, content/video/position/giá 0, hai cột tiếp tục học + FK lesson, append-only; V12 dừng nếu có course/lesson và không đụng payment/refunds.
- [ ] `CourseLifecycleTest` (unit) kiểm edit/submit/withdraw/request changes/approve version; working không đổi snapshot.
- [ ] Unit test kiểm archive chapter/lesson giữ ID/progress, version mới bỏ khỏi mẫu số, hard delete trước lần approve; parser YouTube phủ allowlist và mọi dạng bị từ chối đã nêu.
- [ ] `FreeCourseMigrationTest`, `CourseLifecycleTest`, `ArticleLifecycleTest` đạt; full backend do CI, không chạy `scripts/verify.sh`.

## Task 1b — API Author, Markdown/ảnh dùng chung và AI handoff bài học

**Giai đoạn:** Backend
**Đổi giao diện:** Không

### Phạm vi endpoint

| Method + path | Hành vi |
|---|---|
| `GET /api/v1/author/courses/options`; `POST .../import` | Options topic/tag active; import Markdown/text chưa lưu, validator như article. |
| `POST /api/v1/author/courses` | Tạo working course với UUID `Idempotency-Key`; `action=SAVE|SUBMIT`. |
| `GET /api/v1/author/courses` / `GET /{id}` | List phân trang; detail trả metadata tree working/published, fingerprint và `hasUnpublishedChanges`, không nhúng content bài. |
| `GET /{id}/lessons/{lessonId}` | Nội dung một lesson working; `versionId` tùy chọn chỉ đọc snapshot thuộc khóa. |
| `PATCH /api/v1/author/courses/{id}` | Partial SAVE/SUBMIT metadata; SUBMIT duyệt toàn tree. |
| Chapter/lesson CRUD + `PUT ...:reorder` | Đúng khóa/chương; create lesson có UUID `Idempotency-Key`; delete draft hoặc archive subtree published; reorder gửi đủ ID active đúng một lần và atomic. |
| `POST /{id}/images`, `POST /{id}/lessons/{lessonId}/images` | Upload cover/ảnh Markdown, `Upload-Key`; scope resource tách biệt. |
| Withdraw/discard/publication/delete/history | Theo article-flow; public snapshot không đổi khi edit/withdraw/discard; history mới nhất trước. |
| `POST /api/v1/author/ai/outlines`, `POST /drafts:stream` | Thêm `targetType=LESSON`; generation/quota/cancel hiện có giữ nguyên. |

### Quy tắc nghiệp vụ và mã lỗi

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Câu hiển thị tương ứng |
|---|---|---|---|
| Owner/quyền | Write cần AUTHOR + profile APPROVED + chủ khóa; suspended chỉ read/delete như article | 403 `ACCESS_DENIED` | “Bạn không có quyền thực hiện thao tác này.” |
| ID/resource | Không tồn tại hoặc không thuộc owner trả cùng 404 | 404 `COURSE_NOT_FOUND` / `LESSON_NOT_FOUND` | “Không tìm thấy khóa học.” / “Không tìm thấy bài học.” |
| State/action | Tách đúng nguyên nhân như article-flow | 409 `COURSE_NOT_EDITABLE`, `COURSE_NO_CHANGES`, `COURSE_NOT_WITHDRAWABLE`, `COURSE_NOT_DISCARDABLE`, `COURSE_NOT_DELETABLE`, `COURSE_PUBLICATION_TRANSITION_INVALID`, `COURSE_AUTHOR_UNHIDE_NOT_ALLOWED` | Copy riêng theo hành động; chỉ stale mới yêu cầu tải lại. |
| Reorder | Danh sách thiếu, thừa, lặp hoặc chứa ID khác parent | 400 `COURSE_ORDER_INVALID` | “Thứ tự chương hoặc bài học không hợp lệ.” |
| Create retry | Cùng key+payload trả receipt cũ; key khác payload/deleted hoặc request đang chạy | 409 `COURSE_KEY_CONFLICT` / `COURSE_REQUEST_IN_PROGRESS` | “Khóa yêu cầu đã dùng cho dữ liệu khác.” / “Yêu cầu đang xử lý, hãy thử lại cùng khóa.” |
| Import/content | `.md/.txt`, UTF-8 ≤1 MiB; lỗi/rate/storage tách rõ | 400 `COURSE_FILE_INVALID`/`COURSE_CONTENT_INVALID`; 413 `COURSE_FILE_TOO_LARGE`; 415 `COURSE_FILE_UNSUPPORTED`; 429 `COURSE_RATE_LIMITED`; 503 `COURSE_STORAGE_UNAVAILABLE` | Copy course tương ứng contract article. |
| Ảnh | JPEG/PNG/WebP ≤5 MiB; tối đa 50 node ảnh cho description+cover và riêng mỗi lesson; đúng scope | 400 `COURSE_IMAGE_INVALID`; 413 `COURSE_IMAGE_TOO_LARGE`; 415 `COURSE_IMAGE_UNSUPPORTED`; 429 `COURSE_RATE_LIMITED`; 502 `COURSE_IMAGE_UPLOAD_FAILED`; 503 `COURSE_STORAGE_UNAVAILABLE` | Copy upload course tương ứng article. |
| AI lesson | `targetType=LESSON` bắt buộc `courseId`, cấm client gửi `topicId/tagIds`; server kiểm owner và lấy taxonomy khóa. Receipt lưu `targetType+courseId`; claim `LESSON:<lessonId>` khi POST hoặc PATCH, không claim chéo ARTICLE/LESSON | 409 `AI_GENERATION_INVALID`; các mã AI hiện có khác giữ nguyên | “Bản nháp AI không còn hợp lệ. Hãy tạo lại.” |
| Video/content | `videoUrl` nullable; backend parse rồi chỉ response provider/videoId; content nullable nhưng không được blank | 400 `LESSON_CONTENT_REQUIRED` / `LESSON_VIDEO_INVALID` | Như Task 1a. |

AI `ARTICLE` giữ request hiện tại (`topicId/tagIds`) và claim khi create; `targetType` mặc định `ARTICLE` để không phá client. Create lesson cấp UUID trước khi claim nên retry dùng cùng `LESSON:<lessonId>`; PATCH chỉ nhận lại cùng claim key.

### Kế hoạch thực thi

- Author CRUD/reorder/idempotency; content/image generic giữ facade article; AI receipt thêm lesson. SUBMIT/APPROVE chỉ kiểm storage ngoài lock cho document đổi, rồi khóa và recheck fingerprint/scope; autosave không snapshot.

### Xong khi

- [ ] `LessonContentServiceTest` kiểm Markdown/image/video, import/reading time, giới hạn ảnh theo document, video-only và asset scope.
- [ ] `AuthorCourseIntegrationTest` kiểm 3–5 luồng create idempotent, CRUD/reorder, quyền/lifecycle và public không đổi sau edit/archive.
- [ ] Test AI unit/controller kiểm `ARTICLE` không đổi; `LESSON` resolve taxonomy/owner, claim POST/PATCH và chặn receipt sai type/course/reuse.
- [ ] `ArticleImageCleanupServiceTest` kiểm cleanup theo scope: xóa asset rời nhưng giữ ảnh course/lesson còn ở working hoặc bất kỳ snapshot.
- [ ] `AuthorArticleIntegrationTest`, `ArticleContentServiceTest` giữ contract article sau khi tách dịch vụ.
- [ ] OpenAPI/DTO không nhận `priceAmount`, không lưu raw `videoUrl`, response chỉ `provider/videoId`; Moderator không có trường tiền.
- [ ] Các lớp trên + `AuthorAiControllerTest`, `AiOutlineServiceTest`, `AiDraftStreamServiceTest`, `AiGeneratedContentValidatorTest`, `ArticleImageCleanupServiceTest` đạt; full backend do CI.

## Task 1c — API Moderator, public course và học/progress

**Giai đoạn:** Backend
**Đổi giao diện:** Không

### Phạm vi endpoint

| Method + path | Quyền/hành vi |
|---|---|
| Moderator list/detail/history/lesson | List phân trang; detail metadata tree working/published + fingerprint/token/history và trạng thái đổi từng chapter/lesson; content từng lesson qua endpoint riêng, `versionId` tùy chọn; không tiền. |
| Moderator review/publication | `APPROVE|REQUEST_CHANGES`, `HIDE|RESTORE|REMOVE`; snapshot aggregate, review token và note theo article-flow. |
| `GET /api/v1/courses`, `GET /api/v1/courses/{id}` | List phân trang; detail public trả curriculum; Learner enrolled nhận completed IDs, progress khóa/chương và `continueLesson` (bài cuối nếu còn trong snapshot hiện hành, nếu không là bài đầu). |
| `GET .../courses/{courseId}/lessons/{lessonId}` | Guest chỉ preview; Learner enrolled đọc bài hiện hành, cập nhật `last_lesson_id` + `last_accessed_at`, rồi trả curriculum/completed IDs/progress. Preview chưa enroll không cập nhật. |
| `POST /api/v1/courses/{id}/start` | Auth Reader; tạo FREE enrollment idempotent và trả lesson đầu + progress. |
| `GET /api/v1/me/courses` | List enrollment FREE active, mới nhất theo `last_accessed_at`, rồi `granted_at`; mỗi item trả `continueLesson` theo fallback như overview. |
| `PUT|DELETE /api/v1/courses/{courseId}/lessons/{lessonId}/completion` | Hoàn thành/bỏ hoàn thành idempotent; trả progress khóa + chương. |

### Quy tắc nghiệp vụ và mã lỗi

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Câu hiển thị tương ứng |
|---|---|---|---|
| Review token | Khớp fingerprint/trạng thái; stale không ghi | 409 `COURSE_REVIEW_STALE` | “Khóa học đã thay đổi. Hãy tải lại trước khi duyệt.” |
| Moderator/APPROVE | Không tự duyệt; author/profile/taxonomy/asset/tree còn hợp lệ | 403 `COURSE_SELF_REVIEW_NOT_ALLOWED`; 409 `COURSE_AUTHOR_INELIGIBLE` / `COURSE_NOT_READY` | “Bạn không thể duyệt khóa của mình.” / “Tác giả không còn đủ điều kiện.” / “Khóa học không còn đủ điều kiện xuất bản.” |
| Note review/publication | Trim, tối đa 2.000; bắt buộc với REQUEST_CHANGES và HIDE/REMOVE, RESTORE không cần | 400 `COURSE_REVIEW_NOTE_REQUIRED` / `COURSE_PUBLICATION_NOTE_REQUIRED`; quá dài `VALIDATION_ERROR` | “Cần nhập phản hồi.” / “Cần nhập lý do.” |
| Public visibility | Snapshot `PUBLISHED`, author active/profile không suspended; còn lại che 404 | 404 `COURSE_NOT_FOUND` | “Không tìm thấy khóa học.” |
| Preview | Guest/auth chưa enroll chỉ đọc lesson snapshot `isPreview=true`; response không lộ nội dung bài khác | 403 `LESSON_PREVIEW_ONLY` | “Hãy đăng nhập và bắt đầu khóa học để xem bài này.” |
| Start | Chỉ course visible/free; một active FREE enrollment/user/course; retry trả cùng kết quả | 404 `COURSE_NOT_FOUND`; 403 `ACCESS_DENIED` | “Không thể bắt đầu khóa học này.” |
| Completion | Cần enrollment active; lesson thuộc snapshot hiện hành; PUT/DELETE idempotent | 409 `COURSE_ENROLLMENT_REQUIRED`; 404 `LESSON_NOT_FOUND` | “Hãy bắt đầu khóa học trước.” |
| Progress | `x=current completed stable lesson IDs`, `y=current snapshot lessons`, `% = floor(x*100/y)`; chapter tương tự | — | Hiện `x/y (%)`, `Đã học x/y bài`. |

Mọi list: `page=0`, `size=20`, size 1–100. Author/Moderator thêm workflow/publication; public có keyword/topic/tag/level + newest/oldest; `/me/courses` giữ thứ tự hoạt động cố định.

So với published version gần nhất, chapter/lesson có `changeStatus`: `NEW` nếu ID chỉ ở working; `ARCHIVED` nếu chỉ ở published/đã archive; `CHANGED` nếu fingerprint, metadata hoặc thứ tự khác; còn lại `UNCHANGED`. Chapter tính cả danh sách/thứ tự lesson.

### Kế hoạch thực thi

- Moderator lifecycle/diff và public/learning DTO dùng helper article. Tree không nhúng content; lesson thuộc current version; tránh N+1; start/completion/access concurrent vẫn idempotent.

### Xong khi

- [ ] `ModeratorCourseIntegrationTest` kiểm 3–5 luồng review/self-review/stale/publication; tree/lesson fetch và đủ `NEW|CHANGED|ARCHIVED|UNCHANGED` theo fingerprint/metadata/thứ tự; snapshot bất biến, không tiền.
- [ ] `PublishedCourseIntegrationTest` kiểm snapshot visible/filter/pagination/preview và curriculum/progress payload; hidden/removed/suspended che 404.
- [ ] `CourseLearningIntegrationTest` kiểm start idempotent; mở bài enrolled cập nhật last lesson/time nhưng preview chưa enroll không; overview/my courses fallback tiếp tục và sort access/granted; owner/manager 403; progress sau version/archive.
- [ ] Regression `ModeratorArticleIntegrationTest`, `PublishedArticleIntegrationTest` giữ nguyên sau khi dùng chung lifecycle/visibility helper.
- [ ] Năm lớp course/article integration vừa nêu đạt; full backend do CI.

## Cổng wireframe trước Task 2a

**Giai đoạn:** Giao diện
**Đổi giao diện:** Có

### Phạm vi

- Tạo `plans/course-free.wireframe.md` trước code cho overview, lesson 3 cột, My Courses, Author editor và Moderator; desktop/mobile, dark/light, đủ lỗi/lifecycle/preview/progress/AI.

### Xong khi

- [ ] Đủ route, responsive/collapse, focus order/action; không vượt backend; người dùng duyệt và quyết định được ghi log trước Task 2a.

## Task 2a — Giao diện Author quản lý khóa/chương/bài

**Giai đoạn:** Giao diện
**Đổi giao diện:** Có

### Phạm vi

- Route `/author/courses`, `/author/courses/new`, `/author/courses/:id/edit`; form metadata, cover, curriculum reorder, lesson editor video + Markdown/import/ảnh/preview/AI, autosave/idempotency, submit/withdraw/discard/publication/history.
- Menu Tác giả đổi thành nhóm thu gọn chứa “Bài viết của tôi” và “Khóa học”; không thêm Doanh thu.

### Quy tắc nghiệp vụ và mã lỗi

Frontend validate đúng Task 1a/1b; server là nguồn cuối. `courseI18n` ánh xạ danh sách đóng toàn bộ `COURSE_*`, `LESSON_*`, `AI_*`, `ACCESS_DENIED`, `VALIDATION_ERROR`, `MALFORMED_REQUEST` trong hai bảng; unknown dùng fallback, không parse message backend.

### Kế hoạch thực thi

- **Dùng lại:** types/service/i18n, editor/tree/route, TagPicker/import/upload/autosave/idempotency, AI stream/quota và lifecycle article.
- **Bẫy/UI:** giữ class/thứ tự CSS; write mutex, keyboard reorder, chặn response cũ. Theo wireframe, shadcn/token, không gradient; contrast ≥4.5:1, target ≥44 px; mobile không cuộn ngang, sticky không che nội dung, Sheet/Accordion giữ focus.
- **Copy vi/en chính:** Khóa học/Courses; Tạo khóa học/Create course; Gửi duyệt/Submit for review; Học thử/Preview; Có thay đổi chưa xuất bản/Unpublished changes; Dùng bản nháp này cho bài học/Use this draft for the lesson.

### Xong khi

- [ ] Service/i18n test đủ endpoint/error Author, idempotency/upload key, video và AI handoff dùng chung quota.
- [ ] Workspace test khoảng 5 luồng list/filter/create, state/action và lifecycle; editor khoảng 5 luồng metadata, CRUD/reorder keyboard, video/content, Markdown/import/upload/autosave và submit tree.
- [ ] AI lesson test kiểm restore/stream/cancel/hash/claim và regression AI article.
- [ ] Navigation/App kiểm nhóm Tác giả thu gọn, AUTHOR route, role khác không thấy và article route không đổi.
- [ ] Test service/i18n/workspace/editor/AI/article callers/navigation/App + `npm run build` đạt; kiểm mắt một lượt dark/light × desktop/mobile, ghi “Chưa kiểm” nếu thiếu môi trường.

## Task 2b — Giao diện Moderator duyệt khóa

**Giai đoạn:** Giao diện
**Đổi giao diện:** Có

### Phạm vi

- Route `/moderator/courses`, `/moderator/courses/:id`; detail mặc định chỉ hiện chapter/bài đổi với nhãn “Mới/New”, “Đã sửa/Changed”, “Đã gỡ/Archived” và “Xem tất cả/View all”; giữ history và action review/publication.

### Quy tắc nghiệp vụ và mã lỗi

Client dẫn chiếu Task 1c: review token stale bắt buộc tải lại; không retry mutation tự động; không render/đề cập giá, doanh thu, ngân hàng hoặc hoa hồng.

### Kế hoạch thực thi

- List/detail/test, route/sidebar/i18n; dùng badge/filter/comparison/dialog/BackToTopButton article. Lọc theo `changeStatus`, `UNCHANGED` không gắn nhãn; diff cấu trúc/thứ tự/preview/video/content; khóa action khi pending.
- Khung Moderator: desktop dễ so sánh, mobile working rồi published; contrast ≥4.5:1, dialog có focus/error, action nguy hiểm không chỉ bằng màu.
- Copy chính: Duyệt khóa học/Course moderation; Duyệt khóa/Approve course; Yêu cầu sửa/Request changes; stale dùng đúng câu Task 1c.

### Xong khi

- [ ] List test khoảng 5 luồng chính cho mặc định pending, filter/state, loading/empty/error và không có dữ liệu tiền.
- [ ] Detail test kiểm metadata/tree/content, snapshot, history/token, action; mặc định chỉ bài đổi, ba nhãn vi/en đúng, “Xem tất cả” hiện cả `UNCHANGED`.
- [ ] Stale token/validation/API error map đúng vi/en, không mutation retry tự động; action được khóa khi pending.
- [ ] App/sidebar test route chỉ MODERATOR; ADMIN chỉ vào được khi đồng thời có role MODERATOR.
- [ ] Test hai trang Moderator, sidebar/App, i18n + `npm run build` đạt; kiểm mắt dark/light × desktop/mobile.

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
| Tiếp tục | Overview/My courses mở `continueLesson` backend trả | Tiếp tục học | Continue learning |

### Kế hoạch thực thi

- Public/my-course/lesson pages; curriculum/progress/video, service/types/i18n/routes; dùng Markdown/TOC/Pagination/BackToTop/Reader policy article.
- Iframe chỉ từ provider+ID hợp lệ, có title/sandbox/referrer/allow. Desktop ba cột curriculum — content — TOC; mobile control có nhãn, video 16:9, không nested scroll; reduced motion, focus/landmark/live region, contrast ≥4.5:1.
- Copy chính: Khóa học/Courses; Khóa học của tôi/My courses; Tiếp tục học/Continue learning; Nội dung khóa học/Course content; Mở rộng tất cả/Expand all; Bài trước/Bài tiếp theo.

### Xong khi

- [ ] Service/i18n test public list/detail/preview/start/my courses/completion và lỗi Task 1c.
- [ ] Catalog + overview test khoảng 5 luồng: filter/list, info/accordion/expand, preview, Guest/start, 404.
- [ ] Lesson page test khoảng 5 luồng: search/navigation, collapse, YouTube nocookie, Markdown+TOC, completion toggle/progress và previous/next.
- [ ] Overview/“Khóa học của tôi” test loading/empty/error, progress, CTA “Tiếp tục học”/“Continue learning”, thứ tự access/granted và fallback last lesson còn hiện hành → bài đầu; preview-only không xuất hiện nếu chưa start.
- [ ] App/navigation test Guest public route, authenticated Reader/my courses, return URL; manager account không thấy/không gọi learning API.
- [ ] Kiểm tĩnh iframe không dùng `youtube.com` hay raw `videoUrl`; Public DTO/component không tham chiếu working content hoặc trường tiền.
- [ ] Test service/i18n/public/overview/my courses/lesson/Markdown/App + `npm run build` đạt; kiểm mắt dark/light × desktop/mobile cho bốn trang đổi.

## Quyết định người dùng ngày 2026-11-06

`DELETE completion` idempotent; `lessons.summary` tùy chọn ≤500 và ẩn khi trống; preview không tạo enrollment; owner chỉ preview working, không học khóa mình; khóa chưa từng approve được hard delete; mô tả dài của khóa là Markdown dùng validator chung.

## Rủi ro và điểm yếu còn lại

- YouTube unlisted vẫn lộ ID; snapshot curriculum tăng query/N+1; stable lesson ID khiến sửa lớn không reset completion.
- Khái quát image/content/AI là rủi ro cao nhất; AI tutor chỉ để sẵn ID/version/fingerprint.

## Quyết định của người dùng

- **Spec đã chốt ngày 2026-11-07** sau vòng 1 (không chạy vòng 2), gồm 6 quyết định ngày 2026-11-06 và hai đề xuất làm ngay: “Tiếp tục học”, Moderator lọc bài đổi; thời lượng ước tính tách sau.
- Lịch sử phản biện: [`course-free.review.md`](course-free.review.md).
- Bước tiếp theo: **Task 1a**.
