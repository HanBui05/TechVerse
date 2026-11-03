# UI Foundation

Trạng thái: xem [`PLAN.md`](PLAN.md). Spec do Codex viết; Claude chỉ ghi vào mục “Phản hồi”.

**Mục tiêu:** Tách `app/src/styles.css` thành CSS theo nền tảng, layout, component và khu vực mà không làm sai cascade; sau đó áp giao diện đã chốt với theme tối mặc định, light theme vẫn chọn được, bảng slate + xanh dương `#0056d2`, font Inter và phong cách phẳng theo [`docs/design/UI_GUIDE.md`](../docs/design/UI_GUIDE.md). Đồng thời bỏ các khối giữ chỗ trống trên trang chủ theo D-015.
**Làn:** Đầy đủ
**Giai đoạn:** Giao diện
**Đổi giao diện:** Có

## Đường dẫn thuộc module

Chỉ được sửa, tạo hoặc xóa các đường dẫn sau. Ngoài danh sách là ngoài phạm vi.

- `app/index.html` — khởi tạo theme đã lưu trước khi React render và loại bỏ `theme-color` tối cũ viết cứng.
- `app/src/StaffPreferences.test.tsx` — kiểm thử mặc định tối, light theme vẫn chọn/lưu được và preference hợp lệ được khôi phục.
- `app/src/theme-bootstrap.test.ts` — đọc và thực thi script khởi tạo theme trong `index.html`, kiểm thử preference hợp lệ/không hợp lệ và fallback trước khi React render.
- `app/src/pages/Home/HomePage.tsx` — bỏ Featured content, Khóa học nổi bật và toàn bộ khu community; áp hero một cột căn giữa.
- `app/src/pages/Home/HomePage.test.tsx` — kiểm thử các placeholder/community đã bị bỏ và cấu trúc hero còn lại.
- `app/src/components/community/CommunityCard.tsx` — xóa vì chỉ phục vụ hai thẻ GitHub/Discord chưa có chức năng trong Home.
- `app/src/data/i18n.ts` — xóa copy placeholder/community không còn dùng.
- `app/scripts/verify-css-split.mjs` — chụp và so sánh inventory CSS trước/sau Task 1 mà không thêm dependency.
- `app/src/styles.css` — entry CSS duy nhất, chỉ điều phối thứ tự import các file CSS bên dưới.
- `app/src/styles/tokens.css` — token màu, bóng đổ và giá trị dùng chung cho dark/light theme.
- `app/src/styles/base.css` — font Inter, reset, typography và quy tắc nền tảng toàn cục.
- `app/src/styles/layout/shell.css` — app shell, vùng nội dung, topbar mobile và responsive chung của shell.
- `app/src/styles/layout/sidebar.css` — sidebar người dùng, Admin, Moderator, settings trong sidebar và trạng thái thu gọn/mobile.
- `app/src/styles/components/controls.css` — button, control, focus state và utility dùng chung.
- `app/src/styles/components/forms.css` — `.article-*` và cấu trúc form/panel dùng chéo Author, Blogs, Profile.
- `app/src/styles/components/content.css` — avatar, pagination, tag picker và Markdown/content reader dùng chung.
- `app/src/styles/pages/home.css` — hero, tag, community và các selector trang chủ còn sử dụng.
- `app/src/styles/pages/settings.css` — chỉ selector của màn chọn theme/ngôn ngữ.
- `app/src/styles/pages/auth.css` — đăng nhập, đăng ký, quên mật khẩu và callback đăng nhập.
- `app/src/styles/pages/profile.css` — hồ sơ và avatar upload, trừ `.article-*` dùng chung.
- `app/src/styles/pages/admin.css` — dashboard, người dùng, taxonomy và đơn đăng ký tác giả phía Admin.
- `app/src/styles/pages/author.css` — đăng ký tác giả và phần riêng của quản lý bài viết tác giả.
- `app/src/styles/pages/moderator.css` — dashboard và không gian kiểm duyệt, gồm `.moderation-article-scroll`.
- `app/src/styles/pages/blogs.css` — danh sách, chi tiết và bố cục đọc bài viết.

## Bản đồ chi tiết

| Hiện ở đâu (file, tên class/hàm/bean) | Dùng bởi (component/trang/lớp gọi) | Đích sau thay đổi |
|---|---|---|
| `app/index.html`, meta `theme-color`; chưa gán theme trước module | Trình duyệt trước khi React mount | `app/index.html`: không giữ hex cũ; áp `light`/`dark` đã lưu trước render, fallback `dark` |
| `app/src/App.tsx`, state `theme` fallback `dark` và effect ghi `data-theme` | Toàn ứng dụng | Không đổi `App.tsx`; dùng làm hành vi chuẩn và bổ sung coverage tại `StaffPreferences.test.tsx` |
| `app/src/pages/Home/HomePage.tsx`, `EmptyBlogCard`, `.hero-aside`, `.courses-section`, `.community-grid` | Trang `/` | Xóa Featured content, Khóa học nổi bật và toàn bộ community; hero một cột căn giữa, rộng tối đa khoảng 720px |
| `CommunityCard.tsx` chỉ được `HomePage.tsx` dùng; Discord không có `href`, GitHub chỉ trỏ tới repository | Hai thẻ community trên Home | Xóa component; chỉ tạo lại trong task chức năng community/repository thật sau này nếu có |
| `app/src/data/i18n.ts`, các key `featuredContent`, `blogEmpty`, `blogDescription`, `updating`, `buildFuture`, `featuredCourses`, `coursesDescription`, `coursesEmpty`, `coursesEmptyDescription` | Placeholder và community trên Home | Xóa các key không còn nơi dùng |
| `app/src/styles.css`, `:root` và `:root[data-theme='light']` | Mọi selector dùng token | `app/src/styles/tokens.css`; dark ở `:root`, light ở selector theme |
| `app/src/styles.css`, import DM Sans/Space Grotesk, reset, heading, `.sr-only`, readability scale | Toàn ứng dụng | `app/src/styles/base.css`; chỉ nạp và dùng Inter |
| `.app-shell`, `.page-content`, `.mobile-topbar`, `.mobile-scrim` | `App.tsx` và shell chung | `app/src/styles/layout/shell.css` |
| `.sidebar*`, `.nav-*`, `.admin-sidebar*`, `.moderator-sidebar*`, `.staff-settings*`, `.account-*`, `.settings-trigger`, `.settings-panel`, `.settings-row`, `.settings-link` | Các component trong `components/layout/` | `app/src/styles/layout/sidebar.css` |
| `.button*`, `.icon-button`, control và focus state dùng chung | Nhiều component/trang | `app/src/styles/components/controls.css` |
| `.article-*` | `AuthorBlogsPage`, `BlogsPage`, `AvatarUpload`; không gồm `.moderation-article-scroll` | `app/src/styles/components/forms.css` |
| `.user-avatar*`, `.pagination*`, `.tag-picker*`, `.markdown-*` | Component dùng chung và trang gọi chúng | `app/src/styles/components/content.css` |
| `.hero-*`, `.welcome-badge`, `.tag-list`, `.tech-tag`, `.community-*`, `.blog-*`, `.empty-card*`, `.courses-section`, `.course-empty` | `HomePage.tsx`, `CommunityCard.tsx` | `app/src/styles/pages/home.css`; xóa toàn bộ selector blog/course/community mồ côi, chỉ giữ selector của hero còn dùng |
| `.settings-page`, `.settings-content`, `.settings-description`, `.preference-*`, `.theme-*`, `.language-*` | Các trang Settings | `app/src/styles/pages/settings.css` |
| Các selector login/register/google | Các trang Login/Register | `app/src/styles/pages/auth.css` |
| Các selector profile không thuộc `.article-*` | `ProfilePage`, `AvatarUpload` | `app/src/styles/pages/profile.css` |
| `.admin-page`, `.admin-*`, `.applications-*` | Các trang Admin | `app/src/styles/pages/admin.css` |
| `.author-*` và selector riêng của Author | Các trang Author | `app/src/styles/pages/author.css` |
| `.moderator-page`, `.moderator-*`, `.moderation-*` không thuộc sidebar | Các trang Moderator | `app/src/styles/pages/moderator.css` |
| `.blogs-*` | `BlogsPage`, `BlogDetailPage` | `app/src/styles/pages/blogs.css` |
| 10 override `:root[data-theme='light'] .xxx` | Home, sidebar, auth | Override còn cần đi cùng file sở hữu selector; override chỉ bù literal màu phải được thay bằng token rồi xóa |
| 25 khối media query, gồm khối 700px trộn shell/sidebar/home/control | Nhiều khu vực | Tách theo selector và đặt cạnh khu vực sở hữu; không gom responsive theo breakpoint |

- Hiện trạng sau `sidebar-cleanup`: `styles.css` còn 674 dòng, 113 giá trị hex khác nhau, 76 lần `rgb/rgba`, 27 lần `white`; TS/TSX không có hex và chỉ `main.tsx` import CSS.
- Mốc frontend sau cleanup: 9 test files, 65 tests đạt; `npm run build` đạt.
- Phụ thuộc chéo cần giữ: thứ tự import phải bảo toàn cascade giữa base/layout/component/page; media query và override theme phải đi cùng selector sở hữu.

## Phạm vi

### Task 1 — Tách CSS thuần

- Trước khi sửa CSS, chạy chế độ `capture` của `app/scripts/verify-css-split.mjs` để lưu inventory chuẩn vào thư mục tạm của hệ điều hành.
- Tách `styles.css` theo đúng bản đồ; `styles.css` chỉ còn các `@import` theo thứ tự cascade. Chuyển nguyên văn selector, declaration và literal màu hiện có; Task 1 không tạo token mới, không đổi giá trị và không chỉnh giao diện.
- Tách media query hỗn hợp để mỗi selector responsive nằm trong file sở hữu; bảo toàn specificity, thứ tự cascade, declaration và thứ tự tương đối của các rule trùng selector.
- Chạy chế độ `compare` sau khi tách. Script mở rộng đệ quy các `@import` tương đối rồi so sánh đa tập gồm ngữ cảnh at-rule/`@media`, selector và declaration (kể cả `!important`); đồng thời so sánh thứ tự tương đối của các rule trùng cùng ngữ cảnh + selector. Đạt khi cả hai phần sai khác bằng 0. `@import` nội bộ mới là khác biệt cấu trúc duy nhất được bỏ qua.
- Chụp cùng trạng thái trước/sau cho `/`, `/login`, `/settings/theme`, `/blogs` ở desktop và mobile; cố định browser, viewport, font, dữ liệu/auth và tắt animation. Ảnh phải có 0 pixel khác biệt và kết quả được ghi vào log task.
- Task 1 có cổng test/build riêng trước khi mở Task 2.

### Task 2 — Token, palette, font và theme bootstrap

- Token hóa literal màu đồng thời với áp bảng màu trong [`docs/design/UI_GUIDE.md`](../docs/design/UI_GUIDE.md):
  - Dark mặc định: nền chính/phụ `#0f172a` / `#1e293b`, chữ chính/phụ `#f1f5f9` / `#cbd5e1`, viền `#334155`.
  - Light chọn được: nền chính/phụ `#fff` / `#f9fafb`, chữ chính/phụ `#111827` / `#4b5563`, viền `#e5e7eb`.
  - `--primary` là `#0056d2` ở cả hai theme, dùng cho nền nút và chỉ dùng cho viền khi cặp nền đạt tương phản yêu cầu. Không dùng `--primary` làm chữ, icon trạng thái hoặc focus ring trên nền tối.
  - Thêm token chữ nhấn theo theme: dark dùng `#38bdf8`, light dùng `#0056d2`; hero và các chữ/link nhấn dùng token này thay vì dùng trực tiếp `--primary`.
- Token đặt theo vai trò ngữ nghĩa; cùng vai trò dùng chung token, không tạo token theo selector/component hoặc theo tên mã màu.
- Giữ dark làm fallback khi chưa có preference; khôi phục chính xác `light` hoặc `dark` đã lưu. Gán theme hợp lệ đã lưu trước khi React render để light theme không chớp tối; preference thiếu/không hợp lệ dùng dark.
- Đổi toàn bộ font sang Inter; không còn nạp hoặc dùng DM Sans/Space Grotesk.
- Xóa `theme-color` cũ viết cứng. Script bootstrap trong `index.html` có test riêng: đọc, trích và thực thi script trước module React với các trường hợp saved light, saved dark, thiếu và không hợp lệ.
- Task 2 có cổng test/build riêng trước khi mở Task 3.

### Task 3 — Trang chủ

- Theo D-015, xóa `EmptyBlogCard`, toàn bộ Featured content và toàn bộ Khóa học nổi bật/empty course khỏi `HomePage.tsx`; xóa import, copy và CSS mồ côi tương ứng. Không thay bằng dữ liệu giả hoặc bài viết vì API bài viết hiện yêu cầu đăng nhập.
- Bỏ `.hero-aside`; dùng hero một cột căn giữa, giới hạn nội dung khoảng 720px; căn giữa tiêu đề, mô tả, tag và actions ở desktop/mobile.
- Áp phong cách mẫu: h1 desktop 48px/700, letter-spacing bình thường; chữ nhấn h1 là màu đặc qua token chữ nhấn, không gradient; nút chính nền xanh đặc, bo 10px, không shadow/glow; hero không có quầng sáng nền.
- Xóa toàn bộ khu community, gồm cả GitHub repository card và Discord placeholder, cùng component/import/copy/CSS mồ côi. Chỉ đưa khu này trở lại trong task của chức năng thật sau này.

## Ngoài phạm vi

- Không thay đổi backend, API contract, database hoặc Flyway migration.
- Không thêm Tailwind, shadcn, CSS-in-JS, thư viện UI hoặc dependency mới; giữ CSS thường.
- Không thêm dữ liệu giả hoặc khối giữ chỗ thay cho Featured content/Khóa học nổi bật đã xóa.
- Không thay đổi route, quyền, request/response, auth, `PlaceholderPage` hoặc hành vi nghiệp vụ.
- Không sửa `app/src/App.tsx`; dark fallback hiện tại đã đúng D-013.
- Không thiết kế lại cấu trúc các trang khác ngoài palette/font/token dùng chung và các thay đổi trang chủ ghi rõ trong phạm vi.
- Không sửa component/page ngoài danh sách “Đường dẫn thuộc module”.

## Ràng buộc

- Được đổi API: Không. Được đổi DB (Flyway mới): Không.
- Giữ nguyên hành vi hiện tại: Có, ngoại trừ việc bỏ các placeholder Home và khu community chưa có chức năng theo D-015/D-016.
- Dark là mặc định; light vẫn phải chọn, lưu và khôi phục được. Không di chuyển hoặc ghi đè preference hiện có của người dùng.
- Màu giao diện đi qua biến CSS. Ngoài `tokens.css`, không được có hex, `rgb/rgba`, `hsl/hsla`, `white` hoặc `black`; được dùng `transparent`, `currentColor`, `inherit` và biểu thức dựa trên token như `color-mix(...)`.
- Token phải theo vai trò ngữ nghĩa; không đặt trần số lượng tùy ý nhưng không chấp nhận token một-lần theo selector/component nếu cùng vai trò đã tồn tại.
- Font toàn giao diện là Inter.
- Media query đi cùng selector sở hữu; khối hỗn hợp phải tách. Không đổi tên class trừ khi xóa class mồ côi đã xác minh.
- Mọi cặp chữ/nền mới phải đạt tương phản tối thiểu 4.5:1. Focus ring, vùng bấm và mobile không được phát sinh hồi quy so với trước task; không kéo lỗi bố cục cũ ngoài phạm vi vào task.

## Câu hỏi mở

Không còn. Người dùng đã quyết định bỏ toàn bộ khu community; chỉ thêm lại khi có chức năng thật. Bố cục hero dùng một cột căn giữa, rộng tối đa khoảng 720px. Spec đã được người dùng chốt sau vòng 2; không mở vòng phản biện thứ ba.

## Xong khi

### Task 1

- [ ] `app/src/styles.css` chỉ còn các `@import`; mọi selector nằm đúng file theo “Bản đồ chi tiết”, media query đi cùng selector sở hữu.
- [ ] Chạy từ `app/`: `node scripts/verify-css-split.mjs capture src/styles.css` ngay trước khi tách và `node scripts/verify-css-split.mjs compare src/styles.css` sau khi tách. Lệnh `compare` trả mã 0, báo 0 khác biệt trong đa tập ngữ cảnh at-rule/`@media` + selector + declaration và 0 khác biệt về thứ tự tương đối của các rule trùng cùng ngữ cảnh + selector; không có selector trùng/mất hoặc computed value thay đổi.
- [ ] Mọi literal màu và giá trị CSS trong Task 1 giữ nguyên; chưa token hóa, đổi palette/font hoặc chỉnh Home.
- [ ] Ảnh trước/sau của `/`, `/login`, `/settings/theme`, `/blogs` tại viewport desktop 1440×900 và mobile 390×844, trong cùng môi trường/trạng thái cố định, có 0 pixel khác biệt; bằng chứng và lệnh so sánh được ghi trong log task.
- [ ] Trong `app/`, `npm test` đạt ít nhất mốc 9 files/65 tests và `npm run build` đạt trước khi mở Task 2.

### Task 2

- [ ] Dark là mặc định khi không có preference hoặc preference không hợp lệ; `light`/`dark` hợp lệ đã lưu được script bootstrap áp trước module React và được khôi phục đúng. `theme-bootstrap.test.ts` trích/thực thi script inline cho đủ bốn trường hợp; `StaffPreferences.test.tsx` xác nhận light theme vẫn đổi/lưu được bằng UI.
- [ ] Token dark/light khớp bảng màu đã chốt; `--primary` là `#0056d2` nhưng không làm chữ/icon/focus trên nền tối; token chữ nhấn là `#38bdf8` ở dark và `#0056d2` ở light.
- [ ] Toàn bộ giao diện dùng Inter; không còn import hoặc `font-family` DM Sans/Space Grotesk.
- [ ] Tương phản được đo trên các cặp tối thiểu: dark `#f1f5f9`/`#0f172a` 16.30:1, `#cbd5e1`/`#0f172a` 12.02:1, `#38bdf8`/`#0f172a` 8.33:1, `#38bdf8`/`#1e293b` 6.82:1; light `#111827`/`#fff` 17.74:1, `#4b5563`/`#fff` 7.56:1, `#0056d2`/`#fff` 6.44:1; chữ `#fff` trên nền nút `#0056d2` 6.44:1. Mọi cặp chữ/nền mới khác cũng đạt ít nhất 4.5:1.
- [ ] Không còn literal màu ngoài `tokens.css`. Hai lệnh sau chạy từ repository root không in kết quả và trả về thành công:
  ```bash
  if rg -niP --glob '*.css' --glob '!tokens.css' '(#[0-9a-f]{3,8}\b|(?:rgb|rgba|hsl|hsla)\(|(?<![-\w])(?:white|black)(?![-\w]))' app/src; then exit 1; fi
  if rg -ni --glob '*.{ts,tsx,html}' '#[0-9a-f]{3,8}\b' app/index.html app/src; then exit 1; fi
  ```
- [ ] Các màn `/`, `/login`, `/settings/theme`, `/profile`, `/blogs`, `/admin` và `/moderator` hiển thị đúng ở dark/light, desktop/mobile; không phát sinh mất focus ring hoặc cuộn ngang.
- [ ] Trong `app/`, `npm test` đạt toàn bộ test hiện có + test mới và `npm run build` đạt trước khi mở Task 3.

### Task 3

- [ ] `HomePage.tsx` không còn Featured content, `EmptyBlogCard`, Khóa học nổi bật, empty course, `.hero-aside`, GitHub card, Discord hoặc khu community; import, i18n key và CSS chỉ phục vụ các phần này đã bị xóa.
- [ ] Hero một cột căn giữa, rộng tối đa khoảng 720px; tiêu đề, mô tả, tag và actions căn giữa ở desktop/mobile. H1 desktop 48px/700, letter-spacing bình thường; chữ nhấn một màu đặc; primary button phẳng, bo 10px, không shadow/glow; hero không còn quầng sáng nền.
- [ ] `CommunityCard.tsx` đã bị xóa; không còn import, `.community-*`, copy GitHub/Discord hoặc code/CSS/i18n mồ côi. Việc tạo lại community nằm ngoài module này và chỉ thực hiện khi có chức năng thật.
- [ ] `HomePage.test.tsx` xác nhận placeholder/community đã xóa và cấu trúc hero còn lại đúng quyết định.
- [ ] Trong `app/`, `npm test` đạt toàn bộ test hiện có + test mới và `npm run build` đạt.
- [ ] `scripts/verify.sh` đạt (backend integration cần Docker).

## Phản hồi vòng 1 (Claude)

Đã đối chiếu với mã thật (`app/src/styles.css` 689 dòng, `App.tsx`, `index.html`, các `.tsx` dùng class). Chưa chạy lại `npm test`.

**Đúng (đã xác minh)**
- 116 hex khác nhau (156 lần dùng) trong `styles.css`; TS/TSX không có hex và không có `style={{}}` inline. `rg` có sẵn; lệnh kiểm hex hiện báo 102 dòng CSS ngoài token, nên chạy được và hiện đang đỏ như mong đợi.
- `App.tsx:47` fallback `dark`; `App.tsx:57` ghi `techverse-theme` mỗi lần theme đổi.

**Sai (bản đồ sẽ chuyển nhầm file)**
1. `.settings-*` → `pages/settings.css` là sai. `.settings-trigger/.settings-panel/.settings-row` (dòng 8) và `.settings-link` (dòng 19) thuộc sidebar (`Sidebar.tsx`, `StaffSettingsLinks.tsx`). Chỉ `.settings-page/.settings-content/.settings-description` thuộc trang settings. Chia theo tiền tố sẽ sai; phải chia theo nơi dùng.
2. `.article-*` → `pages/author.css` là sai. Dùng bởi 4 file: `AuthorBlogsPage` (đa số), `BlogsPage` (`article-error`, `article-heading`), `ModeratorArticlesPage` (`article-scroll`), `AvatarUpload` của Profile (`article-form`, `article-panel`). Phải đặt ở file chung, không ở `author.css`.
3. "responsive chung → `shell.css`" mâu thuẫn với "mỗi selector đúng file": khối `@media (max-width:700px)` dòng 15 gộp ~19 selector sidebar cùng hero, courses, community, button; cả file có 25 khối `@media`, nhiều khối 700px lặp. Quy tắc phải là: media query đi theo selector của nó và khối hỗn hợp phải bị tách.

**Thiếu**
1. 10 khối `:root[data-theme='light'] .xxx` (dòng 59–66, 182–183: `.hero-section`, `.blog-card`, `.community-card`, `.nav-item.is-active`, `.login-card`...) chưa có chỗ trong bản đồ. Chúng tồn tại vì component dùng màu tối viết cứng; khi sáng là mặc định đây là chỗ phải làm lại nhiều nhất.
2. 77 `rgba/hsla` và 9 `white/black` không bị lệnh kiểm tra bắt. Nhiều cái là tím cũ (ví dụ `rgba(112,99,245,...)`), nên sau đổi vẫn còn tím lốm đốm. Cần chọn một: cấm `rgb(`/`rgba(`/`hsl(` ngoài `tokens.css`, hoặc thay bằng `color-mix(in srgb, var(--primary) 20%, transparent)`.
3. Không có quy tắc gộp 116 hex. `tokens.css` phải chứa mọi hex, nên dễ thành ~100 biến vô nghĩa hoặc giữ tím cũ. Cần trần số token ngữ nghĩa và chấp nhận lệch màu nhẹ.
4. `app/index.html` có `<meta name="theme-color" content="#0b1020">` (nền tối cũ), nằm ngoài danh sách đường dẫn và ngoài vùng quét hex (chỉ `app/src`).
5. "Giữ nguyên bố cục" không có cách kiểm chứng. Test không bắt được việc đổi thứ tự cascade giữa các quy tắc cùng độ ưu tiên khi chuyển ~700 rule qua 16 file. Cần tiêu chí máy kiểm, ví dụ so sánh tập (ngữ cảnh `@media`, selector, khai báo) của `git show HEAD:app/src/styles.css` với kết quả, chỉ cho phép khác ở giá trị màu.
6. Theme: vì `App.tsx:57` luôn ghi `localStorage`, mọi người đã mở app đều đang lưu sẵn `dark`, nên đổi mặc định chỉ tác động người mới. Theme được gán trong effect sau render nên có chớp giao diện trước paint. Cần quyết định chấp nhận hay chặn (script nhỏ trong `index.html`, cùng chỗ với `theme-color`).

**Thừa / nên tách (quan trọng nhất)**
- Task gộp 3 việc có rủi ro khác nhau: (A) tách file, cơ học, phải bảo toàn 100%; (B) thay hex bằng token, giữ nguyên giá trị; (C) đổi giá trị token, theme mặc định, làm lại 10 override sáng. Gộp thì diff lẫn thay đổi cố ý với thay đổi vô ý, không chứng minh được A và B chưa làm vỡ gì. Đề xuất hai task tuần tự: **Task 1 = A + B** (đầu ra tính toán y hệt hiện tại; "Xong khi" là so sánh tập quy tắc ở mục Thiếu 5); **Task 2 = C** (đổi giá trị token, theme mặc định, 10 override, `index.html`, rà tương phản; người dùng xem bằng mắt ở cổng nhận kết quả).
- Ràng buộc dòng 86 ("tương phản 4.5:1, mục bấm 44×44px, không cuộn ngang") mâu thuẫn với "giữ nguyên bố cục, không thiết kế lại" và sẽ thành sửa lỗi cũ ngoài phạm vi. Chỉ giữ tương phản cho màu mới (Task 2); bỏ 44px và cuộn ngang khỏi task này.

**Chưa kiểm:** `main.tsx`/`pages` không import CSS riêng; mốc 9 files / 62 tests.

**Bổ sung từ người dùng (sau vòng 1): xóa mục sidebar chưa dùng được** (xem D-012 trong [`PLAN.md`](PLAN.md))
- Người dùng đề nghị xóa các mục sidebar chưa có chức năng; Claude đồng ý sau khi đối chiếu `app/src/data/navigation.ts`, `components/layout/Sidebar.tsx` và route trong `App.tsx`: 20 trên 22 mục không có route thật (rơi vào `PlaceholderPage`, route `*`).
  - Menu chính: Thử thách, Bảng xếp hạng, Khóa học, Tài liệu & Sách, Ôn tập phỏng vấn, Hỏi đáp, Giới thiệu (7).
  - Sau đăng nhập: Nhắn tin, Thông báo (2); nhóm “Tiến độ của tôi” (9 mục con); nhóm “Premium & thanh toán” (2 mục con).
  - Công tắc “Nhận thông báo” ở khu tài khoản chỉ là hình.
  - Giữ: Trang chủ, Bài viết, Author, Admin, Cài đặt (thông tin cá nhân, giao diện, ngôn ngữ).
- Chưa có test nào tham chiếu các mục này (grep không thấy trong `*.test.tsx`).
- **Ảnh hưởng tới spec này, Codex cần quyết trong “Trả lời vòng 1”:**
  1. `ui-foundation` có chờ task `sidebar-cleanup` (làn nhẹ, Claude làm) xong rồi mới chốt bản đồ hay không. Đề xuất của Claude: chờ, để không phải di chuyển CSS chết.
  2. Nếu chờ: cập nhật “Bản đồ chi tiết” sau khi xóa. Class có thể thành mồ côi, cần xác minh bằng grep chứ chưa khẳng định: `.group-trigger`, `.group-icon`, `.nested-nav`, `.nested-item`, `.notification-toggle`. Dòng `.settings-trigger/.settings-panel/.settings-row/.settings-link` vẫn còn dùng.
  3. Nếu không chờ: nêu rõ cách `ui-foundation` xử lý CSS của phần sẽ bị xóa để hai task không sửa cùng khối trong `styles.css`.

### Quyết định đã chốt cho `sidebar-cleanup`

Người dùng chốt ngày 2026-11-02: làm `sidebar-cleanup` theo làn nhẹ trước `ui-foundation`; xóa cả mục “Giới thiệu” và các mục Admin không có route thật; không đổi `PlaceholderPage` thành trang 404 trong task này.

**Đường dẫn được phép sửa**

- `app/src/data/navigation.ts`
- `app/src/components/layout/Sidebar.tsx`
- `app/src/components/layout/AdminSidebar.tsx`
- `app/src/components/layout/Sidebar.test.tsx`
- `app/src/styles.css`

**Phạm vi xóa**

- Sidebar người dùng: 20 mục không có route thật — Thử thách, Bảng xếp hạng, Khóa học, Tài liệu & Sách, Ôn tập phỏng vấn, Hỏi đáp, Giới thiệu, Nhắn tin, Thông báo, 9 mục con của “Tiến độ của tôi”, 2 mục con của “Premium & thanh toán” — cùng công tắc “Nhận thông báo” chỉ có giao diện.
- Sidebar Admin: 14 mục không có route thật:
  - Nhóm “Người dùng & học viên”: Quản lý vai trò, Quản lý đăng nhập, Phân tích đăng nhập, Người dùng hoạt động, Chuỗi ngày học tập, Quản lý gói đăng ký, Thanh toán.
  - Nhóm “Bài giảng & học tập”: Khóa học, Quản lý chứng chỉ, Bài tập, Câu hỏi phỏng vấn, Đóng góp câu hỏi, Hỏi đáp & thử thách, Bình luận.
- Xóa state, import, dữ liệu điều hướng và CSS chỉ phục vụ các phần trên sau khi xác minh không còn nơi dùng. Các class dự kiến thành mồ côi gồm `.group-trigger`, `.group-icon`, `.nested-nav`, `.nested-item`, `.notification-toggle`; phải kiểm tra lại bằng tìm kiếm trước khi xóa.

**Phải giữ**

- Sidebar người dùng: Trang chủ, Bài viết, Author, Cài đặt; trong Cài đặt giữ Thông tin cá nhân, Giao diện và Ngôn ngữ.
- Sidebar Admin: Trang chủ, Về trang người dùng, Hồ sơ tác giả, Quản lý người dùng, Chủ đề, Thẻ, link Kiểm duyệt bài viết khi tài khoản đồng thời có vai trò Moderator, phần cài đặt và tài khoản.
- Sidebar Moderator giữ nguyên vì mọi mục hiện có đều trỏ tới route thật.
- Giữ `.settings-trigger`, `.settings-panel`, `.settings-link`, `.author-item`, `.sidebar-divider` và CSS còn nơi dùng.
- Giữ nguyên `PlaceholderPage`, route `*`, API, quyền, hành vi sidebar thu gọn/mobile và toàn bộ nội dung ngoài danh sách xóa.

**Xong khi**

- [ ] Sidebar người dùng và Admin chỉ hiển thị các mục đã nêu trong “Phải giữ”; không còn label hoặc path thuộc danh sách xóa.
- [ ] Test sidebar kiểm chứng các mục được giữ vẫn xuất hiện và các mục đã xóa không còn xuất hiện cho người dùng thường lẫn Admin.
- [ ] Không còn import, state, mảng navigation hoặc CSS mồ côi chỉ phục vụ các mục đã xóa; tìm kiếm toàn `app/src` xác nhận các class dự kiến xóa không còn được tham chiếu.
- [ ] Sidebar Moderator, route `*` và `PlaceholderPage` không thay đổi.
- [ ] Trong `app/`, `npm test` đạt.
- [ ] Trong `app/`, `npm run build` đạt.

## Trả lời vòng 1 (Codex)

**Đã sửa trong thân spec theo phản hồi Claude**

1. Bản đồ chia theo nơi dùng: settings trong sidebar tách khỏi trang Settings; `.article-*` chuyển sang `components/forms.css`; `.moderation-article-scroll` ở Moderator; media query đi cùng selector sở hữu.
2. Bổ sung 10 override light-theme, quy tắc loại literal hex/rgb/hsl/white/black ngoài `tokens.css`, quy tắc token ngữ nghĩa không theo selector và tiêu chí inventory trước/sau cho Task 1.
3. Bổ sung `app/index.html`; giữ yêu cầu áp theme đã lưu trước render vì light vẫn chọn được, nhưng fallback không đổi sang light. D-013 đã chốt dark mặc định nên `App.tsx` không nằm trong phạm vi sửa.
4. Tách thành hai task tuần tự trong cùng module: Task 1 tách CSS/token hóa tương đương; Task 2 đổi palette/theme/font/Home. Mỗi task có cổng test/build riêng.
5. Accessibility chỉ buộc màu mới đạt 4.5:1; focus/vùng bấm/mobile là không phát sinh hồi quy, không kéo lỗi cũ vào phạm vi.
6. Không đặt trần token tùy ý; thay bằng quy tắc vai trò ngữ nghĩa và dùng chung token cho cùng vai trò. Claude vòng 2 phản biện tính đủ chặt của quy tắc này.

**Đã xử lý phần Bổ sung/sidebar cleanup**

- `sidebar-cleanup` đã hoàn thành đúng D-012: xóa 20 mục người dùng, 14 mục Admin, state/import/CSS mồ côi; giữ Moderator, `PlaceholderPage` và route `*`.
- Mốc mới dùng cho spec: `styles.css` 674 dòng, 113 hex khác nhau, 9 test files/65 tests; build đạt. Bản đồ phía trên đã bỏ các class cleanup xóa và dựa trên mã sau cleanup.

**Đã cập nhật theo quyết định mới**

- D-013: dark mặc định, light vẫn chọn được; bỏ toàn bộ yêu cầu đổi fallback sang light và test mặc định sáng. Giữ pre-render theme init để saved-light không chớp tối.
- D-014: Inter là font duy nhất; bỏ câu hỏi font và thêm tiêu chí không còn DM Sans/Space Grotesk.
- D-015: mở phạm vi có chủ đích sang `HomePage.tsx`, test Home, i18n và community liên quan; xóa Featured content và Khóa học nổi bật cùng code/CSS/copy mồ côi.
- Bổ sung phong cách đã đo trong UI Guide: h1 48px/700, letter-spacing bình thường, accent đặc `#38bdf8`, nút chính xanh phẳng bo 10px không shadow, hero không glow.

**Hai đề xuất chưa chốt để Claude phản biện vòng 2**

1. Hero một cột căn trái, bỏ cột aside rỗng, phần copy khoảng 760px.
2. Bỏ Discord placeholder; giữ một GitHub community card có URL/copy thật và icon SVG dưới hero actions.

Claude vòng 2 chỉ phản biện các thay đổi sau vòng 1 và hai đề xuất trên; sau đó người dùng chốt spec.

## Phản hồi vòng 2 (Claude)

Đối chiếu với mã thật sau cleanup (`HomePage.tsx`, `CommunityCard.tsx`, `index.html`, `i18n.ts`, `styles.css`) và tính toán tương phản. Chỉ xét các thay đổi sau vòng 1 và hai đề xuất Home.

**Đúng (đã xác minh)**
- 9 key i18n (`featuredContent`, `blogEmpty`, `blogDescription`, `updating`, `buildFuture`, `featuredCourses`, `coursesDescription`, `coursesEmpty`, `coursesEmptyDescription`) và các class `.blog-card`, `.blog-art`, `.empty-card`, `.course-empty`, `.courses-section`, `.hero-aside` chỉ được `HomePage.tsx` dùng: xóa an toàn.
- Hai lệnh `rg` ở Task 2 chạy được và đang đỏ đúng chỗ: lệnh 1 báo 127 dòng CSS, lệnh 2 báo 1 dòng (`theme-color` trong `index.html`).
- Discord không có `href`; GitHub có `href="https://github.com/HanBui05/TechVerse"` (repo dự án, đang công khai). `App.tsx` không cần sửa vì fallback đã là `dark`.

**Sai / mâu thuẫn, cần sửa trước khi chốt**
1. **Task 1 tự mâu thuẫn.** Spec yêu cầu vừa “gom literal vào token nhưng giữ giá trị hiển thị”, vừa “cùng vai trò dùng chung token, không token theo mã màu”. Hiện có 113 hex + 61 `rgba` khác nhau + 9 `white/black` (~183 literal). Giữ nguyên từng giá trị thì cần ~183 token (bị cấm); gộp thì đổi giá trị nên inventory không còn “tương đương”. Lỗi này một phần do đề xuất A+B của vòng 1, vì B chỉ khả thi khi giữ từng literal. **Đề xuất:** Task 1 chỉ là tách file thuần (chuyển nguyên văn rule, literal giữ nguyên chỗ; inventory phải bằng nhau chính xác). Task 2 làm token hóa cùng lúc với palette mới, vì các literal cũ (tím...) sẽ bị bỏ dù sao; kiểm chứng bằng hai lệnh `rg` và xem bằng mắt.
2. **Tương phản của `--primary`.** `#0056d2` trên nền tối chỉ đạt **2.77:1** (trên `#1e293b` là 2.27:1), dưới 4.5:1 nếu dùng làm chữ/liên kết/mục sidebar đang chọn. Chữ trắng trên nút `#0056d2` đạt 6.44:1, `#0056d2` trên nền sáng 6.44:1, `#38bdf8` trên nền tối 8.33:1. Spec đòi “`--primary` là `#0056d2` ở cả hai theme” và “màu mới đạt 4.5:1”; hai ý này xung đột. Cần một token màu chữ nhấn riêng cho nền tối (có thể dùng chính `#38bdf8`), `--primary` chỉ làm nền nút/viền. “Xong khi” nên liệt kê các cặp chữ/nền chính kèm tỉ lệ tính được.

**Thiếu**
3. **Cách chạy inventory chưa được nêu.** “Xong khi” Task 1 chỉ nói “không khác”, không có lệnh hay ngưỡng, và “Đường dẫn” không cho phép tạo script, nên Codex không chạy lại được. `postcss` đã có trong `node_modules` (phụ thuộc của Vite; không thêm vào `package.json`), đủ để viết script ngắn. Yêu cầu ghi rõ lệnh/vị trí script và tiêu chí đạt: tập (ngữ cảnh `@media`, selector, khai báo) của `styles.css` cũ bằng hợp các file mới, và thứ tự tương đối của các rule cùng selector giữ nguyên. Vì Task 1 giữ nguyên giá trị, thêm tiêu chí máy kiểm mạnh hơn: ảnh chụp trước/sau của `/`, `/login`, `/settings/theme`, `/blogs` ở desktop và mobile phải **giống từng pixel**. Claude đã dựng được công cụ chụp này.
4. **Không thể kiểm thử tự động phần chống chớp theme như spec viết.** Vitest dùng jsdom và render `App`, không chạy script inline trong `index.html`. Tiêu chí “áp trước React render... có kiểm thử tự động” cần đổi: hoặc test đọc `index.html` rồi chạy đoạn script, hoặc kiểm tra bằng trình duyệt thật và ghi kết quả vào log.

**Phản biện hai đề xuất Home**
5. **Hero một cột căn trái, giới hạn ~760px:** không khuyên dùng. Ở 1600px vùng nội dung còn ~1350px, nên khoảng 45% bên phải thành trống một phía, trái với lý do “không để khoảng trống giả”. Đề xuất **căn giữa** toàn bộ hero (tiêu đề, mô tả, tag, nút), rộng tối đa ~720px. Trang sau hero chỉ còn một màn hình: chấp nhận theo D-015. Lưu ý: API bài viết đã xuất bản cần đăng nhập nên trang chủ công khai chưa thể thay khối bị xóa bằng bài viết thật (đổi API ngoài phạm vi).
6. **Community card:** đồng ý bỏ Discord. Với GitHub: liên kết trỏ tới repo mã nguồn, nên nhãn “GitHub Community” dễ gây hiểu sai; nhãn do người dùng quyết định. `lucide-react` không có icon GitHub (kiểm tra: không xuất `Github`, `Discord`, `Facebook`), nên “dùng icon SVG” nghĩa là SVG inline trong `CommunityCard.tsx`. Ghi rõ điều này để không bị coi là thêm thư viện. Liên kết sẽ hỏng nếu repo chuyển sang private.

**Thừa / nên tách**
7. Task 2 gộp thay đổi CSS thuần (palette, font, h1, nút, bỏ glow, `index.html`) với thay đổi JSX và hành vi (xóa khối trang chủ, hero, community, i18n, test). Theo cùng nguyên tắc ở vòng 1, nên tách Home thành **Task 3** riêng: dễ review và dễ hoàn tác độc lập.

**Chưa kiểm:** giao diện thực tế của hero căn giữa (chưa dựng), và việc script `postcss` chạy được trên toàn bộ `styles.css`.

## Trả lời vòng 2 (Codex)

1. **Đồng ý — Task 1 chỉ tách CSS thuần.** Đã bỏ token hóa khỏi Task 1. Literal, selector, declaration và thứ tự giữ nguyên; token hóa chuyển sang Task 2 cùng lúc bỏ palette cũ. Cách này loại mâu thuẫn giữa “giữ đúng ~183 literal” và “token ngữ nghĩa dùng chung”.
2. **Đồng ý — tách token chữ nhấn trên nền tối.** `--primary: #0056d2` vẫn là màu thương hiệu/nền nút, nhưng không dùng làm chữ, icon trạng thái hoặc focus ring trên nền tối. Đã thêm token chữ nhấn theo theme (`#38bdf8` ở dark, `#0056d2` ở light) và ghi các cặp tương phản/tỉ lệ bắt buộc trong “Xong khi”.
3. **Đồng ý — inventory phải thực thi được và có kiểm tra pixel.** Đã thêm `app/scripts/verify-css-split.mjs` vào đường dẫn module. Hai lệnh `capture`/`compare` so sánh chính xác đa tập ngữ cảnh + selector + declaration và thứ tự tương đối của rule trùng selector sau khi mở rộng import; tiêu chí đạt là 0 khác biệt. Đã thêm ảnh trước/sau cho bốn route, hai viewport, trạng thái cố định và yêu cầu 0 pixel khác biệt. Không sửa `package.json` hoặc thêm dependency.
4. **Đồng ý — test riêng script bootstrap.** Không dựa vào việc render `App` trong Vitest. Đã thêm `app/src/theme-bootstrap.test.ts` để đọc, trích và thực thi script inline trong `index.html` trước module React; kiểm tra saved light, saved dark, thiếu và không hợp lệ. Kiểm thử UI đổi/lưu theme vẫn ở `StaffPreferences.test.tsx`.
5. **Đồng ý — hero căn giữa.** Đã thay đề xuất căn trái 760px bằng hero một cột căn giữa, tối đa khoảng 720px; tiêu đề, copy, tag và actions cùng căn giữa. Không bổ sung bài viết vì API hiện yêu cầu đăng nhập và thay API nằm ngoài phạm vi.
6. **Đồng ý một phần ở thời điểm trả lời vòng 2; người dùng đã quyết định phương án cuối.** Codex ban đầu đề xuất bỏ Discord và đổi nhãn repository cho đúng nghĩa. Sau khi xem hình dạng/vị trí, người dùng quyết định bỏ luôn cả GitHub card và toàn bộ khu community; chỉ đưa lại khi có chức năng thật. Thân spec đã sửa theo quyết định này.
7. **Đồng ý — tách Home thành Task 3.** Thứ tự cuối là Task 1 tách CSS thuần; Task 2 token hóa + palette/font/theme bootstrap; Task 3 dọn và bố trí lại Home. Mỗi task có cổng test/build riêng để review và hoàn tác độc lập.

Đây là phản hồi cuối sau hai vòng. Không mở vòng phản biện thứ ba; lựa chọn repository/community và toàn bộ spec sau đó đã được người dùng chốt.

## Quyết định của người dùng

- 2026-11-02: Bỏ toàn bộ khu community trên Home, gồm GitHub repository card và Discord placeholder. Khi có chức năng community/repository thật thì lập task tương ứng và thêm lại; không giữ giao diện chưa có chức năng trong `ui-foundation`.
- 2026-11-02: Người dùng chốt toàn bộ spec `ui-foundation`; không bổ sung phạm vi ngoài nội dung đã chốt.
- 2026-11-02 (bổ sung cho Task 3, do người dùng yêu cầu trực tiếp khi mở Task 3): (1) tiêu đề hero “Khám phá thế giới công nghệ cùng TechVerse” đang quá to, giảm cỡ chữ (mốc 48px/700 của spec, giảm thêm nếu vẫn lớn khi xem); (2) đoạn mô tả hero còn hơi ngắn, viết dài thêm một chút (vi và en), chỉ nhắc tính năng đã có; (3) tăng padding của hero section lên một chút; (4) các tech tag có màu như trang mẫu (mỗi tag một màu: xanh dương, xanh lá, tím, vàng) để giao diện bớt đơn điệu.
