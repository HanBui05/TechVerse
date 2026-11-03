# UI foundation v2 (shadcn)

Trạng thái: xem [`PLAN.md`](PLAN.md). Spec do Codex viết; Claude chỉ ghi vào mục “Phản hồi”.

**Mục tiêu:** Chuyển giao diện frontend TechVerse sang shadcn/ui + Tailwind CSS v4 trên nhánh `feature/shadcn-ui`, gồm màn đăng ký Tác giả/Author `/author/apply` nhưng chưa gồm luồng bài viết ba vai trò (Author viết bài, Moderator duyệt, Learner đọc bài). Giữ nguyên nghiệp vụ, route, request/payload API và nội dung vi/en; ngoại lệ Task 6 bổ sung `avatarUrl` vào ba DTO response Admin để giao diện hiển thị avatar thật. Giao diện mới dùng một hệ token dark/light, component và tỷ lệ thống nhất theo [`javabuilder-patterns.md`](../docs/design/javabuilder-patterns.md); các màn bài viết và lớp CSS tương thích của chúng được giữ nguyên để chuyển trong module `article-flow`.
**Làn:** Đầy đủ
**Giai đoạn:** Giao diện
**Đổi giao diện:** Có
**Nhánh thực hiện:** `feature/shadcn-ui`

## Đường dẫn thuộc module

Chỉ được sửa các đường dẫn sau. Ngoài danh sách là ngoài phạm vi.

- Cấu hình và dependency: `app/index.html`, `app/package.json`, `app/package-lock.json`, `app/components.json`, `app/tsconfig.json`, `app/tsconfig.app.json`, `app/vite.config.ts`, `app/vitest.config.ts`.
- Điểm vào và khung route: `app/src/main.tsx`, `app/src/App.tsx`, `app/src/styles.css`.
- Token/CSS chuyển tiếp và CSS cũ được xóa hoặc giữ làm lớp tương thích luồng bài viết theo từng task: `app/src/styles/tokens.css`, `app/src/styles/base.css`, `app/src/styles/layout/{shell,sidebar}.css`, `app/src/styles/components/{controls,forms,content}.css`, `app/src/styles/pages/{home,settings,auth,profile,admin,author,moderator,blogs}.css`.
- Hạ tầng shadcn: `app/src/lib/utils.ts`, `app/src/components/ui/*.tsx`, `app/src/hooks/{use-mobile,use-debounced-value}.ts` cho shadcn Sidebar đã chọn và tìm động ở Admin.
- Component dùng chung/nghiệp vụ: `app/src/components/{EmptyState,GoogleAuthButton,UserAvatar}.tsx`, `app/src/components/auth/AuthLayout.tsx`, `app/src/components/brand/Brand.tsx`, `app/src/components/layout/{AccountIdentity,AdminSidebar,ModeratorSidebar,Sidebar,StaffSettingsLinks}.tsx`.
- Trang Home: `app/src/pages/Home/HomePage.tsx`.
- Trang Profile/Settings: `app/src/pages/Profile/{AvatarUpload,ChangePasswordPanel,ProfilePage}.tsx`, `app/src/pages/Settings/{LanguagePage,SettingsLayout,ThemePage}.tsx`.
- Trang Auth: `app/src/pages/Login/{LoginPage,ForgotPasswordPage,GoogleCallbackPage}.tsx`, `app/src/pages/Register/RegisterPage.tsx`.
- Trang Admin: `app/src/pages/Admin/{AdminDashboardPage,AdminUsersPage,AuthorApplicationsPage,TaxonomyPage}.tsx`.
- Ngoại lệ API avatar Admin: `server/src/main/java/com/techverse/server/dto/response/{AdminUserSummaryResponse,AdminAuthorApplicationSummaryResponse,AdminAuthorApplicationDetailResponse}.java`, `server/src/main/java/com/techverse/server/service/impl/{AdminUserServiceImpl,AdminAuthorApplicationServiceImpl}.java`, `server/src/test/java/com/techverse/server/admin/{AdminUserIntegrationTest,AdminAuthorApplicationIntegrationTest}.java`.
- Trang đăng ký Tác giả/Author và type response liên quan: `app/src/pages/Author/AuthorApplyPage.tsx`, `app/src/services/profileService.ts`.
- Ngoại lệ copy-only để thống nhất thuật ngữ trên màn bài viết hoãn: `app/src/pages/Author/AuthorBlogsPage.tsx`, `app/src/pages/Moderator/ModeratorDashboardPage.tsx`; kicker dùng chung của AuthorBlogs phải đọc prop `language` để hiện “Tác giả” ở vi và “Author” ở en, còn Moderator chỉ thay chữ “Author” trong câu tiếng Việt. Không đổi bố cục/logic/CSS.
- Trang fallback: `app/src/pages/PlaceholderPage.tsx`.
- Test frontend hiện có được phép cập nhật: `app/src/{App.auth,App.author-session,StaffPreferences}.test.tsx`, `app/src/theme-bootstrap.test.ts`, `app/src/components/layout/Sidebar.test.tsx`, `app/src/pages/Admin/AdminUsersPage.test.tsx`, `app/src/pages/Author/AuthorBlogsPage.test.tsx`, `app/src/pages/Home/HomePage.test.tsx`, `app/src/pages/Profile/{ChangePasswordPanel,ProfilePage}.test.tsx`; được thêm `app/src/pages/Author/AuthorApplyPage.test.tsx` và test đồng vị cho đúng component/trang trong danh sách trên.
- Setup test mới: `app/src/test/setup.ts`.
- Dọn script cũ: `app/scripts/verify-css-split.mjs`.
- Dữ liệu kiểm thử dev và hướng dẫn chạy: `scripts/dev-seed-admin.sql`, `docs/RUNBOOK.md`.
- Luật/tài liệu: `.claude/rules/frontend.md`, `.claude/skills/ui-components/SKILL.md`, `docs/design/UI_GUIDE.md`.

Từ Task 7a trở đi, ngoài `AuthorApplyPage.tsx`, phần type response trong `profileService.ts` và hai ngoại lệ copy-only đã liệt kê, không sửa `app/src/services/**`, `app/src/data/**`, `app/src/types/**`, phần khác của `AuthorBlogsPage.tsx`, `app/src/pages/Blogs/**`, phần khác của `app/src/pages/Moderator/**`, `app/src/components/{TagPicker,MarkdownContent,Pagination}.tsx`, test nghiệp vụ của AuthorBlogs/Blogs/Moderator hay `server/**`. Các file CSS legacy còn consumer của luồng bài viết chỉ được giữ nguyên hoặc lược bỏ rule đã chứng minh không còn consumer; không được đổi hình thức/hành vi các trang đó. Nếu Task 7a cho thấy API hiện có thiếu dữ liệu, dừng và đưa vấn đề về cho người dùng thay vì sửa backend hoặc mở rộng phạm vi.

## Bản đồ chi tiết

### Hiện trạng và đích chuyển đổi

| Hiện ở đâu | Dùng bởi | Đích sau thay đổi |
|---|---|---|
| `app/src/styles.css` import Google Font và 16 file CSS cũ | Toàn app qua `main.tsx` | Entry Tailwind v4 dùng CSS config; chỉ nạp theme + utilities, chưa bật preflight; Task 7b bỏ import CSS của trang đã chuyển và giữ lớp tương thích tối thiểu cho luồng bài viết |
| `app/src/styles/tokens.css` (`:root`, `:root[data-theme='light']`) | Toàn bộ CSS hiện tại | Nguồn duy nhất cho token shadcn, tone badge, code highlighting và dark/light; shadcn token là canonical, alias legacy chỉ giữ khi luồng bài viết còn dùng |
| `App.tsx` (`data-theme`, shell, mobile topbar, route) | Mọi trang | Giữ `data-theme`/localStorage/route, thay lớp trình bày và primitive giao diện |
| `Sidebar`, `AdminSidebar`, `ModeratorSidebar`, `StaffSettingsLinks`, `AccountIdentity` | Shell theo vai trò | Một cấu trúc shadcn Sidebar thống nhất, giữ menu/quyền/thu gọn/mobile hiện tại |
| `UserAvatar`, `GoogleAuthButton`, `Brand` | Sidebar, Profile, Auth | Component ghép nghiệp vụ ngoài `components/ui/`; `Brand` dùng logo Cloudinary `techverse/brand/logo`, không tự thiết kế logo mới trong Task 2 |
| `Pagination` | AuthorBlogs, Blogs, Admin, Moderator | Primitive shadcn đã sinh ở Task 1 nhưng wrapper dùng chung giữ nguyên trong module này để không đổi gián tiếp luồng bài viết; migrate trong `article-flow` và regression mọi caller |
| `MarkdownContent` | Blogs và Moderator | Giữ nguyên trong module này; chuyển cùng luồng bài viết trong module `article-flow` |
| `TagPicker` | Chỉ `AuthorBlogsPage` | Giữ nguyên trong module này; chuyển cùng màn viết bài trong module `article-flow` |
| `AuthorApplyPage` + `profileService.AuthorProfile` | `/author/apply` | Task 7a chuyển sang shadcn/Tailwind, hiển thị đúng năm trạng thái và lịch sử duyệt đã có trong response; không đổi endpoint/payload |
| Native `<dialog>` ở Profile và `window.confirm` ở các trang quản trị | Profile/Admin; Moderator hoãn | `Dialog`/`AlertDialog` Radix cho trang đã chuyển; API trình duyệt cũ ở Moderator chỉ được bỏ trong `article-flow` |
| Input ngày sinh kiểu gõ + native picker ở Profile | `ProfilePage` | `Popover` + `Calendar`, vẫn cho gõ `dd/mm/yyyy` và giữ validation/API hiện tại |
| 13 file test / 221 test hiện tại | Luồng chính frontend | Giữ regression; test phụ thuộc class cũ chuyển sang role/label/state |

Các class hiện cùng phần tử ở `AuthorApplyPage` cần được gỡ theo cụm khi chuyển: `page-content author-apply-page` trên `<main>`; `button button-outline` trên nút thử lại; `button button-primary w-full` trên nút gửi. Các class đơn còn lại là `author-apply-illustration`, `author-illustration-orbit`, `author-apply-card`, `section-kicker`, `author-intro`, `author-apply-error`, `author-form-status`, `author-application-status`, `author-upload-note`; chỉ bỏ selector dùng chung như `section-kicker` khỏi CSS khi grep chứng minh không còn consumer khác. Thứ tự import legacy hiện tại phải giữ cho các file còn lại: `tokens` → `base` (layer base) → `shell` → `controls` → `forms` → `content` → `admin` → `author` → `moderator` → `blogs`; Task 7a chỉ bỏ import `author.css`, không đổi thứ tự tương đối của phần còn lại.

### Ánh xạ trang TechVerse ↔ mẫu JavaBuilder

Chỉ lấy bố cục, tỷ lệ và công thức màu từ tài liệu mẫu; không lấy logo, chữ, ảnh hoặc code.

| Route/trang TechVerse | Mẫu áp dụng từ `javabuilder-patterns.md` | Quy định chính |
|---|---|---|
| `/` — `HomePage` | 4.1 đầu trang + 4.7 tiêu đề khu vực + 4.3 lưới card | Hero hiện có, section header căn giữa, card nội dung 3 cột; không khôi phục các khối đã bỏ theo D-015/D-016 |
| `/profile` — `ProfilePage`, `AvatarUpload`, `ChangePasswordPanel` | 4.6 hồ sơ hai cột | Card trái 320px, card nội dung bên phải; avatar, form và hành động giữ nguyên nghiệp vụ |
| `/settings/theme`, `/settings/language` — `SettingsLayout`, `ThemePage`, `LanguagePage` | 4.6 cài đặt hai cột | Dùng cùng khung Profile/Settings, card lựa chọn có trạng thái rõ ràng |
| `/login`, `/register`, `/forgot-password`, `/auth/callback` — Auth pages + `AuthLayout` | Bố cục Auth hiện tại, thay control theo hệ 1–3 | Không đổi luồng/tab route/copy; chuẩn hóa thang chữ, Card, Button, Input, Label và trạng thái |
| `/admin` — `AdminDashboardPage` | 4.1 đầu trang gọn + card lối tắt | Lời chào và lối tắt tới bốn trang Admin thật; không có số liệu giả, hoạt động gần đây hoặc người đang online |
| `/admin/users` — `AdminUsersPage` | 4.2 filter + 4.5 hàng trong card | Tìm động; avatar thật, Badge và icon meta; Checkbox chọn nhiều với thanh hành động nổi; chi tiết trong Sheet; AlertDialog xác nhận |
| `/admin/author-applications` — `AuthorApplicationsPage` | 4.2 filter + 4.5 hàng trong card | Tìm động, chip lọc trạng thái/chuyên môn, avatar thật; chi tiết/hành động trong Sheet; AlertDialog xác nhận |
| `/admin/topics`, `/admin/tags` — `TaxonomyPage` | 4.2 filter + lưới card màu | Tìm động; tone ổn định; tạo/sửa bằng Dialog; AlertDialog thay confirm |
| `/author/apply` — `AuthorApplyPage` | 4.1 đầu trang có minh họa + 4.6 bố cục hai vùng | Hành trình đăng ký Tác giả/Author sinh động; form/trạng thái/lịch sử duyệt dùng dữ liệu thật, xếp dọc trên mobile |
| `*` — `PlaceholderPage` | 4.1 đầu trang ứng dụng gọn + một Card trạng thái | Giữ fallback và copy hiện có, không biến thành route/chức năng mới |

Mọi mẫu dùng vùng nội dung tối đa 1280px, padding ngang 24–32px, gap khối 24/32px, card lớn bo 18px, card lưới bo 10px và sidebar 256px/mobile 320px. Thang chữ bắt buộc: hero H1 48/48 700; H1 bài 30/37.5 700; H1 app 24/32 700; H2 20/700; tiêu đề card lưới 16/700; tiêu đề khối 14/600; body/input 14/400; meta 12/400; label trường 11/600 uppercase, tracking `.05em`.

### Token shadcn và tương phản

Trong task 1, token shadcn lấy đúng giá trị từ token cũ để trang chưa chuyển không đổi màu. Riêng tên `--muted` bị xung đột nghĩa: CSS cũ dùng nó làm chữ phụ, còn shadcn dùng nó làm nền. Vì CSS variable không thể “chụp” giá trị cũ qua alias động, task 1 phải chuyển mọi reference chữ phụ legacy từ `var(--muted)` sang `var(--muted-foreground)` trước, rồi mới đặt `--muted` = `--surface-2`; không được viết `--muted-foreground: var(--muted)` sau khi đổi nghĩa. Các token không xung đột có thể dùng alias tương thích trong giai đoạn chuyển. Task 7b xóa alias cũ không còn dùng ngoài lớp tương thích luồng bài viết và giữ các token shadcn làm nguồn chuẩn. `@theme inline` expose màu/font cho utility Tailwind; mọi giá trị màu thực nằm trong `app/src/styles/tokens.css`.

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
| `button` | Mọi form, filter, pagination, hành động Profile/Admin/AuthorApply, mobile topbar |
| `input`, `label`, `textarea` | Auth; Profile; bộ lọc Admin; form AuthorApply; ghi chú duyệt Admin |
| `card` | Home, Profile/Settings, Auth, Admin, AuthorApply, Placeholder |
| `native-select` | Select chữ đơn giản hiện có ở Admin và chuyên môn AuthorApply; giữ `<select>` gốc, mobile UX và `selectOptions` |
| `checkbox` | Chọn nhiều ở `AdminUsersPage` |
| `badge` + `tone` | Topic/category/tag; trạng thái hồ sơ tác giả trong Admin/AuthorApply; chip số liệu trên Home/Admin |
| `avatar` | `UserAvatar`, `AccountIdentity`, Profile, byline bài viết, danh sách người dùng/hồ sơ |
| `separator` | Sidebar, card meta, Profile/Settings, Auth, danh sách hàng |
| `breadcrumb` | Đã sinh ở Task 1 cho Blog detail nhưng chưa dùng trong module này; module `article-flow` là consumer |
| `dialog` | Profile/logout-all và vùng chi tiết/chỉnh sửa đang cần modal; không đổi thành modal nếu hiện tại là trang |
| `alert-dialog` | Thay `window.confirm` ở `AdminUsersPage`, `AuthorApplicationsPage`, `TaxonomyPage`; Moderator hoãn sang `article-flow` |
| `popover`, `calendar` | Chọn ngày sinh Profile, vẫn cho nhập `dd/mm/yyyy` |
| `tooltip` | Icon button và sidebar thu gọn |
| `skeleton` | Trạng thái tải ở Profile, Admin, AuthorApply |
| `sheet` | Sidebar/mobile navigation 320px; chi tiết Admin ở cạnh phải |
| `sidebar` | Đã chọn 4A; dùng cho shell User/Admin/Moderator, controlled bằng state/localStorage hiện có |
| `pagination` | Primitive đã sinh ở Task 1; wrapper `Pagination` dùng chung chỉ migrate trong `article-flow` |
| `EmptyState` (composite ngoài `ui/`) | Tạo và test ở Task 5; dùng cho Admin ở Task 6; không ép dùng ở AuthorApply nếu trạng thái chuyên biệt rõ hơn |

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
- Tạo composite `EmptyState` ngoài `components/ui/` (icon, tiêu đề, mô tả, hành động tùy chọn), không chứa copy hay nghiệp vụ cố định; Task 6 là consumer đầu tiên.
- Xóa `styles/pages/home.css` ngay khi task đạt; không chạm `blogs.css` hoặc `components/content.css` trong task này.

#### Xong khi — Task 5

- [x] Home khớp mẫu đầu trang/section/card ở desktop, xếp hợp lý trên mobile và giữ nguyên route/copy/hành vi.
- [x] Không khôi phục Featured/khóa học/community đã bỏ; không sao chép nội dung/ảnh/logo/code của JavaBuilder.
- [x] `EmptyState` có API trình bày chung, test role/nội dung/hành động tùy chọn và không chứa copy nghiệp vụ.
- [x] Không còn `home.css`, import hoặc selector Home mồ côi; CSS của các trang hoãn vẫn nguyên vẹn.
- [x] Trong `app/`, test liên quan `src/pages/Home/HomePage.test.tsx` và test mới của `EmptyState` đạt bằng `npx vitest run <các file>`; `npm run build` đạt. Không chạy full `npm test` hoặc backend.
- [x] Kiểm bằng mắt Home dark/light desktop và mobile; thiếu môi trường ghi “chưa kiểm”.

### Task 6 — Admin

- Chuyển Admin dashboard/users/author applications/taxonomy theo bảng ánh xạ và hướng **sinh động hơn việc thay primitive**: được thêm icon, khối và copy ngắn vi/en thuần trình bày; đầu trang có mô tả và số kết quả, hàng có avatar/Badge/icon meta/hover, trạng thái tải dùng Skeleton, trạng thái rỗng dùng `EmptyState`, hiệu ứng chỉ bằng CSS/Tailwind. Task này không đổi trang phía Author hoặc Moderator.
- Sidebar Admin dùng icon màu theo `toneText`, nhóm đúng miền thật “Người dùng”/“Nội dung”; Cài đặt dùng `SettingsMenu` thu gọn, mặc định đóng và tự mở khi route hiện tại thuộc Cài đặt. `StaffSettingsLinks` dùng chung nên Moderator nhận cùng hành vi Cài đặt cơ bản; thiết kế nội dung Moderator hoãn sang `article-flow`.
- Bỏ mọi phần của chức năng chưa có: thẻ số liệu giả, hoạt động gần đây/người đang online và nhãn nhóm “học viên/bài giảng”. Dashboard chỉ có lời chào, bốn thẻ lối tắt tới trang Admin thật và hai lối tắt ngôn ngữ/giao diện; không bịa số liệu.
- Users dùng hàng trong Card, avatar thật, filter Card, Sheet chi tiết và thanh hành động nổi khi chọn nhiều. Author applications dùng chip lọc nhanh theo trạng thái sẵn có, Sheet chi tiết và các hành động duyệt. Taxonomy dùng lưới card màu; tạo/sửa trong Dialog. Hướng Dashboard + Users đã được người dùng duyệt để áp dụng tự do cho hai trang còn lại trong đúng bối cảnh quản trị.
- Ô tìm kiếm ở Users, Author applications và Taxonomy là `type="search"`, tự áp dụng sau debounce 300 ms, vẫn áp dụng ngay khi Enter và không có nút “Tìm”. Mỗi trang dùng request id/ref mới nhất để response cũ không ghi đè dữ liệu, lỗi hoặc trạng thái tải của truy vấn mới.
- Chuyên môn hồ sơ tác giả tách theo dấu phẩy, chấm phẩy hoặc xuống dòng thành Badge chip có tone ổn định; hàng hiển thị tối đa ba chip và `+n`, Sheet hiển thị đầy đủ trong card có số kỹ năng. Giới thiệu trình bày thành đoạn có viền nhấn, không đổi dữ liệu nguồn.
- Ngoại lệ backend đã chốt: thêm `avatarUrl` nullable vào `AdminUserSummaryResponse`, `AdminAuthorApplicationSummaryResponse`, `AdminAuthorApplicationDetailResponse` và map từ `User.avatarUrl` trong hai service; frontend truyền URL cho `UserAvatar` ở danh sách/chi tiết và giữ fallback chữ cái khi URL trống hoặc ảnh lỗi. Không đổi request, payload, quyền hoặc route.
- Dùng `EmptyState` từ Task 5 cho trạng thái rỗng phù hợp, truyền copy/hành động từ trang thay vì đặt nghiệp vụ trong component.
- Giữ nguyên wrapper `Pagination`, props/API, CSS và page 0-based hiện tại vì component còn dùng chung với luồng bài viết; Admin tiếp tục dùng wrapper này. Việc bọc primitive shadcn chuyển sang `article-flow` và phải regression mọi caller.
- Admin users dùng Checkbox cho chọn nhiều. Thay `window.confirm` ở `AdminUsersPage`, `AuthorApplicationsPage`, `TaxonomyPage` bằng AlertDialog, giữ nguyên thời điểm gọi API, payload, loading/error và câu hỏi xác nhận hiện có. Câu hỏi cũ thành mô tả; tiêu đề lấy từ nhãn hành động; chỉ thêm inline copy cấu trúc tối thiểu vi/en.
- Thêm `scripts/dev-seed-admin.sql` chạy tay, idempotent và chỉ dành cho DB dev: sáu hồ sơ tác giả đủ trạng thái với bốn lịch sử duyệt, tám chủ đề và mười hai thẻ; không phải Flyway migration và không chạy production. Script kiểm tra email admin trước khi ghi, lỗi thì rollback toàn bộ; `docs/RUNBOOK.md` ghi lệnh cho Docker Compose và container riêng bằng chính `POSTGRES_USER`/`POSTGRES_DB` trong container.
- Xóa các rule chỉ còn phục vụ Admin sau khi task đạt. Nếu `styles/pages/admin.css` vẫn chứa rule `.application-row`/`.applications-actions` mà `AuthorBlogsPage` đang dùng thì giữ nguyên các rule đó và file/import tương ứng như lớp tương thích; không di chuyển, đổi selector hoặc đổi giao diện Author trong task này.

#### Quy tắc nghiệp vụ và mã lỗi — ngoại lệ API avatar Task 6

| Endpoint / DTO | Trường và ràng buộc | HTTP / mã lỗi | Câu hoặc cách hiển thị |
|---|---|---|---|
| `GET /api/v1/admin/users` — `AdminUserSummaryResponse` | `avatarUrl`: chuỗi nullable, lấy nguyên giá trị `User.avatarUrl`; không thêm validation hay biến đổi URL | `200`; lỗi auth giữ nguyên `401 AUTH_ACCESS_TOKEN_REQUIRED`/`AUTH_INVALID_ACCESS_TOKEN`, `403 ACCESS_DENIED` | Có URL thì hiển thị ảnh; null/ảnh lỗi thì `UserAvatar` dùng chữ cái. Lỗi giữ thông điệp hiện tại, không thêm mapping/copy mới |
| `GET /api/v1/admin/author-applications` — `AdminAuthorApplicationSummaryResponse` | `avatarUrl` cùng quy tắc trên | `200`; lỗi auth như trên | Hàng danh sách hiển thị avatar thật hoặc fallback chữ cái; lỗi giữ thông điệp hiện tại |
| `GET /api/v1/admin/author-applications/{id}` — `AdminAuthorApplicationDetailResponse` | `avatarUrl` cùng quy tắc trên | `200`; `404 AUTHOR_APPLICATION_NOT_FOUND`; lỗi auth như trên | Sheet chi tiết hiển thị avatar thật hoặc fallback; lỗi giữ thông điệp hiện tại |

Không endpoint nào nhận trường mới; không có validation client mới. Test frontend dẫn chiếu fallback/URL ở bảng trên, test backend kiểm đúng `avatarUrl` trong ba response.

#### Xong khi — Task 6

- [x] Toàn bộ route Admin hiện hữu dùng primitive/token mới theo hướng sinh động đã duyệt; phần của tính năng chưa có đã bỏ; loading/empty/error và số kết quả có đủ.
- [x] Sidebar Admin có icon tone và Cài đặt thu gọn đúng route; Dashboard chỉ dẫn tới chức năng thật. Bulk select Users có Checkbox/thanh nổi; ba xác nhận Admin dùng AlertDialog, không còn `window.confirm` trong ba trang.
- [x] Review hồ sơ tác giả, taxonomy và user status giữ nguyên request/payload/quyền/route; thay đổi response chỉ gồm `avatarUrl` của ba DTO theo bảng API trên.
- [x] Avatar thật/fallback, tìm động debounce 300 ms có chặn response cũ và chuyên môn dạng chip được test ở frontend; `AdminUserIntegrationTest` và `AdminAuthorApplicationIntegrationTest` kiểm `avatarUrl` của ba response.
- [x] Pagination giữ nguyên API/hình thức hiện tại và các caller Admin hoạt động; `EmptyState`, Skeleton, Sheet và Dialog được dùng ở consumer thật.
- [x] Seed dev idempotent, rollback khi email admin sai, không phải migration; RUNBOOK có lệnh Compose/container riêng và báo cáo chỉ đếm bản ghi seed.
- [x] Không còn rule/import Admin mồ côi; `admin.css` chỉ giữ `.application-row`/`.applications-actions` có consumer ở `AuthorBlogsPage`. `author.css`, `blogs.css`, `moderator.css` vẫn được giữ tại thời điểm kết thúc Task 6.
- [x] Trong `app/`, `npx vitest run src/components/layout/Sidebar.test.tsx src/StaffPreferences.test.tsx src/pages/Admin src/lib/utils.test.ts src/components/ui` đạt 96/96 và `npm run build` đạt; trong `server/`, `AdminUserIntegrationTest` + `AdminAuthorApplicationIntegrationTest` đạt 58/58. Không chạy full suite.
- [ ] Kiểm bằng mắt dark/light desktop cho các trang Admin và mobile cho danh sách đã đạt; avatar qua backend thật và Badge số kết quả sau sửa chưa kiểm lại. (chưa kiểm — xem log)

### Task 7a — Đăng ký Tác giả/Author (`AuthorApplyPage`)

- Chuyển `/author/apply` sang shadcn/Tailwind và thống nhất thuật ngữ hiển thị: tiếng Việt là **“Tác giả”**, tiếng Anh là **“Author”**. Sửa link/tooltip Author đang viết cứng trong `Sidebar.tsx`; kicker dùng chung của `AuthorBlogsPage` đổi theo prop `language`; câu tiếng Việt ở `ModeratorDashboardPage` dùng “tác giả”. Không redesign hai trang hoãn. Các màn Admin và `managementI18n.ts` đã trả đúng “Tác giả”/“Author” nên không sửa. Giữ nguyên tên kỹ thuật `AUTHOR`, route, quyền `LEARNER`, ba endpoint `GET/POST/PATCH`, request/payload, validation và quy tắc chỉ `NOT_APPLIED`/`REJECTED` được gửi form.
- Claude được **chủ động sáng tạo UI** để màn này sinh động, có thẩm mỹ và đồng bộ hướng Admin đã được người dùng duyệt; không chỉ thay primitive. Có thể tự quyết định tỷ lệ hai vùng desktop, thứ tự khối, icon Lucide, Card/Badge tone, đường dẫn thị giác, viền/độ sâu và micro-interaction CSS/Tailwind nhẹ. Trên mobile phải xếp dọc, thứ tự nội dung dễ hiểu và không cuộn ngang.
- Hướng nội dung bắt buộc: một vùng giới thiệu/hero ngắn giúp người dùng hiểu giá trị và quy trình đăng ký; một vùng làm việc chứa form hoặc trạng thái hiện tại. Dùng phân cấp chữ rõ, khoảng thở, icon và màu tone có chủ đích; được thêm copy trình bày ngắn cho cả vi/en nhưng không bịa số liệu, cam kết xét duyệt, quyền lợi, tính năng hay điều kiện nghiệp vụ.
- Không dùng gradient, ảnh ngoài, minh họa sao chép, emoji, nút chết hoặc CTA sang chức năng bài viết. Không thêm upload chứng chỉ, bước form, progress nghiệp vụ hay trường mới; ba trường duy nhất vẫn là `bio`, `expertise`, `portfolioUrl` với giới hạn hiện tại. Chuyên môn tiếp tục là native select và phải giữ lựa chọn đã lưu không nằm trong danh sách tĩnh.
- Với 22 chuyên môn tĩnh, giữ **value tiếng Việt hiện tại** làm giá trị gửi/lưu để không tạo dữ liệu lẫn ngôn ngữ; khi giao diện tiếng Anh chỉ dịch label của option và cách hiển thị value đã biết. Giá trị cũ/tự do không có trong bảng ánh xạ phải hiển thị nguyên văn, không tự dịch và không thay đổi khi gửi lại. Admin tiếp tục đọc chuỗi đã lưu, không sửa dữ liệu hoặc `managementI18n.ts`.
- Thiết kế riêng cho đủ năm trạng thái từ `GET /api/v1/author-profiles/me`: `NOT_APPLIED` hiển thị form mới; `PENDING` trình bày hồ sơ đã gửi và trạng thái chờ; `APPROVED` trình bày kết quả được duyệt; `REJECTED` làm nổi lý do/lần duyệt và hiển thị form prefill để gửi lại; `SUSPENDED` trình bày lý do/thời gian đình chỉ, không thêm hành động khi chưa có API.
- Chỉ mở rộng **type frontend** trong `profileService.ts` để phản ánh đúng response backend đã có: profile thêm `reviewedAt`, `suspensionReason`, `suspendedAt`, `restorationNote`, `restoredAt`, `createdAt`, `updatedAt`; response thêm `reviewHistory[]` gồm `decision`, `reviewNote`, `applicationVersion`, ba snapshot `bio/expertise/portfolioUrl` và `reviewedAt`. Không đổi hàm request, endpoint hoặc backend.
- Lịch sử xét duyệt hiển thị dạng timeline/card, giữ thứ tự mới nhất trước như API trả về, có quyết định, thời gian, phiên bản và ghi chú/snapshot cần thiết để người nộp hiểu lần nào bị từ chối hoặc được duyệt; tuyệt đối không hiển thị hay suy đoán danh tính admin. Lịch sử rỗng thì không dựng khối rỗng gây nhiễu.
- Loading dùng Skeleton phù hợp bố cục; lỗi tải có `role="alert"` và nút thử lại; lỗi gửi/success giữ semantics trợ năng hiện tại. Khi POST/PATCH trả **409**, hiển thị câu chung vi/en “Hồ sơ đã thay đổi”/“The application has changed”, tự gọi lại `GET /api/v1/author-profiles/me` và thay form/trạng thái bằng dữ liệu mới từ server. Với 403, lỗi khác hoặc lỗi mạng, hiển thị cảnh báo chung đúng ngôn ngữ và giữ dữ liệu người dùng đã nhập; không mở rộng `ApiError` hay phân loại theo error code trong task này. Control có label nhìn thấy, focus ring, disabled/loading rõ và vùng bấm đạt quy tắc của module.
- Truyền `language` hiện tại từ `App.tsx` cho trang để toàn bộ copy nhìn thấy trên AuthorApply — form, trạng thái, ngày giờ, timeline và thông báo — đổi đúng vi/en. Warning tải/gửi/validation phải ngắn, chung, không lộ lỗi kỹ thuật hoặc nguyên văn thông báo sai ngôn ngữ; không đổi error contract phía backend.
- Sau khi Admin duyệt hồ sơ ở phiên khác, người dùng đang tại `/profile` bấm refresh phải đi qua luồng khôi phục session hiện có, nhận profile/claim mới có `AUTHOR` và thấy link Tác giả/Author trỏ `/author/blogs` thay vì `/author/apply`, không cần đăng nhập lại. Giữ nguyên route `/profile` sau refresh; yêu cầu là cập nhật shell/quyền theo role mới, không tự điều hướng người dùng.
- Sau khi task đạt, xóa `styles/pages/author.css` và import của nó vì grep xác nhận file này chỉ phục vụ `AuthorApplyPage`. Không đụng `AuthorBlogsPage`, `admin.css`, `blogs.css`, `moderator.css`, `TagPicker`, `MarkdownContent`, `Pagination` hoặc CSS còn consumer của luồng bài viết.

#### Xong khi — Task 7a

- [ ] `/author/apply` có giao diện shadcn/Tailwind mới sinh động, phân cấp thị giác rõ và responsive; dark/light desktop cùng mobile không cuộn ngang, không dùng gradient/ảnh ngoài/nút chết/dữ liệu giả.
- [ ] Cả năm trạng thái `NOT_APPLIED`, `PENDING`, `APPROVED`, `REJECTED`, `SUSPENDED` hiển thị đúng dữ liệu và hành động được phép; `REJECTED` prefill/gửi lại với `expectedVersion`, còn `PENDING`/`APPROVED`/`SUSPENDED` không gửi form.
- [ ] Form giữ đúng ba field và validation/API hiện tại; option tiếng Anh chỉ đổi label, value gửi/lưu vẫn là tiếng Việt; chuyên môn cũ ngoài bảng ánh xạ vẫn hiển thị nguyên văn và không bị đổi khi gửi lại.
- [ ] Lý do, timestamps và timeline `reviewHistory` mới nhất trước hiển thị rõ khi có dữ liệu, không lộ reviewer; type `AuthorProfile` khớp response backend hiện có và không sửa backend.
- [ ] Loading/error/retry/success, label/focus/disabled và copy mới vi/en đúng semantics trợ năng; 409 tự tải lại trạng thái server, còn 403/lỗi khác giữ dữ liệu form; vùng bấm đạt ≥44px khi `pointer-coarse`.
- [ ] Sau khi hồ sơ được Admin duyệt, refresh tại `/profile` đồng bộ token/profile có role `AUTHOR`, giữ nguyên `/profile`, đổi link sidebar sang `/author/blogs` và không yêu cầu đăng nhập lại.
- [ ] Không còn `author.css`, import hoặc selector chỉ phục vụ AuthorApply; `AuthorBlogsPage`, Blogs, Moderator và lớp CSS tương thích của luồng bài viết không đổi.
- [ ] Trong `app/`, `npx vitest run src/pages/Author/AuthorApplyPage.test.tsx src/components/layout/Sidebar.test.tsx src/App.author-session.test.tsx src/pages/Author/AuthorBlogsPage.test.tsx` đạt với khoảng 5 luồng chính của AuthorApply (có thể gom năm trạng thái bằng test tham số) và regression refresh phân quyền/copy thuật ngữ; `npm run build` đạt. Không chạy full `npm test` hoặc backend.
- [ ] Kiểm bằng mắt `/author/apply` dark/light desktop và một mobile, gồm trạng thái form và một trạng thái đã nộp phức tạp như `REJECTED`; thiếu môi trường phải ghi chính xác “chưa kiểm” trong log. Năm trạng thái được kiểm bằng test tự động, không bắt buộc chụp đủ năm.

### Task 7b — Dọn CSS ngoài luồng bài viết và hoàn tất phạm vi module

- Tiếp tục **không bật Tailwind preflight** vì các trang của luồng bài viết chưa chuyển vẫn phụ thuộc reset/style legacy; việc bật preflight chỉ thực hiện trong module `article-flow` sau khi mọi consumer còn lại đã chuyển xong.
- Sửa comment chuyển tiếp trong `styles.css` để không còn ghi preflight sẽ bật ở Task 7b; comment phải trỏ đúng việc bật/dọn cuối trong `article-flow`.
- Giữ các reset chuyển tiếp trong `styles.css` đang thay vai trò preflight cho component shadcn; chỉ xóa chúng trong module hoãn hoàn tất sau cùng, sau khi preflight được bật và kiểm regression toàn frontend.
- Xóa import/file/rule CSS legacy không còn consumer ngoài luồng bài viết. Giữ lớp tương thích tối thiểu cho `AuthorBlogsPage`, `BlogsPage`, `BlogDetailPage`, `ModeratorDashboardPage`, `ModeratorArticlesPage`, `TagPicker`, `MarkdownContent` và `Pagination`: `base.css`, `layout/shell.css`, `components/controls.css`, `components/forms.css`, phần markdown/TagPicker/Pagination trong `components/content.css`, `pages/moderator.css`, `pages/blogs.css`, cùng phần `.application-row`/`.applications-actions` trong `pages/admin.css` nếu vẫn còn consumer trực tiếp. `pages/author.css` đã xóa ở Task 7a.
- Chuyển shadcn token thành canonical; chỉ giữ alias/token cũ còn được lớp tương thích luồng bài viết tham chiếu. Xóa `app/scripts/verify-css-split.mjs` vì không còn dùng để bảo toàn toàn bộ inventory CSS cũ.
- Xóa dependency `framer-motion` sau khi Sidebar/Home đã thay animation và grep không còn import; Auth không phải consumer.
- Quét và loại mọi literal màu ngoài token, `window.alert`, class/selector CSS legacy và import CSS trang **ngoài allowlist tương thích luồng bài viết nêu trên**. `window.confirm` trong `ModeratorArticlesPage` được giữ nguyên tới `article-flow`, không đặt tiêu chí toàn repo bằng 0 ở task này.

#### Xong khi — Task 7b

- [ ] Tailwind preflight vẫn chưa được nạp và reset chuyển tiếp cần thiết trong `styles.css` vẫn còn; dark mặc định/light tùy chọn, focus, form, markdown và responsive của các trang đã chuyển không regression.
- [ ] `find src/styles/pages -type f ! -name 'admin.css' ! -name 'blogs.css' ! -name 'moderator.css' -print` chạy trong `app/` không có kết quả; nếu `admin.css` còn thì chỉ chứa rule có consumer trực tiếp ở `AuthorBlogsPage`.
- [ ] `rg -n --glob '*.{css,ts,tsx}' --glob '!styles/tokens.css' '(#[0-9A-Fa-f]{3,8}\b|(?:rgb|hsl|oklch|oklab|lab|lch|color)\()' src` không có kết quả màu literal.
- [ ] `rg -n 'window\.alert\(' src` không có kết quả; `rg -n 'window\.confirm\(' src` chỉ còn kết quả đã biết trong `ModeratorArticlesPage` thuộc module `article-flow`.
- [ ] Không còn token cũ/class legacy không được tham chiếu ngoài lớp tương thích luồng bài viết; `scripts/verify-css-split.mjs` và dependency/import `framer-motion` đã xóa.
- [ ] Toàn bộ route trong bảng ánh xạ dùng component/token mới, giữ hành vi/route/API/copy vi/en; `/author/blogs`, `/blogs`, `/blogs/:id`, `/moderator`, `/moderator/articles` vẫn hoạt động với giao diện cũ, không bị cleanup làm hỏng.
- [ ] Trong `app/`, các test liên quan đến hạ tầng dùng chung bị sửa ở cleanup — tối thiểu `src/theme-bootstrap.test.ts`, `src/styles/tokens.test.ts`, `src/components/ui/focus.test.ts`, `src/components/ui/labels.test.tsx` và test của file trực tiếp bị sửa trong Task 7b — đạt bằng `npx vitest run <các file>`; `npm run build` đạt. Không chạy full `npm test` hoặc backend theo quyết định 2026-11-03/D-021.
- [ ] Kiểm bằng mắt dark/light desktop cho một route đại diện mỗi nhóm và mobile cho shell/form/list; smoke-check thêm `/author/blogs`, `/blogs`, `/blogs/:id`, `/moderator/articles` ở giao diện cũ để bắt regression do cleanup, không đánh giá lại thiết kế các trang hoãn. Thiếu môi trường ghi rõ route nào “chưa kiểm”.

## Ngoài phạm vi

- Không sửa `server/`, DB, API hoặc hợp đồng request/response, ngoài đúng ngoại lệ `avatarUrl` trong ba DTO response Admin và hai service mapper/test đã hoàn tất ở Task 6; không thêm migration hay đổi schema. Task 7a chỉ đồng bộ type frontend với response Author đã tồn tại.
- Không thêm chức năng, route, field nghiệp vụ hoặc quyền. Ngoại lệ trình bày: copy vi/en ngắn và các khối Admin/AuthorApply đã mô tả; copy cấu trúc tối thiểu cho ba AlertDialog Admin. Ngoại lệ dữ liệu dev: chỉ `scripts/dev-seed-admin.sql` chạy tay theo Task 6, không phải dữ liệu production/migration.
- Không đổi bảng màu D-010, dark mặc định D-013 hoặc font Inter D-014.
- Không migrate hoặc đổi thiết kế `/author/blogs`, `/blogs`, `/blogs/:id`, `/moderator`, `/moderator/articles`, `TagPicker`, `MarkdownContent`, wrapper `Pagination` dùng chung và CSS còn phục vụ các màn này; toàn bộ luồng bài viết ba vai trò thuộc module `article-flow` riêng.
- Không bật Tailwind preflight hoặc xóa lớp CSS legacy còn consumer của luồng bài viết; việc bật preflight và dọn legacy cuối thuộc `article-flow`.
- Không sao chép logo, chữ, ảnh hoặc code từ javabuilder.online.
- Không thêm thư viện form, validation schema, animation/UI thứ hai ngoài dependency được chốt trong spec.

## Ràng buộc

- Được đổi API: Chỉ mở rộng response bằng `avatarUrl` nullable trong ba DTO Admin theo bảng Task 6; không đổi request/payload/route/quyền. Được đổi DB (Flyway mới): Không.
- Giữ nguyên hành vi hiện tại: Có; chỉ thay hệ giao diện/cấu trúc CSS và thay API trình bày cũ (`dialog`, `confirm`) bằng component tương đương.
- Bám [`docs/design/UI_GUIDE.md`](../docs/design/UI_GUIDE.md) sau khi tài liệu được viết lại trong Task 1 và [`docs/design/javabuilder-patterns.md`](../docs/design/javabuilder-patterns.md).
- Mỗi task chỉ xóa CSS của trang vừa chuyển sau khi test/build đạt; không dọn trước CSS của trang chưa chuyển và không xóa rule dùng chung còn consumer của luồng bài viết.
- Không sửa logic nghiệp vụ trong `components/ui/*`; composite theo nghiệp vụ đặt ngoài `ui/`. Variant Badge `tone` chỉ là API trình bày.
- Không chạy `shadcn add --overwrite` lên primitive đã review ở Task 1; component thêm sau phải giữ quy ước label qua prop, focus ring đặc và token màu đã chốt.
- Test bám role/label/state; chỉ sửa assertion class cũ khi class đó không còn là hợp đồng. Mỗi task chỉ chạy file test của component/trang bị sửa và nơi dùng trực tiếp bằng `npx vitest run <file...>`, cộng `npm run build` một lần; không chạy full `npm test` hoặc `scripts/verify.sh`. Ngoại lệ Task 6 chạy đúng hai lớp backend `AdminUserIntegrationTest` và `AdminAuthorApplicationIntegrationTest` do sửa DTO/service response; không chạy full backend.
- Mỗi task kiểm dark/light desktop bằng Chrome; nếu không có môi trường phải ghi “chưa kiểm”, không suy diễn là đã đạt.
- Sau mỗi task được người dùng nhận, tạo commit WIP cục bộ `wip(ui-foundation-v2): Task n`; khi toàn bộ module, gồm Task 7b và review cuối, hoàn tất thì squash các WIP thành một commit cuối.
- Task 3 và Task 4 thực hiện liên tiếp trong cùng một session nhưng vẫn giữ hai nhóm “Xong khi” và kiểm chứng riêng. Task 2 dùng adversarial review; các task còn lại dùng review thường. Mỗi task/review vẫn tuân giới hạn hai vòng.

## Quyết định thiết kế đã chốt

1. Control desktop theo mặc định shadcn 36px; với `pointer-coarse`, vùng bấm/nút điều hướng tối thiểu 44px.
2. Không dùng gradient; card nổi bật dùng nền đặc theo tone.
3. Không thêm `sonner` trong module này; toast tách module sau nếu cần.
4. Dùng shadcn Sidebar, controlled bằng state/localStorage TechVerse như Task 2.
5. Danh sách Admin dùng hàng trong Card; thiết kế danh sách Moderator được quyết định trong `article-flow`, không triển khai ở module này.
6. Primitive shadcn Pagination đã sinh ở Task 1; hoãn việc bọc wrapper `Pagination` dùng chung sang `article-flow` để không đổi gián tiếp các màn bài viết trong module này.
7. Gỡ `framer-motion` sau Task 5 khi Sidebar và Home đã chuyển sang transition/animation Tailwind-shadcn.
8. Thêm `EmptyState` composite ngoài `components/ui/` ở Task 5, dùng tiếp trong Task 6.
9. Không làm UI kit/dev route. `JWT_SECRET_KEY` hiện tại đã được xác nhận là Base64 hợp lệ, 32 byte/256 bit; thử chạy server dev từ Task 2 để kiểm bằng mắt, nếu môi trường khác lỗi thì ghi đúng nguyên nhân.
10. Task 3 và Task 4 chạy trong cùng một session; Task 2 dùng adversarial review, các task khác dùng review thường.
11. Commit WIP cục bộ sau mỗi task được người dùng nhận; squash thành một commit cuối khi toàn bộ module hoàn tất.
12. Đưa `AuthorApplyPage` trở lại Task 7a; chỉ `AuthorBlogsPage` và `TagPicker` theo Author sang `article-flow`.
13. Tách `BlogsPage`, `BlogDetailPage`, `MarkdownContent`, wrapper `Pagination` và toàn bộ nội dung Moderator sang `article-flow`; Task 7b giữ preflight tắt và lớp tương thích cho các màn này.
14. Admin và AuthorApply được trình bày sinh động bằng khối/copy ngắn vi/en gắn với dữ liệu thật; bỏ phần của tính năng chưa có. Task 7a cho Claude tự do sáng tạo trong các ranh giới thiết kế và nghiệp vụ đã ghi; thuật ngữ người dùng là “Tác giả” ở tiếng Việt và “Author” ở tiếng Anh.
15. Tìm động Admin dùng debounce 300 ms và chặn response cũ; chuyên môn hồ sơ tác giả ở Admin hiển thị dạng chip. Task 6 được mở đúng ngoại lệ `avatarUrl` trong ba DTO Admin và seed dev idempotent chạy tay theo RUNBOOK.

## Xong khi

Module chỉ hoàn tất khi Task 1–6, Task 7a và Task 7b đều đạt “Xong khi”, các quyết định thiết kế đã chốt được thực hiện và chỉ còn nhóm trang hoãn thuộc **luồng bài viết ba vai trò**. Tiêu chí tổng không thay thế kiểm chứng riêng của từng task.

- [ ] Toàn bộ route/trang trong bảng đã ánh xạ dùng shadcn/ui + Tailwind/token mới, giữ hành vi, route, API và copy vi/en.
- [ ] Không còn CSS trang/legacy ngoài allowlist tương thích luồng bài viết, literal màu ngoài token, `window.alert` hoặc dependency bị quyết định gỡ; `window.confirm` chỉ còn ở Moderator và preflight vẫn tắt đến khi `article-flow` hoàn tất.
- [ ] Dark mặc định/light tùy chọn đúng bảng màu, Inter duy nhất, tương phản và focus đạt; responsive không cuộn ngang.
- [ ] Các file test frontend liên quan đã ghi tại từng task và `npm run build` đạt; không task nào yêu cầu full `npm test`/full backend, ngoại lệ Task 6 chỉ chạy hai lớp integration bị ảnh hưởng bởi `avatarUrl`.

## Quyết định của người dùng

- 2026-11-02: Chốt spec UI foundation v2. Câu 1: A (36px desktop, ≥44px khi `pointer-coarse`); câu 2: A (không gradient); câu 3: B (chưa toast, tách module sau); câu 4: A (shadcn Sidebar); câu 5: A (hàng trong card); câu 6: B (shadcn pagination bọc sau `Pagination`); câu 7: A (gỡ framer-motion sau Task 5).
- Nhận đề xuất `EmptyState` (composite ngoài `components/ui/`, thêm ở Task 5, dùng tiếp Task 6). Không làm UI kit; kiểm bằng mắt từng task qua server dev.
- Theme sáng: chữ tone `amber`/`green` dùng bậc 800 để có biên tương phản.
- Giao Claude thực hiện, bắt đầu Task 1.
- 2026-11-03 sau Task 1: không commit từng task, chỉ commit một lần khi hoàn tất module; Task 3 + Task 4 chạy cùng session; chỉ Task 2 dùng adversarial review.
- Logo đổi sang asset Cloudinary public ID `techverse/brand/logo`; Task 2 chỉ ghép bản đầy đủ/icon vào shell, `app/index.html` dùng cùng master cho favicon. Không commit file ảnh nguồn lớn.
- Quyết định cũ từng để Task 7a chỉ còn Moderator và Task 7b dọn CSS ngoài Author/Blogs đã được thay bởi quyết định ngày 2026-11-03 ở cuối mục này.
- Đính chính: `JWT_SECRET_KEY` hiện tại hợp lệ (Base64 chuẩn, 32 byte/256 bit); không cần người dùng sửa trước Task 2, chỉ cần xác nhận bằng lần chạy server dev.
- 2026-11-03: Vòng review 2 của Task 3+4 dùng `/code-review` thay lượt Codex bị dừng; sửa 8/9 phát hiện để ổn định, gồm ba bug sidebar thuộc Task 2. Phát hiện #9 về logo Cloudinary khi offline được ghi “Ngoài phạm vi”.
- 2026-11-03: Từng tách `AuthorApplyPage`, `AuthorBlogsPage`, `TagPicker` và phần Blogs khỏi module; quyết định này được thay một phần bởi D-027 bên dưới.
- 2026-11-03 sau khi nhận Task 6: Admin dùng hướng trình bày sinh động đã duyệt, bỏ phần của tính năng chưa có; sidebar Admin/Moderator có icon tone và Cài đặt thu gọn; tìm động debounce/chặn response cũ; chuyên môn dạng chip; avatar thật qua `avatarUrl` trong ba DTO Admin; dữ liệu kiểm dev dùng `scripts/dev-seed-admin.sql` idempotent theo RUNBOOK.
- 2026-11-03 — Kết luận 1/5: Task 7a làm `AuthorApplyPage` sinh động với đủ năm trạng thái/lịch sử; vi dùng “Tác giả”, en dùng “Author”, tên kỹ thuật `AUTHOR` giữ nguyên; ba copy cố định ở Sidebar/AuthorBlogs/Moderator được sửa đúng ngôn ngữ nhưng hai trang hoãn không redesign.
- 2026-11-03 — Kết luận 2/5: 22 chuyên môn giữ value tiếng Việt, chỉ dịch label; POST/PATCH 409 báo hồ sơ thay đổi rồi GET lại, 403/lỗi khác dùng warning chung và giữ form; không mở `ApiError`/backend.
- 2026-11-03 — Kết luận 3/5: Sau Admin duyệt ở phiên khác, refresh tại `/profile` phải nhận role `AUTHOR`, sidebar trỏ `/author/blogs`, không đăng nhập lại và không tự rời `/profile`.
- 2026-11-03 — Kết luận 4/5: Test tự động bao phủ đủ năm trạng thái và regression quyền; kiểm bằng mắt form + `REJECTED`; Task 7b giữ preflight/CSS tương thích, toàn bộ luồng bài viết còn lại sang `article-flow`.
- 2026-11-03 — Kết luận 5/5: Người dùng chốt bổ sung Task 7a/7b sau phản biện vòng 2 và giao Claude bắt đầu code Task 7a.
