# UI foundation v2 (shadcn) — Log

Trạng thái chính thức: xem [`PLAN.md`](PLAN.md). Spec: [`ui-foundation-v2.md`](ui-foundation-v2.md) — nguồn chuẩn về phạm vi; log chỉ giữ phần spec chưa có. Ba mục đầu và “Nhật ký phiên” được hook SessionStart tự nạp sau `/clear`; giữ chúng ngắn.

## Bắt đầu từ đây (cập nhật 2026-11-03)

- **Task 3 + 4 xong, đủ 2 vòng review** (vòng 2 = `/code-review` người dùng chạy; 8/9 phát hiện đã sửa, gồm 3 bug sidebar của Task 2). Chi tiết ở mục Task 4.
- **Người dùng đã nhận Task 3 + 4** (2026-11-03). **Task tiếp theo: Task 5** (Home + `EmptyState`), session mới. Đề xuất sửa luật (xem Nhật ký phiên) chờ người dùng hỏi, chưa áp dụng.
- **Thứ tự sau đó:** Task 5 (Home + tạo `EmptyState`) → Task 6 (AuthorApply + Admin, Pagination) → Task 7a (Blogs, AuthorBlogs, Moderator, TagPicker, MarkdownContent) → Task 7b (preflight, dọn CSS, gỡ `framer-motion`).
- **Đã xong — không đọc lại, không làm lại, không kiểm lại:** Task 1 (Tailwind v4, shadcn new-york/Radix, 20 primitive trong `components/ui`, token + 8 tone, `test/setup.ts`, UI_GUIDE/rule/skill). Task 2 (shell `SidebarProvider`, 3 sidebar dùng `SidebarFrame` trong `components/layout/Sidebar.tsx`, `Brand` logo Cloudinary, favicon, xóa `sidebar.css`, vùng chạm 44px). Cả hai đã review đủ 2 vòng. Chưa commit — cố ý, một commit sau Task 7b.
- **Bỏ qua — không liên quan task tiếp theo:** các trang hoãn của Task 7a và CSS của chúng (`blogs.css`, `moderator.css`, `author.css`); `server/`; các module cũ khác trong `PLAN.md`.
- **Chưa kiểm còn treo:** thiết bị cảm ứng thật (không giả lập được `pointer: coarse`). Đã kiểm 2026-11-03 qua iframe 390px: Profile mobile (topbar hiện, card xếp dọc 326px, không cuộn ngang), sheet mobile Moderator 320px, menu đúng vai trò, bấm logo thì sheet đóng; Moderator đăng nhập → `/moderator`.

## Quyết định người dùng chưa có trong spec

| Ngày | Quyết định | Hệ quả khi làm |
|---|---|---|
| 2026-11-03 | Commit WIP cục bộ sau mỗi task người dùng nhận (`wip(ui-foundation-v2): Task n`), squash thành một commit cuối module (luật ở `CLAUDE.md`). | Spec chờ Codex cập nhật dòng “Không commit riêng từng task”. Task 1–4 đã commit WIP; review Task 5 chỉ xem diff chưa commit. |

## Câu hỏi mở cho người dùng

- (không có)

## Nhật ký phiên

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

## Ghi nhận khác

- `vitest.config.ts` thêm `css.include` cho `src/styles` để test đọc CSS thật qua `?raw`.
- Đính chính 2026-11-03: `JWT_SECRET_KEY` trong `.env` hợp lệ (Base64, 256 bit); nhận định “không hợp lệ” trong phản hồi vòng 2 của spec là sai.
