# UI foundation v2 (shadcn)

Trạng thái: xem [`PLAN.md`](PLAN.md). Spec do Codex viết; Claude chỉ ghi vào mục “Phản hồi”.

**Mục tiêu:** Chuyển toàn bộ giao diện frontend TechVerse **ngoài các trang phía Author và Blogs** sang shadcn/ui + Tailwind CSS v4 trên nhánh `feature/shadcn-ui`, giữ nguyên nghiệp vụ, route, API và nội dung vi/en. Giao diện mới dùng một hệ token dark/light, component và tỷ lệ thống nhất theo [`javabuilder-patterns.md`](../docs/design/javabuilder-patterns.md); Author, Blogs và lớp CSS tương thích của chúng được giữ nguyên để chuyển trong các module riêng.
**Làn:** Đầy đủ
**Giai đoạn:** Giao diện
**Đổi giao diện:** Có
**Nhánh thực hiện:** `feature/shadcn-ui`

## Đường dẫn thuộc module

Chỉ được sửa các đường dẫn sau. Ngoài danh sách là ngoài phạm vi.

- Cấu hình và dependency: `app/index.html`, `app/package.json`, `app/package-lock.json`, `app/components.json`, `app/tsconfig.json`, `app/tsconfig.app.json`, `app/vite.config.ts`, `app/vitest.config.ts`.
- Điểm vào và khung route: `app/src/main.tsx`, `app/src/App.tsx`, `app/src/styles.css`.
- Token/CSS chuyển tiếp và CSS cũ được xóa hoặc giữ làm lớp tương thích Author/Blogs theo từng task: `app/src/styles/tokens.css`, `app/src/styles/base.css`, `app/src/styles/layout/{shell,sidebar}.css`, `app/src/styles/components/{controls,forms,content}.css`, `app/src/styles/pages/{home,settings,auth,profile,admin,author,moderator,blogs}.css`.
- Hạ tầng shadcn: `app/src/lib/utils.ts`, `app/src/components/ui/*.tsx`, `app/src/hooks/use-mobile.ts` cho shadcn Sidebar đã chọn.
- Component dùng chung/nghiệp vụ: `app/src/components/{EmptyState,GoogleAuthButton,UserAvatar}.tsx`, `app/src/components/auth/AuthLayout.tsx`, `app/src/components/brand/Brand.tsx`, `app/src/components/layout/{AccountIdentity,AdminSidebar,ModeratorSidebar,Sidebar,StaffSettingsLinks}.tsx`.
- Trang Home: `app/src/pages/Home/HomePage.tsx`.
- Trang Profile/Settings: `app/src/pages/Profile/{AvatarUpload,ChangePasswordPanel,ProfilePage}.tsx`, `app/src/pages/Settings/{LanguagePage,SettingsLayout,ThemePage}.tsx`.
- Trang Auth: `app/src/pages/Login/{LoginPage,ForgotPasswordPage,GoogleCallbackPage}.tsx`, `app/src/pages/Register/RegisterPage.tsx`.
- Trang Admin: `app/src/pages/Admin/{AdminDashboardPage,AdminUsersPage,AuthorApplicationsPage,TaxonomyPage}.tsx`.
- Trang Moderator và fallback: `app/src/pages/Moderator/{ModeratorDashboardPage,ModeratorArticlesPage}.tsx`, `app/src/pages/PlaceholderPage.tsx`.
- Test frontend hiện có được phép cập nhật: `app/src/{App.auth,App.author-session,StaffPreferences}.test.tsx`, `app/src/theme-bootstrap.test.ts`, `app/src/components/layout/Sidebar.test.tsx`, `app/src/pages/Admin/AdminUsersPage.test.tsx`, `app/src/pages/Home/HomePage.test.tsx`, `app/src/pages/Moderator/ModeratorArticlesPage.test.tsx`, `app/src/pages/Profile/{ChangePasswordPanel,ProfilePage}.test.tsx`; được thêm test đồng vị cho đúng component/trang trong danh sách trên.
- Setup test mới: `app/src/test/setup.ts`.
- Dọn script cũ: `app/scripts/verify-css-split.mjs`.
- Luật/tài liệu: `.claude/rules/frontend.md`, `.claude/skills/ui-components/SKILL.md`, `docs/design/UI_GUIDE.md`.

Từ Task 6 trở đi, không sửa `app/src/services/**`, `app/src/data/**`, `app/src/types/**`, `app/src/pages/Author/**`, `app/src/pages/Blogs/**`, `app/src/components/{TagPicker,MarkdownContent,Pagination}.tsx`, test riêng của Author/Blogs hay `server/**`. Các file CSS legacy còn consumer Author/Blogs chỉ được giữ nguyên hoặc lược bỏ rule đã chứng minh không còn consumer; không được đổi hình thức/hành vi các trang đó. Nếu việc chuyển giao diện cho thấy cần đổi các đường dẫn này, dừng task liên quan và đưa vấn đề về cho người dùng thay vì mở rộng phạm vi.

## Bản đồ chi tiết

### Hiện trạng và đích chuyển đổi

| Hiện ở đâu | Dùng bởi | Đích sau thay đổi |
|---|---|---|
| `app/src/styles.css` import Google Font và 16 file CSS cũ | Toàn app qua `main.tsx` | Entry Tailwind v4 dùng CSS config; chỉ nạp theme + utilities, chưa bật preflight; Task 7b bỏ import CSS của trang đã chuyển và giữ lớp tương thích tối thiểu cho Author/Blogs |
| `app/src/styles/tokens.css` (`:root`, `:root[data-theme='light']`) | Toàn bộ CSS hiện tại | Nguồn duy nhất cho token shadcn, tone badge, code highlighting và dark/light; shadcn token là canonical, alias legacy chỉ giữ khi Author/Blogs còn dùng |
| `App.tsx` (`data-theme`, shell, mobile topbar, route) | Mọi trang | Giữ `data-theme`/localStorage/route, thay lớp trình bày và primitive giao diện |
| `Sidebar`, `AdminSidebar`, `ModeratorSidebar`, `StaffSettingsLinks`, `AccountIdentity` | Shell theo vai trò | Một cấu trúc shadcn Sidebar thống nhất, giữ menu/quyền/thu gọn/mobile hiện tại |
| `UserAvatar`, `GoogleAuthButton`, `Brand` | Sidebar, Profile, Auth | Component ghép nghiệp vụ ngoài `components/ui/`; `Brand` dùng logo Cloudinary `techverse/brand/logo`, không tự thiết kế logo mới trong Task 2 |
| `Pagination` | Author, Blogs, Admin, Moderator | Primitive shadcn đã sinh ở Task 1 nhưng wrapper dùng chung giữ nguyên trong module này để không đổi gián tiếp Author/Blogs; migrate trong `blogs-ui-shadcn` và regression mọi caller |
| `MarkdownContent` | Blogs và Moderator | Giữ nguyên trong module này; chuyển cùng Blogs trong module `blogs-ui-shadcn`, kèm regression cho Moderator |
| `TagPicker` | Chỉ `AuthorBlogsPage` | Giữ nguyên trong module này; chuyển sang shadcn trong module `author-ui-shadcn` |
| Native `<dialog>` ở Profile và `window.confirm` ở bốn trang quản trị | Profile/Admin/Moderator | `Dialog`/`AlertDialog` Radix; bỏ stub `HTMLDialogElement` và API trình duyệt cũ |
| Input ngày sinh kiểu gõ + native picker ở Profile | `ProfilePage` | `Popover` + `Calendar`, vẫn cho gõ `dd/mm/yyyy` và giữ validation/API hiện tại |
| 13 file test / 221 test hiện tại | Luồng chính frontend | Giữ regression; test phụ thuộc class cũ chuyển sang role/label/state |

### Ánh xạ trang TechVerse ↔ mẫu JavaBuilder

Chỉ lấy bố cục, tỷ lệ và công thức màu từ tài liệu mẫu; không lấy logo, chữ, ảnh hoặc code.

| Route/trang TechVerse | Mẫu áp dụng từ `javabuilder-patterns.md` | Quy định chính |
|---|---|---|
| `/` — `HomePage` | 4.1 đầu trang + 4.7 tiêu đề khu vực + 4.3 lưới card | Hero hiện có, section header căn giữa, card nội dung 3 cột; không khôi phục các khối đã bỏ theo D-015/D-016 |
| `/profile` — `ProfilePage`, `AvatarUpload`, `ChangePasswordPanel` | 4.6 hồ sơ hai cột | Card trái 320px, card nội dung bên phải; avatar, form và hành động giữ nguyên nghiệp vụ |
| `/settings/theme`, `/settings/language` — `SettingsLayout`, `ThemePage`, `LanguagePage` | 4.6 cài đặt hai cột | Dùng cùng khung Profile/Settings, card lựa chọn có trạng thái rõ ràng |
| `/login`, `/register`, `/forgot-password`, `/auth/callback` — Auth pages + `AuthLayout` | Bố cục Auth hiện tại, thay control theo hệ 1–3 | Không đổi luồng/tab route/copy; chuẩn hóa thang chữ, Card, Button, Input, Label và trạng thái |
| `/admin` — `AdminDashboardPage` | 4.1 đầu trang gọn + card số liệu + 4.5 card danh sách/rỗng | Chỉ trình bày dữ liệu hiện có, không tạo dashboard/backend mới |
| `/admin/users` — `AdminUsersPage` | 4.2 filter + 4.5 hàng trong card | Checkbox chọn nhiều; xác nhận thao tác bằng AlertDialog |
| `/admin/author-applications` — `AuthorApplicationsPage` | 4.2 filter + 4.5 hàng trong card | Badge trạng thái; chi tiết/hành động trong card/dialog; AlertDialog xác nhận |
| `/admin/topics`, `/admin/tags` — `TaxonomyPage` | 4.2 filter + 4.5 hàng trong card | Tone cố định cho taxonomy; AlertDialog thay confirm |
| `/moderator` — `ModeratorDashboardPage` | 4.1 đầu trang gọn + card số liệu + 4.5 card danh sách/rỗng | Không thêm dữ liệu hay hành động mới |
| `/moderator/articles` — `ModeratorArticlesPage` | 4.2 filter + 4.5 hàng trong card; vùng đọc theo 4.4 | Danh sách hàng; vùng đọc hai cột khi đủ chỗ; AlertDialog thay confirm |
| `*` — `PlaceholderPage` | 4.1 đầu trang ứng dụng gọn + một Card trạng thái | Giữ fallback và copy hiện có, không biến thành route/chức năng mới |

Mọi mẫu dùng vùng nội dung tối đa 1280px, padding ngang 24–32px, gap khối 24/32px, card lớn bo 18px, card lưới bo 10px và sidebar 256px/mobile 320px. Thang chữ bắt buộc: hero H1 48/48 700; H1 bài 30/37.5 700; H1 app 24/32 700; H2 20/700; tiêu đề card lưới 16/700; tiêu đề khối 14/600; body/input 14/400; meta 12/400; label trường 11/600 uppercase, tracking `.05em`.

### Token shadcn và tương phản

Trong task 1, token shadcn lấy đúng giá trị từ token cũ để trang chưa chuyển không đổi màu. Riêng tên `--muted` bị xung đột nghĩa: CSS cũ dùng nó làm chữ phụ, còn shadcn dùng nó làm nền. Vì CSS variable không thể “chụp” giá trị cũ qua alias động, task 1 phải chuyển mọi reference chữ phụ legacy từ `var(--muted)` sang `var(--muted-foreground)` trước, rồi mới đặt `--muted` = `--surface-2`; không được viết `--muted-foreground: var(--muted)` sau khi đổi nghĩa. Các token không xung đột có thể dùng alias tương thích trong giai đoạn chuyển. Task 7b xóa alias cũ không còn dùng ngoài lớp tương thích Author và giữ các token shadcn làm nguồn chuẩn. `@theme inline` expose màu/font cho utility Tailwind; mọi giá trị màu thực nằm trong `app/src/styles/tokens.css`.

| Token shadcn | Tối mặc định | Sáng (`data-theme='light'`) | Ánh xạ/ghi chú |
|---|---:|---:|---|
| `--background` | `#0f172a` | `#ffffff` | từ `--bg` |
| `--foreground` | `#f1f5f9` | `#111827` | từ `--text` |
| `--card`, `--popover` | `#1e293b` | `#f9fafb` | từ `--surface` |
| `--card-foreground`, `--popover-foreground` | `#f1f5f9` | `#111827` | cùng `--foreground` |
| `--secondary`, `--muted`, `--accent` | `#334155` | `#f3f4f6` | từ `--surface-2` |
| `--secondary-foreground`, `--accent-foreground` | `#f1f5f9` | `#111827` | chữ chính trên surface-2 |
| `--muted-foreground` | `#a8b4c8` | `#4b5563` | từ `--muted`, giữ vì đạt AA |
| `--border`, `--input` | `#334155` | `#e5e7eb` | từ `--border` |
| `--primary` | `#0056d2` | `#0056d2` | màu nhấn D-010 |
| `--primary-foreground` | `#ffffff` | `#ffffff` | chữ trên primary |
| `--ring` | `#38bdf8` | `#0056d2` | từ `--accent-text` |
| `--destructive` | `#b91c1c` | `#b91c1c` | nền đỏ đặc, không dùng `--danger` hiện tại làm nền |
| `--destructive-foreground` | `#ffffff` | `#ffffff` | chữ trên destructive |
| `--radius` | `0.625rem` | `0.625rem` | bán kính chuẩn |
| `--font-sans` | `Inter, ...fallback` | như tối | Inter duy nhất theo D-014 |

Các cặp chữ/nền đã tính theo WCAG contrast ratio:

| Cặp | Tối | Sáng |
|---|---:|---:|
| foreground / background | 16.30:1 | 17.74:1 |
| card-foreground / card; popover-foreground / popover | 13.35:1 | 16.98:1 |
| secondary-foreground hoặc accent-foreground / surface-2 | 9.45:1 | 16.12:1 |
| muted-foreground / background | 8.52:1 | 7.56:1 |
| muted-foreground / card | 6.99:1 | 7.23:1 |
| muted-foreground / muted (surface-2) | 4.94:1 | 6.87:1 |
| primary-foreground / primary | 6.44:1 | 6.44:1 |
| destructive-foreground / destructive | 6.47:1 | 6.47:1 |
| ring / background (chỉ báo focus) | 8.33:1 | 6.44:1 |

Expose thêm qua token và `@theme inline`: `accent-text`, `success`, `warning`, `info`, `violet`, `rose`, `scrim`, toàn bộ `code-*`. Badge tone có ba token nền/chữ/viền cho từng `blue`, `green`, `purple`, `amber`, `rose`, `sky`, `cyan`, `slate` ở cả hai theme; tối dùng nền bậc 900 ở opacity 25% + chữ bậc 300 + viền mảnh, sáng dùng nền bậc 100 + chữ bậc 700 + viền bậc 200, riêng `green`/`amber` dùng chữ bậc 800 để có biên tương phản an toàn. Không đặt literal màu trong component hoặc CSS trang.

Tương phản tối dưới đây lấy trường hợp xấu hơn khi nền tone 900/25 nằm trên `surface-2`; nền `background`/`card` cho tỷ lệ cao hơn. Tương phản sáng dùng chữ bậc 700 trên nền bậc 100, riêng `green`/`amber` dùng bậc 800. Giá trị token cuối cùng phải được đo lại trong Task 1 và không thấp hơn 4.5:1:

| Badge tone | Tối: chữ 300 / nền 900-25% | Sáng: chữ 700, riêng green/amber 800 / nền 100 |
|---|---:|---:|
| blue | 5.81:1 | 5.49:1 |
| green | 7.19:1 | 6.49:1 (chữ 800) |
| purple | 6.14:1 | 5.92:1 |
| amber | 7.22:1 | 6.37:1 (chữ 800) |
| rose | 5.80:1 | 5.24:1 |
| sky | 6.15:1 | 5.17:1 |
| cyan | 6.97:1 | 4.79:1 |
| slate | 8.11:1 | 9.45:1 |

Theme tiếp tục dùng thuộc tính trên `<html>`: không có thuộc tính là tối, `data-theme='light'` là sáng; giữ localStorage `techverse-theme`, không thêm `.dark`. Dark utility được khai báo theo ý nghĩa `:root:not([data-theme='light'])` bằng `@custom-variant dark`, áp dụng cho root và hậu duệ.

### Component ↔ trang dùng

Chỉ sinh component có người dùng trong bảng bằng `npx shadcn@latest add`; không thêm component dự phòng. File `components/ui/*` chỉ chứa primitive/presentational API, không chứa nghiệp vụ, gọi API, route hay copy. Ngoại lệ có chủ đích là variant trình bày `tone` của Badge; quy tắc gán tone theo tên/trạng thái nằm ở helper/component nghiệp vụ ngoài `ui/`.

| Component | Trang/component dùng |
|---|---|
| `button` | Mọi form, filter, pagination, hành động Profile/Admin/Moderator, mobile topbar |
| `input`, `label`, `textarea` | Auth; Profile; bộ lọc Admin/Moderator; ghi chú duyệt |
| `card` | Home, Profile/Settings, Auth, Admin, Moderator, Placeholder |
| `native-select` | Mọi select chữ đơn giản hiện có ở Admin/Moderator; giữ `<select>` gốc, mobile UX và `selectOptions` |
| `checkbox` | Chọn nhiều ở `AdminUsersPage` |
| `badge` + `tone` | Topic/category/tag; trạng thái bài viết/hồ sơ tác giả trong màn Admin; chip số liệu trên Home/Admin/Moderator |
| `avatar` | `UserAvatar`, `AccountIdentity`, Profile, byline bài viết, danh sách người dùng/hồ sơ |
| `separator` | Sidebar, card meta, Profile/Settings, Auth, danh sách hàng |
| `breadcrumb` | Đã sinh ở Task 1 cho Blog detail nhưng chưa dùng trong module này; module `blogs-ui-shadcn` là consumer |
| `dialog` | Profile/logout-all và vùng chi tiết/chỉnh sửa đang cần modal; không đổi thành modal nếu hiện tại là trang |
| `alert-dialog` | Thay `window.confirm` ở `AdminUsersPage`, `AuthorApplicationsPage`, `TaxonomyPage`, `ModeratorArticlesPage` |
| `popover`, `calendar` | Chọn ngày sinh Profile, vẫn cho nhập `dd/mm/yyyy` |
| `tooltip` | Icon button và sidebar thu gọn |
| `skeleton` | Trạng thái tải ở Profile, Admin, Moderator |
| `sheet` | Sidebar/mobile navigation 320px |
| `sidebar` | Đã chọn 4A; dùng cho shell User/Admin/Moderator, controlled bằng state/localStorage hiện có |
| `pagination` | Primitive đã sinh ở Task 1; wrapper `Pagination` dùng chung chỉ migrate trong `blogs-ui-shadcn` |
| `EmptyState` (composite ngoài `ui/`) | Tạo và test ở Task 5; dùng cho Admin ở Task 6 và Moderator ở Task 7a |

Tone cho category/topic/tag được gán cố định bằng cấu hình hoặc hàm băm tên ổn định; tone cho status/số liệu dùng bảng ánh xạ semantic cố định. Cùng một giá trị phải ra cùng tone ở mọi trang và cả hai ngôn ngữ.

### Dependency mới

Task 1 ghi đúng dependency trực tiếp vào `package.json`/lock file; không coi package transitive là dependency trực tiếp:

- Build/dev: `tailwindcss`, `@tailwindcss/vite`, `@types/node`.
- Nền shadcn/Tailwind đã khóa ở Task 1: `shadcn@4.23.0`, `tailwindcss@4.3.3`, `@tailwindcss/vite@4.3.3`, `@types/node@26.6.6`, `class-variance-authority@0.7.1`, `cn@0.5.2`, `tw-animate-css@1.4.0`.
- Primitive Radix cho style `new-york`: gói hợp nhất `radix-ui@1.8.1`; không cài dàn gói `@radix-ui/react-*` cũ.
- Calendar/date picker: `react-day-picker@10.0.2`, `date-fns@4.4.0`.
- Đã có nên không thêm lại như dependency mới: `lucide-react`, React, Vite.
- `native-select`, `sidebar`, `pagination` là mã registry, không phải package runtime mới. Không thêm `table` hoặc `sonner` theo quyết định đã chốt.

Danh sách/version thực tế của Task 1 đã được khóa trong `package-lock.json` và ghi ở log. Các task sau không tự nâng phiên bản hoặc thêm form/UI library khác.

Không thêm `react-hook-form`, `zod`, thư viện UI thứ hai hoặc `tailwind.config.js`.

## Phạm vi

### Task 1 — Cài đặt, token, primitive và tài liệu nền

- Cấu hình Tailwind CSS v4 bằng `@tailwindcss/vite`; dùng CSS `@import` + `@theme inline`, không có `tailwind.config.js`.
- Thêm alias `@/*` → `src/*` đồng bộ trong `tsconfig.json`, `tsconfig.app.json`, `vite.config.ts`, `vitest.config.ts`.
- Với `shadcn@4.23.0`, `init -b radix` không còn preset `new-york`; cấu hình thủ công `components.json` với `style: new-york`, CSS variables, Lucide và alias `src/components/ui`, rồi dùng registry `add` sinh 20 primitive đã chốt. Không đổi sang preset Nova/Vega hoặc Base UI.
- Giữ `native-select` từ registry; không sinh Radix `select`, `table` hoặc `sonner`. Primitive import `cn` trực tiếp; `lib/utils.ts` chỉ giữ helper dự án hiện có, không bắt buộc primitive đi qua helper này.
- Trong giai đoạn chuyển, không import preflight: chỉ import theme và utilities vào layer tương ứng để reset của Tailwind không làm đổi trang cũ. Giữ CSS cũ hoạt động, bổ sung token shadcn dạng alias tương thích và giải quyết riêng xung đột `--muted` như phần token.
- Tạo Badge `tone` theo công thức màu, mapping tone ổn định ngoài `components/ui/`; không đưa nghiệp vụ vào primitive.
- Tạo `app/src/test/setup.ts`, nối vào `vitest.config.ts`; polyfill `ResizeObserver`, `hasPointerCapture`, `scrollIntoView`, `matchMedia` cho jsdom/Radix. Khi Dialog đã chuyển sang Radix, xóa stub `HTMLDialogElement.showModal/close` khỏi test.
- Viết lại `docs/design/UI_GUIDE.md` theo shadcn/Tailwind/D-024; thay luật CSS thường trong `.claude/rules/frontend.md` bằng luật ưu tiên `components/ui`, utility theo token và đúng thang chữ/khoảng cách trong tài liệu mẫu.
- Tạo `.claude/skills/ui-components/SKILL.md` gồm danh mục component, mẫu bố cục, Badge tone, ví dụ ghép trang và điều cấm; đây là tài liệu dự án thuộc module, không phải yêu cầu thêm công cụ cho người code.

#### Xong khi — Task 1

- [x] Alias hoạt động ở TypeScript, Vite và Vitest; `components.json` đúng base Radix, style `new-york`, CSS variables, Lucide và `src/components/ui`.
- [x] `package.json`/lock có dependency trực tiếp đúng registry Radix `new-york` đã chọn và danh sách thực tế được ghi vào log; không có `@base-ui/react`, `components/ui/select.tsx`, consumer Radix Select hoặc form/UI library ngoài phạm vi.
- [x] Dark mặc định, light qua `data-theme='light'`, token/tương phản đúng hai bảng trên; không có `.dark`.
- [x] Preflight chưa được nạp; trang cũ không đổi giao diện do bước cài đặt. Lệnh `rg -n '\.(hidden|flex|grid|container|sr-only|full-width)([^A-Za-z0-9_-]|$)' src/styles src/styles.css` được chạy và kết quả ghi lại; hiện biết `.sr-only`, `.full-width`, còn `hidden|flex|grid|container` không có selector độc lập.
- [x] Badge đủ 8 tone, từng cặp chữ/nền ở cả hai theme đạt ≥4.5:1 và cùng category/topic/tag/status cho cùng tone ổn định; mọi màu nằm trong `tokens.css`.
- [x] `UI_GUIDE.md`, luật frontend và skill `ui-components` thống nhất với spec.
- [x] Primitive không chứa copy tiếng Anh mặc định: label accessibility phụ thuộc ngôn ngữ phải nhận qua prop bắt buộc. Focus dùng `ring-ring` đặc; không có ring pha trong suốt hoặc `aria-invalid:ring-*` ghi đè focus.
- [x] Trong `app/`, `npx vitest run src/styles/tokens.test.ts src/lib/utils.test.ts src/components/ui/badge.test.tsx src/components/ui/labels.test.tsx src/components/ui/focus.test.ts src/theme-bootstrap.test.ts` và `npm run build` đạt; không chạy full `npm test` hoặc backend.
- [x] Kiểm bằng mắt dark/light desktop cho một trang cũ đại diện; nếu thiếu môi trường ghi đúng “chưa kiểm”.

### Task 2 — Khung chung, điều hướng và nhận diện logo

- Chuyển `App` shell, mobile topbar, `Brand`, `Sidebar`, `AdminSidebar`, `ModeratorSidebar`, `AccountIdentity`, `StaffSettingsLinks` sang component/utility mới.
- Dùng logo chính đã upload trên Cloudinary tại public ID `techverse/brand/logo`; không thiết kế logo/wordmark mới. Khi sidebar mở hiển thị nhận diện đầy đủ, khi thu gọn/mobile topbar dùng bản icon crop từ cùng master; giữ accessible name “TechVerse home” và route `/`.
- `app/index.html` dùng icon crop từ cùng master Cloudinary cho favicon và Apple touch icon. Không commit file nguồn `Logo_Techverse.png` dung lượng lớn vào repository.
- Giữ nguyên route, menu theo role, active state, thu gọn sidebar, localStorage, mở nhóm Settings theo route, logout và mobile open/close.
- Sidebar desktop 256px; mobile dùng Sheet 320px. Dùng `SidebarProvider` controlled từ state/localStorage `techverse-sidebar`, không tạo cookie `sidebar_state`, tắt phím tắt Ctrl+B vì giao diện hiện tại không có hành vi này; ba sidebar nghiệp vụ chỉ ghép menu/role bên ngoài primitive shadcn Sidebar.
- Khi shell mới tự chừa chỗ bằng `SidebarInset`, bỏ `margin-left: 250px/76px` của `.page-content` ngay trong Task 2 nhưng giữ padding cho trang legacy; không để trang chưa chuyển bị lệch hai lần.
- Trước khi đổi class, quét selector legacy trùng utility. `.sr-only` chuyển dứt điểm sang utility hoặc tạm đổi thành `.legacy-sr-only`; `.full-width` đổi sang `w-full` hoặc `.legacy-full-width`. Bất kỳ selector độc lập `hidden|flex|grid|container` nào phát hiện thêm phải prefix `legacy-` và cập nhật mọi chỗ dùng trước khi utility cùng tên xuất hiện.

#### Xong khi — Task 2

- [ ] User/Admin/Moderator desktop và mobile giữ đúng menu, quyền, active state, collapse, Settings auto-open và logout như trước. (chưa kiểm Moderator và mobile — xem log)
- [ ] Mobile Sheet rộng 320px, focus/escape/overlay hoạt động; desktop sidebar rộng 256px và content không cuộn ngang. (chưa kiểm mobile và thiết bị cảm ứng thật — xem log)
- [x] Một trang legacy chưa chuyển được kiểm ở trạng thái sidebar mở/thu gọn: chỉ có một khoảng chừa sidebar, padding cũ còn đúng và không lệch ngang.
- [x] Không còn selector legacy mang tên utility trong các file đã chuyển; grep va chạm được chạy lại và ghi kết quả.
- [ ] Logo Cloudinary hiển thị rõ ở dark/light, đúng ở sidebar mở/thu gọn và mobile topbar; favicon/Apple touch icon cùng master; giữ accessible name và route `/`, không có file ảnh nguồn lớn được commit. (chưa kiểm mobile topbar — xem log)
- [x] Trong `app/`, các test liên quan `src/components/layout/Sidebar.test.tsx`, `src/App.auth.test.tsx`, `src/App.author-session.test.tsx`, `src/StaffPreferences.test.tsx`, `src/theme-bootstrap.test.ts` và test mới của Brand/shell (nếu có) đạt bằng `npx vitest run <các file>`; `npm run build` đạt. Không chạy full `npm test` hoặc backend.
- [ ] Kiểm bằng mắt dark/light desktop cho ba vai trò và mobile cho shell; thiếu môi trường ghi “chưa kiểm”. (chưa kiểm Moderator và mobile — xem log)

### Task 3 — Hồ sơ và Cài đặt

- Chuyển Profile, avatar, đổi mật khẩu, logout/logout-all, Theme và Language theo mẫu hai cột 4.6.
- Chọn avatar trực tiếp trên hình như hiện tại; giữ upload/validation/API. Ngày sinh dùng Popover + Calendar và vẫn nhận chuỗi `dd/mm/yyyy`; không đổi dirty-only update.
- Native `<dialog>` logout-all chuyển sang Radix Dialog/AlertDialog phù hợp; giữ focus return, trạng thái lỗi và chỉ điều hướng khi API thành công như hiện tại.
- Xóa `styles/pages/profile.css` và `styles/pages/settings.css` ngay khi task đạt; xóa selector mồ côi liên quan khỏi CSS dùng chung nhưng không dọn CSS của trang chưa chuyển.

#### Xong khi — Task 3

- [ ] Profile/Settings đúng mẫu hai cột, responsive, đủ loading/empty/error liên quan và không lộ field không có trong nghiệp vụ hiện tại. (chưa kiểm mobile — xem log)
- [x] Avatar, update thông tin dirty-only, date input + calendar, đổi mật khẩu, logout và logout-all giữ nguyên hành vi/API/test.
- [x] Dialog Radix có role/name/focus đúng; các stub `HTMLDialogElement` tương ứng đã bỏ khỏi test.
- [x] Không còn `profile.css`, `settings.css` hoặc import/selector mồ côi của hai trang.
- [x] Test sửa theo role/label/state, không thay bằng assertion class Tailwind; các test liên quan `src/pages/Profile/ProfilePage.test.tsx`, `src/pages/Profile/ChangePasswordPanel.test.tsx`, `src/StaffPreferences.test.tsx` và test mới của Settings (nếu có) đạt bằng `npx vitest run <các file>`; `npm run build` đạt. Không chạy full `npm test`.
- [ ] Kiểm bằng mắt dark/light desktop cho Profile, Theme, Language; mobile kiểm Profile; thiếu môi trường ghi “chưa kiểm”. (chưa kiểm mobile và dark cho Theme/Language — xem log)

### Task 4 — Auth

- Chuyển `AuthLayout`, Login, Register, ForgotPassword, GoogleCallback và `GoogleAuthButton` sang primitive mới nhưng giữ bố cục Auth hiện tại.
- Giữ route/tab link, validation native/custom, toggle mật khẩu, loading/error, copy vi/en và request hiện tại; Auth hiện không dùng `framer-motion` nên không gắn Task 4 với quyết định thiết kế 7.
- Không đổi logic đăng nhập, đăng ký, Google callback, forgot-password hoặc redirect theo role.
- Xóa `styles/pages/auth.css` ngay khi task đạt; xóa selector auth mồ côi trong CSS dùng chung.

#### Xong khi — Task 4

- [x] Cả bốn route Auth giữ đúng luồng, redirect, validation, warning vi/en và khả năng dùng bàn phím.
- [x] Login/Register chuyển tab/link có trạng thái rõ; toggle mắt chỉ tác động đúng trường như regression hiện có.
- [x] Loading/error/callback không đổi copy hay API; không phát sinh horizontal scroll ở dark/light.
- [x] Không còn `auth.css`, import hoặc selector auth cũ.
- [x] Test ưu tiên role/label; test liên quan `src/App.auth.test.tsx` và test mới đồng vị của Auth (nếu có) đạt bằng `npx vitest run <các file>`; `npm run build` đạt. Không chạy full `npm test`.
- [ ] Kiểm bằng mắt dark/light desktop cho Login/Register/ForgotPassword/GoogleCallback; thiếu môi trường ghi “chưa kiểm”. (chưa kiểm đủ dark/light cho mọi route — xem log)

### Task 5 — Trang chủ và EmptyState

- Chuyển Home theo 4.1/4.7/4.3; giữ các phần đã bỏ theo D-015/D-016 không xuất hiện lại.
- Tạo composite `EmptyState` ngoài `components/ui/` (icon, tiêu đề, mô tả, hành động tùy chọn), không chứa copy hay nghiệp vụ cố định; Task 6 là consumer đầu tiên và Task 7a dùng tiếp.
- Xóa `styles/pages/home.css` ngay khi task đạt; không chạm `blogs.css` hoặc `components/content.css` trong task này.

#### Xong khi — Task 5

- [ ] Home khớp mẫu đầu trang/section/card ở desktop, xếp hợp lý trên mobile và giữ nguyên route/copy/hành vi.
- [ ] Không khôi phục Featured/khóa học/community đã bỏ; không sao chép nội dung/ảnh/logo/code của JavaBuilder.
- [ ] `EmptyState` có API trình bày chung, test role/nội dung/hành động tùy chọn và không chứa copy nghiệp vụ.
- [ ] Không còn `home.css`, import hoặc selector Home mồ côi; CSS của các trang hoãn vẫn nguyên vẹn.
- [ ] Trong `app/`, test liên quan `src/pages/Home/HomePage.test.tsx` và test mới của `EmptyState` đạt bằng `npx vitest run <các file>`; `npm run build` đạt. Không chạy full `npm test` hoặc backend.
- [ ] Kiểm bằng mắt Home dark/light desktop và mobile; thiếu môi trường ghi “chưa kiểm”.

### Task 6 — Admin

- Chuyển Admin dashboard/users/author applications/taxonomy theo bảng ánh xạ. Toàn bộ trang phía Author được giữ nguyên cho module `author-ui-shadcn`; toàn bộ Moderator tiếp tục hoãn sang Task 7a.
- Dùng `EmptyState` từ Task 5 cho trạng thái rỗng phù hợp, truyền copy/hành động từ trang thay vì đặt nghiệp vụ trong component.
- Giữ nguyên wrapper `Pagination`, props/API, CSS và page 0-based hiện tại vì component còn dùng chung với Author/Blogs; Admin tiếp tục dùng wrapper này. Việc bọc primitive shadcn chuyển sang `blogs-ui-shadcn` và phải regression mọi caller.
- Filter dùng Card/Input/NativeSelect; danh sách dùng hàng trong Card; mọi status/topic/tag/stat dùng Badge tone ổn định.
- Admin users dùng Checkbox cho chọn nhiều. Thay `window.confirm` ở `AdminUsersPage`, `AuthorApplicationsPage`, `TaxonomyPage` bằng AlertDialog, giữ nguyên thời điểm gọi API, payload, loading/error và câu hỏi xác nhận hiện có. Câu hỏi cũ thành mô tả; tiêu đề lấy từ nhãn hành động; chỉ thêm inline copy cấu trúc tối thiểu vi/en.
- Xóa các rule chỉ còn phục vụ Admin sau khi task đạt. Nếu `styles/pages/admin.css` vẫn chứa rule `.application-row`/`.applications-actions` mà `AuthorBlogsPage` đang dùng thì giữ nguyên các rule đó và file/import tương ứng như lớp tương thích; không di chuyển, đổi selector hoặc đổi giao diện Author trong task này.

#### Xong khi — Task 6

- [ ] Toàn bộ route Admin hiện hữu dùng primitive/token mới, đúng mẫu và giữ đủ loading/empty/error.
- [ ] Bulk select Admin users dùng Checkbox có label/trạng thái chọn rõ; ba xác nhận Admin dùng AlertDialog, không còn `window.confirm` trong ba trang này.
- [ ] Review hồ sơ tác giả phía Admin, taxonomy và user status giữ nguyên API/payload/quyền/copy; không thêm route/chức năng/field mới.
- [ ] Pagination giữ nguyên API/hình thức hiện tại và các caller Admin hoạt động; `EmptyState` được dùng ở consumer thật.
- [ ] Không còn rule/import Admin mồ côi; nếu còn `admin.css` thì chỉ giữ rule có consumer trực tiếp ở trang Author chưa chuyển. `author.css`, `blogs.css`, `moderator.css` vẫn được giữ.
- [ ] Trong `app/`, các test liên quan `src/pages/Admin/AdminUsersPage.test.tsx` và test mới của Admin (nếu có) đạt bằng `npx vitest run <các file>`; `npm run build` đạt. Không chạy full `npm test` hoặc backend.
- [ ] Kiểm bằng mắt dark/light desktop cho các trang Admin, mobile cho ít nhất một danh sách; thiếu môi trường ghi “chưa kiểm”.

### Task 7a — Moderator

- Chuyển `ModeratorDashboardPage`, `ModeratorArticlesPage`; dùng lại Pagination/EmptyState. Giữ nguyên `MarkdownContent` và CSS markdown hiện tại vì component còn dùng chung với Blog detail; chỉ ghép nó vào bố cục Moderator mới.
- Thay `window.confirm` còn lại ở `ModeratorArticlesPage` bằng AlertDialog theo cùng quy tắc copy vi/en của Task 6.
- Xóa `styles/pages/moderator.css` và rule chỉ phục vụ Moderator đã hết consumer khi task đạt; giữ `styles/pages/blogs.css`, `MarkdownContent`, rule markdown/TagPicker trong `components/content.css` và mọi CSS còn consumer Author/Blogs.

#### Xong khi — Task 7a

- [ ] Toàn bộ route Moderator dùng primitive/token mới, đúng mẫu và responsive; đủ loading/empty/error.
- [ ] Filter/query/pagination/navigation, moderation và markdown giữ nguyên hành vi/API/copy.
- [ ] Topic/tag/status dùng Badge tone ổn định; vùng đọc bài giữ Markdown render và syntax highlighting hiện tại.
- [ ] Moderator dùng AlertDialog, không còn `window.confirm`; MarkdownContent/Pagination giữ nguyên hợp đồng và hình thức hiện tại.
- [ ] Không còn `moderator.css` hoặc selector/import Moderator mồ côi; `blogs.css`, `author.css`, rule markdown/TagPicker và lớp tương thích Author/Blogs vẫn còn nguyên.
- [ ] Trong `app/`, các test liên quan `src/pages/Moderator/ModeratorArticlesPage.test.tsx` và test mới của Moderator (nếu có) đạt bằng `npx vitest run <các file>`; `npm run build` đạt. Không chạy full `npm test` hoặc backend.
- [ ] Kiểm bằng mắt dark/light desktop cho Moderator dashboard/articles và mobile cho một trang danh sách; thiếu môi trường ghi “chưa kiểm”.

### Task 7b — Dọn CSS ngoài Author/Blogs và hoàn tất phạm vi module

- Tiếp tục **không bật Tailwind preflight** vì các trang Author/Blogs chưa chuyển vẫn phụ thuộc reset/style legacy; việc bật preflight chỉ thực hiện sau khi cả hai module riêng đã chuyển xong.
- Giữ các reset chuyển tiếp trong `styles.css` đang thay vai trò preflight cho component shadcn; chỉ xóa chúng trong module hoãn hoàn tất sau cùng, sau khi preflight được bật và kiểm regression toàn frontend.
- Xóa import/file/rule CSS legacy không còn consumer ngoài Author/Blogs. Giữ lớp tương thích tối thiểu cho `AuthorApplyPage`, `AuthorBlogsPage`, `BlogsPage`, `BlogDetailPage`, `TagPicker`, `MarkdownContent` và `Pagination`: `base.css`, `layout/shell.css`, `components/controls.css`, `components/forms.css`, phần markdown/TagPicker/Pagination trong `components/content.css`, `pages/author.css`, `pages/blogs.css`, cùng phần `.application-row`/`.applications-actions` trong `pages/admin.css` nếu vẫn còn consumer trực tiếp.
- Chuyển shadcn token thành canonical; chỉ giữ alias/token cũ còn được lớp tương thích Author/Blogs tham chiếu. Xóa `app/scripts/verify-css-split.mjs` vì không còn dùng để bảo toàn toàn bộ inventory CSS cũ.
- Xóa dependency `framer-motion` sau khi Sidebar/Home đã thay animation và grep không còn import; Auth không phải consumer.
- Quét và loại mọi literal màu ngoài token, `window.confirm`, `window.alert`, class/selector CSS legacy và import CSS trang **ngoài allowlist tương thích Author/Blogs nêu trên**.

#### Xong khi — Task 7b

- [ ] Tailwind preflight vẫn chưa được nạp và reset chuyển tiếp cần thiết trong `styles.css` vẫn còn; dark mặc định/light tùy chọn, focus, form, markdown và responsive của các trang đã chuyển không regression.
- [ ] `find src/styles/pages -type f ! -name 'author.css' ! -name 'admin.css' ! -name 'blogs.css' -print` chạy trong `app/` không có kết quả; nếu `admin.css` còn thì chỉ chứa rule có consumer trực tiếp ở Author chưa chuyển.
- [ ] `rg -n --glob '*.{css,ts,tsx}' --glob '!styles/tokens.css' '(#[0-9A-Fa-f]{3,8}\b|(?:rgb|hsl|oklch|oklab|lab|lch|color)\()' src` không có kết quả màu literal.
- [ ] `rg -n 'window\.(confirm|alert)\(' src` không có kết quả; mọi xác nhận nguy hiểm dùng AlertDialog.
- [ ] Không còn token cũ/class legacy không được tham chiếu ngoài lớp tương thích Author/Blogs; `scripts/verify-css-split.mjs` và dependency/import `framer-motion` đã xóa.
- [ ] Toàn bộ route trong bảng ánh xạ dùng component/token mới, giữ hành vi/route/API/copy vi/en; `/author/apply`, `/author/blogs`, `/blogs`, `/blogs/:id` vẫn hoạt động với giao diện cũ, không bị cleanup làm hỏng.
- [ ] Trong `app/`, các test liên quan đến hạ tầng dùng chung bị sửa ở cleanup — tối thiểu `src/theme-bootstrap.test.ts`, `src/styles/tokens.test.ts`, `src/components/ui/focus.test.ts`, `src/components/ui/labels.test.tsx` và test của file trực tiếp bị sửa trong Task 7b — đạt bằng `npx vitest run <các file>`; `npm run build` đạt. Không chạy full `npm test` hoặc backend theo quyết định 2026-11-03/D-021.
- [ ] Kiểm bằng mắt dark/light desktop cho một route đại diện mỗi nhóm và mobile cho shell/form/list; smoke-check thêm `/author/apply`, `/author/blogs`, `/blogs`, `/blogs/:id` ở giao diện cũ để bắt regression do cleanup, không đánh giá lại thiết kế các trang hoãn. Thiếu môi trường ghi rõ route nào “chưa kiểm”.

## Ngoài phạm vi

- Không sửa `server/`, DB, API, service/data/type frontend hoặc hợp đồng request/response.
- Không thêm chức năng, route, field nghiệp vụ, quyền, copy vi/en hoặc dữ liệu mẫu; ngoại lệ duy nhất là copy cấu trúc tối thiểu vi/en bắt buộc cho ba AlertDialog Admin ở Task 6 và một AlertDialog Moderator ở Task 7a.
- Không đổi bảng màu D-010, dark mặc định D-013 hoặc font Inter D-014.
- Không migrate hoặc đổi thiết kế `/author/apply`, `/author/blogs`, `TagPicker` và CSS Author; toàn bộ giao diện phía Author thuộc module `author-ui-shadcn` riêng. Màn Admin `/admin/author-applications` vẫn thuộc module hiện tại vì là giao diện quản trị.
- Không migrate hoặc đổi thiết kế `/blogs`, `/blogs/:id`, `MarkdownContent`, wrapper `Pagination` dùng chung và CSS Blogs; toàn bộ phần này thuộc module `blogs-ui-shadcn` riêng.
- Không bật Tailwind preflight hoặc xóa lớp CSS legacy còn consumer Author/Blogs; chỉ bật preflight và dọn legacy cuối sau khi cả hai module riêng đã chuyển xong.
- Không sao chép logo, chữ, ảnh hoặc code từ javabuilder.online.
- Không thêm thư viện form, validation schema, animation/UI thứ hai ngoài dependency được chốt trong spec.

## Ràng buộc

- Được đổi API: Không. Được đổi DB (Flyway mới): Không.
- Giữ nguyên hành vi hiện tại: Có; chỉ thay hệ giao diện/cấu trúc CSS và thay API trình bày cũ (`dialog`, `confirm`) bằng component tương đương.
- Bám [`docs/design/UI_GUIDE.md`](../docs/design/UI_GUIDE.md) sau khi tài liệu được viết lại trong Task 1 và [`docs/design/javabuilder-patterns.md`](../docs/design/javabuilder-patterns.md).
- Mỗi task chỉ xóa CSS của trang vừa chuyển sau khi test/build đạt; không dọn trước CSS của trang chưa chuyển và không xóa rule dùng chung còn consumer Author/Blogs.
- Không sửa logic nghiệp vụ trong `components/ui/*`; composite theo nghiệp vụ đặt ngoài `ui/`. Variant Badge `tone` chỉ là API trình bày.
- Không chạy `shadcn add --overwrite` lên primitive đã review ở Task 1; component thêm sau phải giữ quy ước label qua prop, focus ring đặc và token màu đã chốt.
- Test bám role/label/state; chỉ sửa assertion class cũ khi class đó không còn là hợp đồng. Mỗi task chỉ chạy file test của component/trang bị sửa và nơi dùng trực tiếp bằng `npx vitest run <file...>`, cộng `npm run build` một lần; không chạy full `npm test`, `scripts/verify.sh` hoặc backend (quyết định 2026-11-03).
- Mỗi task kiểm dark/light desktop bằng Chrome; nếu không có môi trường phải ghi “chưa kiểm”, không suy diễn là đã đạt.
- Sau mỗi task được người dùng nhận, tạo commit WIP cục bộ `wip(ui-foundation-v2): Task n`; khi toàn bộ module, gồm Task 7b và review cuối, hoàn tất thì squash các WIP thành một commit cuối.
- Task 3 và Task 4 thực hiện liên tiếp trong cùng một session nhưng vẫn giữ hai nhóm “Xong khi” và kiểm chứng riêng. Task 2 dùng adversarial review; các task còn lại dùng review thường. Mỗi task/review vẫn tuân giới hạn hai vòng.

## Quyết định thiết kế đã chốt

1. Control desktop theo mặc định shadcn 36px; với `pointer-coarse`, vùng bấm/nút điều hướng tối thiểu 44px.
2. Không dùng gradient; card nổi bật dùng nền đặc theo tone.
3. Không thêm `sonner` trong module này; toast tách module sau nếu cần.
4. Dùng shadcn Sidebar, controlled bằng state/localStorage TechVerse như Task 2.
5. Danh sách Admin/Moderator dùng hàng trong Card; không thêm Table khi dữ liệu hiện tại không cần nhiều cột số.
6. Primitive shadcn Pagination đã sinh ở Task 1; hoãn việc bọc wrapper `Pagination` dùng chung sang `blogs-ui-shadcn` để không đổi gián tiếp Author/Blogs trong module này.
7. Gỡ `framer-motion` sau Task 5 khi Sidebar và Home đã chuyển sang transition/animation Tailwind-shadcn.
8. Thêm `EmptyState` composite ngoài `components/ui/` ở Task 5, dùng tiếp trong Task 6.
9. Không làm UI kit/dev route. `JWT_SECRET_KEY` hiện tại đã được xác nhận là Base64 hợp lệ, 32 byte/256 bit; thử chạy server dev từ Task 2 để kiểm bằng mắt, nếu môi trường khác lỗi thì ghi đúng nguyên nhân.
10. Task 3 và Task 4 chạy trong cùng một session; Task 2 dùng adversarial review, các task khác dùng review thường.
11. Commit WIP cục bộ sau mỗi task được người dùng nhận; squash thành một commit cuối khi toàn bộ module hoàn tất.
12. Tách toàn bộ giao diện phía Author (`AuthorApplyPage`, `AuthorBlogsPage`, `TagPicker`) khỏi module này; giữ preflight tắt và lớp CSS tương thích cho tới module `author-ui-shadcn`.
13. Tách toàn bộ giao diện Blogs (`BlogsPage`, `BlogDetailPage`, `MarkdownContent`) và việc migrate wrapper `Pagination` dùng chung khỏi module này sang `blogs-ui-shadcn`; Task 7a chỉ còn Moderator.

## Xong khi

Module chỉ hoàn tất khi Task 1–6, Task 7a và Task 7b đều đạt “Xong khi”, các quyết định thiết kế đã chốt được thực hiện và không còn nhóm trang hoãn **trong phạm vi ngoài Author/Blogs**. Tiêu chí tổng không thay thế kiểm chứng riêng của từng task.

- [ ] Toàn bộ route/trang trong bảng đã ánh xạ dùng shadcn/ui + Tailwind/token mới, giữ hành vi, route, API và copy vi/en.
- [ ] Không còn CSS trang/legacy ngoài allowlist tương thích Author/Blogs, literal màu ngoài token, `window.confirm`/`window.alert` hoặc dependency bị quyết định gỡ; preflight vẫn tắt cho đến khi hai module hoãn hoàn tất.
- [ ] Dark mặc định/light tùy chọn đúng bảng màu, Inter duy nhất, tương phản và focus đạt; responsive không cuộn ngang.
- [ ] Các file test frontend liên quan đã ghi tại từng task và `npm run build` đạt; không có task nào yêu cầu full `npm test` hoặc backend.

## Phản hồi vòng 1 (Claude)

Đúng / Sai / Thiếu / Thừa (đã đối chiếu code trên `feature/shadcn-ui`):

**Đúng**
- Xung đột `--muted` là bẫy thật: CSS cũ có **100** chỗ `var(--muted)` dùng làm màu chữ. Cách xử lý (đổi sang `--muted-foreground` trước rồi mới định nghĩa lại `--muted`) là đúng và bắt buộc.
- Bảng tương phản token: tính lại 3 cặp (`muted-foreground/surface-2` 4.94, `destructive` 6.47, `primary` 6.44) khớp.
- Bảng ánh xạ trang ↔ mẫu đủ và khớp `javabuilder-patterns.md`; nguyên tắc "chỉ thêm component khi có trang dùng" + bảng component ↔ trang đúng hướng.
- `base.css` đã có `font: inherit` cho button/input và `box-sizing`, nên tắt preflight trong lúc chuyển không làm component shadcn mất font.

**Sai**
1. *`select` (Radix) cho 17 thẻ `<select>` gốc.* `AdminUsersPage.test` và `AuthorBlogsPage.test` dùng `user.selectOptions`, chỉ chạy với `<select>` gốc; Radix Select render nút + listbox, cần polyfill pointer và đổi cách test. Các select hiện tại chỉ là danh sách chữ đơn giản, không cần render tùy biến; `<select>` gốc còn tốt hơn trên mobile. → Dùng `<select>` gốc với class giống `Input` (một primitive `NativeSelect` trong `components/ui/`), bỏ `@radix-ui/react-select`. Chỉ dùng Radix Select khi có select cần icon/nhóm/tìm kiếm.
2. *Câu hỏi 7 sai tiền đề.* `framer-motion` chỉ dùng ở `Sidebar.tsx` (`AnimatePresence` nhóm Cài đặt) và `HomePage.tsx` (hero), **không** ở tab Auth. Chọn 4A + Task 5 thì framer hết consumer → câu 7 chỉ còn "gỡ ở Task 7".
3. *Danh sách dependency cứng `@radix-ui/react-*`.* shadcn CLI hiện tại có thể cài gói gộp `radix-ui` thay vì từng gói; "Xong khi" Task 1 sẽ trượt vì lý do không phải lỗi. → Chấp nhận đúng những gì `shadcn init/add` cài, ghi danh sách thực tế vào log; vẫn cấm form/UI library ngoài phạm vi.
4. *Đường dẫn test:* file thật là `app/src/theme-bootstrap.test.ts` (không phải `.tsx`).

**Thiếu**
5. *Lề trái của trang cũ khi đổi shell (Task 2).* `shell.css` đặt `.page-content { margin-left: 250px }` (thu gọn 76px) và **mọi trang** dùng class này. Shell mới (`SidebarInset`) tự chừa chỗ sidebar → trang chưa chuyển bị lệch gấp đôi. Task 2 phải chuyển phần chừa chỗ sang shell mới, bỏ `margin-left` của `.page-content` (giữ padding), và "Xong khi" Task 2 kiểm một trang cũ chưa chuyển không bị lệch.
6. *Tương phản chip tone.* Công thức màu chưa đủ: chip chủ đề của trang mẫu (purple-500 trên purple-900) chỉ **2.75:1**, category blue-500 trên card **3.98:1**, đều trượt AA với chữ 12–14px. → Thêm bảng tương phản 8 tone × 2 theme, chữ/nền ≥ 4.5:1 (tối dùng chữ bậc 300; ví dụ purple-300 trên nền tím ~25% = 7.55:1; sáng dùng bậc 700).
7. *Copy cho AlertDialog mâu thuẫn "Ngoài phạm vi".* Thay `window.confirm` cần tiêu đề + nút Hủy/Xác nhận vi/en, nhưng spec cấm thêm copy và cấm sửa `src/data/**`. → Cho phép thêm tối thiểu copy cho dialog (tiêu đề, Hủy, Xác nhận), câu hỏi hiện có của `confirm` thành mô tả; ghi rõ đặt ở đâu (inline như các trang quản trị đang làm, hoặc mở ngoại lệ cho một file data).
8. *Chi tiết 4A (shadcn Sidebar):* mặc định mobile rộng 18rem (288px) → đặt lại 320px; trạng thái thu gọn hiện lưu localStorage `techverse-sidebar`, còn shadcn mặc định dùng cookie `sidebar_state` → dùng `SidebarProvider` dạng controlled từ localStorage, không thêm cookie; nêu giữ hay tắt phím tắt Ctrl+B.

**Thừa**
9. `breadcrumb` cho Author/Admin/Moderator: hiện không có trang phân cấp nào → chỉ dùng ở Blog detail.
10. `scroll-area`: Sidebar shadcn tự cuộn (`SidebarContent`), vùng đọc Moderator dùng cuộn gốc đủ; Radix ScrollArea thêm phức tạp trong jsdom → bỏ, thêm lại khi có chỗ thật sự cần.

**Câu hỏi mở — ý kiến Claude**
- Câu 1: **A + vùng chạm 44px trên màn cảm ứng** (variant `pointer-coarse:` của Tailwind v4 cho icon button, mục menu, nút nhỏ). Giữ được mật độ trang mẫu trên desktop mà không hạ chuẩn chạm trên điện thoại. Khác đề xuất B của Codex.
- Câu 2: A. Câu 3: B (toast tách module sau). Câu 4: A (kèm điểm 8). Câu 5: A. Câu 6: B. Câu 7: gỡ (theo điểm 2).

### Đề xuất ngoài spec (không chặn chốt)

1. **Trang `UI kit` chỉ ở chế độ dev (`/dev/ui`, chặn bằng `import.meta.env.DEV`):** bày mọi component, tone badge, mẫu card/bộ lọc/hàng danh sách ở dark/light. Lợi ích: kiểm bằng mắt mỗi task không cần backend/đăng nhập (vấn đề "chưa kiểm" lặp lại vì `JWT_SECRET_KEY` hỏng), và là tài liệu sống cho skill. Công sức: nhỏ (một trang). **Làm ngay ở Task 1.**
2. **Component `EmptyState` dùng chung** (icon + tiêu đề + mô tả + hành động): `UI_GUIDE` bắt buộc trạng thái rỗng ở mọi màn có dữ liệu nhưng hiện mỗi trang tự viết. Công sức nhỏ. **Làm ngay ở Task 1**, dùng dần ở Task 5–6.
3. **Toast (`sonner`) chuẩn hóa thông báo lưu/lỗi**: đồng nhất phản hồi sau thao tác. Công sức trung bình, đổi hành vi hiển thị → **tách module sau** (đồng ý câu 3B).

## Trả lời vòng 1 (Codex)

**Kết luận chung:** Đồng ý với các lỗi/thiếu/thừa Claude nêu, nhưng điều chỉnh cách xử lý ở điểm 1 và 3 theo component/changelog chính thức của shadcn hiện tại; không xóa câu hỏi 7 vì đây là lựa chọn người dùng đã yêu cầu, chỉ sửa đúng tiền đề.

1. **Đồng ý — dùng `NativeSelect`, không dùng Radix Select.** Code hiện tại chỉ có select chữ đơn giản, `<select>` gốc tốt hơn trên mobile và giữ được `user.selectOptions`. Thân spec đã đổi `select` thành component registry chính thức `native-select` của shadcn, không tự chế một primitive mang tên TechVerse; bỏ dependency/consumer Radix Select. Nếu module sau thật sự cần icon, nhóm phức tạp hoặc tìm kiếm thì mới thêm Select/Combobox.
2. **Đồng ý về consumer, không đồng ý xóa lựa chọn.** `framer-motion` chỉ có ở `Sidebar.tsx` và `HomePage.tsx`, không có ở Auth. Task 4 và câu hỏi 7 đã sửa. Câu hỏi 7 vẫn giữ hai phương án “gỡ sau khi thay hai consumer” hoặc “giữ cho Sidebar/Home” để người dùng chốt đúng yêu cầu ban đầu.
3. **Đồng ý và làm chặt hơn.** Với thời điểm hiện tại, style `new-york` dùng gói hợp nhất `radix-ui`, còn registry mới dùng `cn` thay cặp `clsx` + `tailwind-merge`. Spec đã đổi danh sách dependency và ghim `npx shadcn@latest init -b radix`, vì `latest` hiện mặc định Base UI trong khi yêu cầu/test setup của module nhắm Radix. Task 1 phải ghi package/version thực tế vào log; chỉ chấp nhận dependency do registry item đã chọn kéo vào, không chấp nhận tùy ý thêm thư viện.
4. **Đồng ý.** Sửa đường dẫn chính xác thành `app/src/theme-bootstrap.test.ts`.
5. **Đồng ý.** Task 2 đã thêm việc bỏ `margin-left: 250px/76px` của `.page-content` khi `SidebarInset` nhận trách nhiệm chừa chỗ, vẫn giữ padding legacy; “Xong khi” phải xem một trang chưa chuyển ở cả trạng thái mở/thu gọn để tránh lệch gấp đôi.
6. **Đồng ý.** Đã bổ sung bảng 8 tone × 2 theme. Theme tối dùng chữ bậc 300 trên nền 900/25 và lấy tỷ lệ xấu hơn khi đặt trên `surface-2`; theme sáng dùng chữ 700 trên nền 100. Mọi cặp phải được đo lại từ token thật ở Task 1 và đạt ít nhất 4.5:1, không sao chép cặp màu trượt AA của trang mẫu.
7. **Đồng ý.** Ngoài phạm vi đã thêm đúng một ngoại lệ copy cấu trúc cần thiết cho bốn AlertDialog. Câu hỏi xác nhận hiện có trở thành mô tả; tiêu đề lấy từ nhãn hành động; chỉ thêm inline `Hủy/Cancel`, `Xác nhận/Confirm` hoặc nhãn hành động tương ứng. Không mở quyền sửa `src/data/**` và không viết lại thông điệp nghiệp vụ.
8. **Đồng ý.** Phương án Sidebar 4A đã ghi rõ: desktop 256px, Sheet mobile 320px, `SidebarProvider` controlled bằng state/localStorage `techverse-sidebar`, không thêm cookie `sidebar_state`, tắt Ctrl+B để giữ nguyên hành vi hiện tại.
9. **Đồng ý.** Breadcrumb chỉ còn ở Blog detail; Author/Admin/Moderator chưa có phân cấp thì không thêm.
10. **Đồng ý.** Bỏ `scroll-area` khỏi bộ ban đầu và phương án Sidebar; dùng cuộn gốc/`SidebarContent`, chỉ thêm lại trong module có consumer thật.

**Về bảy câu hỏi mở:** Tôi đổi đề xuất câu 1 sang phương án A có điều kiện `pointer-coarse` ≥44px như Claude; giữ đề xuất 2A, 3B, 4A, 5A, 6B; câu 7 đề xuất gỡ sau Task 5 với đúng hai consumer Sidebar/Home. Đây vẫn là đề xuất, chưa coi là quyết định cho tới khi người dùng chốt.

**Đề xuất ngoài spec:**

1. **UI kit `/dev/ui`: chưa đưa vào spec.** Lợi ích kiểm giao diện không cần backend là thật, nhưng nó thêm route/component mới, mâu thuẫn trực tiếp với “không thêm route” và làm Task 1 đổi giao diện thay vì chỉ dựng nền. Nếu người dùng muốn, nên mở task dev-tool riêng sau khi hệ component ổn định.
2. **`EmptyState`: hợp lý nhưng chờ người dùng chọn theo D-023.** Nếu được chọn, thêm composite ngoài `components/ui/` ở Task 5 khi có consumer đầu tiên, rồi dùng tiếp ở Task 6; không tạo sớm ở Task 1 khi chưa có trang chuyển.
3. **Toast:** đồng ý tách module sau, không thêm vào spec hiện tại; khớp đề xuất 3B.

### Điểm yếu còn lại

- Bảy câu hỏi mở vẫn cần người dùng chốt; đặc biệt 4A quyết định có sinh shadcn Sidebar và 6B quyết định có sinh shadcn Pagination.
- Người dùng cần quyết riêng có nhận đề xuất `EmptyState` vào Task 5–6 hay không. UI kit dev không được đề xuất đưa vào module này.
- Vì yêu cầu dùng `shadcn@latest`, tên/version dependency có thể tiếp tục thay đổi; `-b radix`, registry item đã chọn và lock file là ba rào chắn, nhưng Task 1 vẫn phải ghi thực tế vào log.
- Tỷ lệ Badge trong spec là mức tham chiếu từ thang màu đã chọn; chỉ kết quả đo token CSS thật ở Task 1 mới là bằng chứng hoàn tất.
- Kiểm bằng mắt vẫn phụ thuộc Chrome/môi trường đăng nhập; thiếu môi trường phải ghi “chưa kiểm” theo từng route, không được coi là đạt.

## Phản hồi vòng 2 (Claude)

Đồng ý cả 10 trả lời vòng 1 và phần sửa thân spec (NativeSelect, `-b radix`, lề `.page-content`, bảng tone, ngoại lệ copy AlertDialog, chi tiết Sidebar 4A, bỏ breadcrumb thừa/scroll-area). Không còn bất đồng kỹ thuật; ba ghi chú nhỏ, không cần thêm vòng:

1. *Biên tương phản theme sáng quá mỏng:* `amber` 4.51:1 và `green` 4.57:1 chỉ vừa trên 4.5; sai lệch nhỏ khi đo token thật ở Task 1 là trượt. Đề xuất chữ bậc 800 cho hai tone này ở theme sáng (biên rộng hơn), các tone khác giữ 700.
2. *Rào cho registry:* `native-select` và cờ `-b radix` là dữ kiện của shadcn ở thời điểm hiện tại; nếu khi chạy Task 1 registry không có `native-select` hoặc cờ khác tên, dùng thẳng `<select>` gốc với class của `Input` trong `components/ui/native-select.tsx` và ghi log — không dừng task.
3. *UI kit dev:* chấp nhận lý do Codex không đưa vào module (thêm route). Nhưng vấn đề gốc là thật: mỗi task đều có thể rơi vào "chưa kiểm" vì kiểm bằng mắt cần backend + đăng nhập (và `JWT_SECRET_KEY` trong `.env` hiện không hợp lệ). Để người dùng chọn: (a) task dev-tool riêng ngay sau Task 1, hoặc (b) người dùng sửa `JWT_SECRET_KEY` để Claude chạy server dev chụp từng task.

Điểm yếu còn lại của Codex: chấp nhận cả năm. Đề nghị người dùng chốt 7 câu hỏi mở + 2 đề xuất ngoài spec.

## Trả lời vòng 2 (Codex)

**Chốt.** Tôi đồng ý phản hồi vòng 2; không còn bất đồng kỹ thuật hoặc câu hỏi thiết kế nào chặn Task 1. Đây là vòng phản biện cuối theo D-002.

1. **Đồng ý tăng biên tương phản.** Thân spec đã đổi chữ `green`/`amber` ở theme sáng từ bậc 700 lên 800. Tỷ lệ tham chiếu tương ứng tăng từ 4.57/4.51 lên 6.49/6.37; Task 1 vẫn phải đo lại token CSS thật và giữ mọi cặp ≥4.5:1.
2. **Đồng ý fallback registry.** Nếu `shadcn@latest` đổi tên cờ base hoặc không còn registry item `native-select`, Task 1 không bị chặn: tạo presentational `components/ui/native-select.tsx` bọc `<select>` gốc, dùng class/token của Input, ghim base Radix tương đương và ghi sai khác vào log. Không đổi hành vi/mobile UX/test `selectOptions`.
3. **Chốt cách kiểm bằng mắt theo lựa chọn người dùng.** Không thêm UI kit hay route dev. Đính chính sau Task 1: `JWT_SECRET_KEY` hiện tại đã hợp lệ (Base64 chuẩn, 32 byte/256 bit), không cần người dùng sửa; Claude thử server dev từ Task 2 để kiểm dark/light. Nếu môi trường vẫn thiếu, phải ghi chính xác route “chưa kiểm”, không được coi là đã đạt.

Các quyết định người dùng đã được đưa vào thân spec: 1A, 2A, 3B, 4A, 5A, 6B, 7A; tạo `EmptyState` ở Task 5 và dùng trong Task 6/7a; không làm UI kit. Mục “Câu hỏi mở” đã đổi thành “Quyết định thiết kế đã chốt”, các nhánh không được chọn (`sonner`, Table, sidebar tự viết, giữ `framer-motion`) đã bỏ khỏi yêu cầu thực hiện.

### Điểm yếu còn lại

- Task 1 đã khóa `shadcn@4.23.0` và dependency trong lock file; các task sau không tự nâng phiên bản. Nếu tái sinh component bằng registry phải đối chiếu diff để không làm mất các sửa focus/i18n đã review.
- Tỷ lệ Badge trong spec là tham chiếu; kết quả đo từ token CSS thật ở Task 1 mới là bằng chứng hoàn tất.
- Kiểm bằng mắt phụ thuộc môi trường server dev và tài khoản theo vai trò; đây là rủi ro thực thi cần ghi log, không còn là lỗ hổng quyết định của spec.

Không còn điểm nào cần phản biện thêm. Task 1 đã hoàn tất; spec sẵn sàng chuyển sang Task 2 sau khi người dùng nhận kết quả Task 1.

## Quyết định của người dùng

- 2026-11-02: Chốt spec UI foundation v2. Câu 1: A (36px desktop, ≥44px khi `pointer-coarse`); câu 2: A (không gradient); câu 3: B (chưa toast, tách module sau); câu 4: A (shadcn Sidebar); câu 5: A (hàng trong card); câu 6: B (shadcn pagination bọc sau `Pagination`); câu 7: A (gỡ framer-motion sau Task 5).
- Nhận đề xuất `EmptyState` (composite ngoài `components/ui/`, thêm ở Task 5, dùng tiếp Task 6). Không làm UI kit; kiểm bằng mắt từng task qua server dev.
- Theme sáng: chữ tone `amber`/`green` dùng bậc 800 để có biên tương phản.
- Giao Claude thực hiện, bắt đầu Task 1.
- 2026-11-03 sau Task 1: không commit từng task, chỉ commit một lần khi hoàn tất module; Task 3 + Task 4 chạy cùng session; chỉ Task 2 dùng adversarial review.
- Logo đổi sang asset Cloudinary public ID `techverse/brand/logo`; Task 2 chỉ ghép bản đầy đủ/icon vào shell, `app/index.html` dùng cùng master cho favicon. Không commit file ảnh nguồn lớn.
- Task 7a chỉ còn Moderator; Task 7b dọn CSS ngoài Author/Blogs. Các quyết định cũ đưa Blogs/BlogDetail/MarkdownContent hoặc TagPicker/AuthorBlogs vào Task 7a và bật preflight ở Task 7b đã được thay bởi các quyết định tách module bên dưới.
- Đính chính: `JWT_SECRET_KEY` hiện tại hợp lệ (Base64 chuẩn, 32 byte/256 bit); không cần người dùng sửa trước Task 2, chỉ cần xác nhận bằng lần chạy server dev.
- 2026-11-03: Vòng review 2 của Task 3+4 dùng `/code-review` thay lượt Codex bị dừng; sửa 8/9 phát hiện để ổn định, gồm ba bug sidebar thuộc Task 2. Phát hiện #9 về logo Cloudinary khi offline được ghi “Ngoài phạm vi”.
- 2026-11-03: Tách `AuthorApplyPage`, `AuthorBlogsPage`, `TagPicker` và cleanup CSS/preflight phụ thuộc chúng sang module `author-ui-shadcn`; Task 6 chỉ còn Admin. D-026 sau đó tiếp tục tách Blogs để Task 7a chỉ còn Moderator.
- 2026-11-03: Tách `BlogsPage`, `BlogDetailPage`, `MarkdownContent`, wrapper `Pagination` dùng chung và CSS phụ thuộc sang module `blogs-ui-shadcn`; Task 7a chỉ còn Moderator.
