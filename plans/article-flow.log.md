# Article flow — Log

Trạng thái chính thức: xem [`PLAN.md`](PLAN.md). Spec: [`article-flow.md`](article-flow.md). Ba mục đầu và “Nhật ký phiên” được hook SessionStart tự nạp sau `/clear`; giữ chúng ngắn.

## Bắt đầu từ đây (cập nhật 2026-11-04)

- **Task 1a đã nhận (2026-11-04)**, commit WIP `wip(article-flow): Task 1a`.
- **Task 1b đã nhận (2026-11-04)**, commit WIP `wip(article-flow): Task 1b`; đã đánh dấu “Xong khi” 1b trong spec, nhờ Codex đồng bộ spec (kèm đề xuất container dùng chung).
- Task 1b: 4 lớp test 94/94, Codex review vòng 1 không phát hiện. Chi tiết, lệch spec, chưa kiểm: mục “Task 1b” cuối file.
- **Task tiếp theo: 1c** (Backend lưu bài), session mới; áp dụng luật tăng tốc mới (lần đỏ chỉ ca mới + `--fail-fast`) và ghi thời gian chạy test vào log để so. Thứ tự: 1a → 1b → 1c → cổng wireframe → 2a → 2b → 2c → 2d → regression gộp + E2E.
- **Frontend đang lệch API mới (có chủ đích, tới 2a/2b/2c):** `ModeratorArticlesPage`/`AuthorBlogsPage` còn đọc `status` (bỏ từ 1a); Public bỏ `updatedAt`, `sortBy/direction` → `sort`. Không sửa FE trong task Backend.
- **Đề xuất chờ Codex đưa vào spec (tăng tốc test, người dùng yêu cầu 2026-11-04):** lớp cha Testcontainers dùng chung Postgres/Redis + một cấu hình context chung (`@MockitoBean ArticleImageStorage`, `generate_statistics`) cho các lớp tích hợp article để Spring cache context; cần spec chỉ định đường dẫn file. Gửi kèm lượt nhờ Codex đồng bộ spec khi người dùng nhận 1b.
- **DB dev phải làm mới trước khi chạy app** (V10 dừng nếu `articles` có dữ liệu): lệnh ở `docs/RUNBOOK.md` mục “Làm mới DB dev”. Không còn seed SQL bài viết: tạo 3–5 bài qua API theo `server/src/test/resources/seed/HUONG_DAN.md`.
- **Môi trường:** Docker 29.6.1, `.env` có `CLOUDINARY_CLOUD_NAME`; RUNBOOK có tài khoản dev Moderator.

## Quyết định người dùng chưa có trong spec


## Câu hỏi mở cho người dùng

- (không có)

## Nhật ký phiên
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
