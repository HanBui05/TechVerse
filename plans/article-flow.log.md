# Article flow — Log

Trạng thái chính thức: xem [`PLAN.md`](PLAN.md). Spec: [`article-flow.md`](article-flow.md). Ba mục đầu và “Nhật ký phiên” được hook SessionStart tự nạp sau `/clear`; giữ chúng ngắn.

## Bắt đầu từ đây (cập nhật 2026-11-04)

- **Task 1a đã nhận (2026-11-04)**, commit WIP `wip(article-flow): Task 1a`.
- **Task 1b đã nhận (2026-11-04)**, commit WIP `wip(article-flow): Task 1b`; đã đánh dấu “Xong khi” 1b trong spec, nhờ Codex đồng bộ spec (kèm đề xuất container dùng chung).
- **Task 1c đã nhận (2026-11-04)**, commit WIP `wip(article-flow): Task 1c`; đã đánh dấu “Xong khi” 1c trong spec, nhờ Codex đồng bộ spec. 76/76, Codex review không phát hiện; chi tiết mục “Task 1c” cuối file. **Backend module xong (1a–1c).**
- **Cổng wireframe 2a–2d đã nhận (2026-11-04)** — [`article-flow.wireframe.md`](article-flow.wireframe.md) (bố cục + mục “Phong cách”); đã đánh dấu “Xong khi” cổng UI trong spec.
- **Task 2a đã nhận (2026-11-04)**, commit WIP `wip(article-flow): Task 2a`; đã đánh dấu “Xong khi” 2a trong spec, nhờ Codex đồng bộ spec. Test 80/80 + build đạt; Codex vòng 1 sửa 5 lỗi, vòng 2 sửa 1 lỗi; chi tiết mục “Task 2a” cuối file.
- **Task 2b đã nhận (2026-11-04)**, commit WIP `wip(article-flow): Task 2b`; đã đánh dấu “Xong khi” 2b trong spec, nhờ Codex đồng bộ spec (2 quyết định: bộ lọc Moderator, nút lên đầu trang). Chi tiết mục “Task 2b” cuối file.
- **Task 2c đã nhận (2026-11-04)**, commit WIP `wip(article-flow): Task 2c`; đã đánh dấu “Xong khi” 2c trong spec, nhờ Codex đồng bộ spec (gồm quyết định làm đẹp Reader). Preflight đã bật, 7 CSS legacy đã xóa; Codex vòng 1 sửa 3 lỗi, vòng 2 sửa 1 lỗi. Chi tiết mục “Task 2c” cuối file.
- **Task 1d đã nhận (2026-11-04)**, commit WIP `wip(article-flow): Task 1d`; đã đánh dấu “Xong khi” 1d trong spec, nhờ Codex đồng bộ spec (kèm quyết định chạy full cuối module). Test 24/24, Codex review vòng 1 không phát hiện. Một dòng `@PreAuthorize` ở `SavedArticleController`; chi tiết mục “Task 1d” cuối file.
- **Task 2d đã nhận (2026-11-04)**, commit WIP `wip(article-flow): Task 2d`; đã đánh dấu 6 mục “Xong khi” 2d trong spec, nhờ Codex đồng bộ spec. 262/262, build đạt, kiểm mắt thật đạt; Codex vòng 1 sửa 2 lỗi, vòng 2 approve; chi tiết mục “Task 2d” cuối file. **Tiếp: hoàn tất module** (regression gộp BE+FE song song → E2E thật → full BE rồi FE, mục “Hoàn tất module sau Task 2d” trong spec), session mới.
- **Hoàn tất module đã nhận (2026-11-04) — MODULE HOÀN TẤT**, commit WIP `wip(article-flow): Hoàn tất module`; đã đánh dấu 4 mục “Hoàn tất module” + mục 2c “Public 404…” trong spec, nhờ Codex đồng bộ spec. **PR đã mở; CI xanh sau khi push commit sửa test Admin (`803d288`, run 41850864882, 2026-11-04). Tiếp:** trước khi merge, squash các commit `wip(article-flow)` khi người dùng yêu cầu. Codex review vòng 1 không phát hiện; full BE sau sửa để CI (quyết định người dùng). Kết quả: regression gộp BE 147/147, FE 375 (1 ca chậm do tải, chạy riêng đạt); E2E API thật 46/46 + UI thật đạt (Cloudinary thật); full BE 368/370 → 2 test Admin taxonomy còn chèn cột `status` cũ, đã sửa fixture, 2 lớp 36/36; full FE 563/563. Dữ liệu E2E còn trong DB dev (bài của `hoa.author`). Chi tiết mục “Hoàn tất module” cuối file. Khi nhận: đánh dấu 4 mục “Xong khi” hoàn tất + mục 2c “Public 404…”, commit WIP, Codex đồng bộ spec; squash chỉ khi người dùng yêu cầu PR.
- Frontend đã theo API mới ở cả Author/Moderator/Reader.
- **Lỗi có sẵn:** Sidebar dư 8 px cuộn ngang ở desktop (cả `/profile`). (Lỗi `App.auth.test` Moderator đã sửa ở 2b.)
- **DB dev phải làm mới trước khi chạy app** (V10 dừng nếu `articles` có dữ liệu): lệnh ở `docs/RUNBOOK.md` mục “Làm mới DB dev”. Không còn seed SQL bài viết: tạo 3–5 bài qua API theo `server/src/test/resources/seed/HUONG_DAN.md`.
- **Môi trường:** Docker 29.6.1. DB dev đã vá checksum V10 (không cần làm mới DB; tài khoản dev còn nguyên, gồm `moderator@techverse.test`). Người dùng đã tạo API key Cloudinary mới (key cũ báo `api_secret mismatch`). Backend người dùng chạy từ IntelliJ (app không tự đọc `.env`).

## Quyết định người dùng chưa có trong spec

(không có)

## Câu hỏi mở cho người dùng

- (không có)

## Nhật ký phiên
### 2026-11-04 — CI PR đỏ: thiếu commit sửa test Admin
- CI `Server CI` run 41847950833 (PR `feature/article-flow`) đỏ 368/370: đúng 2 test Admin `BadSqlGrammarException` vì remote còn ở `824f909`, commit sửa `3554a5b` chưa push. Log Netty/Lettuce `RejectedExecutionException`/`Connection refused` cuối run là nhiễu lúc tắt (Testcontainers dừng trước khi Spring đóng context), không phải nguyên nhân.
- Quyết định người dùng (2026-11-04): commit phần Codex đồng bộ spec rồi `git push` (không force) nhánh `feature/article-flow` để CI chạy lại; squash làm sau, trước khi merge.
- Đã push `803d288`; CI run 41850864882 **success** (`BUILD SUCCESSFUL in 3m 57s`, full BE). Tiêu chí full BE của bước hoàn tất đã có CI xác nhận.

### 2026-11-04 — Codex đồng bộ hoàn tất module
- Codex: đã đưa quyết định không chạy lại full backend sau khi sửa hai test Admin vào spec; tiêu chí hoàn tất dùng kết quả full 368/370 + hai lớp đã sửa 36/36, còn full backend để CI chạy khi mở PR. Giữ nguyên 4 mục “Hoàn tất module” và mục 2c về public 404 ở `[x]`; trạng thái module trong `PLAN.md` đã là “Hoàn tất”.

### 2026-11-04 — Module article-flow đã nhận
- Người dùng nhận bước hoàn tất module; đánh dấu spec, commit WIP, nhờ Codex đồng bộ spec. Module hoàn tất. Tiếp: squash + PR khi người dùng yêu cầu.

### 2026-11-04 — Hoàn tất module: regression + E2E + full
- Đã làm: regression gộp, E2E thật (API + UI Playwright), full BE rồi FE; sửa 2 test Admin (`AdminTagIntegrationTest`, `AdminTopicIntegrationTest`) còn chèn cột `articles.status` đã bị V10 xóa.
- Bài học: Task 1a grep caller của `status` chỉ trong lớp article → sót SQL thô ở test module khác; chỉ full suite mới lộ. Chạy Vitest song song Gradle làm `findBy*` (1 s) hết hạn → lỗi giả.
- Codex review vòng 1 (job đầu treo, đã hủy, chạy lại): không phát hiện. Người dùng: full BE sau sửa để CI. Việc dở: người dùng nhận.

### 2026-11-04 — Codex đồng bộ Task 2d
- Codex: đã đối chiếu kết quả Task 2d trong log; toàn bộ 6 mục “Xong khi” Task 2d đã là `[x]` đúng theo kết quả test, build, kiểm mắt và review nên giữ nguyên. Bảng “Quyết định người dùng chưa có trong spec” đang trống nên không có quyết định nào cần đưa vào thân spec.

### 2026-11-04 — Task 2d đã nhận
- Người dùng nhận Task 2d; đánh dấu 6 mục “Xong khi” 2d trong spec, commit WIP, nhờ Codex đồng bộ spec. Tiếp: hoàn tất module (session mới).

### 2026-11-04 — Task 2d: UI Bài đã lưu
- Đã làm: `/me/saved-articles` (card dùng chung, dòng “Đã bỏ lưu · Hoàn tác” trên cùng `useSavedState`), nhóm sidebar “Góc của tôi”, `ReaderRoute` chuyển Admin/Moderator về dashboard, `canSave` ẩn nút/link lưu, bỏ “Về trang người dùng”.
- Kiểm mắt lần này đăng nhập thật được: mật khẩu dev mặc định `12345678` (`application-dev.yaml`), backend người dùng đã có 1d.
- Codex vòng 1 sửa 2 lỗi (quay lại từ detail, nhóm sidebar khi khôi phục phiên), vòng 2 approve. Việc dở: người dùng nhận.

- 2026-11-04 — Codex: đã đối chiếu và giữ nguyên 3 tiêu chí Task 1d ở `[x]`; đã đưa quyết định chạy full backend rồi full frontend một lượt, tuần tự sau regression gộp + E2E, vào spec.

### 2026-11-04 — Task 1d đã nhận
- Người dùng nhận Task 1d; đánh dấu 3 mục “Xong khi” 1d, commit WIP, nhờ Codex đồng bộ spec. Quyết định mới: chạy full BE + FE một lượt sau khi xong mọi task (mục “Quyết định người dùng”). Tiếp: Task 2d (session mới).

### 2026-11-04 — Task 1d: chặn saved với tài khoản quản lý
- Đã làm: `SavedArticleController` đổi class-level `@PreAuthorize` thành `isAuthenticated() and !hasAnyRole('ADMIN','MODERATOR')` (403 `ACCESS_DENIED` qua handler sẵn có); test ma trận quyền mới.
- Bài học: `User.createLocalAccount` đã tự gán `LEARNER` → tài khoản đa role trong test chỉ cần thêm role khác, gán lại `LEARNER` bị trùng khóa.
- Codex review vòng 1: không phát hiện mức cao/trung. Việc dở: người dùng nhận.

- 2026-11-04 — Codex: đã đưa hai quyết định Task 2d về nhóm “Góc của tôi”/route `/me/saved-articles` và chính sách tài khoản quản lý vào spec + wireframe; tách phần 403 backend thành Task 1d riêng trước Task 2d, đồng thời cập nhật contract, đường dẫn và ngân sách test.
- 2026-11-04 — Codex: đã đối chiếu “Chưa kiểm” của Task 2c; giữ 7 tiêu chí ở `[x]`, để tiêu chí public 404 theo trạng thái ở `[ ] (chưa kiểm — xem log)` và không chặn mở Task 2d vì E2E thật thuộc bước hoàn tất module.
- 2026-11-04 — Codex: đã đưa quyết định làm đẹp Reader vào thân spec và wireframe 2c, đồng thời xóa quyết định khỏi bảng chờ.
### 2026-11-04 — Task 2c đã nhận
- Người dùng nhận Task 2c (sau làm đẹp Reader + vòng 2 sửa slug tuyến tính); đánh dấu 8 mục “Xong khi” 2c trong spec, commit WIP, nhờ Codex đồng bộ spec. Bài học: máy 14,8 GB RAM dễ thiếu khi Vitest + build + Playwright + Codex chạy cùng lúc → lệnh chờ nền bị dừng, job Codex treo; chờ Codex thì không chạy test/trình duyệt. Tiếp: Task 2d (session mới).

### 2026-11-04 — Task 2c: Reader + preflight + CSS legacy
- Đã làm: `/blogs` (URL là nguồn filter, 9 bài/trang), `/blogs/:id` tách file (TOC, related, 404), `ArticleCard`, `ArticleSaveButton` (state machine), `MarkdownContent`/`Pagination` sang Tailwind; bật preflight, xóa 7 CSS + alias token; cập nhật luật frontend/skill `ui-components`/`UI_GUIDE` (hết giai đoạn preflight tắt).
- Test 13 file 309/309 + build đạt; kiểm mắt bằng API giả lập (không có mật khẩu dev trong `.env`).
- Bài học: lại chạy Python trong heredoc Bash (3 lần, đều chạy được nhưng trái luật) → Write file. `userEvent.setup()` tự gắn clipboard giả → mock clipboard sau `setup()`.
- Việc dở: Codex review vòng 1; người dùng nhận.

### 2026-11-04 — Codex đồng bộ quyết định Task 2c
- Codex: đã đưa quyết định `/blogs` dùng `size=9` với 9 skeleton và chi tiết card “Bài liên quan” vào spec; `BackToTopButton.test.tsx` đã có trong lệnh kiểm Task 2c.

### 2026-11-04 — Codex đồng bộ Task 2b
- Codex: đã đưa quyết định bộ lọc list Moderator và component dùng chung `BackToTopButton` vào spec; giữ nguyên 5 mục “Xong khi” Task 2b đã được đánh dấu `[x]` và bổ sung tiêu chí đã đạt cho nút lên đầu trang.

### 2026-11-04 — Task 2b đã nhận
- Người dùng nhận Task 2b; đánh dấu 5 mục “Xong khi” 2b trong spec, commit WIP, nhờ Codex đồng bộ spec. Tiếp: Task 2c (session mới).

### 2026-11-04 — Task 2b: nút lên đầu trang
- Người dùng thêm nút “Lên đầu trang” góc dưới phải ở detail Moderator; làm component dùng chung (2c dùng lại). 73/73 + build đạt, kiểm mắt desktop/mobile. Chưa qua Codex (hết 2 vòng). Bài học: lại vá script bằng `sed` và bị vỡ → luôn Write.

### 2026-11-04 — Tăng tốc Codex review
- Đo phiên 2b: 32 phút, Codex review 11,5 phút (vòng 1 7m50s). Nguyên nhân: `AGENTS.md` bảo “chạy bằng Git Bash” nhưng sandbox chặn → Codex thử `bash -lc`/`sed` lỗi rồi mới đổi. Người dùng: giữ vòng 2. Đã thêm luật shell PowerShell cho reviewer vào `AGENTS.md`; skill `codex-workflow`: chạy vòng 1 nền song song kiểm mắt.

### 2026-11-04 — Task 2b: Moderator UI
- Đã làm: dashboard/list 2 trục trạng thái, route detail `/moderator/articles/:id` toàn khổ so sánh song song (bỏ Sheet), dialog review/HIDE/RESTORE/REMOVE. 218/218 + build đạt; kiểm mắt bằng API giả lập.
- Quyết định mới: bộ lọc Chủ đề/Thẻ dùng options công khai, lọc tác giả bằng bấm tên (xem mục quyết định). Người dùng nhắc: chi tiết bài phải là form lớn, không nép bên phải — đã đáp ứng bằng trang riêng.
- Bài học: PowerShell `Get-Content -Raw` đọc UTF-8 thành ANSI → hỏng file test; import fixture từ file `*.test.ts` làm chạy lặp test → fixture để ở `src/test/articleFixtures.ts`.
- Codex vòng 1: 3 lỗi P2 đã sửa; vòng 2 approve. Việc dở: người dùng nhận → đánh dấu spec, commit WIP, Codex đồng bộ spec.

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

## Task 2b — Moderator UI (2026-11-04)

- **Đã làm:** `types/articles.ts` (summary/detail/filter Moderator), `articleService.ts` (`moderatorArticles` list/options/detail/review/publication/history; hàm thuần `moderatorActions`, `changedFromLive`, `lastReturnNote`), `articleI18n.ts` (nhãn trạng thái góc Moderator, mã lỗi Moderator, `isStaleError`, copy vi/en). `ArticleStats` 5 ô 2 trục (Chờ duyệt, Cần sửa, Đang công khai, Bị ẩn, Đã gỡ), bấm lọc ở list. List: mặc định “Chờ duyệt”, filter tiêu đề/chủ đề/thẻ/ngày gửi/sắp xếp/2 nhóm chip, hàng là link tới detail, viền trái theo trạng thái, cảnh báo tác giả không đủ điều kiện. `ModeratorArticleDetailPage` mới: breadcrumb, header + nút theo trạng thái (mobile thanh đáy 2 nút + `⋯`), dải “Thay đổi so với vN” + [Song song|Đề xuất|Công khai], hai cột, “Đã đổi” amber, thẻ Tác giả + Lịch sử 5 mục + Sheet đầy đủ, AlertDialog có ghi chú/lý do bắt buộc, “Lần trước trả về”, 409 stale → [Tải lại]. `App.tsx` route `/moderator/articles/:id`. `ArticleStatusBadges` thêm prop `moderator`; `ArticleHistorySheet` nhận `fetchPage`.
- **Test:** RED: service/i18n 28 lỗi (hàm chưa có), page detail/list lỗi (trang chưa có). Cuối: `npx vitest run src/services/articleService.test.ts src/data/articleI18n.test.ts src/pages/Moderator/ModeratorDashboardPage.test.tsx src/pages/Moderator/ModeratorArticlesPage.test.tsx src/pages/Moderator/ModeratorArticleDetailPage.test.tsx src/pages/Author/AuthorBlogsPage.test.tsx src/components/articles/ArticleStatusBadges.test.tsx src/App.auth.test.tsx` → 8 file, 218/218; `npm run build` đạt. Sau sửa breadcrumb chạy lại detail 6/6 + build đạt.
- **Kiểm mắt (Playwright MCP, API giả lập `route` đúng shape backend — backend 8080 không chạy):** list + detail dark/light 1440 (không cuộn ngang, 2 cột 544 px); mobile 390 cảm ứng (`pointer: coarse` true) list/detail/404: không cuộn ngang, không chữ tràn nút, thanh đáy 2 nút + `⋯`. Sửa sau kiểm: `ol` breadcrumb hiện số/thụt lề (preflight tắt) → `m-0 list-none p-0`; link breadcrumb thêm vùng chạm 44 px.
- **Lệch khác spec (chi tiết kỹ thuật tự chọn):**
  - Bộ lọc Chủ đề/Thẻ/Tác giả theo quyết định người dùng (mục “Quyết định”).
  - “Lần trước trả về” suy từ `moderationNote` + `reviewedAt` > `publishedVersion.approvedAt` (APPROVE đóng dấu hai mốc cùng một instant), không từ 5 mục lịch sử (có thể bị đẩy ra bởi ẩn/hiện).
  - Ngày trên hàng list là `updatedAt` (backend không có mốc gửi duyệt riêng), hiện dạng ngày, không “2 giờ trước”.
  - Lịch sử không có mục “Gửi duyệt/Rút lại” (backend không ghi SUBMIT/WITHDRAW).
  - Fixture contract dùng chung đặt ở `src/test/articleFixtures.ts` (file mới, ngoài danh sách đường dẫn spec); 2a đặt trong `articleService.test.ts`, import file test làm chạy lặp test.
  - `App.auth.test.tsx`: ca Google → `/moderator` chỉ đếm request `/auth`, `/users` (dashboard gọi số liệu là đúng).
  - Ảnh trong so sánh chỉ nạp URL managed đúng tác giả/bài (`isManagedImage`), còn lại placeholder.
- **Chưa kiểm:** backend/DB thật (E2E cuối module); Cloudinary thật.
- **Review vòng 1 (Codex `review`):** 3 phát hiện [P2], sửa cả 3: tải lại sau 409 stale lỗi vẫn giữ bài + token cũ → `reload` xóa `detail` trước khi tải; trang vượt `totalPages` khi hàng đợi co lại → về trang cuối; lỗi tải options chủ đề/thẻ bị nuốt → dòng lỗi + [Thử lại], “Làm mới” tải lại options. Test thêm 3 ca (viết trước khi sửa nhưng không chạy riêng lúc đỏ). Chạy `npx vitest run src/pages/Moderator/ModeratorArticlesPage.test.tsx src/pages/Moderator/ModeratorArticleDetailPage.test.tsx src/data/articleI18n.test.ts` → 58/58; build đạt.
- **Review vòng 2 (Codex `adversarial-review`, phần sửa):** approve, “No material findings”.
- **Bổ sung theo người dùng (sau review):** nút “Lên đầu trang” (`components/BackToTopButton.tsx` + test, file mới ngoài danh sách đường dẫn spec) ở detail Moderator: hiện khi `scrollY > 400`, cuộn mượt (tôn trọng reduced-motion). Test: RED (chưa có module) → `npx vitest run src/components/BackToTopButton.test.tsx src/pages/Moderator/ModeratorArticleDetailPage.test.tsx src/data/articleI18n.test.ts src/components/ui/focus.test.ts` 73/73; build đạt. Kiểm mắt (Playwright, API giả lập, dùng chung Vite cổng 3000 đang chạy): desktop 1440 nút 44×44 cách đáy 24 px, bấm → `scrollY` 0; mobile 390 cảm ứng nút cách đáy 96 px, trên thanh nút (cao 69 px). Chưa qua Codex review (đã hết 2 vòng của task).

## Task 2c — Reader + preflight + CSS legacy (2026-11-04)

- **Đã làm:** `types/articles.ts` (DTO public + `ReaderFilter`), `articleService.ts` (`publicArticles` list `size=9`/options/detail/`setSaved` PUT·DELETE; hàm thuần `readerFilter`/`readerSearch`/`readerBackTarget`), `articleI18n.ts` (`readerText`, `readerErrorText`, `relativeDate`), fixture public ở `test/articleFixtures.ts`. `ArticleSaveButton` + hook `useSavedState` (một request bay, gửi ý định cuối, lỗi rollback về success gần nhất; 2d dùng lại `setSaved` cho Undo). `ArticleCard` (cover 16:10/fallback tone, meta, 3 tag + “+N”, phút đọc, lưu, “Đọc tiếp”, tác giả; link mang `state.from`). `MarkdownContent`: kiểu chữ bằng utility, `slugify`/`uniqueSlug` + plugin rehype gán id h1–h3 khi `anchors`, nút sao chép link mục/mã (`CopyButton`, báo lỗi tại chỗ). `Pagination` dạng số (dùng `pageItems` của `AdminPagination`). `BlogsPage` (header, card lọc, chip chủ đề, thẻ, sắp xếp, chip tổng, lưới 3/2/1, 9 skeleton, empty 2 loại, lỗi + Thử lại, về trang cuối khi trang vượt). `BlogDetailPage.tsx` mới (breadcrumb, nội dung ≤880 + sidebar 280 sticky cuộn riêng, tác giả, TOC đánh dấu mục đang đọc, ≤5 bài liên quan + “Xem tất cả <chủ đề>”, mobile TOC `<details>` + sidebar xuống cuối, 404, `BackToTopButton`). `App.tsx` truyền `language`. `styles.css`: preflight trong `layer(base)`, khối base nền/chữ/màu viền; xóa 7 CSS + khối `[data-slot]`/`.tw-page` + alias `--bg/--surface/--surface-2/--text/--on-primary`.
- **Test:** RED quan sát được: `MarkdownContent.test.tsx` 4/5 lỗi (thiếu `slugify`, id, nút sao chép). Service/i18n, `ArticleSaveButton`, `ArticleCard`, `Pagination`, `BlogsPage`, `BlogDetailPage` viết test cùng lượt với code, lần chạy đầu đã xanh (không quan sát RED riêng). Cuối: `npx vitest run` 11 file của spec + `ModeratorArticleDetailPage.test.tsx` + `ArticleEditorPage.test.tsx` (dùng `MarkdownContent`) → 13 file, 309/309; `npm run build` đạt. Sau sửa kiểm mắt: `ArticleCard.test` + `BlogsPage.test` 8/8, build đạt.
- **Kiểm tĩnh preflight:** grep không còn class legacy (`page-content`, `blogs-*`, `article-*`, `button-*`, `application-row`, `section-kicker`, `tag-picker*`, `markdown-*`, `pagination-*`) ngoài primitive `data-slot="pagination"`; mọi `h1–h6` trong `.tsx` có class cỡ chữ; mọi `ul/ol` ngoài Markdown là list bố cục. Không còn import tới file CSS đã xóa.
- **Kiểm mắt (Playwright MCP, API giả lập `page.route` đúng shape backend — backend 8080 chạy nhưng `.env` không có `INITIAL_ADMIN_PASSWORD` để đăng nhập thật):** `/blogs` 1440 light + dark: 3 cột × 9 card, select giãn đủ cột, không cuộn ngang, `h1` 30px không margin/letter-spacing; `/blogs/:id` dark 1440: nội dung 793 + sidebar 280 sticky, TOC đổi mục khi cuộn, code/hljs/bảng/list đúng màu; mobile 390 cảm ứng (`pointer: coarse` true) list + detail: không cuộn ngang, mọi control ≥44 px, không chữ tràn, TOC thu gọn đầu bài, sidebar dưới bài, breadcrumb rút còn “Bài viết”. Sửa sau kiểm: select `w-fit` → giãn cột; link tiêu đề card một dòng cao 19 px → `pointer-coarse:min-h-11`.
- **Lệch khác spec (chi tiết kỹ thuật tự chọn):**
  - TOC đọc id heading từ DOM sau khi render (cùng một lần slug của plugin rehype) thay vì parse Markdown riêng; `#` (h1) hiển thị như H2 nên cũng có id/vào TOC. Anchor + id chỉ bật ở Reader (`anchors`), không ở preview editor/so sánh Moderator để tránh id trùng.
  - Nút “Bài đã lưu” ở header `/blogs` để Task 2d (spec 2d ghi link từ header).
  - Mục lục mobile đặt ngay dưới tóm tắt (trước hàng tag).
  - `CopyButton` export từ `MarkdownContent.tsx` (dùng cho copy-link bài); `ArticleCard` lấy `TONE_TILE` từ `AuthorBlogsPage` như Moderator.
  - Class `tw-page` còn trên `<main>` các trang (không còn rule CSS); không sửa file ngoài phạm vi chỉ để xóa class chết.
  - Luật lỗi thời cập nhật: `.claude/rules/frontend.md` (mục preflight), skill `ui-components`, `docs/design/UI_GUIDE.md`.
- **Chưa kiểm:** dữ liệu/backend thật (đăng nhập thật, lưu bài, 404 do ẩn/soft-delete/suspended — để E2E cuối module; phần 404 đã phủ bằng test 404 chung vì backend trả cùng một 404); trang ngoài module sau khi bật preflight chỉ kiểm tĩnh theo spec, không kiểm mắt; lỗi có sẵn Sidebar dư cuộn ngang vẫn còn.
- **Review vòng 1 (Codex `review`):** 3 phát hiện [P2], sửa cả 3: slug trùng khi heading có sẵn hậu tố (`Foo`, `Foo 2`, `Foo` → `foo-2` hai lần) → `uniqueSlug` dùng tập id đã phát, bỏ qua id đã có; URL có param rỗng/mặc định/lạ bị coi là đang lọc → `BlogsPage` tính query chuẩn và `replace` URL về dạng chuẩn; hash sai định dạng (`#%`) làm `decodeURIComponent` ném lỗi → so hash thô (slug chỉ `[a-z0-9-]`). Test thêm 3 ca (RED đúng lý do: `seen.get`, “không tìm thấy Chưa có bài viết nào”, `URIError`). Chạy lại `MarkdownContent.test` + `BlogsPage.test` + `BlogDetailPage.test` 17/17, `ModeratorArticleDetailPage.test` + `ArticleEditorPage.test` 20/20, build đạt.
- **Làm đẹp Reader theo người dùng (2026-11-04, sau vòng 1; mục “Quyết định”):** xem mẫu chi tiết javabuilder.online (chỉ đo bố cục: bài trong một card lớn bo 16 + viền + bóng, ảnh bìa tràn, chip meta có viền, tag chip 14px, card “Hành động nhanh”). `/blogs`: header có ô icon + kicker; bộ lọc gọn một hàng (tìm kiếm, Thẻ có icon, Sắp xếp có icon, chip tổng) + chip chủ đề tô màu `toneFor` kèm icon (`topicIcon`), cao ~170 → 118 px; card bo 16, nhấc lên + bóng khi hover, ảnh/ô bìa phóng nhẹ, ô bìa fallback có icon trang trí, chip phút đọc nổi trên ảnh, hàng chip topic + tối đa 3 tag + `+N`, tác giả avatar 36 có viền + tên đậm + nhãn “Tác giả”, nút “Đọc tiếp” nền nhấn; card xuất hiện lần lượt (`tw-animate-css`, tắt khi reduced-motion). `/blogs/:id`: thanh tiến độ đọc trên cùng (`role=progressbar`), bài trong card lớn, ô bìa fallback lớn, H1 36px, hàng chip tác giả/ngày/cập nhật (green)/phút đọc (sky), tóm tắt tone blue + icon, tag chip lớn, nội dung 16px; sidebar 300 px: thẻ tác giả kiểu hồ sơ (dải màu + avatar 64 + chuyên môn dạng badge), tiêu đề card có ô icon màu, bài liên quan ảnh 56 + hover, card “Hành động nhanh” (Tất cả bài viết, Bài cùng chủ đề — chỉ link có sẵn).
  - Lỗi phát hiện khi kiểm mắt và đã sửa: mở chi tiết từ list đang cuộn giữ nguyên vị trí cuộn → cuộn lên đầu khi đổi bài (trừ khi có `#mục`); card sidebar `overflow-hidden` bị co về 0 trong cột flex có `max-h` → `[&>*]:shrink-0`.
  - Kiểm: `ArticleCard.test` + `BlogsPage.test` + `BlogDetailPage.test` + `articleI18n.test` + `MarkdownContent.test` 66/66, build đạt. Kiểm mắt Playwright (API giả lập): desktop 1440 dark + light list/detail, không cuộn ngang; mobile 390 cảm ứng list/detail: không cuộn ngang, mọi control ≥44 px, không chữ tràn.
  - Chưa qua Codex (vòng 2 bị dừng do thiếu RAM); phần làm đẹp nên gộp vào vòng 2.
- **Review vòng 2 (Codex `adversarial-review`, phần sửa vòng 1 + làm đẹp; job cũ treo do thiếu RAM đã hủy, chạy lại):** needs-attention, 1 phát hiện [medium]: `uniqueSlug` dò hậu tố lại từ `-2` cho mỗi heading trùng → bậc hai, bài 1 MiB nhiều heading trùng có thể treo Reader. Phần làm đẹp không có phát hiện. **Người dùng chọn sửa (2026-11-04):** `seen` thành `Map` id → hậu tố kế tiếp, không quét lại (tuyến tính). Test thêm: 20.000 heading trùng < 500 ms, id duy nhất, `a-20000`; ca `Foo, Foo 2, Foo, Foo 3, Foo` → `foo, foo-2, foo-3, foo-3-2, foo-4`. RED (`seen.add is not a function`) → `MarkdownContent.test` + `BlogDetailPage.test` 12/12, build đạt. Hết 2 vòng, không chạy vòng 3.

## Task 1d — Backend chặn lưu bài với tài khoản quản lý (2026-11-04)

- Sửa: `SavedArticleController` class-level `@PreAuthorize("isAuthenticated() and !hasAnyRole('ADMIN', 'MODERATOR')")` — chặn cả PUT/DELETE `/articles/{id}/saved` và GET `/me/saved-articles` trước service nên không chạm row và không phụ thuộc article visible. `AuthorizationDeniedException` → 403 `ACCESS_DENIED` qua `GlobalExceptionHandler` có sẵn. Không đổi schema/URL/DTO/SecurityConfiguration.
- Test (`SavedArticleIntegrationTest`): ca “mọi role auth” thay bằng `managerRolesAreDeniedOnAllSavedRoutesWithoutTouchingRows` (Moderator, Admin, tài khoản LEARNER+AUTHOR+ADMIN; PUT/DELETE trên bài visible, bài đã có row, ID ngẫu nhiên + GET list → 403 `ACCESS_DENIED`; row cũ còn 3, không tạo row mới) và `putAndDeleteAreIdempotentForLearnerAndAuthor` (regression).
- Lệch khác spec: không có. Caller khác: `PublishedArticleIntegrationTest` chỉ lưu bằng token Learner → không ảnh hưởng.
- RED: 403 expected nhưng 200. Cuối: `./gradlew test --tests '...SavedArticleIntegrationTest' --tests '...PublishedArticleIntegrationTest'` → 8/8 + 16/16 đạt.
- Chưa kiểm: không chạy full backend (CI); không kiểm app thật.
- Review vòng 1 (Codex `review`): “Không phát hiện lỗi mức cao/trung.” Không cần vòng 2.

## Task 2d — UI Bài đã lưu (2026-11-04)

- **Đã làm:** `App.tsx`: `managerHome` (ADMIN → `/admin`, rồi MODERATOR → `/moderator`) dùng chung cho đăng nhập và guard `ReaderRoute` (`Navigate replace`) trên `/`, `/blogs`, `/blogs/:id`, route mới `/me/saved-articles` (thêm `AuthRoute`); `canSave` truyền xuống `BlogsPage`/`BlogDetailPage` → `ArticleCard`. `Sidebar` thêm nhóm cố định “Góc của tôi” → “Bài đã lưu”; `AdminSidebar`/`ModeratorSidebar` bỏ “Về trang người dùng”. `BlogsPage` header thêm nút “♡ Bài đã lưu” (chỉ khi `canSave`). `ArticleSaveButton` tách `SaveToggle` (trình bày, có `autoFocus`); `ArticleCard` nhận `canSave` + `saveButton`. `SavedArticlesPage.tsx` mới: header (kicker, h1, chip tổng, nút “Tất cả bài viết” — mobile thành icon), tìm kiếm Enter/✕, lưới như `/blogs`, 6 skeleton, empty tim + “Khám phá bài viết”, empty tìm kiếm + “Xóa tìm kiếm”, lỗi + Thử lại, phân trang, về trang cuối khi trang vượt. `publicArticles.savedList`, type `SavedArticleSummary`, fixture `savedSummaryFixture`, copy vi/en trong `readerText`.
- **Test:** RED: 6 ca mới lỗi đúng lý do (thiếu `canSave`, nhóm sidebar, link quản trị còn) + `SavedArticlesPage.test` chưa có module; ca service viết cùng lượt code nên không thấy RED riêng. Cuối: `npx vitest run src/services/articleService.test.ts src/data/articleI18n.test.ts src/components/articles/ArticleCard.test.tsx src/components/articles/ArticleSaveButton.test.tsx src/pages/Blogs/BlogsPage.test.tsx src/pages/Blogs/BlogDetailPage.test.tsx src/pages/Blogs/SavedArticlesPage.test.tsx src/components/layout/Sidebar.test.tsx src/App.auth.test.tsx` → 9 file 262/262; `npm run build` đạt. Sau sửa dòng hoàn tác: `SavedArticlesPage.test` 5/5 + build đạt.
- **Kiểm mắt (Playwright MCP, backend dev thật, `bao.author` / `moderator`, mật khẩu dev mặc định):** desktop 1440 dark: trang có 1 bài, nhóm “Góc của tôi” active, bỏ lưu → dòng hoàn tác (focus vào nút Hoàn tác), Hoàn tác → card trở lại `aria-pressed=true` và focus về nút lưu, empty thật (“Chưa có bài đã lưu” + CTA); light: card/nền đúng token, không cuộn ngang trang. Mobile 390 cảm ứng (`pointer: coarse` true): không cuộn ngang, mọi control ≥44 px, không chữ tràn, dòng hoàn tác full width cao 62 px. Moderator thật: `/blogs`, `/`, `/me/saved-articles` → `/moderator`, không request saved, không có link “Về trang người dùng”. Sửa sau kiểm: dòng hoàn tác bị xuống 2 hàng ở desktop → một hàng (tiêu đề cắt `…`).
- **Lệch khác spec (chi tiết kỹ thuật tự chọn):**
  - Tìm kiếm/trang của Bài đã lưu giữ trong state, không lên URL (spec không đòi).
  - Dòng hoàn tác ghi thêm tiêu đề bài (cắt `…`) để biết bài nào; `size=9` như `/blogs`, skeleton 6 theo wireframe.
  - `VALIDATION_ERROR` ở trang này dùng câu “Kiểm tra lại bộ lọc bài đã lưu.” theo bảng mã lỗi.
  - `Sidebar.test`: ca đếm icon Admin ≥7 → ≥6 (bỏ một mục).
- **Chưa kiểm:** Admin thật (không đổi được, chỉ test + logic chung `managerHome`); nhiều trang phân trang thật (DB dev chỉ 1 bài công khai). Lỗi có sẵn: thanh cuộn ngang 8 px ở Sidebar do `SidebarSeparator` (`w-full` + `mx-2`) — không sửa (ngoài phạm vi).
- **Review vòng 1 (Codex `review`):** 2 phát hiện [P2], sửa cả 2: detail mở từ Bài đã lưu “Về danh sách” ra `/blogs` → `readerBackTarget` nhận thêm đúng `/me/saved-articles` (đã sửa dòng tương ứng ở “Lệch khác spec”); khi khôi phục phiên `roles` còn rỗng nên Admin/Moderator thoáng thấy “Bài đã lưu” → nhóm “Góc của tôi” chỉ hiện khi đã có `profile` và không có role quản lý. Test thêm (RED đúng lý do): 2 kỳ vọng `readerBackTarget`, 2 ca Sidebar (profile chưa tải; LEARNER+MODERATOR). Chạy `npx vitest run src/services/articleService.test.ts src/components/layout/Sidebar.test.tsx src/pages/Blogs/BlogDetailPage.test.tsx src/pages/Blogs/SavedArticlesPage.test.tsx` → 76/76; build đạt.
- **Review vòng 2 (Codex `adversarial-review`, phần sửa):** approve, “No material findings”.

## Hoàn tất module sau Task 2d (2026-11-04)

- **Regression gộp (song song):** BE lệnh spec → `BUILD SUCCESSFUL` 4m20s, 10 lớp 147/147. FE 21 file spec → 374/375 + build đạt; ca lỗi `App.author-session.test.tsx` “F5 after approval…” (`findByRole('option','Java Backend')` hết 1 s) do máy tải nặng khi Gradle + Testcontainers chạy cùng; chạy riêng file sau khi BE xong → 6/6. Không phải lỗi code.
- **E2E API thật** (script tạm scratchpad `e2e.mjs`, backend IntelliJ đã nạp code 1d, `hoa.author` = Author, `lan.author` = Reader): 46/46. Tạo 4 bài từ `articles.json` (không SQL): A=`ec1e2af8-…` ảnh ngoài → `imageIssues` → SUBMIT 400 `ARTICLE_IMAGE_INVALID` → upload Cloudinary thật (ảnh + cover) → SUBMIT; v1 approve → sửa, Reader vẫn v1 → REQUEST_CHANGES (note) → gửi lại → approve v2 cùng URL; Author hide/unhide; Moderator HIDE từ AUTHOR_HIDDEN → Author UNHIDE 409 → RESTORE về AUTHOR_HIDDEN; Admin suspend `hoa.author` → 4 bài 404 + biến khỏi list/saved → restore hiện lại; Admin/Moderator ba API saved 403 `ACCESS_DENIED`; soft delete B (đang lưu) biến khỏi public/saved/Author list/queue, Moderator RESTORE 409; hard delete nháp + retry key 409 `ARTICLE_KEY_CONFLICT`.
- **E2E UI thật (Playwright MCP, desktop, dark mặc định):** Reader `/blogs` lưu/bỏ lưu trên card (DB 1→2→1); `/blogs/A` H1 v2 + nhãn “Cập nhật” + ảnh Cloudinary; `/me/saved-articles` bỏ lưu → “Đã bỏ lưu” → Hoàn tác (focus về nút lưu). Moderator + Admin: `/`, `/blogs`, `/blogs/:id`, `/me/saved-articles` → dashboard đúng role, 0 request saved, không có “Về trang người dùng”; dialog Duyệt bài C hiện “Lần trước trả về: …” và duyệt thành công. Author: editor nháp F có 2 ảnh ngoài → “2 ảnh cần tải lên”, Gửi duyệt khóa, 0 request tới URL ngoài; “Tải ảnh thay thế” bằng PNG thật → Cloudinary → còn 1.
- **Full (tuần tự):** BE `./gradlew test` → 370, 2 lỗi `BadSqlGrammarException`: `AdminTagIntegrationTest.renameAndStatusChangesPreserveArticlesAndAllTagLinks`, `AdminTopicIntegrationTest.inactivePreservesAllFourReferencingContentTypesWithoutChangingRows` chèn `articles(status,published_at)` — cột `status` bị V10 xóa (regression từ Task 1a). Sửa fixture: chèn nháp mặc định V10 + `content_fingerprint=repeat('0',64)` (ý định test giữ nguyên: đổi taxonomy không đổi row bài). Chạy lại 2 lớp → 36/36. FE `npm test` → 44 file 563/563.
- **Lệch khác spec:** spec đòi full BE đạt “trong đúng một lượt”; lượt full có 2 lỗi trên, đã sửa và chỉ chạy lại 2 lớp bị ảnh hưởng (không chạy lại full ~9 phút) — người dùng chọn để CI chạy khi mở PR (2026-11-04).
- **Review vòng 1 (Codex `review`):** “Không phát hiện lỗi chức năng hoặc bảo mật… Hai fixture Admin đã được cập nhật phù hợp schema V10.” Không cần vòng 2. Sửa 2 file test ngoài “Đường dẫn thuộc module” vì lỗi do V10 của module.
- **Chưa kiểm:** mobile/light trong lượt E2E (đã kiểm mắt ở từng task); 429/>50 ảnh/>5 MiB với Cloudinary thật (đã phủ unit test). Dữ liệu E2E để lại trong DB dev (bài A/C/D công khai của `hoa.author`, B soft-delete, nháp F; `lan.author` lưu A).
