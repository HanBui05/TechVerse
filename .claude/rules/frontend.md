---
paths:
  - "app/**"
---

# Luật frontend (`app/`)

## Giao diện

- Task có “Đổi giao diện: Có”: bám [`docs/design/UI_GUIDE.md`](../../docs/design/UI_GUIDE.md). Chỉ nạp `ui-ux-pro-max` khi spec còn quyết định thiết kế bỏ ngỏ; spec đã chốt bố cục/màu/chữ thì bám spec.
- Không dùng `ui-styling`, `banner-design`, `brand`, `slides`, `design`. Không thêm thư viện UI/form thứ hai ngoài shadcn/ui + Tailwind (D-024).
- Ghép trang theo skill `ui-components` (danh mục primitive, mẫu bố cục, Badge tone, điều cấm).

## Ngân sách test

- **Chỉ chạy test liên quan, không full `npm test`** (người dùng chốt 2026-11-03). Liên quan = file test của component/trang bị sửa + nơi dùng trực tiếp (grep import). Cuối task: các file đó + `npm run build` một lần, song song; log ghi tên file đã chạy. Full suite chỉ khi người dùng yêu cầu; “Xong khi” ghi `npm test` thì hiểu theo luật này.
- Bảng chọn nhanh: sửa sidebar/shell/`App.tsx` → `components/layout/Sidebar.test.tsx`, `StaffPreferences.test.tsx`, `components/ui/{sidebar,labels,focus}`; sửa `components/ui/*` → `components/ui/*.test.*` + test trang dùng primitive đó. `App.auth.test.tsx` (~60 giây) chỉ chạy khi đụng Auth, `AuthLayout`, redirect hoặc định tuyến.
- Test tích hợp render cả `App` chỉ cho luồng chính: mỗi màn khoảng 5 ca (thành công, một lỗi validation, một lỗi API, regression đã biết).
- Chuỗi dài hơn 20 ký tự trong test: dùng `user.paste` hoặc `fireEvent.change`, không dùng `user.type`.
- Chạy: `cd app && npx vitest run <file...> [-t "<tên>"]`; cần chi tiết thì thêm `--reporter=verbose` ngay lần đầu.

## Kiểm bằng mắt

- Thủ tục (dev server cổng 3000, đăng nhập theo vai trò, đo bằng JS, tối đa 2 ảnh, dark/light, mobile qua iframe 390px): skill `visual-check`; môi trường ở [`docs/RUNBOOK.md`](../../docs/RUNBOOK.md).
- Không khởi động lại backend của người dùng; thiếu môi trường hoặc vai trò thì ghi “chưa kiểm” kèm nguyên nhân, không suy diễn là đạt.

## Style (shadcn + Tailwind v4)

- Ưu tiên primitive trong `src/components/ui/` (import `@/components/ui/...`), rồi utility Tailwind theo token; không viết CSS trang mới. Thiếu primitive thì `npx shadcn@latest add` khi đã có trang dùng.
- `components/ui/*` chỉ trình bày: không gọi API, route, copy hay quy tắc nghiệp vụ. Composite nghiệp vụ đặt ngoài `ui/`. Nhãn truyền qua prop.
- Màu chỉ qua token trong `app/src/styles/tokens.css`; không hex/rgb/hsl, `text-white`, `bg-black` trong component. Tone chọn bằng `toneFor`/`statusTone` (`@/lib/utils`). Không class `.dark`; `dark:` gắn với `data-theme`.
- Vùng chạm (QĐ 1A): mọi control/mục điều hướng có `pointer-coarse:min-h-11 pointer-coarse:min-w-11`, kể cả trạng thái thu gọn; primitive mới thêm vào thì giữ test quét nguồn như `ui/sidebar.test.tsx`, `ui/focus.test.ts`.
- Shell: `App` bọc trang bằng `SidebarProvider` (controlled `techverse-sidebar`); trang tự có `<main>` nên không dùng `SidebarInset`. Sidebar mới ghép bằng `SidebarFrame`/`SidebarAccount`/`activeLink` trong `components/layout/Sidebar.tsx`.
- Test bám role/label/state, không assert class Tailwind (ngoại lệ: test quét nguồn cho QĐ a11y); Radix cần polyfill trong `src/test/setup.ts`.

## Giai đoạn chuyển (preflight tắt, tới Task 7b của `ui-foundation-v2`)

- CSS legacy unlayered thắng mọi utility. Không thêm CSS unlayered chạm element trần (`a`, `button`, `ul`…): `base.css` đã nạp vào `layer(base)` vì `a { color: inherit }` từng đè màu utility trên link.
- Primitive shadcn dựa vào reset `[data-slot]` cuối `styles.css` (border, nút, `ul`, margin `h1–h4/p`); xóa khi bật preflight.
- Trang đã chuyển: `<main>` có class `tw-page` (bỏ `letter-spacing`/margin của `base.css` và margin UA cho `h1–h4/p`). Phần tử không `data-slot` dùng `border*` phải kèm `border-border` (không thì viền lấy màu chữ). Chữ lỗi dùng `text-danger`, không `text-destructive` (~3:1 trên nền tối).
- Class legacy trùng tên utility: đổi sang utility hoặc prefix `legacy-` trước khi dùng utility đó. Sửa CSS legacy: kiểm các class cùng nằm trên một phần tử vì đổi thứ tự nạp làm đổi cascade.
