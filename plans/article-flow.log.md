# Article flow — Log

Trạng thái chính thức: xem [`PLAN.md`](PLAN.md). Spec: [`article-flow.md`](article-flow.md). Ba mục đầu và “Nhật ký phiên” được hook SessionStart tự nạp sau `/clear`; giữ chúng ngắn.

## Bắt đầu từ đây (cập nhật 2026-11-04)

- **Task 1a đã nhận (2026-11-04)**, commit WIP `wip(article-flow): Task 1a`.
- **Task 1b đã nhận (2026-11-04)**, commit WIP `wip(article-flow): Task 1b`; đã đánh dấu “Xong khi” 1b trong spec, nhờ Codex đồng bộ spec (kèm đề xuất container dùng chung).
- **Task 1c đã nhận (2026-11-04)**, commit WIP `wip(article-flow): Task 1c`; đã đánh dấu “Xong khi” 1c trong spec, nhờ Codex đồng bộ spec. 76/76, Codex review không phát hiện; chi tiết mục “Task 1c” cuối file. **Backend module xong (1a–1c).**
- **Cổng wireframe 2a–2d đã nhận (2026-11-04)** — [`article-flow.wireframe.md`](article-flow.wireframe.md) (bố cục + mục “Phong cách”); đã đánh dấu “Xong khi” cổng UI trong spec.
- **Task 2a đã nhận (2026-11-04)**, commit WIP `wip(article-flow): Task 2a`; đã đánh dấu “Xong khi” 2a trong spec, nhờ Codex đồng bộ spec. Test 80/80 + build đạt; Codex vòng 1 sửa 5 lỗi, vòng 2 sửa 1 lỗi; chi tiết mục “Task 2a” cuối file.
- **Task tiếp theo: 2b — Moderator UI** (session mới), theo spec + wireframe 2b-1…2b-3. Dùng lại `ArticleHistorySheet`/`formatDate`/`fieldLabel`/`TONE_TILE` export từ `pages/Author/AuthorBlogsPage.tsx`, `articleI18n` (thêm mã lỗi Moderator), `ArticleStatusBadges`, `ArticlePreview`. Thứ tự sau đó: 2c → 2d → regression gộp + E2E.
- **Frontend còn lệch API mới (tới 2b/2c):** `ModeratorArticlesPage`/`ArticleStats` còn đọc `status`; Public bỏ `updatedAt`, `sortBy/direction` → `sort`. Author đã theo API mới ở 2a.
- **Lỗi có sẵn ngoài 2a (đã kiểm trên HEAD bằng `git stash`):** `App.auth.test.tsx` › “routes ["MODERATOR"] to /moderator” gọi fetch 10 lần thay vì 2 (dashboard Moderator gọi số liệu) → thuộc 2b. Sidebar dư 8 px cuộn ngang ở desktop (cả `/profile`).
- **DB dev phải làm mới trước khi chạy app** (V10 dừng nếu `articles` có dữ liệu): lệnh ở `docs/RUNBOOK.md` mục “Làm mới DB dev”. Không còn seed SQL bài viết: tạo 3–5 bài qua API theo `server/src/test/resources/seed/HUONG_DAN.md`.
- **Môi trường:** Docker 29.6.1. DB dev đã vá checksum V10 (không cần làm mới DB; tài khoản dev còn nguyên, gồm `moderator@techverse.test`). Người dùng đã tạo API key Cloudinary mới (key cũ báo `api_secret mismatch`). Backend người dùng chạy từ IntelliJ (app không tự đọc `.env`).

## Quyết định người dùng chưa có trong spec

- (không có)

## Câu hỏi mở cho người dùng

- (không có)

## Nhật ký phiên
### 2026-11-04 — Codex đồng bộ Task 2a
- Codex: đã đưa quyết định sửa phát hiện review vòng 2 của Task 2a và bài học không sửa migration V1–V10 đã áp dụng vào spec; 8 mục “Xong khi” Task 2a đã là `[x]` đúng theo kết quả trong log nên giữ nguyên.

### 2026-11-04 — Task 2a đã nhận
- Người dùng nhận Task 2a; đánh dấu 8 mục “Xong khi” 2a trong spec, commit WIP, nhờ Codex đồng bộ spec. Tiếp: Task 2b (session mới).

### 2026-11-04 — Upload ảnh bìa báo “Dịch vụ ảnh từ chối tải lên”
- Người dùng test tay: mọi ảnh (PNG…) báo `ARTICLE_IMAGE_UPLOAD_FAILED`. Script chẩn đoán (scratchpad, gọi đúng chuỗi request của `CloudinaryArticleImageStorage` bằng khóa trong `.env`) → Cloudinary trả `401 api_secret mismatch` cho cả Admin API (`find`) lẫn upload. Không phải lỗi code frontend/backend: cặp `CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET` không khớp. Việc người dùng: chép lại API secret đúng từ Cloudinary Console vào `.env` (và cấu hình chạy IntelliJ nếu nhập riêng), khởi động lại backend.
- Ngoài phạm vi (đề xuất cho Codex): backend gộp 401/403 của Cloudinary vào `ARTICLE_IMAGE_UPLOAD_FAILED` và không log mã/thông báo của provider → khó chẩn đoán; nên log `status + error.message` (không log khóa) và coi lỗi xác thực là `ARTICLE_STORAGE_UNAVAILABLE`.

### 2026-11-04 — Sửa DB dev: checksum V10 lệch
- Backend không khởi động: `Migration checksum mismatch for migration version 10`. So schema DB dev với schema dựng mới V1→V10 (DB tạm `tv_check`, đã xóa): chỉ lệch `content_fingerprint` `char(64)` (V10 bản nháp Task 1a) so với `varchar(64)` hiện tại, ở `articles` và `article_publication_versions`. Người dùng đồng ý → `ALTER … TYPE varchar(64)` hai cột + cập nhật checksum V10 trong `flyway_schema_history` (một transaction). So lại: schema khớp; Flyway “Successfully validated 11 migrations”.
- Bài học: đã chạy migration vào DB dev thì không sửa file migration đó; nếu lỡ sửa, so schema với bản dựng mới rồi vá + cập nhật checksum, không cần xóa DB.

### 2026-11-04 — Task 2a: Author workspace + editor
- Viết lại `/author/blogs` (workspace) + editor mới `/author/blogs/new`, `/:id/edit`; service/types/i18n/badge chung; TagPicker sang Tailwind. Test spec 191/192 (1 lỗi có sẵn của Moderator), build đạt; kiểm mắt bằng API giả lập vì backend không chạy.
- Bài học: preflight còn tắt nên `<button>` trần nhận nền/viền legacy → luôn thêm `border-0 bg-transparent`. Lỡ chạy Python trong heredoc Bash một lần (trái luật) — dùng Write rồi chạy file.
- Việc dở: Codex review vòng 1; người dùng nhận.

### 2026-11-04 — Codex đồng bộ cổng wireframe 2a–2d
- Codex: đã đưa ba quyết định về cổng UI, phong cách và mở rộng Author vào thân spec; xác lập `article-flow.wireframe.md` là tài liệu Task 2a–2d bắt buộc phải theo. Checklist cổng UI đã được đánh dấu `[x]` từ trước nên giữ nguyên.

### 2026-11-04 — Cổng wireframe 2a–2d đã nhận
- Tạo `plans/article-flow.wireframe.md` (ma trận hành động Author, mọi màn 2a–2d + loading/empty/error, desktop/mobile). Người dùng duyệt; chốt phong cách: Reader theo javabuilder, Author/Moderator Claude tự thiết kế sinh động trong khung chung. Không sửa code. Tiếp: Task 2a.

### 2026-11-04 — Codex đồng bộ Task 1c
- Codex: đã đối chiếu kết quả Task 1c trong log với checklist spec; toàn bộ 6 mục “Xong khi” 1c đã được đánh dấu `[x]`. Bảng “Quyết định người dùng chưa có trong spec” đang trống nên không có quyết định nào cần đưa vào thân spec.

### 2026-11-04 — Task 1c đã nhận
- Người dùng nhận Task 1c; đánh dấu “Xong khi” 1c trong spec, commit WIP, nhờ Codex đồng bộ spec. Backend xong. Tiếp: cổng wireframe 2a–2d, session mới.

### 2026-11-04 — Task 1c: Backend lưu bài
- Đã làm: PUT/DELETE `/articles/{id}/saved`, `GET /me/saved-articles`, `saved` trong list/detail/related bằng EXISTS; `ArticleIntegrationTestBase` (container khởi động `static`, một context). 76/76, 280 s; Codex review vòng 1 không phát hiện.
- Bài học: lớp cha dùng chung context không được dùng `@Container` (extension dừng container sau mỗi lớp). Test cũ khẳng định “endpoint bị chặn tới task sau” phải đổi khi task đó mở endpoint.
- Việc dở: người dùng nhận 1c → đánh dấu spec, commit WIP, Codex đồng bộ spec. Tiếp: cổng wireframe.

### 2026-11-04 — Codex đồng bộ Task 1b và cấu hình test tích hợp
- Codex: đã đối chiếu kết quả Task 1b trong log với checklist spec; toàn bộ “Xong khi” 1b đã được đánh dấu `[x]`. Đã đưa đề xuất tăng tốc vào Task 1c: tạo `ArticleIntegrationTestBase` dùng chung Postgres/Redis và Spring context cho bốn lớp integration article; giữ `ArticlePublicationMigrationTest` độc lập.

### 2026-11-04 — Task 1b đã nhận
- Người dùng nhận Task 1b; đánh dấu “Xong khi” 1b trong spec, commit WIP (gồm luật tăng tốc), nhờ Codex đồng bộ spec. Tiếp: Task 1c, session mới.

### 2026-11-04 — Tăng tốc quy trình
- Người dùng muốn giảm thời gian mỗi task (~30 phút). Đã thêm luật: lần đỏ chỉ chạy ca mới + `--fail-fast` (`.claude/rules/backend.md`, skill `backend-test`); `CLAUDE.md`: mọi script Python viết file, đọc spec theo đoạn, gom lệnh song song. Đề xuất container dùng chung chờ Codex đưa vào spec.

### 2026-11-04 — Task 1b: Moderator + Public + cleanup + fixture
- Đã làm: Moderator publication HIDE/RESTORE/REMOVE + history + detail so sánh/eligibility, APPROVE kiểm lại ảnh; Public đọc snapshot visible (tác giả active, profile không SUSPENDED), sort NEWEST/OLDEST, related topic-hoặc-tag tối đa 5; cleanup giữ ảnh của mọi version; xóa seed SQL. 94/94.
- Bài học: Bash heredoc chứa Python nhiều nháy lồng vỡ cú pháp lần nữa → luôn Write script vào scratchpad (đã có trong `CLAUDE.md`).
- Codex review vòng 1 không phát hiện. Việc dở: người dùng nhận 1b → commit WIP + Codex đồng bộ spec.

- 2026-11-04 — Codex: đã đưa quyết định chốt toàn bộ spec `article-flow` vào mục “Quyết định của người dùng”; checklist “Xong khi” Task 1a đã được đánh dấu đầy đủ theo kết quả trong log.

### 2026-11-04 — Task 1a đã nhận
- Người dùng nhận Task 1a; đánh dấu “Xong khi” 1a trong spec, commit WIP (gồm luật mới), nhờ Codex đồng bộ spec. Tiếp: Task 1b, session mới.

### 2026-11-04 — Bài học Task 1a thành luật
- Người dùng yêu cầu Claude tự thêm kỹ năng tránh lặp lỗi 1a. Đã thêm: `.claude/rules/backend.md` (kiểu cột khớp Hibernate `validate`, test Flyway thuần, flush trước khi lưu entity tham chiếu entity cascade, grep caller khi xóa/đổi tên, TDD tích hợp viết test endpoint trước); skill `plan-review` (soát ranh giới task + chi tiết để ngỏ khi phản biện spec); `CLAUDE.md` (grep caller đầu task, script Python viết file thay heredoc).

### 2026-11-04 — Task 1a: V10 + state machine + Author API
- Đã làm: V10, entity snapshot/lịch sử, state machine trong `Article`, Author withdraw/discard/publication/DELETE/history, `imageIssues`, CORS PUT/DELETE, tài liệu. 69/69 test 4 lớp spec đạt.
- Quyết định kỹ thuật (ghi ở “Lệch khác spec” mục Task 1a): APPROVE tạo version ngay trong 1a; `imageIssues` kiểm cú pháp, không gọi Cloudinary.
- Bài học: Hibernate `validate` đòi `varchar(64)`, không nhận `char(64)`; lịch sử APPROVE phải lưu sau khi flush version (cascade) nếu không `version_id` bị null.
- Review: vòng 1 sửa 3 phát hiện (soft-delete HIDDEN, đếm 50 ảnh, lệnh RUNBOOK); vòng 2 approve. Việc dở: người dùng nhận 1a; Moderator/Public test hỏng tới 1b.

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

## Task 1a — Backend nền tảng + Author API (2026-11-04)

- **Đã làm:** `V10__add_article_publication_versions.sql` (guard bảng rỗng, hai trục trạng thái + CHECK, FK `(published_version_id, id)` → version cùng bài, bảng version/tag/history append-only bằng trigger, index queue/public/saved). Entity `ArticlePublicationVersion(+Tag)`, `ArticleModerationHistory`; `Article` chứa toàn bộ chuyển trạng thái (save no-op, submit no-change, withdraw, discard, author hide/unhide, hard/soft delete, approve/request changes, moderator hide/restore/remove). Fingerprint SHA-256 length-prefix, tag sắp UUID. Author API mới: `POST /{id}/withdraw`, `POST /{id}/discard`, `PATCH /{id}/publication`, `DELETE /{id}` (tombstone Redis `article:deleted:<id>` 24h), `GET /{id}/history`. SAVE cho ảnh Markdown chưa managed + trả `imageIssues`; cover luôn managed; SUBMIT dùng kiểm ảnh cũ. CORS thêm PUT/DELETE. `final.sql` (gộp V8–V10), `PROJECT_CONTEXT.md`, `RUNBOOK.md` (làm mới DB + Redis).
- **Review vòng 1 (Codex `review`):** [P1] soft-delete bài `HIDDEN` vi phạm CHECK nguồn ẩn → `softDelete` xóa `hiddenFromPublicationStatus`; [P2] giới hạn 50 ảnh đếm theo tập URL → đếm mọi node ảnh + cover (`checkImageCount`); [P2] RUNBOOK dùng sai container → `docker compose exec postgres`. Test thêm: lifecycle `softDeletingModeratorHiddenArticleDropsHiddenSource`, integration 51 ảnh trùng URL → 400, soft-delete khi `HIDDEN`. Chạy lại 4 lớp spec: 7 + 19 + 32 + 12 = 70/70.
- **Review vòng 2 (Codex `adversarial-review`, chỉ phần sửa):** approve, “No material findings”.
- **Test:** `./gradlew test --tests ArticlePublicationMigrationTest --tests ArticleLifecycleTest --tests AuthorArticleIntegrationTest --tests ArticleContentServiceTest` → BUILD SUCCESSFUL, 7 + 18 + 32 + 12 = 69/69. Test cũ sửa theo spec mới: `status` → `workflowStatus`; `resubmission…PublishedArticlesAreReadOnly` đổi thành `resubmissionPreservesReviewNote` (bài công khai nay sửa được); `uploadRetry…` SAVE ảnh ngoài nay 200 + issue, SUBMIT 400.
- **Lệch khác spec (chi tiết kỹ thuật tự chọn):**
  - APPROVE trong `ModeratorArticleServiceImpl` đã tạo version + lịch sử + `readingMinutes` ngay ở 1a (CHECK DB bắt buộc bài PUBLISHED có snapshot, và test Author cần xuất bản qua API thật). Phần 1b còn lại: endpoint HIDE/RESTORE/REMOVE, history Moderator, detail so sánh, kiểm lại ảnh khi APPROVE, eligibility badge, filter mới.
  - `imageIssues` xác định “managed” bằng cú pháp URL Cloudinary + prefix owner/article, không gọi Cloudinary (detail/save không tốn request mạng); SUBMIT/APPROVE vẫn kiểm asset thật. Loại issue: `LOCAL_FILE`, `EXTERNAL_URL`, `UNMANAGED_ASSET`.
  - Import giữ field `warnings` cho UI cũ tới Task 2a, thêm `imageIssues`.
  - SAVE/ảnh Markdown vẫn chặn scheme nguy hiểm (`javascript:`, `data:`) qua cùng luật link an toàn.
  - History Author nhận `page/size` qua `ArticleFilter` (các field khác bị bỏ qua) để dùng lại validation có sẵn.
  - `ArticlePublicationVersionRepository` chưa tạo (1a không cần; version lưu bằng cascade từ `Article`).
  - Trình tự TDD: unit/migration test viết trước và chạy đỏ; test tích hợp Author viết sau khi service đã có (chạy lần đầu đỏ do lỗi schema `char(64)`), không quan sát được đỏ theo từng hành vi API.
- **Chưa kiểm:** `ModeratorArticleIntegrationTest`, `PublishedArticleIntegrationTest` (hỏng có chủ đích tới 1b); cleanup ảnh chưa giữ asset chỉ còn version tham chiếu (1b); `final.sql` chỉ kiểm tĩnh, chưa chạy thử trên DB rỗng; Cloudinary thật (test dùng mock storage); chạy app thật trên DB dev (cần làm mới DB).

## Task 1b — Moderator + Public + cleanup + fixture (2026-11-04)

- **Đã làm:** Moderator: `PATCH /{id}/publication` (HIDE/REMOVE bắt buộc lý do, RESTORE về `hiddenFromPublicationStatus`, token stale 409, UNHIDE/thiếu token 400), `GET /{id}/history`; detail thêm `article.publishedVersion`, `history` (5 mục mới nhất), `authorEligible`; list thêm `authorEligible` (một query batch `ArticleRepository.findEligibleAuthorIds`) + `hasUnpublishedChanges`; APPROVE gọi `imageService.validateReferences`. Khóa user→profile→article tách thành `lock()` dùng chung review/publication. Public: `PublishedArticleRepository` join `published_version_id` → snapshot, predicate `visible()` (PUBLISHED + `users.is_active` + NOT EXISTS profile SUSPENDED) dùng cho list/detail/options/related; tag theo version (batch); detail thêm `PublishedArticleAuthorResponse` (expertise, `bioExcerpt` 300 code point); related cùng topic HOẶC chung tag, `publishedAt DESC, id ASC`, tối đa 5. Cleanup: `ArticlePublicationVersionRepository.findImageSources` → không xóa asset version nào tham chiếu. Xóa `demo-authors-articles.sql`, `HUONG_DAN.md` hướng dẫn 3–5 bài qua API; `PROJECT_CONTEXT.md` bảng API.
- **Test:** `./gradlew test --tests ModeratorArticleIntegrationTest --tests PublishedArticleIntegrationTest --tests ArticleSeedFixtureTest --tests AuthorArticleIntegrationTest` → lần đỏ 24/62 lỗi đúng lý do (thiếu endpoint/field); sau code BUILD SUCCESSFUL 19 + 15 + 26 + 34 = 94/94. `AuthorArticleIntegrationTest` thêm vì sửa cleanup/APPROVE (2 ca mới: APPROVE ảnh đã mất → 400; cleanup giữ ảnh chỉ version tham chiếu).
- **Lệch khác spec (chi tiết kỹ thuật tự chọn):**
  - Public bỏ `sortBy`/`direction`/`updatedAt` (lộ thời điểm sửa working copy); `sort=NEWEST/OLDEST` sắp `publishedAt` rồi `id` cùng chiều.
  - Tên trường tác giả giữ `fullName`/`avatarUrl` như API cũ (spec viết tắt `name/avatar`).
  - Public visible không đòi role AUTHOR/profile APPROVED, đúng chữ spec (account active + profile không SUSPENDED); `authorEligible` của Moderator dùng luật APPROVE (active + AUTHOR + APPROVED).
  - Moderator publication không chặn tự xử lý bài của chính mình (spec chỉ nêu self-review cho review).
  - `history` trong detail giới hạn 5 mục; đầy đủ qua `/history`.
  - `PublishedArticleSpecification` đổi từ `Specification<Article>` sang hàm predicate nhận join snapshot.
- **Review vòng 1 (Codex `review`):** “Không phát hiện lỗi mức trung bình hoặc cao”; không sửa, không chạy vòng 2.
- **Chưa kiểm:** Cloudinary thật (mock storage); FE chưa theo API mới (2a–2c); chạy app thật trên DB dev; `final.sql` không đổi ở 1b (không đổi schema).

## Task 1c — Backend lưu bài (2026-11-04)

- **Đã làm:** `SavedArticle` map bảng V1 (unique + FK cascade giữ nguyên; index đọc đã có từ V10). `SavedArticleRepository.insertIfAbsent` (`INSERT … ON CONFLICT DO NOTHING`) + `deleteByUserAndArticle`. `SavedArticleController`: `PUT/DELETE /api/v1/articles/{id}/saved` → `{saved}`, `GET /api/v1/me/saved-articles` (`keyword`/page/size). `PublishedArticleRepository`: `saved` của actor bằng `CASE WHEN EXISTS` trong cùng query list/detail/related; `isVisible`; `findSavedPage` join saved → article → snapshot với cùng predicate `visible()`. Security mở đúng 3 matcher. `ArticleIntegrationTestBase` cho 4 lớp tích hợp. `PROJECT_CONTEXT.md` bảng API.
- **Test:** lần đỏ `SavedArticleIntegrationTest` + ca mới Published (`--fail-fast`) → 403 (Security chặn PUT) đúng lý do. Xanh: 8/8 (123 s). Chạy cuối 4 lớp spec một Gradle (`./gradlew test --tests AuthorArticleIntegrationTest --tests ModeratorArticleIntegrationTest --tests PublishedArticleIntegrationTest --tests SavedArticleIntegrationTest`) → BUILD SUCCESSFUL, 34 + 19 + 16 + 7 = 76/76, tổng 280 s (Published 124 s, Author 70 s, Moderator 49 s, Saved 22 s); `Started …` chỉ xuất hiện 1 lần → 4 lớp dùng chung một context. Lượt trước đó 75/76: ca 1a nêu dưới.
- **Lệch khác spec (chi tiết kỹ thuật tự chọn):**
  - Race PUT xử lý bằng `ON CONFLICT DO NOTHING` (không ném lỗi unique rồi đọc lại); entity `SavedArticle` chỉ dùng cho query đọc.
  - Saved list sắp `saved_articles.created_at DESC, saved_articles.id DESC` (id của row lưu, khớp index V10); keyword tìm trên title snapshot như Public.
  - `SavedArticleSummaryResponse` lặp field của public summary + `saved`/`savedAt` (record phẳng, không `@JsonUnwrapped`).
  - Lớp cha khởi động container trong khối `static` (không `@Testcontainers/@Container`, vì extension dừng container sau mỗi lớp làm hỏng context cache); Ryuk dọn khi JVM thoát.
  - Test 1a `browserMayPreflightDeleteButUnmatchedEndpointsStayDenied` khẳng định `PUT …/saved` bị chặn “tới 1c” → đổi sang `PUT /api/v1/articles/{id}` (vẫn chưa có matcher).
- **Review vòng 1 (Codex `review`):** “Không phát hiện lỗi mức trung bình hoặc cao”; không sửa, không chạy vòng 2.
- **Chưa kiểm:** FE chưa dùng `saved`/API lưu (2c/2d); chạy app thật trên DB dev.

## Task 2a — Author workspace + editor (2026-11-04)

- **Đã làm:** `types/articles.ts`, `services/articleService.ts` (API Author + hàm thuần `authorActions` ma trận hành động, `changedFields` PATCH chỉ trường đổi, `isManagedImage`, `replaceImage`/`removeImage` theo source+occurrence, `resolveIssue`, `countImages`), `data/articleI18n.ts` (nhãn enum, mã lỗi vi/en, copy UI), `ArticleStatusBadges`, `ArticlePreview`, `MarkdownContent` thêm `imageAllowed`/placeholder, `TagPicker` sang Tailwind + `language`. `AuthorBlogsPage` = workspace (5 ô số liệu bấm lọc, filter/search/sort, hàng + nút chính + menu `⋯`, AlertDialog, Sheet lịch sử, empty/error/retry). `ArticleEditorPage` mới (header dính, banner trạng thái, metadata thu gọn, panel `imageIssues`, nhập file, chèn ảnh, ảnh bìa, preview/“Bản công khai vN”, mobile tab + Sheet + thanh đáy, chặn rời trang). `App.tsx` thêm 2 route.
- **Test:** RED đầu (module chưa có). Cuối: `npx vitest run` 8 file của spec → 191/192; lỗi: `App.auth.test.tsx` › routes ["MODERATOR"] (có sẵn trên HEAD). `npm run build` đạt.
- **Kiểm mắt (Playwright MCP, API giả lập bằng `page.route` đúng shape backend — backend 8080 không chạy, chạy thật cần xóa DB dev):** `/author/blogs` dark 1440 + light đo JS; editor dark 1440 + light (menu `⋯`, metadata mở); mobile 390 cảm ứng (`pointer: coarse` true) cho workspace, editor soạn thảo/xem trước: không cuộn ngang, mọi control ≥44 px, chữ nút không tràn. Preview không request ảnh ngoài (console chỉ có font/logo bị chặn). Sửa sau kiểm: nền/viền legacy trên `<button>` trần, metadata thu gọn với bài đã có (vùng viết từ y≈1043 → 657), header dính dưới topbar mobile, nhãn đóng Sheet “Đóng”.
- **Lệch khác spec (chi tiết kỹ thuật tự chọn):**
  - Hook `useArticleActions`, `ArticleActionMenu`, `ArticleHistorySheet` export từ `AuthorBlogsPage.tsx` (spec không có file riêng); 2b có thể dùng lại Sheet.
  - Định vị ảnh: regex Markdown, che code fence/inline code, lấy lần xuất hiện thứ `occurrence` của `source` và chỉ nhận nếu cùng `line` backend báo; lệch → không sửa, báo “Lưu nháp để cập nhật danh sách ảnh”.
  - Preview chỉ nạp ảnh `https://res.cloudinary.com/...` có `/<authorId>/<articleId>/` (mô phỏng cú pháp luật managed); còn lại placeholder.
  - Giới hạn 50 ảnh chỉ kiểm ở client khi “Chèn ảnh” (upload API không đếm; thay ảnh không đổi số lượng). File >5 MiB/sai loại báo tại dòng, không gửi request.
  - SUBMIT gặp `ARTICLE_IMAGE_INVALID`: tự SAVE phần đổi (hoặc tải lại detail) để lấy `imageIssues` mới.
  - Hộp thoại “Hủy bản sửa” không ghi số version (list không có `publishedVersion`). 403 không có code → câu `ACCESS_DENIED`.
  - Filter workspace giữ trong state, không đưa lên URL. Mobile tab dùng nhóm nút `aria-pressed` (không có primitive Tabs). `statusTone` giữ nguyên (AUTHOR_HIDDEN ra slate).
  - `App.author-session.test.tsx`: thay ca phân trang cũ bằng ca mở editor qua route App; ca 403 nay chặn list và kiểm câu tiếng Việt.
- **Chưa kiểm:** chạy với backend/DB thật và Cloudinary thật (upload, auto-SAVE, idempotency) — để E2E cuối module; CSS legacy `tag-picker*` còn trong `content.css` tới 2c.
- **Review vòng 1 (Codex `review`):** 5 phát hiện, sửa cả 5: [P1] form khóa khi đang ghi (`locked = readOnly || busy`, thay ảnh issue cũng khóa) để response cũ không ghi đè chữ mới; [P1] Ẩn/Hiện lại chỉ cập nhật trạng thái, giữ chỉnh sửa chưa lưu; [P2] preview chỉ nạp ảnh vừa khớp hình dạng URL backend (`/image/upload/v<n>/…/<author>/<article>/<id>.png`, không query/port) **vừa** thuộc danh sách tin cậy (ảnh đã lưu không bị liệt kê issue, ảnh bản công khai, ảnh vừa upload); [P2] lỗi tải chủ đề/thẻ có alert + Thử lại; [P2] import >1 MiB báo 413 thay vì 415. Test thêm 4 ca editor + 2 ca service. Chạy lại 7 file liên quan → 79/79, build đạt.
- **Review vòng 2 (Codex `adversarial-review`, phần sửa):** needs-attention, 1 phát hiện [high]: nút thay/bỏ ảnh, Thử lại, ghép nhiều file trong panel `imageIssues` chưa theo `locked` → khi SAVE chậm, thao tác ảnh có thể bị `apply(saved)` ghi đè; `busy` boolean có thể bị request xong trước đặt về false khi chạy chồng. **Chờ người dùng quyết** (khuyến nghị: sửa — dùng `locked` cho mọi nút panel + guard trong handler, thêm 1 test).
- **Sửa phát hiện vòng 2 (người dùng chọn sửa, 2026-11-04):** `busy` thành bộ đếm thao tác ghi đang chạy (`begin`/`end`), mọi handler ghi (lưu, thay/bỏ ảnh, ghép nhiều file, chèn ảnh, ảnh bìa, nhập file) dừng nếu đã có thao tác khác; nút thay/bỏ/Thử lại/ghép nhiều file theo `locked`. Test thêm: SAVE treo → nút panel khóa, input file bắn vẫn không upload. Chạy 7 file liên quan → 80/80, build đạt. Hết 2 vòng review theo quy trình; không chạy vòng 3.
