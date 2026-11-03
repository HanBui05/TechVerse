# UI foundation v2 (shadcn) — Log

Trạng thái chính thức: xem [`PLAN.md`](PLAN.md). Spec: [`ui-foundation-v2.md`](ui-foundation-v2.md) — nguồn chuẩn về phạm vi; log chỉ giữ phần spec chưa có. Ba mục đầu và “Nhật ký phiên” được hook SessionStart tự nạp sau `/clear`; giữ chúng ngắn.

## Bắt đầu từ đây (cập nhật 2026-11-03)

- **Task 1–6 đã nhận, đã commit WIP** (Task 6 nhận 2026-11-03) — không đọc lại, không làm lại, không kiểm lại. **Task tiếp theo: Task 7a** (chỉ Moderator), session mới.
- **Cho Task 7a:** làm theo hướng giao diện Admin đã duyệt (header icon, Card filter, hàng trong Card, Badge tone, Skeleton, `EmptyState`, Sheet chi tiết, AlertDialog); tìm động thì dùng `hooks/use-debounced-value.ts` + chặn response cũ (`latest` ref như 3 trang Admin); icon màu sidebar Moderator (`toneText`); phần tử thô `button`/`ul`/`dd` gắn `data-slot` hoặc `m-0`. Spec Task 7a chưa ghi hướng “sinh động” — nếu người dùng muốn thì Codex cập nhật spec trước.
- **Sau đó:** Task 7b (dọn CSS ngoài Author/Blogs, giữ preflight tắt, gỡ `framer-motion`).
- **Đã tách sang module riêng:** Author (`AuthorApplyPage`, `AuthorBlogsPage`, `TagPicker`) → `author-ui-shadcn`; Blogs (`BlogsPage`, `BlogDetailPage`, `MarkdownContent`, wrapper `Pagination`) → `blogs-ui-shadcn`. Không sửa hoặc redesign các trang/component này trong Task 7.
- **Bỏ qua — không liên quan Task 7a:** trang Admin (đã nhận), trang/CSS Author và Blogs; `server/` trừ khi spec 7a đòi; các module cũ khác trong `PLAN.md`.
- **Môi trường kiểm:** Playwright MCP (`.mcp.json`) nạp sau khi khởi động lại phiên — phiên Task 6 không có, đã dùng script tạm. Dữ liệu mẫu Admin: `scripts/dev-seed-admin.sql` (RUNBOOK). Avatar thật trong danh sách Admin cần backend chạy code mới (khởi động lại backend).
- **Phát hiện chờ người dùng quyết:** link logo trên topbar mobile chỉ 32×32px khi cảm ứng (< 44px, QĐ 1A) — thuộc Task 2 đã nhận, chưa sửa. Nút “Trước/Tiếp” wrapper `Pagination` 40px cảm ứng — thuộc `blogs-ui-shadcn`.

## Quyết định người dùng chưa có trong spec

- **2026-11-03 — Task 6 thiết kế sinh động hơn, không chỉ đổi primitive** (spec chờ Codex cập nhật; đứng trên “không thêm copy/khối” của spec cho riêng Admin):
  - Được thêm khối/copy ngắn vi/en thuần trình bày: đầu trang có icon + mô tả + số kết quả; hàng danh sách có avatar, Badge màu, icon meta, hover; Skeleton khi tải; `EmptyState` có icon; chi tiết trong Sheet phải; Users có thanh hành động nổi khi chọn nhiều; Author applications có chip lọc nhanh theo trạng thái sẵn có; Taxonomy dạng card màu + form trong Dialog. Hiệu ứng chỉ CSS/Tailwind.
  - **Bỏ mọi thứ của tính năng chưa có:** thẻ số liệu giả Dashboard (khóa học, doanh thu, học viên…), nhãn nhóm “học viên/bài giảng”; Dashboard thay bằng lời chào + thẻ lối tắt tới các trang Admin thật. Không bịa số liệu.
  - **Sidebar Admin giống sidebar user:** icon mỗi mục có màu tone (`toneText` của `Sidebar.tsx`); nhóm Cài đặt là mục thu gọn, **mặc định đóng**, tự mở khi đang ở trang cài đặt. `StaffSettingsLinks` dùng chung với Moderator nên Moderator đổi theo.
  - Giữ nguyên API/payload/quyền/route/bảng màu/font/wrapper `Pagination`. Làm Dashboard + Users trước, chụp dark/light cho người dùng duyệt hướng rồi mới làm 2 trang còn lại.
  - **2026-11-03 — Chỉnh sau khi người dùng test Task 6:** (1) avatar trong danh sách/chi tiết Users và Author applications phải là avatar thật của người dùng (đang hiện chữ cái/sai); (2) ô tìm kiếm Admin tìm động khi gõ (không cần Enter); (3) phần chuyên môn trong hồ sơ tác giả trình bày đẹp hơn dạng chữ thường.
  - **2026-11-03 — Seed dev cho Admin:** người dùng yêu cầu thêm dữ liệu mẫu hồ sơ tác giả/chủ đề/thẻ để test → `scripts/dev-seed-admin.sql` (SQL idempotent chạy tay vào DB dev, không phải migration; cách chạy ở `docs/RUNBOOK.md`). Đã chạy vào DB dev.
  - **2026-11-03 — Người dùng duyệt hướng** (Dashboard + Users): “khá ưng”, được tự do sáng tạo cho Author applications + Taxonomy miễn hợp bối cảnh quản trị.

## Câu hỏi mở cho người dùng

- (không có)

## Nhật ký phiên
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
