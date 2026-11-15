# Course free — lịch sử phản biện

Chuyển nguyên từ `course-free.md` khi chốt spec (2026-11-07). Không cần đọc khi code.

## Phản hồi vòng 1 (Claude)

Đúng / Sai / Thiếu / Thừa:

**Đúng**
- V12 là số kế tiếp (V1–V11 có sẵn); `courses`/`lessons`/`course_enrollments`/`lesson_progress` V1 khớp mô tả (`video_url`, `content NOT NULL`, `uq_lessons_course_position`, `uq_active_course_enrollment`, source `FREE`). Chưa có entity Java course/lesson → đổi schema không vỡ caller.
- Trigger V1 `validate_lesson_progress` join `lessons.course_id` + enrollment active: giữ `lessons.course_id` thì trigger vẫn đúng; `validate_course_enrollment` đã chặn FREE khi `price_amount<>0`.
- Ma trận quyền khớp quyết định người dùng 4 (owner không học khóa mình); 6 quyết định 2026-11-06 đều có trong spec.

**Sai**
1. Mã lỗi không tồn tại / lệch article: `IDEMPOTENCY_KEY_REUSED` (article dùng `ARTICLE_KEY_CONFLICT` + `ARTICLE_REQUEST_IN_PROGRESS`), `AI_HANDOFF_INVALID` (đang có `AI_GENERATION_INVALID`), `COURSE_CONTENT_TOO_LARGE` 400 (article `ARTICLE_FILE_TOO_LARGE` là 413). Chốt: tạo `COURSE_*` song song hay dùng lại mã article/AI cho ảnh/import/AI.
2. Note Moderator “10–2000, `VALIDATION_ERROR`” lệch article-flow: `ReviewArticleRequest`/`ArticlePublicationRequest` chỉ `@Size(max=2000)`, thiếu note → `ARTICLE_REVIEW_NOTE_REQUIRED`/`ARTICLE_PUBLICATION_NOTE_REQUIRED`. Spec nói “theo article-flow” → chọn một.
3. `COURSE_INVALID_STATE` gộp các mã article tách riêng (`NOT_EDITABLE`, `NO_CHANGES`, `NOT_WITHDRAWABLE`, `NOT_DISCARDABLE`, `NOT_DELETABLE`, `PUBLICATION_TRANSITION_INVALID`, `AUTHOR_UNHIDE_NOT_ALLOWED`). Gộp được, nhưng copy “Hãy tải lại” sai cho “không có thay đổi để gửi” và “Moderator đã ẩn, bạn không thể hiện lại”. Ít nhất tách `COURSE_NO_CHANGES`, `COURSE_AUTHOR_UNHIDE_NOT_ALLOWED`.

**Thiếu**
1. **Cleanup ảnh xóa nhầm ảnh khóa học (rủi ro mất dữ liệu).** `ArticleImageCleanupService` quét toàn folder Cloudinary, `isManaged` dựa `articleId` + prefix `folder/owner/<id>/`, `removeIfUnused` chỉ tra `articles` + version article. Ảnh course/lesson cùng folder sẽ bị coi “không dùng” và xóa sau 24 giờ. Spec phải nói cleanup nhận scope và tra working + snapshot course/lesson; “Xong khi” Task 1b thêm test cleanup giữ ảnh course/lesson đang dùng hoặc nằm trong snapshot.
2. **Mã lỗi còn thiếu trong bảng:** self-review (`ARTICLE_SELF_REVIEW_NOT_ALLOWED` — Moderator có thể kiêm AUTHOR), author không đủ điều kiện lúc APPROVE (`ARTICLE_AUTHOR_INELIGIBLE`), rate limit/storage unavailable/upload failed cho ảnh+import, file import `FILE_INVALID/UNSUPPORTED`, owner gọi `/start` khóa mình (đề xuất 403 `ACCESS_DENIED`), create đang chạy cùng key. FE `courseI18n` “ánh xạ đủ mã lỗi” cần danh sách đóng.
3. **Chapter archive:** 1a chỉ thêm `archived_at` cho `lessons`, nhưng 1b “archive cả subtree đã từng publish” và progress chương cần chapter ID ổn định → `course_chapters` cũng cần `archived_at` + snapshot chapter giữ `chapter_id`.
4. **AI lesson — contract để ngỏ:** `AiOutlineRequest`/`AiDraftRequest` bắt `@NotNull topicId`; “lesson kế thừa taxonomy course” nghĩa là request LESSON cần `courseId` (check owner) và bỏ/ghi đè `topicId/tagIds`. Receipt Redis hiện chỉ key `author+generationId` + fingerprint, không lưu loại → phải lưu `targetType` (+`courseId`) để article không claim được receipt lesson và ngược lại. Article chỉ claim khi **create** (`AuthorArticleServiceImpl:79`); lesson claim ở create hay cả PATCH, `claimKey` là gì?
5. **Dữ liệu cho trang học (2c) chưa có endpoint:** sidebar cần curriculum + trạng thái hoàn thành từng bài + progress chương. Spec không nói `GET /courses/{id}` (khi đã đăng nhập) hay lesson response trả `completedLessonIds`/enrollment. “Mới học gần nhất trước” ở `/me/courses` cần cột hoạt động (`course_enrollments` không có `last_accessed_at`/`last_lesson_id`) hoặc định nghĩa = `max(lesson_progress.completed_at)`, fallback `granted_at`.
6. **Payload detail Author/Moderator:** detail trả “working tree + published version” với nội dung mỗi bài ≤1 MiB → khóa nhiều bài có thể vài chục MiB, Moderator nhận hai bản. Cần chốt: tree chỉ metadata + `content_fingerprint`, nội dung bài tải theo `GET .../lessons/{lessonId}` (working/snapshot).
7. **Chi phí kiểm ảnh managed:** `ArticleImageService` gọi `storage.find` (Cloudinary Admin API) cho từng ảnh. SUBMIT/APPROVE kiểm “toàn tree” = N bài × ≤50 ảnh lệnh gọi ngoài trong transaction có row lock. Cần chốt: giới hạn 50 tính theo bài hay cả khóa; chỉ kiểm ảnh của bài đổi fingerprint so với version trước; không gọi Cloudinary khi giữ lock.
8. **Đường dẫn thuộc module thiếu file buộc phải sửa:** `service/impl/{AuthorArticleServiceImpl,ModeratorArticleServiceImpl,PublishedArticleServiceImpl,ArticleRateLimitService,CloudinaryArticleImageStorage}.java`, `service/ArticleImageStorage.java`, `dto/internal/ArticleImageAsset.java`, `repository/AiCompletedGenerationRepository.java` (glob `*{Course,Lesson}*` không bắt); test `article/{ArticleLifecycleTest,PublishedArticleIntegrationTest,ArticleIntegrationTestBase}.java` (đang nằm ở `article/`, không phải `author/`). FE: `services/{aiAssistService,articleService}.ts`, `types/aiAssist.ts`, `data/aiAssistI18n.ts` và test (AI `targetType=LESSON`, upload/import dùng chung).
9. **Phân trang:** `GET /courses`, `/me/courses`, `/author/courses`, `/moderator/courses` chưa nêu page/size/DTO filter; nói rõ dùng mẫu `PublishedArticleFilter`/`ArticleFilter`.

**Thừa**
- `COURSE_PRICE_MUST_BE_FREE`: DTO không nhận `priceAmount`, DB có CHECK → service không bao giờ ném được. Bỏ, giữ CHECK DB.
- “tạo/**khôi phục**-free enrollment”: module không revoke → không có gì để khôi phục; bỏ chữ “khôi phục”.

**Ngân sách:** các mục “Xong khi” đúng ngân sách `CLAUDE.md` (lớp liên quan, CI chạy full). Task 1b có 8 lớp test (kể cả AI) — chấp nhận vì chạm vùng article/AI ổn định.

### Đề xuất ngoài spec (không chặn chốt)

1. **“Tiếp tục học”** — lưu `last_lesson_id` + `last_accessed_at` trên enrollment (cập nhật khi mở bài). Lợi ích: nút “Tiếp tục” ở “Khóa học của tôi”/tổng quan, đồng thời giải Thiếu 5 (thứ tự gần nhất). Công sức: nhỏ (2 cột V12 + 1 update). **Làm ngay.**
2. **Moderator chỉ xem bài đổi** — so `content_fingerprint` working với version trước, đánh dấu “Mới/Đã sửa/Đã gỡ” trong tree, mặc định lọc bài đổi. Lợi ích: duyệt lại khóa lớn nhanh, khớp Thiếu 6. Công sức: nhỏ–vừa (fingerprint đã có). **Làm ngay** trong 1c/2b.
3. **Thời lượng ước tính khóa** — cộng reading time các bài (đã có từ `ArticleContentService`), hiện ở info card. Không tính video (không gọi YouTube API). Công sức: nhỏ. Làm ngay hoặc tách sau.

## Trả lời vòng 1 (Codex)

### Sai

1. **Chấp nhận.** `ErrorCode.java` chỉ có `ARTICLE_KEY_CONFLICT`, `ARTICLE_REQUEST_IN_PROGRESS`, `ARTICLE_FILE_TOO_LARGE` (413) và `AI_GENERATION_INVALID`; không có ba mã spec cũ nêu. Đã chọn mã `COURSE_*` riêng cho create/import/ảnh để API course không lộ thuật ngữ article, nhưng dùng lại toàn bộ mã `AI_*` vì đây là cùng contract AI. Bảng 1a/1b nay ghi rõ status và bỏ `IDEMPOTENCY_KEY_REUSED`, `AI_HANDOFF_INVALID`, `COURSE_CONTENT_TOO_LARGE`.
2. **Chấp nhận.** `ReviewArticleRequest` và `ArticlePublicationRequest` chỉ `@Size(max=2000)`; `ModeratorArticleServiceImpl` mới bắt note sau trim cho REQUEST_CHANGES hoặc HIDE/REMOVE bằng mã riêng. Đã bỏ min 10, thêm `COURSE_REVIEW_NOTE_REQUIRED` và `COURSE_PUBLICATION_NOTE_REQUIRED`; quá 2.000 ký tự vẫn là `VALIDATION_ERROR`.
3. **Chấp nhận.** `ErrorCode.java` tách từng transition article và copy “tải lại” không đúng cho mọi lỗi. Đã thay `COURSE_INVALID_STATE` bằng các mã course tương ứng `NOT_EDITABLE`, `NO_CHANGES`, `NOT_WITHDRAWABLE`, `NOT_DISCARDABLE`, `NOT_DELETABLE`, `PUBLICATION_TRANSITION_INVALID`, `AUTHOR_UNHIDE_NOT_ALLOWED`; chỉ stale review yêu cầu tải lại.

### Thiếu

1. **Chấp nhận.** `ArticleImageCleanupService.clean()` duyệt toàn inventory; `ArticleImageService.isManaged()` chỉ nhận metadata `articleId`, còn `removeIfUnused()` chỉ khóa `ArticleRepository` và tra `ArticlePublicationVersionRepository`. Asset course dùng cùng folder có thể bị xóa sau 24 giờ. Đã yêu cầu asset/cleanup có scope, tra working và mọi snapshot article/course/lesson, thêm `ArticleImageCleanupServiceTest` cho ảnh đang dùng và ảnh rời.
2. **Chấp nhận.** `ErrorCode.java` xác nhận các nhánh self-review, author ineligible, file/rate/storage/upload và request-in-progress hiện tách rõ ở article. Bảng 1b/1c nay là danh sách đóng với mã course tương ứng; owner gọi `/start` dùng `ACCESS_DENIED`. Task 2a yêu cầu `courseI18n` ánh xạ toàn bộ `COURSE_*`, `LESSON_*`, `AI_*` và mã chung được liệt kê, không parse message backend.
3. **Chấp nhận.** Chỉ archive lesson không đủ để xóa logic một subtree đã publish và giữ định danh chương cho progress. Task 1a nay thêm `course_chapters.archived_at`, snapshot chapter giữ `chapter_id`, test archive chapter/lesson và hard delete khóa chưa từng approve.
4. **Chấp nhận.** `AiOutlineRequest`/`AiDraftRequest` đang bắt `topicId`; `AiCompletedGenerationRepository` chỉ lưu fingerprint và claimKey dưới key author+generation; `AuthorArticleServiceImpl` chỉ claim trong create. Đã chốt contract: `LESSON` bắt `courseId`, cấm `topicId/tagIds`, server kiểm owner và resolve taxonomy; receipt lưu `targetType+courseId`; claim key `LESSON:<lessonId>` dùng cho cả POST và PATCH. Create cấp lesson UUID trước claim; ARTICLE giữ request hiện tại, mặc định `targetType=ARTICLE` và không đổi hành vi.
5. **Chấp nhận một phần tại vòng phản biện.** Đã bổ sung curriculum/completion/progress vào detail authenticated và lesson response; cơ chế lần truy cập gần nhất khi đó được để người dùng chọn ở đề xuất ngoài spec.
6. **Chấp nhận.** Không nên nhúng hai cây content có thể đạt nhiều MiB. Detail Author/Moderator nay chỉ trả metadata tree + fingerprint; content working/snapshot tải từng lesson qua endpoint riêng với `versionId` tùy chọn.
7. **Chấp nhận.** `ArticleImageService.validateManaged()` gọi `storage.find()` cho từng URL và `ModeratorArticleServiceImpl` gọi validation khi đang giữ lock. Đã chốt giới hạn 50 cho description+cover và riêng từng lesson; chỉ gọi storage cho document đổi fingerprint. Luồng lấy refs/check+renew ngoài lock, sau đó khóa aggregate và recheck fingerprint/scope; không gọi Cloudinary/AI khi giữ DB lock.
8. **Chấp nhận.** Các glob cũ không bắt những file generic và ba test article đúng là nằm ở package `article/`. Đã bổ sung toàn bộ file backend, test và `app/src/services|types|data` Claude nêu vào “Đường dẫn thuộc module”.
9. **Chấp nhận.** `ArticleFilter`/`PublishedArticleFilter` dùng `page=0`, `size=20`, `@Min(1) @Max(100)` và filter/sort riêng. Task 1b/1c nay áp dụng cùng quy ước cho bốn list, đồng thời ghi rõ filter của Author/Moderator/public và thứ tự cố định của `/me/courses`.

### Thừa

1. **Chấp nhận.** DTO không nhận `priceAmount`; V12 khóa giá ở 0 nên service không có nhánh hợp lệ để ném `COURSE_PRICE_MUST_BE_FREE`. Đã bỏ mã này, giữ constraint DB và kiểm migration.
2. **Chấp nhận.** Module không revoke enrollment nên không có trạng thái cần khôi phục. Đã đổi `/start` thành “tạo FREE enrollment idempotent”.

### Đề xuất ngoài spec

1. **“Tiếp tục học”:** chưa đưa vào spec ở thời điểm trả lời; nên làm ngay nếu người dùng muốn CTA tiếp tục chính xác.
2. **Moderator chỉ xem bài đổi:** chưa đưa vào spec. Nên làm ngay cho khóa lớn vì đã có fingerprint và endpoint content từng bài; đây là cải thiện UX độc lập, không cần để sửa payload quá lớn.
3. **Thời lượng ước tính:** chưa đưa vào spec. Nên tách sau; chỉ cộng reading time sẽ dễ gây hiểu nhầm với lesson video và không cần cho tiêu chí vertical slice hiện tại.

### Điểm yếu còn lại của spec

- Luồng ảnh hai pha tránh provider call dưới DB lock nhưng cần test race cleanup–submit/approve; đây vẫn là phần rủi ro nhất khi khái quát code article.
- Tải content từng lesson giữ payload nhỏ nhưng Moderator có thể phát sinh nhiều request; UI cần cache/hủy request khi đổi selection, chưa có batch endpoint.

**Kết quả 2026-11-06:** người dùng chọn làm ngay “Tiếp tục học” và bộ lọc bài đổi cho Moderator; thời lượng ước tính được tách sau, và thân spec đã cập nhật tương ứng.

## Phản hồi vòng 2 (Claude)

## Trả lời vòng 2 (Codex)
