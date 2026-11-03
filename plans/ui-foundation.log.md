# UI Foundation Log

Trạng thái chính thức: xem [`PLAN.md`](PLAN.md). Spec: [`ui-foundation.md`](ui-foundation.md).

## Task 1 — Tách CSS thuần

### Nhật ký

| Bước | Kết quả |
|---|---|
| Mốc ban đầu | Sau `sidebar-cleanup`: `npm test` 9 files / 65 tests đạt; `npm run build` đạt. |
| Công cụ so sánh | Thêm `app/scripts/verify-css-split.mjs` (`capture` / `compare`, dùng `postcss` có sẵn trong cây phụ thuộc của Vite, không sửa `package.json`). `capture` ghi 2906 declaration khác nhau, 795 ngữ cảnh selector. Kiểm tra công cụ: thêm một declaration → bị bắt; đổi thứ tự hai rule cùng selector → bị bắt; so sánh file với chính nó → 0 khác biệt. |
| Tách file | `styles.css` còn 1 `@import url(...)` font + 15 `@import` cục bộ; 15 file mới theo bản đồ (`tokens`, `base`, `layout/{shell,sidebar}`, `components/{controls,forms,content}`, `pages/{home,settings,auth,profile,admin,author,moderator,blogs}`). Selector dạng danh sách có chủ sở hữu khác nhau được tách theo chủ; media query tách theo selector. Giá trị, literal màu không đổi. |
| So sánh inventory | `node scripts/verify-css-split.mjs compare src/styles.css` → **mã 0**, 0 khác biệt đa tập (ngữ cảnh + selector + declaration), 0 khác biệt thứ tự tương đối của rule trùng selector. |
| Ảnh trước/sau (4 trang bắt buộc) | `/`, `/login`, `/settings/theme`, `/blogs` × desktop 1440×900 và mobile 390×844, Edge headless, API giả cố định, animation tắt: **8/8 ảnh giống từng byte** với ảnh nền. Ảnh nền ổn định (2 lần chụp trước khi sửa giống nhau 8/8). |
| Ảnh bổ sung | 7 trang khác (`/register`, `/forgot-password`, placeholder `*`, `/profile`, `/author/apply`, `/admin`, `/moderator`) × 2 viewport = 14 ảnh: tất cả khớp ít nhất một lần chụp ảnh nền. |
| Test / build | `npm test`: 9 files, **65/65** đạt. `npm run build`: đạt; CSS build 69.71 kB, vẫn mở đầu bằng `@import` font. |

### Lỗi cascade phát hiện và đã sửa trong lúc làm

1. **Avatar:** `.avatar-small/.avatar-large` đặt ở `profile.css` bị nạp sau `.user-avatar` (`content.css`), nên chữ "NA" to hơn. Phát hiện nhờ ảnh bổ sung trang `/profile` (không nằm trong 4 trang bắt buộc). Sửa: `.avatar`, `.avatar-small`, `.avatar-large` chuyển sang `components/content.css`.
2. **Nút thu gọn sidebar trên mobile:** `.icon-button` và `.desktop-only` (controls) bị nạp sau `.sidebar-toggle`/`.admin-sidebar-collapse` (sidebar) nên mất hiệu lực ẩn/hiện. Ảnh chụp **không** thấy (phần tử nằm ngoài khung nhìn), phát hiện bằng bộ kiểm tra tĩnh các cặp rule bị đảo thứ tự. Sửa: nạp `controls.css` trước `sidebar.css`.
3. Bộ kiểm tra tĩnh (công cụ tạm, không đưa vào repo) kiểm chứng bằng cách chạy lại trên mapping lỗi: bắt lại cả hai lỗi trên; trên mapping cuối: **0 cặp** rule cùng độ ưu tiên, có thể cùng áp lên một phần tử, khác giá trị mà thứ tự đã đảo.

### Quyết định và lệch khỏi bản đồ

- `@import url(...)` font nằm ở `styles.css` (không phải `base.css`) để vẫn đứng đầu CSS đã build; sẽ đổi sang Inter ở Task 2.
- Thứ tự nạp: `tokens, base, shell, controls, sidebar, forms, content, home, settings, auth, profile, admin, author, moderator, blogs` (controls trước sidebar, xem lỗi 2).
- `.avatar*` (kích thước) ở `content.css`; `.application-row*` ở `admin.css` (còn dùng ở `AuthorBlogsPage`); `.placeholder-*` ở `shell.css`; `.sr-only` ở `base.css`; `.brand*` ở `sidebar.css`; `.mobile-only/.desktop-only` ở `controls.css`; `.hero-* .button` ở `home.css`; `.profile-* .article-panel` ở `profile.css`; `.article-panel .application-row` ở `forms.css`.
- Khối `@media` trộn được tách thành nhiều khối cùng điều kiện đặt cạnh selector chủ; selector danh sách tách theo chủ nên một số declaration xuất hiện ở hai file (không đổi tập inventory).
- 12 comment trong file gốc không được giữ lại (không ảnh hưởng inventory).

### Kết quả test

- Inventory: PASS (0/0). Ảnh bắt buộc: PASS 8/8. `npm test`: PASS 65/65. `npm run build`: PASS.
- Nhiễu chụp ảnh đã gặp: lần chụp đầu tiên sau khi đổi CSS hoặc khởi động lại máy chủ dev đôi khi lệch vài chục điểm ảnh (60 điểm ở `theme-mobile`; 6 điểm ở `forgot-desktop`), không lặp lại ở các lần chụp sau; ảnh nền mobile của 5 trang cũng không ổn định giữa hai lần chụp. Vì vậy kết luận dựa trên nhiều lần chụp, không dựa trên một lần.
- `scripts/verify.sh` đầy đủ: **chưa chạy** (Docker chưa chạy); spec Task 1 chỉ yêu cầu `npm test` và `npm run build`.
- Review Task 1: `/codex:review --background` không có blocker cao/trung (Codex xác nhận inventory và thứ tự rule được giữ).

### Ngoài phạm vi (ghi nhận, không sửa)

- Class không còn được TSX dùng nhưng CSS còn: `.passkey-button`, `.social-mark`, `.github-mark`, `.linkedin-mark`, `.admin-nav-item`; Task 1 chuyển nguyên văn nên chưa xóa.
- Công cụ tách, chụp ảnh và kiểm tra thứ tự cascade nằm ở thư mục tạm của phiên làm việc, không vào repo; chỉ `verify-css-split.mjs` được commit theo spec. Kết quả đã ghi ở trên; muốn chạy lại cần dựng lại công cụ chụp.
- `verify-css-split.mjs` dùng `postcss` từ cây phụ thuộc của Vite (phụ thuộc gián tiếp, không khai báo trong `package.json`).

## Task 2 — Token, palette, font và theme bootstrap

### Nhật ký

| Bước | Kết quả |
|---|---|
| Kiểm kê | 157 literal màu khác nhau (219 chỗ dùng) ngoài `tokens.css`, chủ yếu họ tím cũ. Ánh xạ sang token theo vai trò bằng công cụ tạm (theo sắc độ và thuộc tính CSS) cộng khoảng 50 ngoại lệ thủ công; đã rà từng dòng thay đổi. |
| `tokens.css` | Viết lại: dark ở `:root`, light ở `:root[data-theme='light']`. Nhóm token: bề mặt/viền/chữ (`--bg`, `--sidebar`, `--surface`, `--surface-2`, `--border`, `--text`, `--text-2`, `--muted`), thương hiệu và trạng thái (`--primary`, `--on-primary`, `--accent-text`, `--info`, `--success`, `--warning`, `--danger`), hiệu ứng (`--shadow*`, `--scrim`, `--hero-glow`), màu cố định (`--preview-*`, `--brand-google`, `--brand-linkedin`), 11 token code/syntax, `--font-sans`. Không còn `--cyan`, `--pink`. |
| Xóa literal | Lệnh `rg` thứ nhất (CSS ngoài `tokens.css`: hex, `rgb/rgba/hsl/hsla`, `white/black`) và lệnh thứ hai (hex trong ts/tsx/html) đều **không còn kết quả** (trước: 127 và 1 dòng). |
| Override sáng | Xóa 9 rule `:root[data-theme='light'] .xxx` (chỉ chứa khai báo màu): các rule gốc nay dùng token tự đổi theo theme. |
| Font | `@import` Inter (400–700) thay DM Sans/Space Grotesk; mọi `font-family` dùng `var(--font-sans)`; không còn tham chiếu font cũ. Khai báo `font-family/color/background/font-synthesis` của `:root` chuyển sang `base.css`. |
| Theme bootstrap | Thêm script inline vào `index.html`, áp `light`/`dark` hợp lệ trước khi React render, mặc định `dark`, an toàn khi `localStorage` bị chặn; xóa `theme-color` cũ. Test trước (đỏ), rồi code (xanh): `theme-bootstrap.test.ts` (7 test, trích và chạy đúng script trong `index.html` qua `?raw`) và 4 test mặc định/khôi phục theme trong `StaffPreferences.test.tsx`. |
| Test / build | `npm test`: 10 files, **76/76** đạt (mốc cũ 65). `npm run build`: đạt. |

### Tương phản (tính từ giá trị trong `tokens.css`)

- Khớp các giá trị spec yêu cầu: dark `#f1f5f9`/`#0f172a` 16.30, `#cbd5e1`/`#0f172a` 12.02, `#38bdf8`/`#0f172a` 8.33, `#38bdf8`/`#1e293b` 6.83; light `#111827`/`#fff` 17.74, `#4b5563`/`#fff` 7.56, `#0056d2`/`#fff` 6.44; `#fff` trên `#0056d2` 6.44.
- Đo thêm toàn bộ cặp chữ/nền của token (chữ, `--text-2`, `--muted`, `--accent-text`, trạng thái, nền nhạt 15% của từng màu, 8 màu code): **thấp nhất 4.94:1**, không cặp nào dưới 4.5. Vòng tròn focus `--accent-text` đạt 8.33 (dark) và 6.44 (light) trên nền chính.
- `--primary` (`#0056d2`) chỉ còn dùng làm nền có chữ trắng; các chỗ dùng `--primary` làm chữ, icon, viền focus được đổi sang `--accent-text`.

### Quyết định và lệch khỏi spec

- Thêm `--surface-2` (`#334155` dark, `#f3f4f6` light) lấy từ token của trang mẫu; `--muted` tối là `#a8b4c8` (không phải `#94a3b8` của mẫu vì chỉ đạt 4.04 trên `--surface-2`); màu trạng thái chọn để đạt 4.5:1 cả trên nền nhạt.
- Nút chính, avatar, brand-mark, `login/register-submit` đổi từ chuyển sắc tím sang màu đặc `var(--primary)` (cần cho tương phản chữ trắng); chữ nhấn h1 tạm là màu đặc `--accent-text`. Phần còn lại của phong cách (cỡ h1, bỏ đổ bóng/glow của nút, bỏ quầng sáng hero, hero căn giữa) thuộc Task 3 và chưa làm.
- Cấu trúc trang chủ chưa đổi (các khối giữ chỗ vẫn còn) vì thuộc Task 3.

### Kiểm tra giao diện

- 9 trang × dark/light × desktop/mobile = 36 trạng thái: không có cuộn ngang, `body` dùng Inter. Đã xem ảnh của trang chủ (dark, light), đăng nhập, giao diện, bài viết, hồ sơ, admin, moderator.
- Một ảnh đăng nhập tối chụp ra trắng do hai tiến trình chụp chạy song song (lỗi công cụ); chụp lại thì đúng.

### Chưa kiểm / ngoài phạm vi

- Chưa xem từng trạng thái hover/focus, danh sách admin có dữ liệu thật, form tác giả và khối code Markdown có nội dung (chỉ đo tương phản token code, chưa xem hiển thị thật).
- `scripts/verify.sh` đầy đủ chưa chạy (Docker).
- Working tree đang gộp thay đổi của Task 1 (chưa commit) và Task 2; nên commit Task 1 riêng trước khi review Task 2.

### Review Task 2

- **Vòng 1** (`/codex:review --background`): 1 phát hiện P2. Bốn vòng sáng focus (`box-shadow` của `.tag-picker-box:focus-within`, `.login-input:focus`, `.author-apply-card input:focus`, `.profile-field input:focus`) vẫn trộn từ `--primary` (2.27:1 trên `--surface`), trái với tiêu chí “không dùng `--primary` làm focus ring trên nền tối”. Phát hiện đúng; tôi đã bỏ sót vì chỉ đổi `color/outline/border`, chưa đổi `box-shadow` của focus.
- **Đã sửa:** cả bốn chuyển sang `var(--accent-text)`. Tìm lại toàn bộ rule có `focus` trong 4 file: không còn `var(--primary)`. `npm test` 76/76, `npm run build` đạt, hai lệnh `rg` literal màu vẫn không còn kết quả.
- Các chỗ `--primary` còn lại đều là nền có chữ trắng hoặc bóng trang trí không phải focus (`.button-primary`, `.brand-mark`, `.login-submit:hover`, `.register-submit:hover`, `.tech-tag:hover`); bóng nút sẽ bị bỏ ở Task 3.
- Codex không chạy lại được Vitest (sandbox chỉ đọc chặn file tạm của Vite); kết quả test dựa trên log này.
- Vòng 2 chưa chạy: diff sửa chỉ 4 dòng; người dùng quyết định có chạy lại review hay nhận kết quả.

## Task 3 — Trang chủ

### Nhật ký

| Bước | Kết quả |
|---|---|
| Yêu cầu bổ sung | Người dùng thêm 4 việc khi mở Task 3 (ghi trong “Quyết định của người dùng” của spec và D-016): giảm cỡ h1 hero, mô tả hero dài hơn, padding hero lớn hơn, tech tag nhiều màu như trang mẫu. |
| Test trước | `HomePage.test.tsx` (5 test): không còn placeholder/community/khóa học trống, hero giữ tiêu đề + hai nút, mô tả vi/en ≥ 150 ký tự, 5 tag có tông riêng. Chạy trước khi sửa: 4 đỏ đúng lý do (còn thẻ trống, mô tả 99/94 ký tự, tag chưa có tông). |
| JSX / copy | `HomePage.tsx` viết lại: bỏ `EmptyBlogCard`, `.hero-aside`, khu community và mục khóa học; tag dùng mảng `techTags` có `data-tone`. Xóa `components/community/CommunityCard.tsx`. Xóa 9 key i18n không còn dùng (cả vi và en); `heroDescription` dài hơn (vi 183, en 176 ký tự), chỉ nhắc điều đã có (đọc và chia sẻ bài viết). |
| CSS | `home.css` còn khoảng 120 dòng: hero một cột căn giữa tối đa 720px, nền `--surface` (bỏ quầng sáng), padding `clamp(72px,9vw,128px) … clamp(72px,8vw,112px)` (trước `clamp(55px,7vw,100px) … 68px`), h1 `clamp(30px,3.4vw,48px)` / 700 / giãn chữ bình thường / chữ nhấn một màu đặc, mô tả 18px, tag nhiều màu qua `--tone` + `data-tone` (xanh dương, xanh lá, tím, vàng, hồng) với chấm màu. Bỏ gradient chữ `h1 span` ở `base.css`; `.section-kicker` (dùng ở 12 trang) chuyển sang `base.css`. Nút: bo 10px, bỏ shadow/glow của `.button-primary`, `.login-submit:hover`, `.register-submit:hover`. Token: thêm `--violet`, `--rose`; bỏ `--hero-glow` và `--shadow` không còn dùng. |
| Test / build | `npm test`: 11 files, **81/81** đạt (trước 76). `npm run build`: đạt. Hai lệnh `rg` literal màu: không còn kết quả. |
| Tương phản tag | Chữ tag trên nền nhạt 12% và hover 15%: thấp nhất **4.63:1** (hồng, theme sáng). Lần đầu thử hover 20% bị 4.49 và 4.25 (theme sáng) nên hạ xuống 15%. |
| Giao diện | Đã xem trang chủ dark desktop, light desktop, dark mobile. 36 trạng thái (9 trang × dark/light × desktop/mobile): không cuộn ngang, font Inter. |

### Lỗi của Task 2 phát hiện và sửa ở đây

- Bộ ánh xạ màu của Task 2 khớp theo chuỗi con nên gán nền “6% chữ” cho cả `.tech-tag i` (chấm màu), làm chấm gần như vô hình. Đã bỏ vì `home.css` được viết lại. Đã kiểm tra mọi ngoại lệ khác của Task 2: chỉ ngoại lệ này khớp nhầm (hai khớp của `.brand-mark` là chủ ý).

### Chưa kiểm / ngoài phạm vi

- Hai nút hero vẫn trỏ tới `/courses` và `/interview`, hiện là trang “đang phát triển”. Spec không yêu cầu đổi nhưng chúng mâu thuẫn với nguyên tắc D-012/D-015; cần quyết định riêng.
- Nhãn “Welcome to TechVerse” vẫn là tiếng Anh trong giao diện tiếng Việt (nằm ngoài yêu cầu).
- Trang chủ giờ chỉ có phần hero; phần dưới hero trống cho tới khi có nội dung thật.
- `scripts/verify.sh` đầy đủ chưa chạy (Docker). Review Task 3: chưa chạy. Chưa xem hover/focus từng trạng thái.
