# Article flow

Trạng thái: xem [`PLAN.md`](PLAN.md). Spec do Codex viết; Claude chỉ ghi vào mục “Phản hồi”.

**Mục tiêu:** Hoàn thiện trọn vòng đời bài viết từ bản nháp, gửi duyệt, xuất bản, sửa bài đã công khai, ẩn/khôi phục/gỡ bài đến trải nghiệm đọc và lưu bài; bản đang công khai không bị thay đổi hoặc biến mất chỉ vì tác giả đang soạn bản cập nhật. Chuyển toàn bộ UI bài viết còn lại sang shadcn/ui + Tailwind, sau đó bật preflight và xóa lớp tương thích legacy cuối cùng.
**Làn:** Đầy đủ
**Giai đoạn:** Task 1a → 1b → 1c — Backend; chỉ khi cả ba task Backend đạt “Xong khi” và người dùng duyệt wireframe toàn bộ màn 2a–2d mới mở Task 2a → 2b → 2c → 2d — Giao diện. Mỗi task dùng một session và một lượt Codex review riêng.
**Đổi giao diện:** Có

## Quyết định và phương án đã chốt

- Người dùng chọn phương án **bản công khai + working copy** ngày 2026-11-03: khi sửa bài đã xuất bản, độc giả tiếp tục đọc snapshot đã duyệt gần nhất; chỉ khi Moderator duyệt bản cập nhật thì snapshot mới thay thế bản cũ trên cùng ID/URL.
- Hai phương án không chọn: đưa bài xuống khỏi trang đọc ngay khi sửa (đơn giản nhưng gây gián đoạn), hoặc sửa trực tiếp bản công khai (bỏ qua kiểm duyệt).
- UI được thiết kế như một sản phẩm hoàn chỉnh cho toàn bộ chức năng article-flow trong spec này, không ghép vá từng màn theo từng endpoint. Bố cục để Claude sáng tạo trong token/component/ràng buộc dự án; không dựng nút, số liệu hay placeholder cho chức năng chưa có backend.
- Dữ liệu thật dùng fixture có sẵn trong `server/src/test/resources/seed/`: tạo bài qua UI/API thật, không chèn thẳng bài mẫu vào DB để giả lập luồng kiểm duyệt.
- Cuối module không chạy local full suite bằng `scripts/verify.sh`; chạy một lượt regression gộp đúng phạm vi Article flow cho Backend và Frontend song song, rồi E2E thật. Full backend/frontend do CI chạy khi mở PR.
- “Lưu bài” thuộc module này: mọi tài khoản đã đăng nhập có thể lưu/bỏ lưu bài visible; row lưu được giữ khi bài tạm ẩn và tự xuất hiện lại khi bài visible. Không công khai số lượt lưu.
- Trước khi code Task 2a, Claude phải trình wireframe ASCII/Markdown cho mọi màn 2a–2d và các trạng thái loading/empty/error; chỉ code sau khi người dùng duyệt và quyết định được ghi vào log.

## Đường dẫn thuộc module

Chỉ được sửa/tạo các đường dẫn sau. File mới ghi rõ “tạo”; migration cũ V1–V9 không được sửa.

### Backend và schema

- `server/src/main/resources/db/migration/V10__add_article_publication_versions.sql` (tạo)
- `server/src/main/java/com/techverse/server/entity/Article.java`
- `server/src/main/java/com/techverse/server/entity/ArticleTag.java`
- `server/src/main/java/com/techverse/server/entity/ArticlePublicationVersion.java` (tạo)
- `server/src/main/java/com/techverse/server/entity/ArticlePublicationVersionTag.java` (tạo)
- `server/src/main/java/com/techverse/server/entity/ArticleModerationHistory.java` (tạo)
- `server/src/main/java/com/techverse/server/entity/SavedArticle.java` (tạo)
- `server/src/main/java/com/techverse/server/enums/ArticleStatus.java` (thay bằng hai enum dưới)
- `server/src/main/java/com/techverse/server/enums/ArticleWorkflowStatus.java` (tạo)
- `server/src/main/java/com/techverse/server/enums/ArticlePublicationStatus.java` (tạo)
- `server/src/main/java/com/techverse/server/enums/ArticlePublicationAction.java` (tạo)
- `server/src/main/java/com/techverse/server/enums/ArticleModerationAction.java` (tạo)
- `server/src/main/java/com/techverse/server/enums/ArticleAction.java`
- `server/src/main/java/com/techverse/server/enums/ArticleReviewDecision.java`
- `server/src/main/java/com/techverse/server/enums/PublishedArticleSortBy.java`
- `server/src/main/java/com/techverse/server/controller/AuthorArticleController.java`
- `server/src/main/java/com/techverse/server/controller/ModeratorArticleController.java`
- `server/src/main/java/com/techverse/server/controller/PublishedArticleController.java`
- `server/src/main/java/com/techverse/server/controller/SavedArticleController.java` (tạo)
- `server/src/main/java/com/techverse/server/configuration/SecurityConfiguration.java`
- `server/src/main/java/com/techverse/server/dto/request/ArticleWriteRequest.java`
- `server/src/main/java/com/techverse/server/dto/request/ArticleFilter.java`
- `server/src/main/java/com/techverse/server/dto/request/ModeratorArticleFilter.java`
- `server/src/main/java/com/techverse/server/dto/request/PublishedArticleFilter.java`
- `server/src/main/java/com/techverse/server/dto/request/SavedArticleFilter.java` (tạo)
- `server/src/main/java/com/techverse/server/dto/request/ReviewArticleRequest.java`
- `server/src/main/java/com/techverse/server/dto/request/ArticlePublicationRequest.java` (tạo)
- `server/src/main/java/com/techverse/server/dto/response/ArticleResponse.java`
- `server/src/main/java/com/techverse/server/dto/response/ArticleImportResponse.java`
- `server/src/main/java/com/techverse/server/dto/response/ArticleImageIssueResponse.java` (tạo)
- `server/src/main/java/com/techverse/server/dto/response/ArticleSummaryResponse.java`
- `server/src/main/java/com/techverse/server/dto/response/ArticlePublicationVersionResponse.java` (tạo)
- `server/src/main/java/com/techverse/server/dto/response/ArticleModerationHistoryResponse.java` (tạo)
- `server/src/main/java/com/techverse/server/dto/response/ModeratorArticleSummaryResponse.java`
- `server/src/main/java/com/techverse/server/dto/response/ModeratorArticleDetailResponse.java`
- `server/src/main/java/com/techverse/server/dto/response/PublishedArticleSummaryResponse.java`
- `server/src/main/java/com/techverse/server/dto/response/PublishedArticleDetailResponse.java`
- `server/src/main/java/com/techverse/server/dto/response/RelatedArticleResponse.java`
- `server/src/main/java/com/techverse/server/dto/response/PublishedArticleAuthorResponse.java` (tạo)
- `server/src/main/java/com/techverse/server/dto/response/SavedArticleStateResponse.java` (tạo)
- `server/src/main/java/com/techverse/server/dto/response/SavedArticleSummaryResponse.java` (tạo)
- `server/src/main/java/com/techverse/server/dto/internal/PublishedArticleRow.java`
- `server/src/main/java/com/techverse/server/dto/internal/SavedArticleRow.java` (tạo)
- `server/src/main/java/com/techverse/server/dto/internal/ArticleCreationReceipt.java`
- `server/src/main/java/com/techverse/server/repository/ArticleRepository.java`
- `server/src/main/java/com/techverse/server/repository/ArticleCreationRepository.java`
- `server/src/main/java/com/techverse/server/repository/ArticlePublicationVersionRepository.java` (tạo)
- `server/src/main/java/com/techverse/server/repository/ArticleModerationHistoryRepository.java` (tạo)
- `server/src/main/java/com/techverse/server/repository/PublishedArticleRepository.java`
- `server/src/main/java/com/techverse/server/repository/SavedArticleRepository.java` (tạo)
- `server/src/main/java/com/techverse/server/repository/specification/ArticleSpecification.java`
- `server/src/main/java/com/techverse/server/repository/specification/ModeratorArticleSpecification.java`
- `server/src/main/java/com/techverse/server/repository/specification/PublishedArticleSpecification.java`
- `server/src/main/java/com/techverse/server/service/AuthorArticleService.java`
- `server/src/main/java/com/techverse/server/service/ModeratorArticleService.java`
- `server/src/main/java/com/techverse/server/service/PublishedArticleService.java`
- `server/src/main/java/com/techverse/server/service/SavedArticleService.java` (tạo)
- `server/src/main/java/com/techverse/server/service/impl/AuthorArticleServiceImpl.java`
- `server/src/main/java/com/techverse/server/service/impl/ModeratorArticleServiceImpl.java`
- `server/src/main/java/com/techverse/server/service/impl/PublishedArticleServiceImpl.java`
- `server/src/main/java/com/techverse/server/service/impl/SavedArticleServiceImpl.java` (tạo)
- `server/src/main/java/com/techverse/server/service/impl/ArticleAccessService.java`
- `server/src/main/java/com/techverse/server/service/impl/ArticleContentService.java`
- `server/src/main/java/com/techverse/server/service/impl/ArticleImageService.java`
- `server/src/main/java/com/techverse/server/service/impl/ArticleImageCleanupService.java`
- `server/src/main/java/com/techverse/server/exception/ErrorCode.java`
- `server/src/test/java/com/techverse/server/article/ArticleLifecycleTest.java` (tạo, unit test không Spring)
- `server/src/test/java/com/techverse/server/article/ArticlePublicationMigrationTest.java` (tạo, Testcontainers/Flyway)
- `server/src/test/java/com/techverse/server/author/AuthorArticleIntegrationTest.java`
- `server/src/test/java/com/techverse/server/author/ArticleContentServiceTest.java`
- `server/src/test/java/com/techverse/server/moderator/ModeratorArticleIntegrationTest.java`
- `server/src/test/java/com/techverse/server/article/PublishedArticleIntegrationTest.java`
- `server/src/test/java/com/techverse/server/article/SavedArticleIntegrationTest.java` (tạo)
- `server/src/test/java/com/techverse/server/author/ArticleSeedFixtureTest.java`
- `server/src/test/resources/seed/demo-authors-articles.sql` (xóa)
- `server/src/test/resources/seed/HUONG_DAN.md`
- `docs/technical/db/final.sql`
- `docs/PROJECT_CONTEXT.md`
- `docs/RUNBOOK.md`

### Giao diện

- `app/src/App.tsx`
- `app/src/App.auth.test.tsx`
- `app/src/App.author-session.test.tsx`
- `app/src/types/articles.ts` (tạo)
- `app/src/services/articleService.ts` (tạo)
- `app/src/services/articleService.test.ts` (tạo)
- `app/src/data/articleI18n.ts` và `app/src/data/articleI18n.test.ts` (tạo)
- `app/src/data/managementI18n.ts`
- `app/src/data/navigation.ts`
- `app/src/lib/utils.ts`
- `app/src/pages/Admin/adminErrors.ts` và `app/src/pages/Admin/adminErrors.test.ts`
- `app/src/pages/Author/AuthorBlogsPage.tsx` và `app/src/pages/Author/AuthorBlogsPage.test.tsx`
- `app/src/pages/Author/ArticleEditorPage.tsx` và `app/src/pages/Author/ArticleEditorPage.test.tsx` (tạo)
- `app/src/pages/Moderator/ModeratorDashboardPage.tsx`
- `app/src/pages/Moderator/ModeratorDashboardPage.test.tsx` (tạo)
- `app/src/pages/Moderator/ModeratorArticlesPage.tsx` và `app/src/pages/Moderator/ModeratorArticlesPage.test.tsx`
- `app/src/pages/Moderator/ModeratorArticleDetailPage.tsx` và `app/src/pages/Moderator/ModeratorArticleDetailPage.test.tsx` (tạo)
- `app/src/pages/Moderator/ArticleStats.tsx`
- `app/src/pages/Blogs/BlogsPage.tsx` và `app/src/pages/Blogs/BlogsPage.test.tsx`
- `app/src/pages/Blogs/BlogDetailPage.tsx` và `app/src/pages/Blogs/BlogDetailPage.test.tsx` (tạo; tách khỏi `BlogsPage.tsx`)
- `app/src/pages/Blogs/SavedArticlesPage.tsx` và `app/src/pages/Blogs/SavedArticlesPage.test.tsx` (tạo)
- `app/src/components/articles/ArticleCard.tsx` và `app/src/components/articles/ArticleCard.test.tsx` (tạo)
- `app/src/components/articles/ArticleSaveButton.tsx` và `app/src/components/articles/ArticleSaveButton.test.tsx` (tạo)
- `app/src/components/articles/ArticleStatusBadges.tsx` và `app/src/components/articles/ArticleStatusBadges.test.tsx` (tạo)
- `app/src/components/articles/ArticlePreview.tsx` (tạo)
- `app/src/components/TagPicker.tsx` và `app/src/components/TagPicker.test.tsx` (tạo test)
- `app/src/components/MarkdownContent.tsx` và `app/src/components/MarkdownContent.test.tsx` (tạo test)
- `app/src/components/Pagination.tsx` và `app/src/components/Pagination.test.tsx`
- `app/src/components/layout/Sidebar.tsx` và `app/src/components/layout/Sidebar.test.tsx`
- `app/src/styles.css`
- `app/src/styles/tokens.css` và `app/src/styles/tokens.test.ts`
- `app/src/styles/base.css`, `app/src/styles/layout/shell.css`, `app/src/styles/components/controls.css`, `app/src/styles/components/forms.css`, `app/src/styles/components/content.css`, `app/src/styles/pages/admin.css`, `app/src/styles/pages/blogs.css` (xóa sau khi không còn caller)

### Đầu vào kiểm thật có sẵn — chỉ chạy/đọc, không sửa trong module

- `scripts/dev-seed-admin.sql`
- `server/src/test/resources/seed/articles.json`
- `server/src/test/resources/seed/articles/*.md`

## Bản đồ chi tiết

| Hiện ở đâu | Dùng bởi | Đích sau thay đổi |
|---|---|---|
| `Article.status` trộn `DRAFT/PENDING/PUBLISHED/CHANGES_REQUESTED/HIDDEN/REMOVED`; `Article.isEditable()` chỉ nhận hai trạng thái | Author update/upload, Moderator review, ba specification | `workflowStatus` chỉ mô tả working copy; `publicationStatus` mô tả khả năng đọc snapshot công khai; mọi chuyển trạng thái nằm trong method nghiệp vụ của entity/service |
| Nội dung public đọc trực tiếp từ các cột mutable của `articles` | `PublishedArticleRepository`, list/detail/related/options | Public chỉ join `articles.published_version_id` tới snapshot bất biến; working copy không bao giờ lọt ra API người đọc |
| `AuthorArticleServiceImpl.update()` khóa `PUBLISHED` | Author editor | Cho phép bắt đầu bản cập nhật từ bài công khai; `SAVE/SUBMIT` đổi workflow nhưng giữ snapshot và URL public |
| `ModeratorArticleServiceImpl.review()` chỉ APPROVE/REQUEST_CHANGES | Moderator list/detail | APPROVE tạo version kế tiếp trong cùng transaction; thêm HIDE/RESTORE/REMOVE với stale token và lịch sử bất biến |
| `ArticleImageCleanupService` chỉ xét URL trong working `Article` | Upload/cleanup Cloudinary | Một asset còn được working copy **hoặc bất kỳ publication version nào** tham chiếu thì không được retire/xóa |
| `AuthorBlogsPage.tsx` gộp danh sách và form; `BlogsPage.tsx` gộp list/detail | Routes trong `App.tsx` | Tách dashboard, editor, reader list/detail thành route/page có trách nhiệm riêng; DTO/API gom ở `types/articles.ts` + `articleService.ts` |
| `ModeratorArticlesPage` dùng Sheet đủ cho duyệt nội dung đơn | Moderator | Danh sách giữ chuẩn Admin; chi tiết riêng đủ chiều rộng để so “đang công khai” với “bản đề xuất” và xử lý publication action |
| `saved_articles` đã có FK cascade + unique `(user_id, article_id)` từ V1 nhưng chưa có entity/API/index đọc theo thời gian | Reader list/detail và trang bài đã lưu | V10 thêm index `(user_id, created_at DESC, id DESC)`; Task 1c thêm API idempotent, query visibility + `saved` không N+1; Task 2c/2d dùng chung card/nút lưu |
| Public DTO hiện thiếu version/reading time/saved và author card chỉ có tên/avatar | Reader list/detail/related | Snapshot lưu `readingMinutes`; list/detail/related trả đúng read model đã chốt, detail thêm expertise + bio excerpt và related visible tối đa 5 |
| `MarkdownContent`, `TagPicker`, `Pagination` phụ thuộc class trong `content.css`; Author/Blogs phụ thuộc CSS legacy | Author, Moderator, Reader | Component tự mang utility/token shadcn; xóa CSS legacy và bật preflight sau khi grep không còn caller |

### Cascade/class phải giữ trong lúc chuyển

- Class đang đồng trú trên cùng phần tử: `page-content blogs-page`; `page-content blogs-page blogs-detail-page`; `page-content article-page`; `button button-primary`; `button button-outline`; `article-panel` chứa caller `application-row`; Moderator có utility Tailwind ở ancestor nhưng nội dung con còn `markdown-content`.
- Nhóm class component phải chuyển đồng thời với caller: `tag-picker*`; `markdown-content`, `markdown-table-scroll`, `markdown-code-*`; `pagination*`; `article-*`; `blogs-*`; `application-row`, `applications-actions`, `section-kicker`.
- Thứ tự nạp hiện tại phải được giữ cho tới khi caller cuối đã chuyển: `tokens.css` → `base.css` trong `layer(base)` → `shell.css` → `controls.css` → `forms.css` → `content.css` → `admin.css` → `blogs.css` → block tương thích `[data-slot]/.tw-page` cuối `styles.css`. Sau khi không còn caller: thêm `tailwindcss/preflight.css` vào `layer(base)`, xóa toàn bộ import/block tương thích trên và xóa alias legacy `--bg/--surface/--surface-2/--text/--on-primary`.

## Mô hình trạng thái và phiên bản

### Hai trục trạng thái

| `publicationStatus` | `workflowStatus` | Ý nghĩa và dữ liệu độc giả thấy |
|---|---|---|
| `UNPUBLISHED` | `DRAFT` | Bản mới chưa gửi; không có public snapshot |
| `UNPUBLISHED` | `PENDING` | Chờ xuất bản lần đầu; độc giả chưa thấy |
| `UNPUBLISHED` | `CHANGES_REQUESTED` | Moderator yêu cầu sửa lần đầu; độc giả chưa thấy |
| `PUBLISHED` | `PUBLISHED` | Working copy khớp snapshot đang công khai |
| `PUBLISHED` | `DRAFT` | Bài cũ vẫn công khai; tác giả có bản nháp cập nhật |
| `PUBLISHED` | `PENDING` | Bài cũ vẫn công khai; bản cập nhật đang chờ duyệt |
| `PUBLISHED` | `CHANGES_REQUESTED` | Bài cũ vẫn công khai; bản cập nhật cần sửa |
| `AUTHOR_HIDDEN` | bất kỳ trừ trạng thái terminal | Author tự ẩn snapshot; public trả 404; working copy và hàng đợi duyệt không tự đổi |
| `HIDDEN` | bất kỳ trừ trạng thái terminal | Moderator ẩn; public trả 404; `hiddenFromPublicationStatus` giữ `PUBLISHED` hoặc `AUTHOR_HIDDEN` để RESTORE/APPROVE không làm mất ý định trước đó |
| `AUTHOR_DELETED` | giữ giá trị cuối để audit | Author xóa mềm bài từng công khai; terminal, public và list Author không còn bài, không khôi phục; version/history vẫn giữ |
| `REMOVED` | giữ giá trị cuối để audit | Terminal trong module này: public trả 404, Author chỉ đọc, không save/submit/upload/withdraw/delete, Moderator không review/restore |

### Bảng hành động Author với bài từng công khai

| Hành động | Trạng thái đầu hợp lệ | Trạng thái sau | Public/queue/history |
|---|---|---|---|
| `HIDE` | `PUBLISHED`, có snapshot, workflow chưa terminal | `AUTHOR_HIDDEN`, giữ workflow | Public 404; pending revision nếu có vẫn ở queue; ghi history |
| `UNHIDE` | `AUTHOR_HIDDEN` | `PUBLISHED`, giữ workflow | Hiện lại snapshot ngay nếu tác giả vẫn eligible; không cần Moderator; ghi history |
| Moderator `HIDE` | `PUBLISHED` hoặc `AUTHOR_HIDDEN` | `HIDDEN`, giữ workflow và lưu trạng thái nguồn | Author không thể `UNHIDE`; RESTORE/APPROVE-khi-HIDDEN trở về đúng trạng thái nguồn; ghi history Moderator |
| Author `DELETE` hard | `UNPUBLISHED` + `DRAFT/CHANGES_REQUESTED`, chưa từng có snapshot | Xóa row phụ thuộc theo FK | Receipt create được đánh dấu tombstone tới hết TTL để retry không hồi sinh bài; asset rời do cleanup xử lý |
| Author `DELETE` soft | Có snapshot; publication chưa terminal `AUTHOR_DELETED/REMOVED` | `AUTHOR_DELETED`, giữ working/version/history | Public 404; biến khỏi list Author; pending revision rời queue; không restore; ghi history |
| Author thao tác trên `REMOVED` | Không có | Không đổi | Chỉ đọc; hide/unhide/delete/save/submit/upload/withdraw đều bị từ chối |

### Quy tắc chuyển trạng thái

- Tạo bài luôn `UNPUBLISHED/DRAFT` hoặc `UNPUBLISHED/PENDING` tùy `action`; `SUBMIT` yêu cầu dữ liệu hoàn chỉnh. Hard delete phải tombstone receipt create; retry cùng `Idempotency-Key` sau delete trả `ARTICLE_KEY_CONFLICT`, không tạo lại row.
- Khi đã có snapshot, mọi `SUBMIT` so `contentFingerprint` SHA-256 của working copy với fingerprint snapshot; canonical input gồm `title`, `summary`, `content`, `coverImageUrl`, `topicId` và danh sách `tagIds` đã sắp UUID, mã hóa length-prefix UTF-8 để không nhập nhằng null/rỗng. Giống nhau trả `ARTICLE_NO_CHANGES` ở mọi workflow. `SAVE` không đổi gì trả 200 no-op, giữ nguyên trạng thái; mọi create/save/discard/approve cập nhật fingerprint trong cùng transaction. List tính `hasUnpublishedChanges` bằng so hai cột, không tải content.
- Author chỉ sửa ở workflow `DRAFT`, `CHANGES_REQUESTED`, hoặc bắt đầu sửa từ `PUBLISHED`; không sửa khi `PENDING`. `withdraw` chỉ chuyển `PENDING → DRAFT` và làm review token cũ vô hiệu.
- `discard` chỉ dành cho bài đã có public snapshot ở workflow `DRAFT/CHANGES_REQUESTED`: chép snapshot mới nhất về working copy, đưa workflow về `PUBLISHED`, giữ nguyên `publicationStatus`; muốn bỏ bản `PENDING` phải withdraw trước. Bài chưa từng công khai dùng DELETE thay vì discard.
- APPROVE chỉ nhận `PENDING`, khóa Article và taxonomy, kiểm lại tác giả/ảnh, tạo `versionNumber = max + 1`, ghi snapshot + tag + fingerprint + `readingMinutes`, trỏ `publishedVersionId` mới và đặt `workflowStatus=PUBLISHED`. Lần đầu đặt `publicationStatus=PUBLISHED`; cập nhật khi `AUTHOR_HIDDEN` giữ `AUTHOR_HIDDEN`; khi `HIDDEN` trở về `hiddenFromPublicationStatus`, rồi xóa cột nguồn. `publishedAt` là lần xuất bản đầu; lần cập nhật dùng `approvedAt` của version mới.
- REQUEST_CHANGES chỉ nhận `PENDING`, bắt buộc note, giữ nguyên public snapshot/publication status và chuyển workflow sang `CHANGES_REQUESTED`.
- Moderator HIDE từ `PUBLISHED/AUTHOR_HIDDEN`, bắt buộc lý do và lưu nguồn; RESTORE chỉ từ `HIDDEN` và trở về đúng nguồn; REMOVE từ `PUBLISHED/AUTHOR_HIDDEN/HIDDEN`, bắt buộc lý do và là terminal. RESTORE, APPROVE-khi-HIDDEN hoặc REMOVE-khi-HIDDEN đều xóa nguồn sau khi xác định trạng thái đích. V10 có CHECK: `HIDDEN` bắt buộc nguồn thuộc `PUBLISHED/AUTHOR_HIDDEN`, trạng thái khác bắt buộc nguồn null.
- Snapshot version bất biến về nội dung và các ID taxonomy. Tên topic/tag được resolve theo taxonomy hiện tại; Admin đổi tên thì version cũ hiển thị tên mới, không sao chép label vào snapshot.
- Mọi review/publication/Author hide-unhide-delete action ghi `ArticleModerationHistory` append-only gồm actor, thời điểm, action, note, trạng thái trước/sau và version liên quan; Author chỉ đọc lịch sử bài mình còn truy cập được, Moderator đọc lịch sử mọi bài không phải private draft.
- Review/publication token là fingerprint 64 ký tự của working copy + hai trạng thái + `publishedVersionId` + audit gần nhất; thao tác từ tab cũ trả 409, không thay đổi DB.
- Public visibility là điều kiện suy ra: snapshot chỉ visible khi `publicationStatus=PUBLISHED`, account tác giả active và `AuthorProfile` không `SUSPENDED`. Khóa/đình chỉ không đổi status/history; khôi phục tác giả làm bài tự hiện lại. Điều kiện phải nằm trong query/join/`EXISTS`, không gọi repository theo từng bài.
- `AUTHOR_DELETED` không xuất hiện trong Moderator queue dù workflow còn `PENDING`; Moderator được đọc detail/history phục vụ audit nhưng review/HIDE/RESTORE/REMOVE đều trả 409, không đổi dữ liệu.

## Phạm vi

### Task 1a — Backend nền tảng + Author API

- Migration V10 tạo publication version/tag/history, hai trục trạng thái + con trỏ version, constraint/index/FK; fail sớm với thông báo rõ nếu bảng `articles` đã có dữ liệu. Không sửa V1–V9, không backfill DB dev cũ; `RUNBOOK.md` ghi reset schema và Redis theo D-022.
- Hoàn thiện entity/state machine và Author create/import/options/list/detail/save/submit/upload; thêm sửa bài đã công khai, withdraw, discard, history, Author HIDE/UNHIDE và DELETE hard/soft. Hard delete tombstone receipt để retry create không hồi sinh bài.
- `SAVE` cho working content chứa ảnh Markdown chưa managed và trả `imageIssues`; `SUBMIT` bắt buộc dữ liệu/ảnh hoàn chỉnh. Cover luôn null hoặc managed; mỗi issue có `source`, `occurrence` một-based để thay đúng ảnh, line/column chỉ để hiển thị.
- CORS cho phép PUT/DELETE ngay từ Task 1a để Author DELETE dùng được từ browser và chuẩn bị Task 1c; không nới security matcher endpoint chưa tồn tại.

### Task 1b — Moderator + Public + cleanup + fixture

- Hoàn thiện Moderator filter/detail/review, so working với public snapshot, HIDE/RESTORE/REMOVE, history và badge eligibility; giữ self-review, taxonomy lock, stale token, lock order và kiểm lại ảnh/tác giả khi APPROVE.
- Public giữ `isAuthenticated()`. List nhận keyword/topicId/tagId, `sort=NEWEST/OLDEST`, page/size; summary trả id/title/summary/cover/topic/tags/author id-name-avatar, `publishedAt`, `approvedAt`, `versionNumber`, `readingMinutes`. Detail thêm content, author card công khai (`name/avatar/expertise/bioExcerpt`, không email), related ngay trong response. `readingMinutes = max(1, ceil(wordCount/200))`, tính từ text/code literal của Markdown một lần khi APPROVE và lưu trên version.
- Related lấy bài visible cùng topic **hoặc** chung tag, loại chính nó, sắp `publishedAt DESC, id ASC`, tối đa 5; trả id/title/cover/publishedAt/saved. Public list/detail/options/related dùng latest approved snapshot đủ điều kiện publication + account + AuthorProfile, stable ID/URL và không N+1.
- Cleanup giữ asset còn được working copy hoặc bất kỳ publication version nào tham chiếu. Xóa `demo-authors-articles.sql`; giữ `articles.json` + Markdown làm fixture import, cập nhật `HUONG_DAN.md` để tạo bài qua API/UI.

### Task 1c — Backend lưu bài

- Map bảng `saved_articles` có sẵn; V10 chỉ thêm index đọc `(user_id, created_at DESC, id DESC)`. Mọi role đã đăng nhập có thể lưu/bỏ lưu; không expose tổng lượt lưu.
- Thêm PUT/DELETE idempotent và danh sách bài đã lưu phân trang. PUT chỉ lưu article đang visible; DELETE luôn xóa row của actor nếu có và trả `saved=false`, kể cả article vừa bị ẩn hoặc row không tồn tại.
- Saved list lọc cùng visibility public, keyword, mới lưu trước; row của bài tạm ẩn/soft-delete/tác giả suspended được giữ nhưng không trả về, và tự hiện lại khi bài visible. Hard delete chưa từng public không thể được lưu; FK cascade giữ nguyên.
- Public list/detail/related thêm `saved` của actor bằng join/`EXISTS` trong query; không gọi repository từng article và không làm tăng query-count theo số dòng.
- Security cho phép authenticated GET `/api/v1/me/saved-articles` và PUT/DELETE `/api/v1/articles/{id}/saved`; không nới endpoint khác.

### Cổng UI trước Task 2a — bắt buộc

- Claude vẽ wireframe ASCII/Markdown cho workspace, editor desktop/mobile, Moderator list/detail, Reader list/detail và Bài đã lưu, gồm loading/empty/error. Người dùng duyệt, Claude ghi quyết định vào log; trước đó không code Task 2a–2d.
- Wireframe chỉ chốt bố cục trong contract/spec đã duyệt, không tự thêm endpoint/chức năng. Sau cổng này, mỗi task UI vẫn có Codex review, kiểm mắt và người dùng nhận kết quả theo quy trình; không mở vòng phản biện spec riêng cho từng task.

### Task 2a — Author workspace + editor

- `/author/blogs` là workspace tổng quan: số liệu thật, filter/search, hai badge trạng thái, action matrix đầy đủ gồm hide/unhide/delete hard/soft và entry rõ tới tạo/sửa/xem live; không hiện action backend từ chối.
- `/author/blogs/new` và `/author/blogs/:id/edit` là editor riêng. Desktop có source Markdown/text/import trái + preview bài thật phải; mobile dùng tab “Soạn thảo/Xem trước”. Metadata, toolbar và panel ảnh để Claude bố trí theo UI Guide mà không làm vùng viết chật.
- Editor hỗ trợ title/topic/tối đa 10 tag/summary/cover, import, upload, save/submit/withdraw/discard/delete. `imageIssues` hiện callout “N ảnh cần tải lên” và từng dòng alt/source/line-column với “Tải ảnh thay thế” hoặc “Bỏ ảnh”; client thay theo `source + occurrence`, nếu target không còn khớp thì không sửa nhầm và yêu cầu save/reload issue. Bài mới: upload đầu tiên tự POST `action=SAVE` bằng `Idempotency-Key` khi title/topic hợp lệ rồi upload; nếu chưa đủ thì khóa nút với hướng dẫn “Nhập tiêu đề, chủ đề và lưu nháp trước”. Chọn nhiều file tự ghép theo filename; lỗi 429, quá 50 ảnh hoặc file >5 MiB nằm ngay dòng tương ứng. Preview dùng placeholder và tuyệt đối không request URL ngoài; khóa Submit tới khi hết issue. Mobile đặt panel trong Sheet/tab. Dirty navigation dùng `beforeunload` và `AlertDialog` cho link/nút do editor kiểm soát, không đổi `BrowserRouter`.
- Preview editor dùng cùng typography/composition Reader nhưng ẩn thời gian đọc vì `readingMinutes` chỉ được backend tính và lưu lúc APPROVE; client không tự ước lượng.

### Task 2b — Moderator UI

- Giữ chuẩn Admin ở dashboard/list; list điều hướng tới route detail riêng `/moderator/articles/:id`, bỏ Sheet detail cũ. Trang detail đủ rộng để so working với snapshot, đánh dấu trường đổi và xử lý review/HIDE/RESTORE/REMOVE bằng `AlertDialog`.
- Hiện eligibility của tác giả. Dialog duyệt chỉ hiện “Lần trước trả về: <note>” khi có REQUEST_CHANGES sau lần APPROVE gần nhất; withdraw/gửi lại giữ note, vòng mới sau APPROVE không hiện note cũ.

### Task 2c — Reader + preflight + CSS legacy

- `/blogs`: header kicker/H1/mô tả; filter card gồm search, chip topic nhanh, tag, NEWEST/OLDEST và chip tổng bài; grid 3/2/1 cột. Card dùng cover 16:10 hoặc fallback tone/icon topic, meta topic + ngày tương đối, title/summary hai dòng, tối đa 3 tag + “+N”, reading time, nút lưu, “Đọc tiếp”, hàng tác giả. Phân trang số; skeleton 6 card; empty có “Xóa bộ lọc”; error có retry.
- URL `/blogs?keyword=&topicId=&tagId=&sort=&page=` là nguồn sự thật của filter/paging: trim và bỏ param mặc định/rỗng; keyword chỉ commit khi submit/Enter hoặc clear; đổi keyword/topic/tag/sort reset page về 0, đổi trang ghi page; mỗi thao tác đã commit push một history entry, mount và Back/Forward parse lại URL. Link từ card/“Đọc tiếp” truyền `location.pathname + search` qua router state; nút về danh sách trong detail dùng state hợp lệ, nếu mở trực tiếp thì fallback `/blogs`; related “Xem tất cả” đi thẳng `/blogs?topicId=<uuid>`.
- `/blogs/:id`: breadcrumb; content khoảng 880 px + sidebar sticky 280 px có cuộn riêng. Nội dung gồm cover, topic, H1, author/date/updated khi version >1/reading time/save, summary viền nhấn, tag, Markdown, copy-link và về đầu trang; Markdown có anchor H2/H3 + copy link, code label + Copy, bảng cuộn trong khung, ảnh lazy. Sidebar gồm author card, mục lục H2/H3 đánh dấu mục đang đọc, related + link `/blogs?topicId=`. Mobile thu gọn mục lục đầu bài và đưa sidebar xuống dưới. 404 dùng câu “Bài viết không tồn tại hoặc đã bị ẩn” + về danh sách.
- Heading H2/H3 và mục lục dùng cùng một hàm slug thuần, không thêm package: NFD → bỏ combining mark, `đ/Đ → d`, lowercase, chuỗi không `[a-z0-9]` thành một `-`, trim `-`, rỗng dùng `section`; trùng theo thứ tự tài liệu thêm `-2`, `-3`. Anchor và TOC dùng cùng kết quả; copy link dùng URL hiện tại + `#slug`.
- Nút lưu trên card/detail có `aria-pressed`, nhãn vi/en, touch ≥44 px và state machine theo từng article: tối đa một request đang bay; click tiếp chỉ cập nhật optimistic `desiredSaved`; mỗi success cập nhật `confirmedSaved`, rồi gửi tiếp nếu confirmed khác ý định cuối. Nếu request lỗi, dừng chuỗi, rollback desired về `confirmedSaved` của lần success gần nhất và báo lỗi tại chỗ. Không có lượt xem/like/comment/share mạng xã hội; chỉ “Sao chép liên kết”.
- Mọi màn có loading/empty/error/retry, vi/en, responsive và dữ liệu thật. Chuyển `TagPicker`, `MarkdownContent`, `Pagination` sang shadcn/Tailwind/token; khi không còn caller legacy mới bật preflight, xóa CSS/alias/block tương thích và kiểm tĩnh trang ngoài module.

### Task 2d — UI Bài đã lưu

- Khai báo route tĩnh `/blogs/saved` trước `/blogs/:id`; thêm entry “Bài đã lưu” chỉ trong sidebar người dùng dưới “Bài viết” và link từ header `/blogs`. Admin/Moderator vẫn dùng được API và vào trang qua header `/blogs`, không thêm entry vào sidebar quản trị.
- Trang có header, chip tổng, search và dùng chung `ArticleCard`/grid với `/blogs`. Bỏ lưu biến card thành dòng “Đã bỏ lưu · Hoàn tác” tại chỗ tới khi rời trang; Undo cập nhật `desiredSaved` trong cùng state machine tuần tự, lỗi hoàn tác và hiển thị tại dòng, không toast.
- Empty có icon tim, “Chưa có bài đã lưu” và nút “Khám phá bài viết”; có skeleton/error/retry, vi/en, responsive, keyboard và touch target ≥44 px.

## Quy tắc nghiệp vụ và mã lỗi

### Contract endpoint và dữ liệu trả về

| Endpoint | Contract sau thay đổi |
|---|---|
| `POST /api/v1/author/articles` | Giữ 201 + `Idempotency-Key`; tạo working copy với `action=SAVE/SUBMIT`. Response có `workflowStatus`, `publicationStatus`, `hasUnpublishedChanges`, `publishedVersion` nullable và `imageIssues`. Retry một key của bài đã hard delete trả conflict, không tạo lại. |
| `POST /api/v1/author/articles/import` | Giữ import không lưu; response thêm `imageIssues[]` do backend phân tích từ Markdown. |
| `GET /api/v1/author/articles` | Giữ phân trang/ownership; filter dùng `workflowStatus` và `publicationStatus` riêng, ngoài keyword/topic/tag/sort hiện có; không trả content và không liệt kê `AUTHOR_DELETED`. |
| `GET /api/v1/author/articles/{id}` | Trả working fields, hai status, moderation note, `imageIssues` và `publishedVersion` đầy đủ nếu đã từng công khai để editor xem/so. |
| `PATCH /api/v1/author/articles/{id}` | Giữ partial merge + `SAVE/SUBMIT`; cho phép bắt đầu revision từ workflow `PUBLISHED`, không cho ghi khi `PENDING/REMOVED/AUTHOR_DELETED`; SAVE response trả `imageIssues`. |
| `POST /api/v1/author/articles/{id}/withdraw` | 200 envelope; `PENDING → DRAFT`, public snapshot không đổi. |
| `POST /api/v1/author/articles/{id}/discard` | 200 envelope; khôi phục working copy từ `publishedVersion`, workflow về `PUBLISHED`, publication giữ nguyên. |
| `PATCH /api/v1/author/articles/{id}/publication` | Body `action=HIDE/UNHIDE`; HIDE đặt `AUTHOR_HIDDEN`, UNHIDE chỉ nhận `AUTHOR_HIDDEN` và đặt `PUBLISHED`; 200 trả detail mới. |
| `DELETE /api/v1/author/articles/{id}` | Endpoint mới, 200 `ApiResponse<Void>`: hard delete nếu chưa từng có snapshot; soft delete terminal `AUTHOR_DELETED` nếu từng công khai; `REMOVED` bị từ chối. |
| `GET /api/v1/author/articles/{id}/history` | Page lịch sử mới nhất trước; chỉ owner, page/size chuẩn. |
| `GET /api/v1/moderator/articles` | Giữ list không lộ content; filter `workflowStatus`/`publicationStatus`, keyword/author/topic/tag/date/sort. Private `UNPUBLISHED/DRAFT` và mọi `AUTHOR_DELETED` không xuất hiện. |
| `GET /api/v1/moderator/articles/{id}` | Trả working article, `publishedVersion` nullable, hai status, history summary, token snapshot và `authorEligible`; `AUTHOR_DELETED` vẫn đọc audit nhưng không có action hợp lệ. |
| `PATCH /api/v1/moderator/articles/{id}/review` | Giữ APPROVE/REQUEST_CHANGES; APPROVE ghi immutable version trong cùng transaction, có thể publish lần đầu/cập nhật/khắc phục hidden; khi hidden trở về `hiddenFromPublicationStatus`. |
| `PATCH /api/v1/moderator/articles/{id}/publication` | Body `action=HIDE/RESTORE/REMOVE`, `reviewToken`, `moderationNote`; RESTORE về trạng thái trước HIDE; trả detail mới và token mới. |
| `GET /api/v1/moderator/articles/{id}/history` | Page lịch sử đầy đủ cho Moderator; draft riêng chưa submit trả 404. |
| `GET /api/v1/articles` | Auth giữ nguyên. Query: `keyword` ≤255, `topicId`, `tagId`, `sort=NEWEST/OLDEST` mặc định NEWEST, page ≥0, size 1–100. Summary gồm id/title/summary/cover, topic `{id,name}`, tags, author `{id,name,avatar}`, `publishedAt`, `approvedAt`, `versionNumber`, `readingMinutes`, `saved`; chỉ snapshot visible. |
| `GET /api/v1/articles/{id}` | Summary fields + content, author `{id,name,avatar,expertise,bioExcerpt}` không email, `relatedArticles` tối đa 5 và `saved`; không visible trả 404, không trả status/history/working fields. |
| `GET /api/v1/articles/options` | Topic/tag chỉ từ bài visible theo cùng eligibility; giữ paging keyword độc lập hiện có. |
| `PUT /api/v1/articles/{id}/saved` | Auth mọi role; article phải visible. Idempotent 200 `ApiResponse<{saved:true}>`; concurrent unique conflict được đọc lại thành success, không 500. |
| `DELETE /api/v1/articles/{id}/saved` | Auth mọi role; idempotent 200 `ApiResponse<{saved:false}>`; xóa row của actor nếu có kể cả article hiện không visible/đã cascade, không tiết lộ trạng thái article. |
| `GET /api/v1/me/saved-articles` | Auth mọi role; query `keyword` ≤255, page ≥0, size 1–100; chỉ bài visible, `savedAt DESC, id DESC`; item là public summary + `savedAt` và `saved=true`. |

`ArticlePublicationVersionResponse` là snapshot bất biến gồm version number, title, summary, content, cover, topic/tag IDs được resolve tên hiện tại, approver, approved time, `contentFingerprint` và `readingMinutes`. `hasUnpublishedChanges=true` khi hai fingerprint khác nhau; client không so content. `ArticleImageIssueResponse` gồm loại lỗi, alt, source gốc, `occurrence` một-based, line/column chỉ để hiển thị và filename gợi ý; import/detail/save cùng dùng một shape. `bioExcerpt` trim từ bio AuthorProfile, tối đa 300 Unicode code point và không cắt giữa surrogate pair.

### API và validation

| API/trường | Ràng buộc backend; validation client phải dẫn chiếu cùng rule | HTTP/mã lỗi và câu hiển thị chính |
|---|---|---|
| `POST/PATCH /author/articles`, `title` | Create bắt buộc; trim; 1–255 ký tự. PATCH chỉ gửi trường dirty | 400 `VALIDATION_ERROR`: “Kiểm tra lại các trường được đánh dấu.” / “Check the highlighted fields.” |
| `topicId` | Bắt buộc; phải tồn tại; topic mới chọn phải active | 404 `TOPIC_NOT_FOUND`: “Không tìm thấy chủ đề.” / “Topic not found.”; 409 `ARTICLE_ASSOCIATION_INACTIVE`: “Chủ đề hoặc thẻ không còn hoạt động.” / “The topic or a tag is inactive.” |
| `tagIds` | 0–10 UUID, không null/trùng; tag mới chọn phải active | 400 `VALIDATION_ERROR`; 404 `TAG_NOT_FOUND` với copy tương ứng |
| `summary` | Save cho phép rỗng, tối đa 500; submit bắt buộc nonblank | 400 `VALIDATION_ERROR` |
| `content` | SAVE cho phép rỗng và cho URL ảnh ngoài/relative tồn tại trong working copy; SUBMIT bắt buộc nonblank và mọi ảnh phải là Cloudinary managed đúng owner/article. Mọi action: UTF-8 ≤1 MiB, cấm NUL/raw HTML/link nguy hiểm | 400 `ARTICLE_CONTENT_INVALID`: “Nội dung chứa HTML hoặc liên kết không được hỗ trợ.” / “Content contains unsupported HTML or links.”; 400 `ARTICLE_IMAGE_INVALID`: “Còn ảnh cần tải lên trước khi gửi duyệt.” / “Upload all images before submitting.”; 413 `ARTICLE_FILE_TOO_LARGE` |
| `coverImageUrl` | Ở cả SAVE/SUBMIT chỉ null hoặc asset HTTPS Cloudinary managed đúng owner/article; UI không cho dán URL. Tổng cover + ảnh Markdown ≤50; APPROVE kiểm lại ownership/asset tồn tại | 400 `ARTICLE_IMAGE_INVALID`: “Ảnh không hợp lệ hoặc không thuộc bài viết này.” / “The image is invalid or does not belong to this article.” |
| `imageIssues` | Backend phân tích ảnh Markdown chưa managed cho import/detail/save; mỗi issue có alt, source, occurrence, line/column và filename. Không tải URL nguồn để kiểm/preview | Không phải lỗi khi SAVE; SUBMIT/APPROVE còn issue chỉ trả 400 `ARTICLE_IMAGE_INVALID` theo shape `ErrorResponse`; client reload detail để lấy danh sách mới |
| `Idempotency-Key` | UUID bắt buộc cho create; retry cùng payload dùng cùng key trong 24 giờ. Hard delete đánh dấu receipt tombstone đến hết TTL | 409 `ARTICLE_KEY_CONFLICT`: “Khóa thao tác đã được dùng hoặc bài tương ứng đã bị xóa.” / “This request key was used or its article was deleted.”; `ARTICLE_REQUEST_IN_PROGRESS`: “Bài đang được tạo, hãy thử lại với cùng khóa.” / “Creation is in progress; retry with the same key.” |
| Import | `.md`/`.txt`, UTF-8, không rỗng/binary, tối đa 1 MiB; import chỉ điền content, chưa lưu và trả `imageIssues` | 400 `ARTICLE_FILE_INVALID`; 413 `ARTICLE_FILE_TOO_LARGE`; 415 `ARTICLE_FILE_UNSUPPORTED`, copy nêu đúng định dạng |
| Upload ảnh | JPEG/PNG/WebP tĩnh, nguồn 1 byte–5 MiB; mỗi chiều 1–8192 px; tối đa 16.000.000 pixel; PNG đã chuẩn hóa tối đa 20 MiB; `Upload-Key` UUID retry-safe. Bài mới phải auto-SAVE thành công để có ID trước upload | 400 `ARTICLE_IMAGE_INVALID`; 413 `ARTICLE_FILE_TOO_LARGE`; 415 `ARTICLE_FILE_UNSUPPORTED`; 429 `ARTICLE_RATE_LIMITED`: “Thao tác quá nhanh, hãy thử lại sau.” / “Too many article operations; try again later.”; 502 `ARTICLE_IMAGE_UPLOAD_FAILED`; 503 `ARTICLE_STORAGE_UNAVAILABLE` |
| `action=SAVE/SUBMIT` | `SUBMIT` kiểm toàn object sau merge; nếu có snapshot thì phải khác snapshot ở title/summary/content/cover/topic/tập tag. SAVE giống hệt trả 200 no-op, giữ state | 409 `ARTICLE_NO_CHANGES`: “Chưa có thay đổi để gửi duyệt.” / “There are no changes to submit.”; 409 `ARTICLE_NOT_EDITABLE`: “Trạng thái hiện tại không cho phép sửa bài.” / “The current state does not allow editing.” |
| `POST /{id}/withdraw` | Owner active/approved Author; chỉ workflow `PENDING`; publication giữ nguyên | 409 `ARTICLE_NOT_WITHDRAWABLE`: “Chỉ bản đang chờ duyệt mới có thể rút lại.” / “Only a pending revision can be withdrawn.” |
| `POST /{id}/discard` | Owner active/approved Author; phải có snapshot; chỉ workflow `DRAFT/CHANGES_REQUESTED`; khôi phục toàn bộ metadata/content/tag/cover từ snapshot | 409 `ARTICLE_NOT_DISCARDABLE`: “Không có bản chỉnh sửa phù hợp để hủy.” / “There is no editable revision to discard.” |
| Author `HIDE` | Owner active/approved; có snapshot; publication `PUBLISHED`; giữ workflow | 409 `ARTICLE_PUBLICATION_TRANSITION_INVALID`: “Bài không ở trạng thái có thể ẩn.” / “The article cannot be hidden in its current state.” |
| Author `UNHIDE` | Owner active/approved; chỉ `AUTHOR_HIDDEN`; không áp dụng cho Moderator `HIDDEN` | Nếu `HIDDEN`: 409 `ARTICLE_AUTHOR_UNHIDE_NOT_ALLOWED`: “Bài do kiểm duyệt viên ẩn nên bạn không thể tự hiện lại.” / “A moderator hid this article, so you cannot unhide it.”; trạng thái khác dùng `ARTICLE_PUBLICATION_TRANSITION_INVALID` |
| Author `DELETE` | Authenticated owner, kể cả AuthorProfile `SUSPENDED`; account bị khóa không gọi được API. Hard delete khi chưa có snapshot và `UNPUBLISHED + DRAFT/CHANGES_REQUESTED`; soft delete khi có snapshot và chưa terminal; `REMOVED` chỉ đọc. Soft delete hủy pending khỏi queue | 409 `ARTICLE_NOT_DELETABLE`: “Trạng thái hiện tại không cho phép xóa bài.” / “The article cannot be deleted in its current state.”; bài đã soft delete không lộ qua Author API và trả 404 `ARTICLE_NOT_FOUND` |
| Review | `decision` APPROVE/REQUEST_CHANGES; `reviewToken` `[a-f0-9]{64}`; note trim, tối đa 2000, bắt buộc với REQUEST_CHANGES | 409 `ARTICLE_NOT_PENDING`; 409 `ARTICLE_REVIEW_STALE`; 400 `ARTICLE_REVIEW_NOTE_REQUIRED`; 403 `ARTICLE_SELF_REVIEW_NOT_ALLOWED`; 409 `ARTICLE_AUTHOR_INELIGIBLE`; dùng copy vi/en hiện có trong `adminErrors`/`articleI18n` |
| Moderator publication action | `HIDE/RESTORE/REMOVE`; HIDE nhận cả `PUBLISHED/AUTHOR_HIDDEN`; token 64 ký tự; note ≤2000, bắt buộc HIDE/REMOVE | 409 `ARTICLE_PUBLICATION_TRANSITION_INVALID`: “Trạng thái xuất bản đã thay đổi, hãy tải lại.” / “The publication state changed; reload.”; 400 `ARTICLE_PUBLICATION_NOTE_REQUIRED`: “Cần nhập lý do ẩn hoặc gỡ bài.” / “A reason is required to hide or remove an article.”; stale dùng `ARTICLE_REVIEW_STALE` |
| Moderator trên `AUTHOR_DELETED` | Detail/history chỉ đọc; list queue loại tường minh; review/HIDE/RESTORE/REMOVE không hợp lệ dù workflow còn `PENDING` | 409 `ARTICLE_PUBLICATION_TRANSITION_INVALID`: “Bài đã bị tác giả xóa và chỉ còn để đối soát.” / “The author deleted this article; it is available for audit only.” |
| PUT save article | Actor active; article phải visible theo cùng public predicate; mọi role auth được lưu cả bài của mình; retry/concurrent cùng cặp là success | 404 `ARTICLE_NOT_FOUND`: “Bài viết không tồn tại hoặc đã bị ẩn.” / “The article does not exist or is hidden.”; auth/inactive dùng mã chung hiện có |
| DELETE saved article | Actor active; xóa theo `(userId, articleId)`; row không có hoặc article không visible vẫn 200 để idempotent và cho phép rút lưu | 200 `{saved:false}`; chỉ lỗi auth/inactive hoặc 5xx chung, không có `SAVED_ARTICLE_NOT_FOUND` |
| Saved list | `keyword` trim ≤255; page ≥0; size 1–100; sort cố định `savedAt DESC, id DESC`; chỉ visible | 400 `VALIDATION_ERROR`: “Kiểm tra lại bộ lọc bài đã lưu.” / “Check the saved-article filters.” |
| List/history | `keyword` ≤255; option keyword ≤100; page ≥0; size 1–100; status enum hợp lệ; `createdFrom ≤ createdTo`; history phân trang, mới nhất trước | 400 `VALIDATION_ERROR`; enum/query malformed dùng 400, không trả 500 |
| Ownership/visibility | Owner mismatch và public snapshot không visible đều trả 404. Public visible còn yêu cầu account tác giả active và profile không `SUSPENDED`; điều kiện suy ra không đổi status/history. Suspended Author đọc bài mình nhưng không ghi | 404 `ARTICLE_NOT_FOUND`: “Không tìm thấy bài viết.” / “Article not found.”; 403 `ACCESS_DENIED`: “Bạn không có quyền thực hiện thao tác này.” / “You do not have permission to do this.” |

Các lỗi 5xx hoặc code chưa biết dùng câu hệ thống chung, không hiển thị nguyên văn message tiếng Anh của backend. Logic `mã lỗi × ngôn ngữ` là hàm thuần và test unit, không dựng ma trận này bằng render cả `App`.

### Màu và tương phản

Không thêm màu mới; chỉ dùng token đã đo từ `tokens.css` bằng `npx vitest run src/styles/tokens.test.ts --reporter=verbose` ngày 2026-11-03:

- Chữ chính/nền: dark 16.30:1, light 17.74:1; chữ card/card: 13.35:1 và 16.98:1.
- Chữ phụ trên nền muted (cặp thấp nhất): dark 4.94:1, light 6.87:1.
- Nút primary: 6.44:1 ở cả hai theme; destructive: 6.47:1.
- Badge status/topic/tag dùng tám tone hiện có; mức thấp nhất dark 5.80:1, light 4.79:1.
- Focus ring/nền: dark 8.33:1, light 6.44:1. Mọi cặp chữ/nền phải tiếp tục ≥4.5:1 trong `tokens.test.ts`.

## Ngoài phạm vi

- Đọc bài không cần đăng nhập; thay đổi chính sách auth hiện tại.
- Like, view count, comment, follow tác giả, notification, toast, analytics; không dựng UI giả để “chừa chỗ”.
- Autosave nền, cộng tác nhiều người, WYSIWYG/rich-text editor, diff từng ký tự, rollback một version cũ, lịch xuất bản hoặc SEO slug cho URL bài (khác anchor slug H2/H3 trong Task 2c).
- Admin quản trị nội dung thay Moderator; khôi phục bài `REMOVED` trong module này.
- Backfill dữ liệu DB dev cũ. Theo D-022 phải làm mới DB để Flyway chạy từ V1; fixture test/demo được cập nhật cho schema mới.
- Sao chép pixel, logo, nội dung, ảnh hoặc code của `javabuilder.online`; thêm UI library/editor package thứ hai.
- Xóa vĩnh viễn snapshot/nội dung/ảnh Cloudinary theo yêu cầu tác giả; `AUTHOR_DELETED` trong module này vẫn giữ version/history/asset để audit.

## Ràng buộc

- Được đổi API: **Có**. Được đổi DB: **Có**, chỉ bằng V10 mới; `ApiResponse<T>`/`ErrorResponse` và prefix `/api/v1` giữ nguyên.
- Task 1a, 1b rồi 1c phải hoàn tất và qua review trước cổng wireframe; người dùng duyệt wireframe mọi màn 2a–2d rồi mới code 2a. Nếu UI phát hiện thiếu dữ liệu/endpoint thì quay lại task Backend tương ứng trong spec, không sửa backend xen kẽ.
- Stable article ID/URL; public API không bao giờ trả working copy. Snapshot/version/history bất biến sau commit; mọi approve/publication action là một transaction có pessimistic lock và stale token.
- Giữ giới hạn/import/upload/idempotency/rate-limit và lock order hiện có. Không làm cleanup mất asset còn được working copy hoặc version lịch sử tham chiếu.
- Kiểm ảnh Cloudinary thật cần đủ `CLOUDINARY_*` trong `.env`; nếu môi trường thiếu thì ghi rõ “Chưa kiểm” cho phần ảnh, không suy ra đạt từ mock.
- Giao diện bám [`docs/design/UI_GUIDE.md`](../docs/design/UI_GUIDE.md) và mẫu [`javabuilder-patterns.md`](../docs/design/javabuilder-patterns.md); dark mặc định, light chọn được, Inter, không gradient, không literal màu, control cảm ứng ≥44×44 px, không chỉ dựa vào hover.
- Không thêm CSS trang mới. Bật preflight chỉ sau khi toàn bộ caller legacy trong bản đồ đã biến mất; trang không đổi chỉ kiểm tĩnh selector/class, không đặt tiêu chí so pixel.

## Xong khi

### Task 1a — Backend nền tảng + Author API

- [ ] V10 tạo đúng working/version/history model, fingerprint, reading time, `hidden_from_publication_status` và index saved list; CHECK/FK/cascade-or-RESTRICT/index đúng, V1–V9 không đổi. Testcontainers chạy Flyway V1→V10, chặn trạng thái sai; V10 gặp `articles` có dữ liệu fail với thông báo rõ.
- [ ] `docs/technical/db/final.sql`, `PROJECT_CONTEXT.md` và `RUNBOOK.md` phản ánh schema/API mới cùng bước reset schema + Redis.
- [ ] Unit state machine bao phủ no-op SAVE, fingerprint canonical ổn định/tag không xét thứ tự, no-change SUBMIT, HIDE nguồn `PUBLISHED/AUTHOR_HIDDEN`, RESTORE/APPROVE về đúng nguồn, author-deleted/removed terminal và transition sai không đổi entity.
- [ ] Author create/save/submit/update published/withdraw/discard/history/HIDE/UNHIDE/DELETE giữ ownership, transaction; AuthorProfile suspended vẫn DELETE được; hard delete tombstone receipt và retry cùng key không hồi sinh bài.
- [ ] Import/detail/save trả `imageIssues` có alt/source/occurrence/line-column; SAVE cho ảnh Markdown chưa managed, cover luôn managed, SUBMIT chỉ trả `ARTICLE_IMAGE_INVALID` theo `ErrorResponse` và detail reload trả issue mới.
- [ ] `AuthorArticleIntegrationTest` kiểm browser preflight cho DELETE; CORS allowed methods có PUT/DELETE từ 1a nhưng security vẫn deny endpoint chưa được matcher cho phép.
- [ ] Chạy bằng Git Bash: `cd server && ./gradlew test --tests 'com.techverse.server.article.ArticlePublicationMigrationTest' --tests 'com.techverse.server.article.ArticleLifecycleTest' --tests 'com.techverse.server.author.AuthorArticleIntegrationTest' --tests 'com.techverse.server.author.ArticleContentServiceTest'` đạt (cần Docker), rồi Codex review task 1a.

### Task 1b — Moderator + Public + cleanup + fixture

- [ ] Moderator approve lần đầu/cập nhật tạo version + fingerprint + readingMinutes tuần tự; REQUEST_CHANGES/HIDE/RESTORE/REMOVE ghi history; hidden restore/approve về đúng nguồn. `AUTHOR_DELETED` rời queue, detail/history chỉ đọc, mọi write trả transition invalid; self-review/eligibility/taxonomy/stale/race giữ đúng.
- [ ] Public list/detail/options/related chỉ đọc snapshot visible; list/filter/sort và DTO đủ trường đã chốt, detail author card không email, readingMinutes tối thiểu 1 và không tính lại mỗi request.
- [ ] Related dùng cùng topic hoặc chung tag, loại chính nó, visible, mới nhất trước và tối đa 5. Account inactive/AuthorProfile `SUSPENDED` cho public 404/không xuất hiện; restore tác giả làm bài tự hiện lại mà không đổi status/history.
- [ ] Public eligibility nằm trong query; query-count regression chứng minh không N+1, không lộ working/moderation fields và không tăng theo số tag/related.
- [ ] Cleanup giữ ảnh được working copy hoặc bất kỳ publication version nào tham chiếu; APPROVE kiểm lại ảnh managed đúng owner/article.
- [ ] Xóa `demo-authors-articles.sql`; `articles.json` + toàn bộ Markdown vẫn là fixture import LF hợp lệ; `HUONG_DAN.md` chỉ hướng dẫn tạo 3–5 bài thật qua API/UI.
- [ ] Chạy bằng Git Bash: `cd server && ./gradlew test --tests 'com.techverse.server.moderator.ModeratorArticleIntegrationTest' --tests 'com.techverse.server.article.PublishedArticleIntegrationTest' --tests 'com.techverse.server.author.ArticleSeedFixtureTest'` đạt (cần Docker), rồi Codex review task 1b.

### Task 1c — Backend lưu bài

- [ ] `SavedArticle` map đúng bảng V1 và unique/FK cascade; V10 chỉ thêm index user + saved time. PUT/DELETE idempotent cho mọi role auth, concurrent PUT không 500 và không tạo trùng.
- [ ] PUT bài không visible trả 404; DELETE row thiếu hoặc bài đã ẩn vẫn 200 false. Saved list lọc visibility, keyword/paging, sort `savedAt DESC, id DESC`; row ẩn được giữ và hiện lại khi article visible.
- [ ] Public list/detail/related trả `saved` đúng actor trong query; saved list trả summary + savedAt, không N+1/query per row và không công khai tổng lượt lưu.
- [ ] `SavedArticleIntegrationTest` có 3–5 ca mỗi endpoint: auth/visibility, idempotency + race, paging/filter/order, hidden→visible và soft-delete; khẳng định JSON shape và Security matcher dùng cho frontend.
- [ ] Chạy bằng Git Bash: `cd server && ./gradlew test --tests 'com.techverse.server.article.SavedArticleIntegrationTest' --tests 'com.techverse.server.article.PublishedArticleIntegrationTest'` đạt (cần Docker), rồi Codex review task 1c.

### Cổng UI trước Task 2a

- [ ] Wireframe ASCII/Markdown bao phủ mọi màn 2a–2d và loading/empty/error, desktop/mobile nơi khác bố cục; người dùng duyệt và quyết định được ghi vào log trước khi có diff code UI.

### Task 2a — Author workspace + editor

- [ ] Workspace/editor thực hiện đúng action matrix, hai badge status, history và live link; hide/unhide/delete hard-soft/withdraw/discard dùng `AlertDialog`, không hiện action backend từ chối.
- [ ] Desktop source/import trái + preview thật phải; mobile tab/Sheet không tràn ngang. Preview dùng `MarkdownContent`, thay ảnh ngoài bằng placeholder và test xác nhận không phát request tới URL ngoài.
- [ ] Preview không hiển thị reading time và không tính reading time ở client; Reader chỉ nhận giá trị backend sau APPROVE.
- [ ] Panel `imageIssues` hiển thị/replace theo source+occurrence/remove/multi-file/retry đúng; target stale không bị thay nhầm. Upload đầu trên bài mới auto-SAVE khi metadata hợp lệ, nếu chưa đủ thì hướng dẫn lưu nháp; 429, >50 ảnh, >5 MiB báo tại dòng; Submit bị khóa tới khi hết issue.
- [ ] Dirty navigation có `beforeunload` và chặn link/nút trong editor bằng `AlertDialog`; không đổi router. Loading/empty/error/retry, vi/en, keyboard/touch target đạt.
- [ ] `articleService.test.ts` dùng JSON fixture đúng shape backend đã khẳng định; `articleI18n.test.ts` liệt kê đủ enum/mã lỗi mới bằng vi/en; logic status/action/error test ở hàm thuần.
- [ ] Chạy `npx vitest run src/services/articleService.test.ts src/data/articleI18n.test.ts src/components/articles/ArticleStatusBadges.test.tsx src/components/TagPicker.test.tsx src/pages/Author/AuthorBlogsPage.test.tsx src/pages/Author/ArticleEditorPage.test.tsx src/App.author-session.test.tsx src/App.auth.test.tsx` rồi `npm run build` trong `app/` đạt; Codex review task 2a.
- [ ] Kiểm mắt dark/light × desktop 1440 px + mobile 390 px một lượt cho workspace/editor; kết quả ghi log, không kiểm lại trang chưa đổi.

### Task 2b — Moderator UI

- [ ] Dashboard/list giữ chuẩn Admin; click item tới `/moderator/articles/:id`, không còn Sheet detail; detail so working/snapshot và đánh dấu trường thay đổi.
- [ ] Review/HIDE/RESTORE/REMOVE có validation/note/stale reload đúng; hiển thị eligibility tác giả; dialog note lần trả về tuân thủ mốc APPROVE gần nhất.
- [ ] Contract fixture frontend đúng shape detail/list/history backend; mọi enum/mã lỗi task 2b có copy vi/en và unit test, page integration khoảng 5 luồng chính.
- [ ] Chạy `npx vitest run src/services/articleService.test.ts src/data/articleI18n.test.ts src/pages/Moderator/ModeratorDashboardPage.test.tsx src/pages/Moderator/ModeratorArticlesPage.test.tsx src/pages/Moderator/ModeratorArticleDetailPage.test.tsx` rồi `npm run build` trong `app/` đạt; Codex review task 2b.
- [ ] Kiểm mắt dark/light × desktop 1440 px + mobile 390 px một lượt cho list/detail Moderator; kết quả ghi log.

### Task 2c — Reader + preflight + CSS legacy

- [ ] Reader list đúng header/filter/chip/grid 3–2–1/card fallback/meta/tag/reading/save/author/pagination; skeleton 6, empty xóa filter và error retry dùng dữ liệu thật. URL là nguồn filter/page; Back/Forward, related link và quay lại từ detail giữ đúng state.
- [ ] Reader detail đúng breadcrumb, content + sticky sidebar, public author/TOC active/related, mobile TOC + sidebar dưới, back-to-top và 404; nhãn “Cập nhật” chỉ cho version >1 với `approvedAt` hiện hành.
- [ ] Markdown/GFM/code label+copy/heading anchor+copy/bảng cuộn/ảnh lazy và copy-link an toàn, responsive; slug thuần cho tiếng Việt/trùng/rỗng dùng nhất quán giữa anchor + TOC. Save optimistic có aria-pressed, touch ≥44 px, tuần tự hóa request theo ý định cuối và lỗi rollback + inline message.
- [ ] Public 404 và empty/list phản ánh đúng author-hidden, moderator-hidden, soft-delete, inactive/suspended author; không hiển thị enum thô hay dữ liệu working/history.
- [ ] Contract fixture frontend đúng shape public backend; copy vi/en và integration tests khoảng 5 luồng chính mỗi màn.
- [ ] Bật preflight; grep không còn class legacy đã liệt kê; xóa bảy CSS, import/block tương thích và alias token cũ. Trang ngoài module chỉ kiểm tĩnh selector/class; `tokens.test.ts` giữ mọi cặp ≥4.5:1.
- [ ] Unit `MarkdownContent.test.tsx` phủ slug tiếng Việt/trùng/rỗng; `ArticleSaveButton.test.tsx` phủ click nhanh PUT→DELETE, DELETE→PUT, lỗi request đầu và lỗi request nối tiếp rollback về success gần nhất; page tests phủ URL params + Back/Forward + detail fallback. Chạy `npx vitest run src/services/articleService.test.ts src/data/articleI18n.test.ts src/components/articles/ArticleCard.test.tsx src/components/articles/ArticleSaveButton.test.tsx src/components/MarkdownContent.test.tsx src/components/Pagination.test.tsx src/pages/Blogs/BlogsPage.test.tsx src/pages/Blogs/BlogDetailPage.test.tsx src/App.auth.test.tsx src/styles/tokens.test.ts` rồi `npm run build` trong `app/` đạt; Codex review task 2c.
- [ ] Kiểm mắt dark/light × desktop 1440 px + mobile 390 px một lượt cho Reader list/detail; kết quả ghi log.

### Task 2d — UI Bài đã lưu

- [ ] `/blogs/saved` khai báo trước `/blogs/:id`; entry chỉ có ở sidebar người dùng dưới Bài viết, header link cho mọi role hoạt động, route yêu cầu auth như Reader hiện tại.
- [ ] Trang dùng chung card/grid, có header/count/search, skeleton/error/retry; hidden article không hiện. Empty có icon tim, câu “Chưa có bài đã lưu” và CTA khám phá.
- [ ] Bỏ lưu chuyển card thành “Đã bỏ lưu · Hoàn tác” tại chỗ; Undo/optimistic/error rollback đúng, không toast; vi/en, keyboard, aria và touch ≥44 px đạt.
- [ ] Contract fixture đúng JSON backend; chạy `npx vitest run src/services/articleService.test.ts src/data/articleI18n.test.ts src/components/articles/ArticleCard.test.tsx src/components/articles/ArticleSaveButton.test.tsx src/pages/Blogs/SavedArticlesPage.test.tsx src/components/layout/Sidebar.test.tsx src/App.auth.test.tsx` rồi `npm run build` trong `app/` đạt; Codex review task 2d.
- [ ] Kiểm mắt dark/light × desktop 1440 px + mobile 390 px một lượt cho Bài đã lưu và trạng thái undo; kết quả ghi log.

### Hoàn tất module sau Task 2d

- [ ] Chạy song song một lượt regression gộp thuộc module: Backend bằng Git Bash `cd server && ./gradlew test --tests 'com.techverse.server.article.*' --tests 'com.techverse.server.author.AuthorArticleIntegrationTest' --tests 'com.techverse.server.author.ArticleContentServiceTest' --tests 'com.techverse.server.author.ArticleImageDecoderTest' --tests 'com.techverse.server.author.CloudinaryArticleImageStorageTest' --tests 'com.techverse.server.author.ArticleSeedFixtureTest' --tests 'com.techverse.server.moderator.*'` (cần Docker); Frontend trong `app/` bằng `npx vitest run src/services/articleService.test.ts src/data/articleI18n.test.ts src/components/articles/ArticleStatusBadges.test.tsx src/components/articles/ArticleCard.test.tsx src/components/articles/ArticleSaveButton.test.tsx src/components/TagPicker.test.tsx src/pages/Author/AuthorBlogsPage.test.tsx src/pages/Author/ArticleEditorPage.test.tsx src/App.author-session.test.tsx src/App.auth.test.tsx src/pages/Moderator/ModeratorDashboardPage.test.tsx src/pages/Moderator/ModeratorArticlesPage.test.tsx src/pages/Moderator/ModeratorArticleDetailPage.test.tsx src/components/MarkdownContent.test.tsx src/components/Pagination.test.tsx src/pages/Blogs/BlogsPage.test.tsx src/pages/Blogs/BlogDetailPage.test.tsx src/pages/Blogs/SavedArticlesPage.test.tsx src/components/layout/Sidebar.test.tsx src/styles/tokens.test.ts`, sau đó `npm run build`; tất cả đạt hoặc ghi chính xác lỗi môi trường. Không chạy `scripts/verify.sh`; full suite do CI chạy khi mở PR.
- [ ] Tạo 3–5 bài qua API/UI từ `articles.json` + Markdown, không chèn SQL article. Với một bài ghi ID và kiểm: v1 approve → sửa nhưng Reader vẫn thấy v1 → request changes → approve v2 cùng URL → nhãn cập nhật; Author hide/unhide; Moderator hide/restore giữ đúng ý định Author; soft delete; panel ảnh; suspended author ẩn rồi restore hiện lại; save trên list/detail, Saved page, bỏ lưu+Undo, bài ẩn biến khỏi saved rồi hiện lại; dialog hiện note lần trả về.
- [ ] Phần upload/managed image chạy với `CLOUDINARY_*` thật; nếu thiếu biến môi trường, ghi “Chưa kiểm” riêng phần ảnh trong log, không đánh dấu mục ảnh đạt.

## Phản hồi vòng 1 (Claude)

Đúng / Sai / Thiếu / Thừa (đối chiếu code ngày 2026-11-03):

**Đúng**
- Mọi đường dẫn “sửa” trong “Đường dẫn thuộc module” đều có thật; migration hiện tới V9 nên V10 đúng thứ tự; seed có đúng 24 file Markdown.
- Bản đồ hiện trạng khớp code: `Article.isEditable()` chỉ nhận `DRAFT/CHANGES_REQUESTED`; `PublishedArticleRepository` lọc `status = PUBLISHED` ở 6 chỗ; review token hiện là SHA-256 snapshot (`ModeratorArticleServiceImpl.reviewToken`); cleanup chỉ xét `images.references(article)` của working copy.
- Chặn đúng rủi ro: ngoài các trang thuộc module không trang nào còn dùng class của bảy file CSS legacy (đã quét `className` toàn `app/src`). Các trang Login/Register/ForgotPassword/GoogleCallback/Settings đã nằm trong `AuthLayout`/`SettingsLayout` có `tw-page`, nên bật preflight ít rủi ro ngoài module.

**Sai**
1. Dòng 162 “hard delete theo semantics hiện có”: hiện **chưa có** DELETE nào (controller Author chỉ có options/import/create/list/detail/patch/images). Cần ghi rõ đây là endpoint mới. Ngoài ra receipt idempotency nằm trong Redis 24 giờ (`ArticleCreationRepository`), còn `create()` tạo lại bài khi `!articles.existsById(previous.articleId())`. Hệ quả: xóa nháp rồi retry create cùng key sẽ **hồi sinh bài vừa xóa**. Đề nghị DELETE xóa luôn receipt, hoặc quy định retry sau DELETE trả `ARTICLE_KEY_CONFLICT`.

**Thiếu**
1. **24 bài seed không sửa được.** `validateFinal()` gọi `imageService.validateReferences()` ở cả SAVE lẫn SUBMIT; cover seed là URL Unsplash (`HUONG_DAN.md` dòng 16) nên mọi PATCH của author01–04 đều nhận `ARTICLE_IMAGE_INVALID`, kể cả khi không đụng tới cover. Spec cần chọn một: (a) URL ngoài có sẵn được giữ khi không đổi (chỉ kiểm URL mới), hoặc (b) chấp nhận seed chỉ để đọc, và editor hiện callout yêu cầu thay cover. Lựa chọn này làm đổi thứ người dùng thấy nên Codex hoặc người dùng chốt.
2. **Quy tắc “thay đổi thật” còn mơ hồ.** Dòng 156 chỉ nói tới `PUBLISHED/PUBLISHED`, dòng 222 lại nói “bài đang public”. Đề nghị: khi có snapshot, mọi SUBMIT có working copy == snapshot đều trả `ARTICLE_NO_CHANGES` (kể cả từ DRAFT/CHANGES_REQUESTED), nếu không Moderator sẽ duyệt ra version trùng. Cần liệt kê trường được so: title, summary, content, cover, topicId, tập tagIds không xét thứ tự. Cũng cần chốt SAVE không đổi gì từ `PUBLISHED` trả 409 hay 200 no-op (UI dễ hơn với 200 no-op).
3. **Cảnh báo rời trang khi dirty:** `main.tsx` dùng `<BrowserRouter>`, mà `useBlocker` của React Router chỉ chạy với data router. Spec cần chọn: (a) thêm `main.tsx` vào đường dẫn và chuyển sang `createBrowserRouter`, ảnh hưởng toàn app và các test App; hoặc (b) chỉ dùng `beforeunload` + `AlertDialog` chặn link/nút trong editor. Khuyến nghị (b), vì nhỏ và không đụng router.
4. **Route Moderator detail** chưa ghi rõ, ví dụ `/moderator/articles/:id`. Cần nói Sheet hiện có bị bỏ hay giữ để xem nhanh.
5. **Snapshot taxonomy:** version lưu FK `topic_id`/tag nên khi Admin đổi tên thì snapshot “bất biến” vẫn hiện tên mới. Cần ghi rõ là chấp nhận (khuyến nghị), hoặc lưu kèm tên.
6. **V10 trên DB dev đang có dữ liệu:** D-022 bảo làm mới DB, nhưng V10 nên fail rõ ràng (hoặc có default) khi `articles` còn dòng, không để lỗi NOT NULL khó hiểu. RUNBOOK cần ghi bước reset.

**Thừa / cần cân nhắc**
1. **Kích thước task:** Task 1 (schema + state machine + 3 API + cleanup + seed) và Task 2 (Author + editor + Moderator + Reader + preflight) mỗi task đều quá lớn cho một session và một lượt review Codex. Đề nghị tách thành 1a (V10 + entity/state machine + Author API), 1b (Moderator + Public + cleanup + seed), 2a (Author workspace + editor), 2b (Moderator), 2c (Reader + bật preflight + xóa CSS). “Xong khi” giữ nguyên, chỉ chia theo task.
2. Cleanup giữ ảnh của **mọi** version cũ làm storage chỉ tăng, trong khi rollback version cũ nằm ngoài phạm vi. Có thể chỉ giữ working copy + version đang trỏ `publishedVersionId`. Đánh đổi là ảnh trong version cũ bị vỡ khi xem lịch sử, mà lịch sử hiện không hiển thị content. Người dùng chọn; nếu giữ nguyên spec thì không chặn.

**Ngân sách kiểm chứng:** lệnh test Task 1/Task 2 nằm trong ngân sách (chỉ lớp/file liên quan + build). Bước kiểm thật E2E ở dòng 284 khá dài (2 version + hide/restore) nhưng hợp lý, giữ nguyên.

### Đề xuất ngoài spec (không chặn chốt)

1. **Hiện “Cập nhật lần cuối” trên trang đọc** (approvedAt của version hiện hành, cạnh publishedAt). Lợi ích: độc giả biết bài đã được sửa. Công sức: rất nhỏ (DTO đã có version). Có thể làm ngay trong Task 2c.
2. **Moderator thấy lý do lần trả về trước ngay trong dialog duyệt**, lấy từ history mới nhất. Lợi ích: duyệt vòng 2 nhanh, không phải mở lịch sử. Công sức: nhỏ. Làm ngay.
3. **Thông báo cho Author khi bài được duyệt, bị trả về hoặc bị ẩn.** Lợi ích lớn nhưng spec đã loại notification. Nên tách thành module sau.

## Trả lời vòng 1 (Codex)

1. **Sai 1 — Chấp nhận.** `DELETE` là endpoint mới, không phải semantics hiện có. Tôi đã kiểm `AuthorArticleServiceImpl.create()`: receipt Redis sống 24 giờ nhưng khi article cũ không còn tồn tại, retry cùng key có thể tạo row mới. Spec nay yêu cầu hard delete đánh dấu receipt tombstone tới hết TTL và retry trả `ARTICLE_KEY_CONFLICT`; đã thêm `ArticleCreationRepository` và `ArticleCreationReceipt` vào đường dẫn.
2. **Thiếu 1 — Chấp nhận, theo quyết định mới của người dùng.** Xóa `demo-authors-articles.sql`, giữ JSON/Markdown làm fixture import. Working copy được SAVE với ảnh Markdown ngoài/relative, nhưng SUBMIT/APPROVE chỉ nhận asset Cloudinary managed đúng owner/article; cover luôn null hoặc managed. Reader smoke dùng 3–5 bài tạo thật qua API/UI, không còn bài SQL chỉ đọc.
3. **Thiếu 2 — Chấp nhận.** Với mọi bài đã có snapshot, SUBMIT so title, summary, content, cover, topic và tập tag không xét thứ tự; giống snapshot trả `ARTICLE_NO_CHANGES` ở cả DRAFT/CHANGES_REQUESTED. SAVE không đổi trả 200 no-op và giữ state để retry an toàn.
4. **Thiếu 3 — Chấp nhận phương án (b).** `app/src/main.tsx` đang dùng `BrowserRouter`; không đổi router toàn app. Editor dùng `beforeunload` và `AlertDialog` cho link/nút điều hướng do editor kiểm soát.
5. **Thiếu 4 — Chấp nhận.** Route detail là `/moderator/articles/:id`; bỏ Sheet detail hiện có, list điều hướng sang page detail riêng.
6. **Thiếu 5 — Chấp nhận khuyến nghị.** Version giữ bất biến content và topic/tag IDs; tên taxonomy được resolve hiện thời, nên Admin rename có chủ đích áp dụng cho mọi version. Không nhân bản label vào snapshot.
7. **Thiếu 6 — Chấp nhận.** V10 fail sớm với thông báo rõ nếu `articles` có dữ liệu; Testcontainers kiểm Flyway V1→V10 và ca fail này. `RUNBOOK.md` ghi reset schema + Redis theo D-022.
8. **Thừa 1 — Chấp nhận.** Đã chia đúng năm task 1a, 1b, 2a, 2b, 2c; mỗi task có session, lệnh kiểm mục tiêu và một lượt Codex review riêng. Cả 1a và 1b phải xong trước khi mở UI.
9. **Thừa 2 — Từ chối cắt cleanup xuống working + current version.** Snapshot lịch sử đã được chốt là bất biến; xóa asset của version cũ sẽ để lại link chết khi lịch sử/version được đọc hoặc dùng về sau. Cleanup tiếp tục giữ asset của mọi approved version, đổi lại storage tăng theo số version.
10. **Đề xuất ngoài spec 1 — Chấp nhận.** Reader chỉ hiện “Cập nhật <ngày>” khi `versionNumber > 1`, lấy `approvedAt` của version hiện hành; hide/restore không tạo ngày cập nhật.
11. **Đề xuất ngoài spec 2 — Chấp nhận.** Dialog duyệt chỉ hiện lần REQUEST_CHANGES gần nhất sau APPROVE gần nhất; withdraw/gửi lại không xóa ngữ cảnh, APPROVE mở vòng mới thì không hiện note cũ.
12. **Đề xuất ngoài spec 3 — Tách module.** Notification cần hạ tầng và kênh gửi riêng, không thuộc vòng đời/article UI hiện tại; ý này đã nằm trong “Câu hỏi mở” của `PLAN.md`.

**Điểm yếu còn lại của spec:**

- Giữ asset của mọi approved version làm storage tăng không giới hạn; module này chưa có quota/retention.
- `imageIssues.line/column` phụ thuộc khả năng lấy source span ổn định từ parser CommonMark; khi code phải khóa cách tính bằng unit test với CRLF/LF và Unicode.
- Public eligibility làm query public phức tạp hơn; query-count test bắt được N+1 nhưng chưa thay benchmark trên dữ liệu lớn.
- `AUTHOR_DELETED` không hiện trong list Author và không restore; quyền đọc URL detail trực tiếp sau soft delete được chốt là 404 cho Author, chỉ Moderator còn thấy audit qua luồng quản trị.
- Vì không chuyển sang data router, spec chỉ chặn unload và điều hướng do editor kiểm soát; nút Back nội bộ ngoài các điểm chặn này vẫn là giới hạn cần kiểm khi triển khai.

## Phản hồi vòng 2 (Claude)

Đối chiếu bản spec sau “Trả lời vòng 1” với code ngày 2026-11-04. 12 điểm vòng 1 đã được xử lý đúng; tôi chấp nhận lý do từ chối Thừa 2 (giữ ảnh mọi version). Còn các điểm sau.

**Sai / mâu thuẫn (nên sửa trước khi chốt)**
1. **Mất ý định của tác giả qua chuỗi `AUTHOR_HIDDEN → HIDDEN → RESTORE`.** Dòng 170 cho Moderator HIDE bài `AUTHOR_HIDDEN`, nhưng dòng 183 cho RESTORE luôn về `PUBLISHED`. Duyệt bản khắc phục khi `HIDDEN` (dòng 181) cũng luôn về `PUBLISHED`. Hệ quả: bài tác giả đã tự ẩn lại hiện công khai mà tác giả không biết. Đề nghị: RESTORE và APPROVE-khi-`HIDDEN` trả về trạng thái **trước lần Moderator HIDE** (`PUBLISHED` hoặc `AUTHOR_HIDDEN`), lấy từ history “trạng thái trước” hoặc lưu thêm một cột; thêm ca này vào unit state machine.
2. **`ErrorResponse` không chở được danh sách issue.** Dòng 254 ghi SUBMIT/APPROVE còn issue thì “trả 400 `ARTICLE_IMAGE_INVALID` cùng danh sách issue”, nhưng `ErrorResponse` chỉ có `fieldErrors: Map<String,String>` và dòng 292 giữ nguyên shape này. Đề nghị: lỗi chỉ trả mã; client đã có `imageIssues` từ detail/save và tự khóa Submit (dòng 207), nên khi gặp mã này thì tải lại detail để cập nhật panel.

**Thiếu (lỗ hổng logic nhỏ)**
1. **Moderator thao tác trên `AUTHOR_DELETED`** chưa có rule. Bảng hai trục (dòng 161) và bảng Moderator chỉ nói “rời queue”; workflow giữ `PENDING` nên filter queue phải loại `AUTHOR_DELETED` bằng điều kiện tường minh. Review/HIDE/RESTORE/REMOVE trên bài này phải trả lỗi rõ, đề nghị 409 `ARTICLE_PUBLICATION_TRANSITION_INVALID`. Moderator chỉ đọc qua history/detail.
2. **`hasUnpublishedChanges` theo định nghĩa mới** (dòng 242: “working copy khác snapshot”) buộc list phải so content của từng dòng, trong khi list không tải content. Đề nghị lưu `content_fingerprint` (SHA-256 của 6 trường so sánh) trên `articles` và trên version, so hai cột trong query. Cùng fingerprint này dùng luôn cho rule `ARTICLE_NO_CHANGES`, khỏi so chuỗi lớn trong Java.
3. **Vị trí `line/column` của `imageIssues` hết đúng ngay khi tác giả gõ thêm** giữa hai lần save. Đề nghị thay đúng ảnh bằng `source` + thứ tự xuất hiện (`occurrence`), không bằng line/column; line/column chỉ để hiển thị. Ý này cũng gỡ một phần rủi ro Codex nêu ở “Điểm yếu còn lại”.
4. **Bài mới chưa lưu thì chưa upload được** (upload cần ID bài). Với file import vào editor `/author/blogs/new`, panel ảnh cần rule: nút “Tải ảnh thay thế” bị khóa kèm hướng dẫn “Lưu nháp trước”, hoặc tự lưu nháp ở lần upload đầu (khi đã đủ title/topic). Khuyến nghị cách tự lưu nháp, vì có `Idempotency-Key` nên retry an toàn.
5. **Tác giả bị đình chỉ có được xóa bài của mình không:** dòng 263 chỉ ghi “Owner”, trong khi HIDE/UNHIDE ghi “Owner active/approved”. Cần ghi rõ: đề nghị cho owner đã đình chỉ vẫn DELETE được (quyền rút nội dung của mình), còn HIDE/UNHIDE thì không cần, vì bài của tác giả bị đình chỉ đã tự ẩn.

**Rủi ro ghi nhận, không chặn**
- Ảnh Cloudinary của bài `AUTHOR_DELETED` vẫn truy cập được qua URL công khai, vì cleanup giữ ảnh của mọi version. Đây là hệ quả của quyết định xóa mềm; nên ghi một dòng trong “Ngoài phạm vi”: “xóa vĩnh viễn ảnh/nội dung theo yêu cầu tác giả”.
- Nút Back của trình duyệt trong editor không bị chặn (Codex đã nêu); chấp nhận vì người dùng đã chọn không đổi router.

## Trả lời vòng 2 (Codex)

1. **Sai 1 — Chấp nhận.** Chuỗi `AUTHOR_HIDDEN → HIDDEN → RESTORE/APPROVE` phải giữ ý định của Author. V10 thêm `hiddenFromPublicationStatus`; Moderator HIDE lưu `PUBLISHED` hoặc `AUTHOR_HIDDEN`, RESTORE và APPROVE-khi-HIDDEN trở về đúng giá trị đó rồi xóa nguồn. CHECK DB và unit state machine chặn nguồn thiếu/sai.
2. **Sai 2 — Chấp nhận.** Đã kiểm `ErrorResponse`: `fieldErrors` là `Map<String,String>`, không thể chở danh sách issue có cấu trúc mà vẫn giữ contract chung. SUBMIT/APPROVE chỉ trả mã `ARTICLE_IMAGE_INVALID`; client reload detail để nhận `imageIssues` mới và cập nhật panel.
3. **Thiếu 1 — Chấp nhận.** `AUTHOR_DELETED` bị loại tường minh khỏi Moderator queue dù workflow còn `PENDING`. Moderator chỉ đọc detail/history để audit; review/HIDE/RESTORE/REMOVE trả 409 `ARTICLE_PUBLICATION_TRANSITION_INVALID`.
4. **Thiếu 2 — Chấp nhận.** Article working copy và publication version cùng lưu `contentFingerprint` SHA-256 từ canonical input sáu nhóm trường; tag UUID được sort. `hasUnpublishedChanges` và `ARTICLE_NO_CHANGES` so hai fingerprint, nên list không tải Markdown và service không so chuỗi lớn mỗi lần.
5. **Thiếu 3 — Chấp nhận.** `imageIssues` dùng `source + occurrence` một-based làm định danh thay thế; line/column chỉ để hiển thị. Nếu người dùng sửa khiến target không còn khớp, client không thay nhầm mà yêu cầu save/reload issue.
6. **Thiếu 4 — Chấp nhận khuyến nghị tự lưu nháp.** Upload đầu tiên ở editor mới tự POST `action=SAVE` bằng `Idempotency-Key` khi title/topic hợp lệ, nhận article ID rồi upload. Nếu metadata chưa đủ, nút bị khóa với hướng dẫn nhập thông tin và lưu nháp trước.
7. **Thiếu 5 — Chấp nhận.** AuthorProfile bị `SUSPENDED` vẫn được DELETE bài của chính mình vì đây là quyền rút nội dung; các write khác vẫn cần Author active/approved. Account bị khóa không thể gọi API. Integration test phải tách hai trường hợp này.
8. **Rủi ro ảnh sau soft delete — Ghi nhận.** Đã thêm “xóa vĩnh viễn snapshot/nội dung/ảnh Cloudinary theo yêu cầu tác giả” vào Ngoài phạm vi; `AUTHOR_DELETED` hiện vẫn giữ asset/version/history để audit.
9. **Rủi ro nút Back — Chấp nhận.** Giữ lựa chọn không đổi router: chỉ `beforeunload` và điều hướng do editor kiểm soát được chặn; đây không phải blocker của module.

**Điểm yếu còn lại của spec:**

- `source + occurrence` ổn định hơn line/column nhưng vẫn có thể stale nếu tác giả chèn thêm đúng cùng source trước target; rule “không khớp thì không thay và reload issue” giảm lỗi sai bài, không loại bỏ thao tác lại.
- Fingerprint SHA-256 có rủi ro va chạm lý thuyết; canonical length-prefix và unit test chỉ loại lỗi chuẩn hóa/ghép chuỗi, không chứng minh tuyệt đối không va chạm.
- Query Reader nay phải kết hợp visibility, snapshot, saved-by-actor, tag và related; query-count test bắt N+1 nhưng chưa thay benchmark dữ liệu lớn.
- Row saved của bài ẩn/soft-delete được giữ vô thời hạn; module chưa có bulk clear hoặc retention, chỉ có DELETE từng bài.
- Task 1c/2d và thiết kế Reader được thêm sau khi Claude đã viết phản hồi vòng 2; phần mở rộng này chưa được Claude kiểm tra kỹ thuật. Theo quyết định người dùng trong log, cần một lượt phản biện hẹp cho phần mới trước khi chốt toàn spec, không mở lại bảy điểm vòng 2 đã xử lý.

## Phản biện phần mở rộng (Claude, lượt ngoại lệ người dùng cho phép 2026-11-04)

Chỉ soát Task 1c/2d và thiết kế Reader mới thêm; 7 điểm vòng 2 đã xử lý đúng, không mở lại. Đã đối chiếu code: đường dẫn mới đủ (`SavedArticle*`, `SecurityConfiguration`, `navigation.ts`, `Sidebar.tsx`); CORS hiện chỉ `GET/POST/PATCH/OPTIONS` (`SecurityConfiguration.java:128`); matcher `/api/v1/author/articles/**` không giới hạn method; `AuthorProfile` có `bio`/`expertise`; app có `react-markdown`, `remark-gfm`, `rehype-highlight`, chưa có plugin slug.

**Thiếu (nên sửa trước khi chốt)**
1. **Bấm lưu/bỏ lưu liên tục làm sai trạng thái cuối.** Optimistic + PUT/DELETE song song có thể về server sai thứ tự (PUT đến sau DELETE). Cần rule: mỗi nút chỉ một request đang bay, click trong lúc chờ thì ghi nhận ý định cuối và gửi sau khi request trước xong (hoặc khóa nút khi pending). Thêm ca này vào `ArticleSaveButton.test.tsx`.
2. **Anchor H2/H3 + mục lục cần luật tạo slug.** Chưa có plugin slug; tiêu đề tiếng Việt có dấu và có thể trùng. Đề nghị hàm slug thuần trong `MarkdownContent` (bỏ dấu bằng NFD, `đ→d`, chữ thường, `-`, trùng thì thêm `-2`, `-3`), không thêm package; mục lục và anchor dùng cùng hàm; unit test tiếng Việt + trùng tên.
3. **Bộ lọc `/blogs` phải đồng bộ URL** (`?keyword=&topicId=&tagId=&sort=&page=`). Link “Xem tất cả → `/blogs?topicId=`” ở sidebar related cần điều này, và nút Back từ trang chi tiết phải giữ bộ lọc/trang cũ. Spec chưa ghi.

**Nhỏ (không chặn)**
- CORS `DELETE` đang nằm ở Task 1c, nhưng `DELETE /author/articles/{id}` có từ 1a. Không lỗi thực tế vì UI chỉ bắt đầu sau 1c, nhưng nên chuyển dòng CORS sang 1a cho đúng thứ tự.
- Admin/Moderator lưu được qua API nhưng entry “Bài đã lưu” chỉ nằm trong sidebar người dùng. Link ở header `/blogs` đủ dùng; ghi rõ là chấp nhận.
- Preview editor (2a) dùng chung bố cục trang đọc nhưng `readingMinutes` chỉ có sau APPROVE: ghi rõ preview ẩn thời gian đọc, không tự tính ở client.

## Trả lời phản biện phần mở rộng (Codex)

1. **Thiếu 1 — Chấp nhận.** `ArticleSaveButton` dùng state machine theo article với `confirmedSaved`, `desiredSaved` và tối đa một request đang bay. Click khi pending chỉ đổi ý định optimistic; mỗi success cập nhật confirmed rồi mới gửi PUT/DELETE kế tiếp nếu cần. Nếu request lỗi, dừng chuỗi, rollback về confirmed của lần server success gần nhất và báo lỗi tại chỗ. Test phủ PUT→DELETE, DELETE→PUT và lỗi ở request đầu/lượt nối tiếp.
2. **Thiếu 2 — Chấp nhận.** Không thêm plugin. `MarkdownContent` dùng hàm slug thuần chung cho heading và TOC: NFD, bỏ combining mark, đổi `đ/Đ`, lowercase, gom ký tự ngoài `[a-z0-9]` thành `-`, trim; slug rỗng là `section`, trùng theo thứ tự thêm `-2`, `-3`. Unit test phủ tiếng Việt, dấu câu, heading trùng và rỗng.
3. **Thiếu 3 — Chấp nhận.** URL là nguồn sự thật của filter/page. Keyword commit khi submit, filter/sort reset page, pagination và các thay đổi đã commit đều ghi history; mount/Back/Forward parse URL. Link vào detail mang URL list qua router state, nút quay lại dùng state hợp lệ hoặc fallback `/blogs`; related link dùng `topicId` thật.
4. **Điểm nhỏ 1 — Chấp nhận.** Chuyển trách nhiệm mở CORS PUT/DELETE sang Task 1a vì Author DELETE xuất hiện ở đó; Task 1c chỉ thêm security matcher cho API saved. `AuthorArticleIntegrationTest` kiểm preflight DELETE.
5. **Điểm nhỏ 2 — Chấp nhận.** Entry “Bài đã lưu” chỉ thêm vào sidebar người dùng. Admin/Moderator vẫn có quyền lưu qua API và truy cập `/blogs/saved` từ header `/blogs`; không làm sidebar quản trị lẫn chức năng Reader.
6. **Điểm nhỏ 3 — Chấp nhận.** Preview editor giữ typography/composition Reader nhưng ẩn reading time; client không tự tính vì giá trị chuẩn chỉ được backend tạo lúc APPROVE.

**Điểm yếu còn lại của spec:**

- Hàng đợi ý định chỉ tuần tự hóa trong một phiên UI; hai tab trình duyệt thao tác cùng article vẫn có thể đến server khác thứ tự. PUT/DELETE idempotent bảo đảm retry an toàn nhưng không cung cấp ordering xuyên tab.
- Slug ASCII phù hợp nội dung Việt/Anh của TechVerse; heading chỉ gồm hệ chữ khác có thể cùng rơi về `section`, khi đó suffix vẫn bảo đảm ID duy nhất nhưng kém mô tả.
- Router state giữ URL list khi điều hướng trong app nhưng không phải permalink; mở detail trực tiếp hoặc mất state sẽ fallback `/blogs`. Browser Back vẫn dùng history URL nếu trang list đã có trong lịch sử.
- Phản biện phần mở rộng đã khép lại; chưa còn điểm kỹ thuật chặn chốt spec, nhưng wireframe vẫn là cổng bắt buộc sau khi ba task Backend hoàn tất.

## Quyết định của người dùng

- 2026-11-03: đã chọn kiến trúc “bản công khai + working copy”; chưa chốt toàn bộ spec, chờ tối đa hai vòng phản biện.
