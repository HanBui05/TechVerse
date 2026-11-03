# UI foundation v2 (shadcn) — Log

Trạng thái chính thức: xem [`PLAN.md`](PLAN.md). Spec: [`ui-foundation-v2.md`](ui-foundation-v2.md) — nguồn chuẩn về phạm vi; log chỉ giữ phần spec chưa có. Ba mục đầu và “Nhật ký phiên” được hook SessionStart tự nạp sau `/clear`; giữ chúng ngắn.

## Bắt đầu từ đây (cập nhật 2026-11-03)

- **Module `ui-foundation-v2` hoàn tất; `refactor/admin-ui` đã push, người dùng tự mở PR → `main` (merge commit) vì tài khoản `gh` trên máy không phải cộng tác viên repo** (Task 1–7b + nhiệm vụ sửa UI Admin/Moderator trên `refactor/admin-ui`, vòng 1–3 đã nhận 2026-11-03). Module đang làm chuyển sang `article-flow` (xem `plans/article-flow.log.md`).
- Đã có trên `main`: Admin Người dùng/Chủ đề/Thẻ/Hồ sơ tác giả theo ảnh `docs/image_admin_page/` (ghi chú `README.md`), `AdminPagination` 12/trang, `adminErrorText` (dịch theo `code`), icon chủ đề (V9 `topics.icon`, `simple-icons`), Moderator `/moderator` + `/moderator/articles` cùng khung Admin.
- **Chưa kiểm:** logo thật lưu qua backend (backend người dùng cần khởi động lại cho V9); Moderator với bài thật (DB dev không có bài); mobile Hồ sơ tác giả.
- **Ngoài phạm vi:** link logo Auth/topbar mobile < 44px.

## Quyết định người dùng chưa có trong spec

- 2026-11-03 (branch `refactor/admin-ui`, sau vòng 3): người dùng đồng ý sửa phát hiện vòng 2 (bio dài trong Sheet Hồ sơ tác giả); yêu cầu bảng chọn icon Chủ đề có **nhiều icon hơn** (hiện chỉ ≤ 24 gợi ý theo tên, ô trống thì không có gì).
- 2026-11-03 (branch `refactor/admin-ui`, vòng 3): người dùng đồng ý làm ngay **giao diện Moderator theo chuẩn Admin** trên branch này (đổi D-027 cho phần trình bày): `/moderator` (đầu trang + thẻ số), `/moderator/articles` (card lọc + chip trạng thái, danh sách bảng/thẻ, `AdminPagination`, khung đọc bài + nhận xét bằng primitive, `AlertDialog` thay `window.confirm`). Giữ nguyên chức năng/API, không thêm tính năng; `article-flow` sau này cắm chức năng vào khung này.

- 2026-11-03 (branch `refactor/admin-ui`, vòng 2): (1) Chủ đề có **icon thật**: thêm cột `icon` (slug của `simple-icons`) cho topic — migration + API tạo/sửa/đọc + validate slug; form Chủ đề có bảng chọn icon (tìm + gợi ý theo tên), không chọn thì hiện chữ cái đầu; người dùng cho làm thẳng trên branch (không chờ spec Codex). Màu: dùng màu thương hiệu thật trên nền ô sáng nhẹ (khuyến nghị của Claude, người dùng không phản đối). (2) Bỏ hàng nút Sửa/Ẩn trên card Chủ đề/Thẻ — bấm cả card mở form (form có nút Ẩn/Kích hoạt); Thẻ giữ lưới như hiện tại (không làm bố cục 4 cột). (3) `/admin/author-applications` làm lại cho đồng bộ với `/admin/users` (thẻ số, card lọc, danh sách cùng kiểu). (4) Kiểm UI Moderator so với chuẩn Admin, muốn một chuẩn chung — báo kết quả kiểm trước khi sửa vì Moderator đang thuộc `article-flow` (D-027).
- 2026-11-03 (branch `refactor/admin-ui`): người dùng giao thẳng nhiệm vụ sửa UI Admin theo ảnh `docs/image_admin_page/` (ghi chú từng ảnh: `docs/image_admin_page/README.md`): (1) `/admin/users` theo `admin-user-management.png`; (2) `/admin/topics`, `/admin/tags` đẹp hơn theo `admin-interview-questions.png`; (3) lỗi trùng tên ở tiếng Việt hiện câu tiếng Anh — kiểm cả hai trang; (4) số mục mỗi trang (người dùng gợi ý 9 hoặc 12) + kiểm nút chuyển trang. Đã chốt 2026-11-03: 12 mục/trang (Người dùng, Topic, Tag); thông báo lỗi dịch theo mã HTTP ở cả 4 trang Admin (không sửa backend); trang Người dùng: thẻ số Tổng/Hoạt động/Đã khóa/Tác giả, card lọc + Làm mới, bảng (mobile thành thẻ), giữ chọn nhiều + khóa hàng loạt, bỏ tạo/sửa/xóa/MFA/khoảng ngày; phân trang số riêng cho Admin. Làm Người dùng trước, rồi Topic/Tag.
- 2026-11-03: giao diện Admin bám bố cục ảnh mẫu nhưng vẫn theo luật FE (`.claude/rules/frontend.md`, skill `ui-components`): shadcn + token TechVerse (bảng màu D-010, dark mặc định, Inter, vùng chạm 44px), copy vi/en tự viết, không chép chữ/logo/code của trang mẫu.
- 2026-11-03 (sau Task 7b): người dùng nhận Task 7b và yêu cầu đánh dấu hoàn thành toàn bộ Task 1–7 trong spec (Claude tự đánh dấu theo yêu cầu, kể cả mục còn ghi “chưa kiểm”). Phần sửa lỗi tiếp theo là nhiệm vụ riêng người dùng giao thẳng cho Claude, không cần quy trình phức tạp.
## Câu hỏi mở cho người dùng

- (không có)

## Nhật ký phiên
### 2026-11-03 — Nhận Admin UI vòng 2 + 3, merge `main`
- Người dùng nhận toàn bộ việc trên `refactor/admin-ui`; commit, push các nhánh, merge vào `main` qua PR (merge commit theo `docs/GIT_WORKFLOW.md`, không push thẳng `main`). Chuyển module đang làm sang `article-flow` (chờ Codex viết spec).
### 2026-11-03 — Moderator theo chuẩn Admin
- `/moderator` + `/moderator/articles` dựng lại cùng khung Admin (thẻ số thật, card lọc, bảng/thẻ, `AdminPagination` 12/trang, Sheet đọc bài, `AlertDialog`); xóa `moderator.css`; lỗi `ARTICLE_*` dịch vi/en; chặn race thống kê ở 3 trang. 50/50, build đạt.
- Việc dở: phát hiện vòng 2 (bio dài) chờ người dùng; người dùng nhận cả vòng 2 + 3 rồi commit cục bộ.
### 2026-11-03 — Admin UI vòng 2
- Icon chủ đề: V9 `topics.icon` (slug simple-icons, CHECK), API tạo/sửa/đọc, form có bảng chọn (gợi ý theo tên, bí danh java→openjdk); card Chủ đề/Thẻ bấm cả card để sửa; Hồ sơ tác giả cùng khung Quản lý người dùng; `Textarea` primitive `font-sans`. Backend Topic 18/18, FE 86/86, build đạt.
- Moderator: chưa theo chuẩn Admin (CSS cũ, `window.confirm`) — chờ người dùng quyết vì đang thuộc `article-flow` (D-027).
### 2026-11-03 — Admin UI theo ảnh mẫu
- Người dùng/Topic/Tag dựng lại theo ảnh; `ApiError.code` + `adminErrorText` (dịch theo mã lỗi → HTTP → câu mặc định) cho 4 trang Admin; `AdminPagination` số trang; 12 mục/trang. 43/43, build đạt; kiểm thật: trùng tên vi/en, phân trang Tag 13 mục.
- Bài học: chạy `npx vitest` trong lệnh có `&` phải `cd` riêng (đã chạy nhầm ở thư mục gốc). Review vòng 1: 3 × P2 đã sửa; vòng 2 approve. Việc dở: người dùng nhận.
### 2026-11-03 — Mở branch `refactor/admin-ui`
- Đọc 21 ảnh mẫu, ghi `docs/image_admin_page/README.md`. Nguyên nhân lỗi tiếng Anh: backend trả `message` tiếng Anh (`Topic/Tag name already exists`, 409), FE hiện nguyên `e.message`; cùng kiểu ở `AdminUsersPage`, `AuthorApplicationsPage`; thông báo lưu thành công Taxonomy luôn tiếng Việt. Page size hiện 20 (backend cho 1–100, trả `totalPages`). Việc dở: chờ người dùng chốt đề xuất.
### 2026-11-03 — Nhận Task 7b, đóng module
- Người dùng nhận Task 7b; đánh dấu toàn bộ “Xong khi” Task 1–7 + module trong spec; commit WIP Task 7b. Việc tiếp: nhiệm vụ sửa lỗi do người dùng giao.
- Luật mới (`CLAUDE.md`): nhận task xong thì đánh dấu ở cả spec (`[x]` “Xong khi”) lẫn log/`PLAN.md`; nhiệm vụ sửa lỗi không spec ghi vào log module.
### 2026-11-03 — Task 7b
- Dọn CSS ngoài luồng bài viết: `UserAvatar`, `PlaceholderPage`, màn chờ `App.tsx` sang Tailwind; xóa rule mồ côi, token không dùng, `framer-motion`, `verify-css-split.mjs`; comment/luật “tới Task 7b” → `article-flow`. 187/187, build đạt.
- Bài học: hit màu literal còn lại chỉ là giá trị mong đợi trong `tokens.test.ts`; class `hljs-*`/`task-list-item` do rehype sinh, `published`/`changes_requested` ghép động — không coi là mồ côi.
- Review vòng 1: không lỗi chức năng; xóa artifact `.playwright-mcp/`. Việc dở: người dùng nhận; kiểm bằng mắt route cần đăng nhập (chưa có mật khẩu dev).
### 2026-11-03 — Nhận Task 7a
- Người dùng test tay và nhận Task 7a; commit WIP `wip(ui-foundation-v2): Task 7a`; nhờ Codex đồng bộ spec theo log. Việc tiếp: Task 7b.
- Codex: đã đưa ba quyết định người dùng sau Task 7a vào spec, xóa chúng khỏi bảng quyết định trong log và đánh dấu “Xong khi” Task 7a theo kết quả/chưa kiểm đã ghi.

### 2026-11-03 — Task 7a: cuộn trong khung
- Người dùng: khối dài (giới thiệu, chuyên môn, lịch sử) phải cuộn trong khung, không kéo dài trang; tự áp ở các trang sau → luật “Nội dung dài: cuộn trong khung” trong skill `ui-components` + mục tự kiểm.
- Bài học: primitive `Textarea` có `field-sizing-content` → tự giãn vô hạn, luôn kèm `max-h-*`.
- Review: 1 × medium (Badge chuyên môn dài tràn ngang) đã sửa; bài học: Badge chứa chữ người nhập phải cho xuống dòng (`[overflow-wrap:anywhere]`).

### 2026-11-03 — Task 7a: sửa theo người dùng test
- Admin: nút Từ chối/Tạm ngưng/Khôi phục khóa im lặng khi chưa có lý do → luôn bấm được, báo lỗi + focus ô lý do, có dòng gợi ý “bắt buộc”. Luồng PATCH đã thử bằng Playwright (chặn PATCH, không ghi DB) — chạy đúng khi có lý do.
- `/author/apply`: native select chuyên môn → 4 nhóm chip radio (icon tone, dấu ✓, phím mũi tên native). 53/53, build đạt. Review bổ sung approve; chờ người dùng test tay rồi nhận Task 7a.

### 2026-11-03 — Task 7a
- Code `AuthorApplyPage` mới (hero quy trình 3 bước + vùng làm việc theo trạng thái, timeline lịch sử), thuật ngữ Tác giả/Author ở Sidebar/AuthorBlogs/Moderator, type `AuthorProfile`, xóa `author.css`. 46/46, build đạt, kiểm bằng mắt dark/light + mobile cảm ứng.
- Bài học: preflight tắt → `textarea` không kế thừa font (ra monospace) → cần `font-sans`.
- Review: vòng 1 2 × P2 đã sửa (nhãn “Gửi lúc”, 409 khi GET lại lỗi); vòng 2 approve. Việc dở: người dùng nhận Task 7a.
### 2026-11-03 — Người dùng chốt Task 7a/7b
- Codex: đã nhận phản hồi vòng 2 của Claude, sửa rõ kicker AuthorBlogs theo `language`, rút gọn tranh luận khỏi spec thành 5 dòng kết luận và chuyển Task 7a sang code.

### 2026-11-03 — Phản biện Task 7a/7b + chuẩn bị code
- Người dùng chốt thuật ngữ vi “Tác giả”/en “Author” (không “Giảng viên”); Codex đưa vào spec D-027/D-028. Claude phản biện vòng 2: không chặn; 2 điểm nhỏ (kicker AuthorBlogs theo `language`, assertion Sidebar test) ghi ở “Bắt đầu từ đây”.
- Đã kiểm hook SessionStart nạp đúng log; phiên sau bắt đầu Task 7a.

### 2026-11-03 — Refresh nhận quyền Author sau khi duyệt
- Codex: đã đưa quyết định mới của người dùng vào Task 7a và D-028; kiểm bằng `App.author-session.test.tsx`, giữ route `/profile` nhưng cập nhật shell/sidebar theo role mới.

### 2026-11-03 — Trả lời phản biện Task 7a/7b
- Codex: đã đưa thuật ngữ người dùng chốt (“Tác giả”/“Author”) vào spec và D-027; chốt giữ value chuyên môn tiếng Việt, chỉ dịch label tiếng Anh; 409 tự tải lại trạng thái, còn 403/lỗi khác dùng cảnh báo chung và giữ form. Không mở `managementI18n.ts` hay `ApiError`.

### 2026-11-03 — Đổi Task 7a sang `AuthorApplyPage`
- Codex: đã đưa quyết định người dùng vào spec: Task 7a chuyển giao diện đăng ký Tác giả/Author với quyền sáng tạo UI có ranh giới; `AuthorBlogsPage` + Blogs/Learner + Moderator chuyển sang `article-flow`; Task 7b giữ CSS/preflight tương thích luồng bài viết.

### 2026-11-03 — Đồng bộ spec sau Task 6
- Codex: đã đưa các quyết định Task 6 về thiết kế Admin sinh động, bỏ tính năng chưa có, sidebar Admin/Moderator, avatar API, tìm động, chip chuyên môn và seed dev vào spec; đã đánh dấu “Xong khi” theo kết quả/chưa kiểm trong log.

### 2026-11-03 — Nhận Task 6
- Người dùng nhận Task 6; commit WIP `wip(ui-foundation-v2): Task 6`; nhờ Codex đồng bộ spec theo log (gồm quyết định thiết kế sinh động, sửa `server/` avatar, seed dev).

### 2026-11-03 — Review bổ sung Task 6
- Người dùng yêu cầu review lại phần sửa sau vòng 2: 3 × medium (race tìm động, lệnh seed sai Compose, seed commit một phần) — đã sửa hết, 96/96, build đạt.
- Bài học: tìm động/đổi filter nhanh cần chặn response cũ (request id) — áp dụng khi làm Moderator 7a.

### 2026-11-03 — Chỉnh Task 6 sau khi người dùng test
- Avatar danh sách sai do API thiếu `avatarUrl` → thêm vào 3 DTO admin (sửa `server/`, test tích hợp đỏ → xanh). Tìm động debounce 300 ms. Chuyên môn thành chip màu.
- Bài học: heredoc Python trong Git Bash dễ vỡ dấu nháy → script sửa file viết bằng Write rồi chạy.

### 2026-11-03 — Seed dev Admin
- Thêm `scripts/dev-seed-admin.sql` (6 hồ sơ tác giả đủ trạng thái + 4 lịch sử duyệt, 8 chủ đề, 12 thẻ) theo yêu cầu người dùng; chạy 2 lần vào DB dev, số bản ghi không đổi; API Admin trả đúng. RUNBOOK có mục “Dữ liệu mẫu”.

### 2026-11-03 — Task 6 phần 1
- Người dùng muốn Admin sinh động hơn, bỏ thứ của tính năng chưa có, sidebar Admin giống user (icon màu, Cài đặt thu gọn) → ghi ở “Quyết định người dùng”.
- Xong sidebar (`SettingsMenu` dùng chung), Dashboard lối tắt, Users (Sheet, thanh chọn nhiều, AlertDialog). 84/84, build đạt.
- Bài học: `button`/`ul`/`dd` thô trong trang đã chuyển cần `data-slot` hoặc `m-0`, không thì dính style legacy/UA.
- Người dùng duyệt hướng (“khá ưng”); xong Author applications, Taxonomy, dọn `admin.css`. Review vòng 1: 2 × P2 (số kết quả đầu trang, `PLAN.md` cũ) đã sửa; vòng 2 approve. 91/91, build đạt. Việc dở: người dùng nhận Task 6.

### 2026-11-03 — Nhận Task 5
- Người dùng nhận Task 5; commit WIP `wip(ui-foundation-v2): Task 5`; nhờ Codex đồng bộ spec theo log.
- Việc dở: quyết sửa logo topbar mobile 32px trong Task 6 hay không.

### 2026-11-03 — Playwright MCP
- Thêm Playwright MCP mức project (`.mcp.json`), Chromium cài ở `%LOCALAPPDATA%/ms-playwright`. Thử bằng script tạm: context 390×844 `hasTouch` → `pointer: coarse` khớp, nút hero 44px.
- Bắt được lỗi Task 5: nút hero mobile cảm ứng co lại, chữ tràn (`pointer-coarse:min-w-11` của Button đè `max-sm:min-w-44`) → `max-sm:w-full`; sau sửa 342×44, không tràn. Home test 5/5, build đạt.
- Luật: `visual-check` viết lại (Playwright chính, Chrome dự phòng, bẫy `min-w`); `frontend.md` trỏ theo. Thêm bảng “Khi nào dùng” (Vitest / Playwright / Chrome / không mở trình duyệt); không thêm e2e Playwright vào `app/` khi chưa có spec.
- Việc dở: logo topbar mobile 32px (Task 2) chờ người dùng quyết; người dùng nhận Task 5.

### 2026-11-03 — Tách Blogs UI
- Codex: đã đưa quyết định tách Blogs/BlogDetail/MarkdownContent/wrapper Pagination khỏi `ui-foundation-v2` sang module `blogs-ui-shadcn` vào spec; Task 7a chỉ còn Moderator, Task 7b giữ preflight tắt và lớp CSS tương thích Author/Blogs.

### 2026-11-03 — Tách Author UI
- Codex: đã đưa quyết định tách toàn bộ Author UI khỏi `ui-foundation-v2` sang module `author-ui-shadcn` vào spec; Task 6 chỉ còn Admin; D-026 sau đó tách Blogs để Task 7a chỉ còn Moderator.
- Codex: đã đưa quy tắc commit WIP sau mỗi task được nhận và squash một commit cuối module từ bảng quyết định chờ vào spec.

### 2026-11-03 — Task 5
- Home chuyển sang shadcn/Tailwind (hero 4.1), tạo `components/EmptyState.tsx` + test; xóa `pages/home.css`. Test liên quan 30/30, build đạt, kiểm bằng mắt dark/light desktop + mobile 390px.
- Review: vòng 1 P2 tone tag riêng trang → dùng `toneFor` (Docker/AI cùng cyan, còn 4 màu); vòng 2 approve.
- Luật mới (người dùng đồng ý sau Task 5): `codex-workflow` vòng 1 `review` không focus, `git add -N` file mới, Codex không chạy được Vitest; `visual-check` chờ animation, màu theo theme tin ảnh/tải lại; `ui-components` tự kiểm tone qua `toneFor`/`statusTone`; `CLAUDE.md` không `sed -i` trên file CRLF.
- Việc dở: người dùng nhận Task 5.


Mới nhất ở trên; mỗi phiên ≤ 6 dòng: đã làm, quyết định mới, bài học, việc dở. Chi tiết kỹ thuật để ở mục Task bên dưới.

- 2026-11-03 — Codex: đã đưa quyết định vòng review 2 Task 3+4 vào spec; hai luật quy trình đã có trong `CLAUDE.md`/`.claude/rules/frontend.md` chỉ xóa khỏi bảng quyết định.

### 2026-11-03 — Luật chung sau Task 3 + 4
- Thêm `docs/RUNBOOK.md` (cổng/CORS, DB, tài khoản theo vai trò, luồng phiên); chèn tài khoản `moderator@techverse.test` vào DB dev (đăng nhập API 200).
- Luật mới: commit WIP theo task + squash cuối module; review kèm “Xong khi” + kết quả test, chờ kết quả (`--wait`); bảng quy tắc/mã lỗi cho spec có API (`AGENTS.md`); bài học Windows; bẫy preflight + tự kiểm trước review (`frontend.md`, skill `ui-components`).
- Bổ sung luật commit WIP: đầu task mới không đọc lại/chạy lại phần đã commit; còn thay đổi chưa commit của task trước thì báo người dùng.
- Rút gọn luật: thủ tục chuyển sang skill nạp khi cần — `codex-workflow` (review, commit WIP, đồng bộ spec), `visual-check` (kiểm bằng mắt, mobile iframe), `plan-review` (phản biện spec). `CLAUDE.md` 12,7k → 9,9k ký tự, `frontend.md` 6,0k → 4,5k; mục “Giai đoạn chuyển” của `frontend.md` xóa ở Task 7b.
- Việc tiếp: Task 5 trong session mới.

### 2026-11-03 — Task 3 + 4
- Người dùng nhận Task 3 + 4. Spec đã được Codex sửa dòng “`npm test` đạt”.
- Luật mới (người dùng chốt): sau khi người dùng nhận task, Claude gọi Codex `task --write` đồng bộ spec theo log (`CLAUDE.md`, `AGENTS.md`). Đã gọi cho Task 1–4.
- Chuyển Profile/Settings và Auth sang shadcn; xóa `profile.css`, `settings.css`, `auth.css`. Test liên quan + build đạt; chờ review.
- Bài học: preflight tắt → phần tử không `data-slot` dùng `border` phải kèm `border-border`; chữ lỗi dùng `text-danger`, không `text-destructive`.
- Review vòng 1: 3 × P2 đã sửa (locale tháng, vùng chạm link Auth và dropdown lịch).
- Luật mới: Claude tự gọi review qua PowerShell, kiểm `status` trước để không chạy trùng (`CLAUDE.md`); dev server cổng 3000 = `WEB_URL`, không khởi động lại backend (`frontend.md`); khi code chỉ đọc mục task + ràng buộc của spec.
- Người dùng chốt: vòng 2 luôn `adversarial-review "<focus>"` (`CLAUDE.md`). Profile/Settings đã kiểm bằng mắt ở cổng 3000.
- Review vòng 2 (`/code-review`): sửa 8/9 gồm `h1` dính chữ do `base.css` (ảnh chụp trước đó đã thấy nhưng bỏ sót) và 3 bug sidebar Task 2.
- Việc dở: người dùng nhận Task 3+4; hỏi về đề xuất sửa luật (tự kiểm vùng chạm/i18n/border trước review, review `--wait`, bẫy preflight vào `frontend.md`, skill TDD).

### 2026-11-03 — Nhận Task 2
- Người dùng nhận Task 2; đã tự xóa `Logo_Techverse.png` khỏi máy (đóng câu hỏi mở).
- Codex đang sửa dòng “`npm test` đạt” trong spec. Việc tiếp: Task 3 + 4 trong session mới.

### 2026-11-03 — Task 2 + quy trình ngữ cảnh
- Làm xong Task 2 và 2 vòng adversarial review (đều là vùng chạm 44px, đã sửa).
- Người dùng chốt: chỉ chạy test liên quan; thỏa thuận trong chat phải ghi vào file ngay; vòng 1 review tự sửa blocker.
- Thêm hook `.claude/hooks/` (SessionStart tự nạp log, Stop nhắc ghi log) và dòng “Module đang làm” trong `PLAN.md`.
- Bài học: Codex sửa spec song song (trang hoãn → Task 7a) — đọc lại spec trước khi tóm tắt; `App.auth.test.tsx` chậm ~60s, chỉ chạy khi đụng Auth/định tuyến.
- `AGENTS.md` thêm mục “Đồng bộ với Claude”: Codex đọc đầu log, đưa quyết định vào spec thì xóa khỏi bảng log + ghi nhật ký.
- Việc dở: người dùng nhận Task 2; quyết file `Logo_Techverse.png`; Codex sửa “`npm test` đạt” trong spec.

## Task 1 — Cài đặt, token, primitive, tài liệu nền

| Mục | Kết quả |
|---|---|
| Registry | `shadcn@4.23.0`: `init -b radix` chỉ còn preset mới (Nova/Vega/…), không có `new-york` → theo fallback của spec, viết tay `components.json` (`style: new-york`, CSS variables, lucide, `src/components/ui`), rồi `shadcn add` 20 primitive; CLI tự kéo base Radix (`radix-ui`). Có `native-select` trong registry. Không có `lib/utils.ts` từ init; primitive import `cn` thẳng từ gói `cn`. |
| Dependency trực tiếp | `tailwindcss@4.3.3`, `@tailwindcss/vite@4.3.3`, `@types/node@26.6.6`, `shadcn@4.23.0` (dev); `class-variance-authority@0.7.1`, `cn@0.5.2`, `radix-ui@1.8.1`, `tw-animate-css@1.4.0`, `react-day-picker@10.0.2`, `date-fns@4.4.0`. Không `@base-ui/react`, `ui/select.tsx`, `table`, `sonner`, form/UI library khác. |
| Sửa sau `add` | Gỡ khối `:root`/`.dark` hsl CLI chèn vào `styles.css` (sidebar token chuyển vào `tokens.css`); `bg-black/50` → `bg-scrim` (dialog/alert-dialog/sheet); `text-white` → `text-destructive-foreground` (button/badge); Button thêm `pointer-coarse:min-h-11 min-w-11` (QĐ 1). |
| Token | `--muted`: 100 chỗ `var(--muted)` legacy đổi sang `var(--muted-foreground)` trước, rồi `--muted` = surface-2. Token shadcn giữ giá trị thật, token cũ là alias. Đo từ `tokens.css` thật (`styles/tokens.test.ts`): mọi cặp khớp bảng spec; tone tối (xấu nhất trên background/card/surface-2) blue 5.80, green 7.23, purple 6.16, amber 7.21, rose 5.83, sky 6.13, cyan 6.96, slate 8.16; sáng blue 5.49, green 6.49, purple 5.92, amber 6.37, rose 5.24, sky 5.17, cyan 4.79, slate 9.45. |
| Grep va chạm | Lệnh của spec (chạy bằng Grep, máy không có `rg` CLI): chỉ `base.css:72 .sr-only`, `controls.css:55 .full-width` → đã xử lý ở Task 2. |
| Test | `npm test` (app): 16 files, **296/296 đạt** (221 cũ + 75 mới: tokens 59, `lib/utils` 14, Badge 2). `npm run build`: đạt (cảnh báo chunk > 500 kB có từ trước). Không chạy backend. |
| Kiểm bằng mắt | `/login` (trang cũ) dark và light desktop qua Chrome: bố cục/màu/font Inter như trước, không vỡ do bước cài đặt. Chưa kiểm mobile (Task 1 không yêu cầu). |
| Review vòng 1 | `/codex:review --background`: 2 × P2, đều nhận. (1) Focus ring `ring-ring/50` chỉ ~2.35:1 ở light → `ring-ring` đặc ở 7 primitive. (2) Copy tiếng Anh hardcode trong primitive → nhãn thành prop bắt buộc (Pagination/Breadcrumb `aria-label`, `label`, Dialog/Sheet `closeLabel`, Sidebar `mobileTitle`, `SidebarTrigger`/`SidebarRail` `label`). +6 test `ui/labels.test.tsx`. `npm test` **302/302**, build đạt. |
| Review vòng 2 | 1 × P2, nhận: `aria-invalid:ring-destructive/20` sinh sau `focus-visible:ring-ring` → control invalid đang focus ~1.3:1. Bỏ màu ring invalid ở 6 primitive. +`ui/focus.test.ts` quét nguồn `ui/`. `npm test` **323/323**, build đạt. Hết 2 vòng review. |

## Task 2 — Khung chung và điều hướng

| Mục | Kết quả |
|---|---|
| Code | `App` dùng `SidebarProvider` controlled bằng `techverse-sidebar`; trang Auth ra ngoài shell. `Sidebar.tsx` có `SidebarFrame`/`SidebarAccount`/`useSidebarNav`/`activeLink` dùng chung cho 3 sidebar; App tự chọn Admin/Moderator/User (Sidebar không còn tự chuyển sang Admin). Mobile topbar + Sheet 320px; `ui/sidebar.tsx` bỏ cookie `sidebar_state`, Ctrl+B, mobile 20rem. `Brand` = logo Cloudinary + wordmark; `index.html` có favicon 64px + Apple touch icon 180px crop từ cùng master. |
| Lệch khác spec | Không dùng `SidebarInset` (render `<main>`, trang đã có `<main>` → lồng landmark); `sidebar-gap` của shadcn chừa chỗ, nội dung bọc `div`. Nút thu gọn Admin hiện cả khi đã thu gọn (cũ bị ẩn → không mở lại được). Thu gọn 48px (icon mặc định shadcn), cũ 76px. |
| CSS | Xóa `layout/sidebar.css`; `shell.css` bỏ `margin-left`, topbar/scrim (giữ padding/min-height). `base.css` nạp vào `layer(base)` vì `a { color: inherit }` không layer đè utility màu trên link shadcn. Reset chuyển tiếp `[data-slot]` cuối `styles.css` (border/nút/ul) — xóa ở 7b khi bật preflight. |
| Va chạm utility | Xóa `.sr-only` (base.css), `.full-width` (→ `w-full` ở AuthorApplyPage), `.icon-button`/`.mobile-only`/`.desktop-only` (hết consumer). Grep spec chạy lại trên `src/styles`, `src/styles.css`: 0 kết quả. |
| Test | TDD: `ui/sidebar.test.tsx` đỏ 3/3 → xanh; `Sidebar.test.tsx` 16 ca (5 đỏ trước khi code). `npm test` 19 files **333/333** (chạy full trước khi có quyết định 7); build đạt. |
| Kiểm bằng mắt | Chrome desktop, khách chưa đăng nhập: `/settings/theme` (trang legacy) mở 256px / thu gọn 48px — một khoảng chừa, padding giữ nguyên, không cuộn ngang; dark + light; `/` dark. Đã sửa: viền sidebar đen ở light, link active/nút Đăng nhập mất màu (do `base.css`). **Chưa kiểm:** Admin/Moderator bằng mắt, mobile bằng mắt. |
| Review vòng 1 | `/codex:adversarial-review`: 1 × medium, nhận — menu sidebar chỉ cao 28–32px trên màn cảm ứng (QĐ 1A ≥44px). Thêm `pointer-coarse:min-h-11` cho `SidebarMenuButton`/`SidebarMenuSubButton`; +1 test quét nguồn. Test liên quan 6 files **172/172**; build đạt. |
| Review vòng 2 | 1 × medium, nhận (người dùng chọn sửa) — sidebar thu gọn trên cảm ứng chỉ rộng 32px. Thêm `pointer-coarse:min-w-11` + căn giữa icon; group/footer/header giảm padding ngang còn 2px khi thu gọn trên cảm ứng. Test liên quan 5 files **53/53**; build đạt. Hết 2 vòng review. Chưa kiểm trên thiết bị cảm ứng thật. |
| Ngoài phạm vi | Review vòng 2 #9: logo/favicon hotlink Cloudinary, mất mạng thì sidebar thu gọn/topbar chỉ còn link trống (hệ quả quyết định logo Cloudinary). `data/navigation.ts` còn comment trỏ `sidebar.css` đã xóa (không được sửa `data/**`). |

## Task 3 — Hồ sơ và Cài đặt

| Mục | Kết quả |
|---|---|
| Code | Profile theo 4.6: card trái 320px (định danh, nav, đăng xuất), card phải (header icon 28 + 14/600 + mô tả 12, thân p-5, nhãn 11 in hoa, lưới 2 cột). Ngày sinh: `Popover` + `Calendar` (dropdown năm, locale vi/en, tắt ngày sau mốc 6 tuổi, mở đúng tháng đang gõ); vẫn gõ `dd/mm/yyyy`. Logout-all: `AlertDialog` controlled, chặn Escape/Hủy khi đang chờ, nút xác nhận là `Button` thường để giữ dialog khi lỗi; focus về nút mở. Settings: `PreferenceOption` (`aria-pressed`) trong `SettingsLayout`. |
| Lệch khác spec | Expose thêm `--color-danger` (token `--danger` có sẵn) cho chữ lỗi: `text-destructive` chỉ ~3:1 trên nền tối. Settings là 1 cột header + lưới 2 thẻ (không có nội dung cho card trái). Bỏ khung xem trước màu của thẻ Theme (trang trí, cần literal màu theme kia). Avatar giữ class legacy `avatar-large` (`content.css`, unlayered thắng utility) tới khi `UserAvatar` chuyển. |
| CSS | Xóa `pages/profile.css`, `pages/settings.css` + import. Quét selector: không còn selector mồ côi của hai trang (`.section-kicker` còn trang khác dùng). |
| Test | TDD đỏ 7 → xanh. Bỏ stub `HTMLDialogElement`; +2 ca Calendar, +`Settings/SettingsPages.test.tsx` (2 ca). `ProfilePage`, `ChangePasswordPanel`, `SettingsPages`, `StaffPreferences`: **61/61**; build đạt. |
| Kiểm bằng mắt | Chrome desktop, dev admin, dev server cổng 3000 của người dùng (5173 bị CORS chặn): `/profile` dark (card 320 + 872px), light (viền header đúng token); Calendar mở, tháng "Tháng 1…" theo ngôn ngữ app; AlertDialog logout-all focus “Hủy”, đóng trả focus nút mở (không bấm xác nhận); `/settings/theme`, `/settings/language` light: thẻ chọn `aria-pressed`, viền token, không cuộn ngang. Cờ emoji hiện “VN/US” trên Windows (có từ trước). **Chưa kiểm:** mobile. |

## Task 4 — Auth

| Mục | Kết quả |
|---|---|
| Code | `AuthLayout.tsx` thêm khung dùng chung `AuthShell` (card 480px) + `AuthIntro`/`AuthField`/`AuthInput`/`PasswordInput`/`AuthAlertText`/`AuthSubmit`/`AuthDivider`/`AuthSwitch`; tab trượt bằng utility (`motion-reduce` tắt). Login/Register/Forgot/GoogleCallback + `GoogleAuthButton` (Button `asChild` `<a>`) dùng khung này. Logic, copy, request giữ nguyên. |
| Lệch khác spec | Bỏ nền radial-gradient (QĐ 2 cấm gradient). GoogleCallback trước dùng khung `login-card` riêng, nay dùng chung `AuthShell` (giữ Brand compact + "GOOGLE AUTHENTICATION"). `App.tsx` bỏ class mồ côi `login-mode`. Input Auth cao 40px (`pointer-coarse` 44px). |
| CSS | Xóa `pages/auth.css` + import; không còn selector auth/login/google trong CSS. Sửa: phần tử không có `data-slot` dùng `border` phải ghi `border-border` (preflight tắt → viền lấy màu chữ) — đã sửa tab Auth, header Profile, thẻ Settings. |
| Test | `App.auth.test.tsx`: 4 assertion class cũ → role/`data-slot` (tab nav, heading remount, `span` accent, card); helper `fillLogin` dán chuỗi >20 ký tự (ca email 255 ký tự timeout 5s khi chạy song song). **119/119**; build đạt. |
| Review vòng 1 (Task 3+4) | Hai job `codex-companion review` chạy trùng (hủy job 2 lỗi `taskkill` do Git Bash đổi `/PID` thành đường dẫn) → gộp làm vòng 1: 3 × P2, đều nhận. (1) Dropdown tháng của `Calendar` theo locale trình duyệt → `formatMonthDropdown` dùng `props.locale.code`. (2) Link Auth (`authLinkClass`, `authInlineLink`) < 44px trên cảm ứng → `inline-flex` + `pointer-coarse:min-h-11`. (3) Dropdown tháng/năm 32px → `pointer-coarse:h-11`/`min-h-11`. +3 test (`ProfilePage` locale tháng, `ui/calendar.test.ts`, `auth/AuthLayout.test.ts`). `ProfilePage`, `calendar`, `focus`, `AuthLayout`, `App.auth`: **183/183**; build đạt. |
| Review vòng 2 (Task 3+4) | `/code-review --background` (lượt Codex vòng 2 bị dừng khi phiên đóng): 9 phát hiện, sửa 8. (1+2) `h1` mới nhận `letter-spacing:-3px`/margin của `base.css`, `p/h2/h3` giữ lề UA → reset tạm `.tw-page` trên `main` Auth/Profile/Settings + `:is(h1..p)[data-slot]{margin:0}` trong `styles.css` (xóa ở 7b). (3) Footer sidebar thu gọn tràn → `px-1`/`p-0` khi icon. (4) Ô nhập Profile/đổi mật khẩu `pointer-coarse:h-11`, nút icon căn giữa. (5) Sheet mobile đóng theo mọi đổi route (`MobileTopbar` effect). (6) Bấm Cài đặt khi thu gọn → mở sidebar. (7) `PasswordInput` giữ `className`. (8) `setSidebarOpen` `useCallback`. +4 test. 9 files **211/211**; build đạt. Đo Chrome: `h1` tracking normal, margin 0; sidebar thu gọn 48px không tràn. Hết 2 vòng. |
| Kiểm bằng mắt | Chrome desktop: `/login` dark + light, `/register` light (lỗi validation hiện đủ 4 trường), `/forgot-password`, `/auth/callback` lỗi — có card, không cuộn ngang. Chưa kiểm mobile (Chrome MCP không đổi viewport). |

## Task 5 — Trang chủ và EmptyState

| Mục | Kết quả |
|---|---|
| Code | `HomePage`: hero 4.1 trong `section bg-card` — chip kicker accent → H1 (48px desktop, 36 sm, 30 mobile; “TechVerse” màu nhấn) → mô tả 18px muted (≤ 672px) → 2 `Button asChild` (`/courses` default, `/interview` outline; mobile full-width) → hàng `Badge tone` trong `ul`. `framer-motion` → `animate-in` của `tw-animate-css` có delay, `motion-reduce:animate-none`. `EmptyState` (ngoài `ui/`): `role="status"`, props `icon?`, `title`, `description?`, `action?`, `className` (gộp `cn`); không copy. |
| Lệch khác spec | Home chỉ còn hero (D-015/D-016 đã bỏ các khối dưới) nên 4.7 tiêu đề khu vực + 4.3 lưới card không có nội dung để áp; không thêm khối/copy mới. Hàng tag chuyển xuống dưới hàng nút (thứ tự mẫu 4.1). Tone tag theo `toneFor` (review vòng 1). Nút ghost → `outline`. Chưa gỡ `framer-motion` (thuộc 7b theo thứ tự đã ghi). |
| CSS | Xóa `pages/home.css` + import; grep selector Home (`hero-*`, `welcome-badge`, `tech-tag`, `tag-list`) trong `src`: 0. Không chạm `blogs.css`/`content.css`. |
| Test | TDD đỏ (Home tone 1 ca, `EmptyState` import lỗi) → xanh. `npx vitest run src/pages/Home/HomePage.test.tsx src/components/EmptyState.test.tsx src/components/ui/focus.test.ts`: **30/30**; `npm run build` đạt (cảnh báo chunk > 500 kB có từ trước). |
| Review vòng 1 | `codex-companion review --wait`: 1 × P2, nhận — tone tag Home ánh xạ riêng (Docker `purple` khác `toneFor('Docker')` = `cyan`), trái quy tắc “cùng giá trị cùng tone” (spec dòng 151). Đổi sang `toneFor(label)`: 5 tag ra rose/green/cyan/cyan/amber (4 màu, D-016 “nhiều màu” vẫn đạt; Docker và AI trùng cyan). Test đổi: tone = `toneFor`, ≥ 4 màu. Test liên quan **30/30**, build đạt. |
| Review vòng 2 | `adversarial-review --wait` chỉ trên phần sửa: **approve**, không phát hiện. Hết 2 vòng. |
| Sau review | Playwright giả lập điện thoại cảm ứng bắt lỗi nút hero co lại/chữ tràn → `max-sm:w-full` (thay `max-sm:min-w-44 max-sm:flex-1`). Home test **5/5**, build đạt; đo lại 2 nút 342×44px, không tràn, không cuộn ngang. Sửa nhỏ sau vòng 2, chưa review lại. |
| Kiểm bằng mắt | Chrome, cổng 3000 (phiên Moderator có sẵn): `/` light + dark desktop — H1 48/48 700, tracking normal, `ul` không bullet/padding, nền section đổi theo theme, không cuộn ngang. Mobile iframe 390px: H1 30px, 2 nút xếp dọc 324px, tag xuống dòng, không cuộn ngang. Chưa kiểm cảm ứng thật. |

## Task 6 — Admin

| Mục | Kết quả |
|---|---|
| Code (phần 1) | Sidebar: `SettingsMenu` dùng chung trong `Sidebar.tsx` (thu gọn mặc định, tự mở khi route là một link của nó) cho user + `StaffSettingsLinks` (Admin/Moderator); `toneText` export, thêm `rose`/`cyan`. `AdminSidebar`: icon tone từng mục, nhóm “Người dùng”/“Nội dung” (bỏ “học viên/bài giảng”), Thẻ dùng icon `Tag`. Dashboard: bỏ thẻ số liệu giả + bảng hoạt động/online; lời chào + 4 thẻ lối tắt (tone theo icon sidebar) + 2 nút ngôn ngữ/giao diện cũ. Users: header icon, Card filter (Input + 5 NativeSelect), danh sách hàng (avatar chữ cái, email/ngày tham gia, Badge vai trò `toneFor`, hồ sơ tác giả `statusTone`, trạng thái), Skeleton, `EmptyState`, thanh chọn nhiều nổi, chi tiết trong Sheet phải, AlertDialog thay `window.confirm` (mô tả = câu hỏi cũ, payload giữ nguyên). |
| Lệch khác spec | Type nội bộ `User` của trang thêm `createdAt`, `authorProfileStatus`, `avatarUrl` (API đã trả sẵn). `statusTone` thêm `ACTIVE`/`LOCKED` (suy từ `active`). `ui/sheet.tsx` nút đóng thêm `data-slot` + 32px/44px cảm ứng (trước đó bị viền legacy). Phần tử thô mới (`ul`, `button` hàng) gắn `data-slot` để nhận reset. |
| Test | TDD đỏ → xanh. `npx vitest run src/components/layout/Sidebar.test.tsx src/StaffPreferences.test.tsx src/pages/Admin src/lib/utils.test.ts src/components/ui`: **84/84** (10 file); build đạt. |
| Kiểm bằng mắt | Playwright script tạm (MCP chưa nạp trong phiên), admin dev, desktop 1440 dark + light: `/admin`, `/admin/users` (chọn 2 → thanh nổi; Sheet 448px), không cuộn ngang. Mobile cảm ứng 390: `coarse` khớp, không cuộn ngang, checkbox hàng 44×44; nút “Trước/Tiếp” của wrapper `Pagination` 40px (có từ trước, thuộc `blogs-ui-shadcn`). |
| Code (phần 2) | Người dùng duyệt hướng. `AuthorApplicationsPage`: chip lọc trạng thái (`aria-pressed`, thay select “Hồ sơ”, cùng tham số `status`, mặc định PENDING), Card filter, hàng (avatar, email, chuyên môn, ngày nộp, Badge `statusTone`, “Đã khóa”), Sheet chi tiết (chuyên môn, giới thiệu, portfolio, ghi chú, lịch sử duyệt từ `reviewHistory`), Textarea + Phê duyệt/Từ chối/Tạm ngưng/Khôi phục → AlertDialog (câu hỏi cũ), payload giữ nguyên. `TaxonomyPage`: lưới card (ô `#` màu `toneFor(name)`, Badge Hoạt động/Ẩn, card ẩn mờ), nút Tạo mới ở header + `EmptyState`, form tạo/sửa trong Dialog (đóng khi lưu xong, thông báo `role=status`), bật/tắt → AlertDialog. `ui/dialog.tsx` nút đóng 32px/44px cảm ứng. `admin.css` chỉ còn `.application-row`/`.applications-actions` (AuthorBlogsPage). |
| Lệch khác spec (2) | Type nội bộ `Application` thêm `active`, `createdAt`, `suspensionReason`, `reviewHistory` (API trả sẵn). Câu hỏi bật/tắt Taxonomy thêm bản en (trước chỉ vi). Thông báo lưu Taxonomy giữ chỉ vi như cũ. |
| Test (cuối) | `npx vitest run src/components/layout/Sidebar.test.tsx src/StaffPreferences.test.tsx src/pages/Admin src/lib/utils.test.ts src/components/ui`: **91/91** (12 file); `npm run build` đạt. Không chạy `App.auth.test.tsx` (định tuyến không đổi). |
| Kiểm bằng mắt (2) | Playwright script, admin dev, **API Admin giả lập bằng `ctx.route`** (DB dev trống, không ghi DB): `/admin/author-applications` + Sheet 512px, `/admin/topics` + Dialog 512px, dark + light 1440, không cuộn ngang. Mobile cảm ứng 390: không cuộn ngang, nút trong Sheet ≥ 44px, nút đóng Sheet/Dialog 44×44. `/admin/tags` dùng chung component, không chụp riêng. |
| Review vòng 1 | `codex-companion review --wait`: 2 × P2, đều nhận. (1) Đầu trang Users/Author applications/Taxonomy thiếu số kết quả đã chốt → `Page.totalElements` (API trả sẵn) → Badge “N kết quả/results” cạnh H1; test 3 trang assert. (2) `PLAN.md` dòng module còn ghi “chờ duyệt hướng” → đổi “đang review”. Test liên quan **91/91**, build đạt. |
| Review vòng 2 | `adversarial-review --wait` chỉ phần sửa vòng 1: **approve**, không phát hiện. Hết 2 vòng. |
| Sau review (người dùng test) | (1) **Avatar:** API danh sách không trả avatar → `server/`: thêm `avatarUrl` vào `AdminUserSummaryResponse`, `AdminAuthorApplicationSummaryResponse`, `AdminAuthorApplicationDetailResponse` (+ builder trong 2 service impl); frontend truyền `url` cho `UserAvatar` ở hàng + Sheet Author applications. (2) **Tìm động:** hook `hooks/use-debounced-value.ts` (300 ms) ở 3 trang, bỏ nút “Tìm”, Enter vẫn áp ngay, ô `type=search`. (3) **Chuyên môn:** tách chuỗi theo `,;\n` thành chip `Badge toneFor` (hàng: tối đa 3 + “+n”; Sheet: card tím có đếm kỹ năng), giới thiệu thành đoạn có viền trái. Test FE: +4 ca; liên quan **95/95**, build đạt. BE: `AdminUserIntegrationTest` + `AdminAuthorApplicationIntegrationTest` (đỏ → xanh 2 ca avatar); cả 2 lớp **58/58** (29 + 29). Kiểm bằng mắt: Playwright, API giả lập với avatar Cloudinary thật (backend người dùng chạy code cũ, không khởi động lại) — ảnh tải được ở Users + Sheet, gõ “han” chỉ 1 request, 5 chip, dark + light. Chưa review lại (đã hết 2 vòng). |
| Review bổ sung (người dùng yêu cầu) | `adversarial-review --wait` trên phần sửa sau vòng 2: needs-attention, 3 × medium, đều nhận. (1) Race tìm động: response cũ về sau đè kết quả mới → `latest` ref, chỉ request mới nhất cập nhật data/error/loading ở 3 trang; test đảo thứ tự response (đỏ → xanh). (2) Lệnh seed giả định container `techverse` + user `root` → `sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'` cho cả Compose (`docker compose exec -T postgres`) và container riêng. (3) Seed commit một phần khi email admin sai → `DO` block `raise exception` ngay sau `begin` (đã thử: email sai → lỗi, không ghi gì); báo cáo chỉ đếm bản ghi seed. FE liên quan **96/96**, build đạt. Chưa kiểm: lệnh Compose (máy không dùng Compose, `.env` thiếu `POSTGRES_PASSWORD`). Không chạy thêm vòng review. |
| Chưa kiểm / ghi nhận | Avatar qua backend thật chưa kiểm (cần khởi động lại backend). Badge số kết quả chưa chụp lại (chỉ test). Nút “Trước/Tiếp” wrapper `Pagination` 40px cảm ứng (có từ trước, thuộc `blogs-ui-shadcn`). Moderator sidebar chỉ đổi phần Cài đặt; icon màu mục chính để Task 7a. Spec chờ Codex cập nhật theo “Quyết định người dùng” 2026-11-03. |

## Ghi nhận khác

- `vitest.config.ts` thêm `css.include` cho `src/styles` để test đọc CSS thật qua `?raw`.
- Đính chính 2026-11-03: `JWT_SECRET_KEY` trong `.env` hợp lệ (Base64, 256 bit); nhận định “không hợp lệ” trong phản hồi vòng 2 của spec là sai.

## Task 7a — Đăng ký Tác giả/Author

| Mục | Kết quả |
|---|---|
| Code | `AuthorApplyPage` (nhận `language` từ `App.tsx`): lưới `lg` 5/7 — trái hero (Badge “Tác giả/Author”, H1, 3 bước có icon tone blue/amber/green nối đường dọc, mẹo cũ), phải vùng làm việc: card trạng thái (icon + tiêu đề + Badge `statusTone`, callout rose lý do từ chối/đình chỉ kèm thời gian, callout green ghi chú duyệt/khôi phục, ngày gửi), card hồ sơ đã gửi (PENDING/APPROVED/SUSPENDED: chip chuyên môn, giới thiệu, nút mở portfolio), form (NOT_APPLIED/REJECTED prefill), card “Lịch sử xét duyệt” `ol` mới nhất trước (Badge quyết định, “v<n>”, thời gian, ghi chú, chip chuyên môn snapshot; không reviewer). Skeleton khi tải; lỗi tải `role=alert` + “Thử lại”; 409 → GET lại, rồi “Hồ sơ đã thay đổi”; lỗi khác → cảnh báo chung, giữ form. 22 chuyên môn: value vi, label en; giá trị ngoài bảng hiện nguyên văn “(đã lưu/saved)”. Chặn response cũ bằng request id. Sidebar link/tooltip, kicker AuthorBlogs theo `language`, câu vi Moderator “tác giả”. Xóa `styles/pages/author.css` + import. |
| Lệch khác spec | Form `noValidate`: validation tự viết (đã có sẵn) báo theo vi/en thay cho bong bóng native theo locale trình duyệt; giới hạn giữ nguyên. Kicker AuthorBlogs đổi theo `language` (spec cũ nói nhánh vi). Timeline chỉ hiện snapshot chuyên môn, không lặp lại toàn văn giới thiệu. Ngày giờ `toLocaleString(vi-VN/en-US)`. `textarea` thêm `font-sans` (preflight tắt). |
| Test | TDD đỏ 10 → xanh. `npx vitest run src/pages/Author/AuthorApplyPage.test.tsx src/components/layout/Sidebar.test.tsx src/App.author-session.test.tsx src/pages/Author/AuthorBlogsPage.test.tsx`: **46/46** (AuthorApply 8 ca: NOT_APPLIED en + validation, 3 trạng thái tham số, REJECTED + timeline + chuyên môn cũ + `expectedVersion`, 409, 403, lỗi tải/thử lại; +1 ca F5 tại `/profile` nhận AUTHOR). `npm run build` đạt (cảnh báo chunk có từ trước). |
| Kiểm bằng mắt | Playwright script tạm (MCP không có trong phiên), dev server 3000 + backend của người dùng, seed `tu.author` (REJECTED) và admin (NOT_APPLIED): desktop 1440 dark + light REJECTED, light form; mobile cảm ứng 390 dark form + light REJECTED — không cuộn ngang, `coarse` khớp, mọi a/button/input/select ≥ 44px, chữ nút không tràn, H1 tracking normal/margin 0. Sửa sau ảnh: textarea monospace → `font-sans`. Chưa kiểm: PENDING/APPROVED/SUSPENDED bằng mắt (test tự động). |
| Review vòng 1 | `codex-companion review --wait`: 2 × P2, đều nhận. (1) “Gửi lúc” dùng `updatedAt` (audit, đổi khi duyệt/đình chỉ) → chỉ hiện ở PENDING. (2) 409 mà GET lại lỗi thì mất “Hồ sơ đã thay đổi” → luôn báo, GET lỗi thì bỏ form cũ + nút “Thử lại”; +1 test. Test liên quan **47/47**, build đạt. |
| Review vòng 2 | `adversarial-review --wait` chỉ phần sửa vòng 1: **approve**, không phát hiện. Hết 2 vòng. |
| Sau review (người dùng test) | (1) `AuthorApplicationsPage`: `needsNote` khóa nút không giải thích → nút luôn bật; thiếu lý do thì `aria-invalid` + câu lỗi `text-danger` + focus textarea, không mở AlertDialog; gợi ý “Bắt buộc khi từ chối, tạm ngưng hoặc khôi phục.” vi/en; payload không đổi. Đã tái hiện bằng Playwright trên dữ liệu thật (PATCH bị chặn, không ghi DB): có lý do → AlertDialog → PATCH đúng `{decision: REJECTED, reviewNote, expectedVersion}`. (2) Chuyên môn: `fieldset` 4 nhóm (Phát triển phần mềm/Dữ liệu & AI/Hạ tầng & bảo mật/Thiết kế & sản phẩm, tone blue/purple/cyan/amber) chứa `input type=radio` `sr-only` bọc trong chip `label`; chip chọn đổi màu tone + ✓; giá trị cũ là chip slate “(đã lưu)” ở đầu. Lệch spec (“native select”) theo quyết định người dùng 2026-11-03. Test: `AuthorApplyPage`, `AuthorApplicationsPage`, `Sidebar`, `App.author-session`, `AuthorBlogsPage` **53/53**; build đạt. Kiểm bằng mắt picker: desktop dark (chọn + phím mũi tên), mobile cảm ứng light — chip ≥ 44px, radio ẩn, không cuộn ngang. Review bổ sung (người dùng yêu cầu): `adversarial-review --wait` chỉ phần sửa này → **approve**, không phát hiện. Chưa chụp gợi ý lỗi lý do Admin (chỉ test); người dùng đang test tay. |
| Cuộn trong khung (người dùng yêu cầu) | `AuthorApplyPage`: textarea giới thiệu `max-h-64` (256px) rồi cuộn; vùng chip chuyên môn `max-h-80` + dòng “Đang chọn: <chip>” (`aria-live`) ngoài khung; lịch sử `max-h-96`; giới thiệu đã gửi `max-h-48`; vùng cuộn là `region` có tên, `tabIndex=0`, focus ring. Admin: textarea lý do và mô tả Taxonomy `max-h-48`. Skill `ui-components` thêm luật + mục tự kiểm. Test: `AuthorApplyPage`, `src/pages/Admin` (4 file), `Sidebar`, `App.author-session`, `AuthorBlogsPage` **66/66**; build đạt. Playwright: bio dài 1869 ký tự → textarea 256px cuộn; chuyên môn 320px cuộn; trang form mobile 1755px; không cuộn ngang. Chưa kiểm bằng mắt lịch sử dài (seed chỉ 1 mục, chỉ test). |
| Review cuộn trong khung | `adversarial-review --wait`: 1 × medium, nhận — chuyên môn cũ 255 ký tự không khoảng trắng trong Badge `whitespace-nowrap` (dòng “Đang chọn”) tràn ngang mobile. Sửa `wrapBadge` (`max-w-full shrink whitespace-normal [overflow-wrap:anywhere]`) cho cả Badge “Đang chọn”, hồ sơ đã gửi, snapshot lịch sử + chip `max-w-full min-w-0`. Playwright mobile 390, GET giả lập 255 ký tự `X`: REJECTED và PENDING không cuộn ngang, không phần tử vượt mép. **66/66**, build đạt. |
| Review vòng 2 (cuộn trong khung) | `adversarial-review --wait` chỉ phần sửa `wrapBadge`: **approve**, không phát hiện. |

## Task 7b — Dọn CSS ngoài luồng bài viết

| Mục | Nội dung |
|---|---|
| Code | `UserAvatar` Tailwind + `data-slot="user-avatar"` (38px mặc định, caller `size-17 text-xl` thay `avatar-large` ở Admin×2/Profile×2). `PlaceholderPage` Tailwind + `Button asChild` (ô icon tone sky, kicker, h1, mô tả). `App.tsx`: màn chờ quyền/phiên dùng `LOADING_MAIN` (Tailwind), wrapper Auth `min-h-svh` thay `app-shell`. |
| CSS | Xóa `.avatar*`, `.user-avatar*` (content), `.button-ghost` (controls), `.article-preview` (forms), `.app-shell`/`.placeholder-*` (shell), `.blogs-reader-meta`/`.blogs-markdown*` (blogs), `.moderator-avatar`/`.moderation-markdown` (moderator) — grep không còn consumer. Giữ lớp tương thích luồng bài viết; `admin.css` chỉ `.application-row`/`.applications-actions` (AuthorBlogs). Token: xóa `--text-2`, `--shadow-*`, `--preview-*`, `--brand-*`; giữ alias `--bg/--surface/--surface-2/--text/--on-primary` (CSS tương thích còn dùng). Preflight vẫn tắt, reset chuyển tiếp + `.tw-page` giữ, comment trỏ `article-flow`. |
| Gỡ | `framer-motion` (+`motion-dom`, `motion-utils` trong lock), `app/scripts/verify-css-split.mjs`. `frontend.md`, `UI_GUIDE.md`: giai đoạn chuyển kéo tới `article-flow`. |
| Lệch khác spec | Lệnh grep màu của spec còn khớp `src/styles/tokens.test.ts` (giá trị hex mong đợi của bảng màu để test tương phản) — giữ, không phải màu UI. `window.confirm` chỉ còn `ModeratorArticlesPage`. Thêm `src/pages/PlaceholderPage.test.tsx` (2 ca, mốc hành vi trước khi chuyển). `ProfilePage.test.tsx` đổi selector `.user-avatar` → `[data-slot="user-avatar"]` (đỏ trước khi sửa). |
| Test | `npx vitest run` theme-bootstrap, styles/tokens, ui/focus, ui/labels, PlaceholderPage, Profile/ProfilePage, layout/Sidebar, `src/pages/Admin` (4), App.author-session, StaffPreferences: **13 files 187/187**. `npm run build` đạt (cảnh báo chunk > 500 kB có từ trước). Không chạy `App.auth.test.tsx` (chỉ đổi class wrapper Auth) và full suite theo luật ngân sách. |
| Kiểm bằng mắt | Playwright MCP, dev 3000 + backend của người dùng, khách: `/courses` (Placeholder) desktop 1440 dark + light (màu token đổi đúng, h1 tracking normal/margin 0, không cuộn ngang); mobile cảm ứng 390 `/courses`, `/`, `/login`, `/settings/theme`: coarse, không cuộn ngang, control ≥ 44px (trừ link logo Auth — có từ trước), chữ nút không tràn. **Chưa kiểm:** route cần đăng nhập (Profile, Admin, AuthorApply, smoke `/author/blogs`, `/blogs`, `/blogs/:id`, `/moderator/articles`) — không đọc được mật khẩu dev. |
| Review vòng 1 | `review --wait`: không lỗi chức năng; 1 × P2 — thư mục `.playwright-mcp/` (artifact Playwright MCP của phiên) chưa track có thể bị `git add -A` đưa vào commit → đã xóa; `.claude/settings.local.json` đã bị git ignore toàn cục. Không đổi code nên không chạy vòng 2. Ngoài phạm vi: đề nghị thêm `.playwright-mcp/` vào `.gitignore` (không thuộc đường dẫn module). |

## Admin UI (refactor/admin-ui)

| Mục | Nội dung |
|---|---|
| Code | `services/api/client.ts`: `ApiError.code` (từ body `code`). `pages/Admin/adminErrors.ts` + test: dịch 15 mã lỗi Admin vi/en, rồi theo HTTP 400/403/404/409/429/5xx, còn lại câu mặc định của trang; áp 10 chỗ `catch` ở Users/AuthorApplications/Taxonomy. `pages/Admin/AdminPagination.tsx` + test: “Hiển thị a–b trong n”, nút số (`pageItems`: đầu, cuối, hiện tại ±1, dấu …), khung primitive `ui/pagination` + `Button`. `AdminUsersPage`: header + Làm mới, 4 thẻ số (đếm bằng `size=1`: tổng, `active=true/false`, `role=AUTHOR`), card Bộ lọc (chip trạng thái thay select “Tài khoản”, tìm, vai trò, hồ sơ tác giả, sắp xếp, thứ tự), bảng lưới 7 cột (md+) / thẻ (mobile), nút “Xem” + khóa/mở khóa từng hàng (AlertDialog), giữ chọn nhiều. `TaxonomyPage`: 3 thẻ số (tổng/hoạt động/ẩn), card Bộ lọc (chip trạng thái), lưới 3 cột card có hàng nút Sửa/Ẩn-Bật, thông báo thành công vi/en (trước luôn vi), bật/tắt trực tiếp từ card. Size 20 → 12. |
| Lệch / quyết định | Bỏ phần ảnh có mà backend chưa có (tạo/sửa/xóa người dùng, MFA, lọc ngày). Nhãn bật/tắt en: “Deactivate/Activate” (bản dịch cũ “Inactive”). Test cũ tìm nút theo `/Trần Minh/`, `/Java/` đổi sang tên chính xác vì có thêm nút trên hàng/card. |
| Test | `npx vitest run src/pages/Admin src/pages/Author/AuthorApplyPage.test.tsx`: **7 files 43/43**. `npm run build` đạt (cảnh báo chunk có từ trước). Không chạy full suite. |
| Kiểm bằng mắt | Playwright MCP, dev 3000 + backend người dùng, admin demo: `/admin/users` light + dark desktop, `/admin/topics` dark; mobile cảm ứng 390 `/admin/users`, `/admin/topics`, `/admin/tags`: không cuộn ngang, control ≥ 44px, chữ nút không tràn. Thật với backend: tạo trùng chủ đề (vi) → “Tên chủ đề đã tồn tại. Hãy chọn tên khác.”; trùng thẻ (en) → “A tag with this name already exists…”; Tag 13 mục: trang 1 = 12, trang 2 = 1, Trang sau khóa ở cuối, quay lại đúng. Users chỉ 9 người, Topic 8 → một trang (phân trang nhiều trang chỉ kiểm qua test + Tag). |
| Review vòng 1 | `review --wait`: 3 × P2, đều nhận và sửa. (1) Phân trang 5+ trang tràn ở 390px → dưới `sm` chỉ còn mũi tên + “trang / tổng”. (2) Trang hiện tại vượt tổng sau khi khóa/ẩn bản ghi cuối → `load` kẹp về trang cuối còn tồn tại (Users, Taxonomy). (3) Bảng Users bị cắt ở 768–1279px vì sidebar → lưới 7 cột từ `xl`, dưới đó là thẻ. +2 test. `npx vitest run src/pages/Admin` **36/36** (+ AuthorApply 7 trước đó), build đạt. Playwright: 768/1024 thẻ, 1280 bảng, 0 nút bị cắt; mobile Tag “1 / 2”, Trang sau → trang 2. |
| Review vòng 2 | `adversarial-review --wait` chỉ phần sửa vòng 1: **approve**, không phát hiện. Hết 2 vòng. |

## Admin UI vòng 2 (refactor/admin-ui)

| Mục | Nội dung |
|---|---|
| Backend | `V9__add_topic_icon.sql`: `topics.icon varchar(64)` + CHECK `^[a-z0-9]{1,64}$`. `Topic.icon` + `updateIcon`; `CreateTopicRequest.icon` (@Pattern, rỗng → null); `UpdateTopicRequest.icon` (có cờ `iconProvided`; null/rỗng xóa; đủ điều kiện “có cập nhật”); `AdminTopicResponse`/`AdminTopicSummaryResponse` thêm `icon`; service tạo/sửa/đọc/danh sách. Không đổi API Tag hay API bài viết công khai. |
| Frontend | `simple-icons` (CC0, nạp lười một lần, chunk riêng). `pages/Admin/topicIcons.tsx`: `searchIcons` (slug/tên chính xác → tiền tố → chứa; bí danh `java→openjdk`), `iconFill` (giữ màu thương hiệu, gần đen/gần trắng thì theo màu chữ theme), `initials`, `useBrandIcons`, `TopicIcon`. `TaxonomyPage`: card bấm cả card mở form (bỏ hàng Sửa/Ẩn, bỏ bật/tắt từ card), Chủ đề hiện logo hoặc chữ cái, Thẻ giữ ô `#`; form Chủ đề có fieldset Icon (xem trước, tìm, lưới gợi ý 24, Bỏ icon), gửi `icon` (Thẻ không gửi). `AuthorApplicationsPage`: cùng khung `/admin/users` (header + Làm mới, 4 thẻ số theo trạng thái bằng `size=1`, card Bộ lọc có chip trạng thái, lưới 6 cột từ `xl`/thẻ dưới `xl`, nút “Xem”, `AdminPagination`, 12/trang, kẹp trang). `ui/textarea.tsx`: `font-sans` (preflight tắt → textarea ra monospace). |
| Lệch / quyết định | Màu logo: thương hiệu thật trên ô nền `background`; logo gần đen/trắng dùng màu chữ theme. Test cũ “bật/tắt từ card” bỏ theo quyết định bỏ hàng nút. |
| Test | Backend: `./gradlew test --tests 'com.techverse.server.admin.AdminTopicIntegrationTest'` **18/18** (+1 ca icon: set/giữ/đổi/xóa, từ chối `Docker`, `spring-boot`, URL, `<svg/>`, 65 ký tự). FE: `npx vitest run src/pages/Admin src/components/ui src/pages/Author/AuthorApplyPage.test.tsx` **13 files 86/86**; `npm run build` đạt (chunk `simple-icons` 5,3 MB / 2,2 MB gzip, chỉ tải ở trang Chủ đề). |
| Kiểm bằng mắt | Playwright, backend cũ của người dùng (chưa có V9): `/admin/topics` card chữ cái + form có fieldset Icon (dark); `/admin/author-applications` desktop dark: 4 thẻ số, bảng 6 cột, không cuộn ngang. Sửa sau ảnh: textarea monospace, gợi ý Java. **Chưa kiểm:** logo thật trên card và lưu icon qua backend (cần khởi động lại backend để chạy V9); mobile Hồ sơ tác giả. |
| Review vòng 1 (vòng 2 công việc) | `review --wait`: 2 × P2, nhận và sửa. (1) Phân trang số vẫn hiện ở 768px có sidebar → dạng gọn “trang / tổng” tới `lg`. (2) Chuyển nhanh Chủ đề ↔ Thẻ, thống kê cũ đè thống kê mới → `loadStats` đánh số request + reset khi đổi `kind`; +1 test (đỏ “99” → xanh). `npx vitest run src/pages/Admin` **44/44**, build đạt. |
| Review vòng 2 (vòng 2 công việc) | `adversarial-review --wait` chỉ phần sửa: **approve**, không phát hiện. Hết 2 vòng. |

## Moderator theo chuẩn Admin (refactor/admin-ui, vòng 3)

| Mục | Nội dung |
|---|---|
| Frontend | `pages/Moderator/ArticleStats.tsx` (`useArticleStats` đếm bằng `size=1` theo PENDING/PUBLISHED/CHANGES_REQUESTED/HIDDEN + `ArticleStats` thẻ số). `ModeratorDashboardPage`: `tw-page`, header, 4 thẻ số thật (bỏ 3 thẻ giả “—” bình luận/báo cáo vì chưa có chức năng), card “Hàng đợi kiểm duyệt” (số bài chờ) + nút mở danh sách. `ModeratorArticlesPage`: header + Làm mới, thẻ số, card Bộ lọc (chip 5 trạng thái + Tất cả, tìm động debounce), danh sách 6 cột từ `xl`/thẻ dưới `xl`, `AdminPagination` 12/trang (trước 20) + kẹp trang, chi tiết trong `Sheet` (khung đọc Markdown `role=region` tabIndex 0, nhận xét trước, Textarea + đếm ký tự), `AlertDialog` thay `window.confirm`; yêu cầu chỉnh sửa thiếu nhận xét → báo ngay ở ô. Payload PATCH giữ nguyên. `adminErrors.ts` +6 mã `ARTICLE_*`. Xóa `styles/pages/moderator.css` + import + 2 rule `.moderation-*` trong `content.css`. Chân phân trang ẩn khi 0 kết quả (Users, Hồ sơ tác giả, Moderator — trước còn dải viền trống). |
| Test | `npx vitest run src/pages/Moderator src/pages/Admin` **8 files 49/49** (Moderator +4 ca: thẻ số/12/trang/Trang 3, xác nhận bằng dialog không `window.confirm`, thiếu nhận xét, 409 `ARTICLE_REVIEW_STALE` tiếng Việt); `npm run build` đạt. |
| Kiểm bằng mắt | Playwright, tài khoản `moderator@techverse.test` (RUNBOOK): `/moderator`, `/moderator/articles` dark 1440 + 390 (không cuộn ngang). DB dev không có bài viết → **chưa kiểm** bảng có dữ liệu, Sheet đọc bài, duyệt thật. |
| Review vòng 1 (vòng 3 công việc) | `review --wait`: 3 × P2, nhận và sửa. (1) Thống kê: lượt cũ trả muộn đè số mới → request id ở `useArticleStats`, `AdminUsersPage.loadStats`, `AuthorApplicationsPage.loadStats`; +1 test Moderator (đỏ khi bỏ chặn → xanh). (2) `ARTICLE_ASSOCIATION_INACTIVE` thêm câu “Chủ đề hoặc thẻ của bài đã bị ẩn…”. (3) Chữ dài không khoảng trắng: `[overflow-wrap:anywhere]` cho tóm tắt/nhận xét/mô tả/thẻ trong Sheet Moderator, Badge chuyên môn + ghi chú/lịch sử trong Sheet Hồ sơ tác giả. `npx vitest run src/pages/Moderator src/pages/Admin` **50/50**, build đạt. |
| Review vòng 2 (vòng 3 công việc) | `adversarial-review --wait` phần sửa: **needs-attention**, 1 × medium: đoạn giới thiệu (`selected.bio`) trong Sheet Hồ sơ tác giả chưa có `overflow-wrap` → bio liền 2.000 ký tự có thể cuộn ngang trên mobile. Hết 2 vòng — chờ người dùng quyết (khuyến nghị: thêm `[overflow-wrap:anywhere]`, 1 class). |

## Sau vòng 3: bio + thêm icon (refactor/admin-ui)

| Mục | Nội dung |
|---|---|
| Sửa | Phát hiện vòng 2: đoạn Giới thiệu trong Sheet Hồ sơ tác giả có `[overflow-wrap:anywhere]`. Bảng chọn icon: `topicIcons.suggestIcons` — có từ khóa thì tìm toàn bộ (tối đa 120, trước 24); ô trống thì logo khớp tên trước rồi bộ `POPULAR` 85 logo công nghệ (đã kiểm từng slug có trong simple-icons; thư viện không có AWS/Azure/C#/OpenAI/Playwright). Dòng đếm “N logo · gõ để tìm trong 3.467 logo”, khung cuộn `max-h-64`. |
| Test | `npx vitest run src/pages/Admin src/pages/Moderator` **52/52** (+2 ca `suggestIcons`), build đạt. Playwright: form “Tạo chủ đề mới” trống hiện 87 icon. Thay đổi nhỏ theo yêu cầu người dùng sau khi hết 2 vòng review — không gọi Codex thêm. |
