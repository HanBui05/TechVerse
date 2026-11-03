# Article flow — Log

Trạng thái chính thức: xem [`PLAN.md`](PLAN.md). Spec: [`article-flow.md`](article-flow.md). Ba mục đầu và “Nhật ký phiên” được hook SessionStart tự nạp sau `/clear`; giữ chúng ngắn.

## Bắt đầu từ đây (cập nhật 2026-11-04)

- **Task 1a đã nhận (2026-11-04)**, commit WIP `wip(article-flow): Task 1a`. Review vòng 1 sửa 3 phát hiện; vòng 2 (`adversarial-review`) approve, không phát hiện (chưa commit, branch `feature/article-flow`). 4 lớp test của spec đạt 69/69. Chi tiết, lệch spec, chưa kiểm: mục “Task 1a” cuối file.
- **Task tiếp theo: 1b** (Moderator + Public + cleanup + fixture). Đầu task: grep caller theo `.claude/rules/backend.md`; viết lại `ModeratorArticleIntegrationTest` + `PublishedArticleIntegrationTest` (đang hỏng có chủ đích); Public chuyển sang đọc snapshot; tạo `ArticlePublicationVersionRepository` nếu cần. Thứ tự: 1a → 1b → 1c → cổng wireframe → 2a → 2b → 2c → 2d → regression gộp + E2E.
- **Tạm hỏng tới 1b (có chủ đích):** `ModeratorArticleIntegrationTest`, `PublishedArticleIntegrationTest` còn ghi cột `status` cũ (đã bỏ ở V10) và kỳ vọng hành vi cũ; Public vẫn đọc cột working của `articles` lọc `publication_status=PUBLISHED` (chưa đọc snapshot). Task 1b phải viết lại hai lớp test này và query Public.
- **DB dev phải làm mới trước khi chạy app** (V10 dừng nếu `articles` có dữ liệu): lệnh ở `docs/RUNBOOK.md` mục “Làm mới DB dev”.
- **Môi trường:** Docker 29.6.1, `.env` có `CLOUDINARY_CLOUD_NAME`; RUNBOOK có tài khoản dev Moderator.

## Quyết định người dùng chưa có trong spec


## Câu hỏi mở cho người dùng

- (không có)

## Nhật ký phiên
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
