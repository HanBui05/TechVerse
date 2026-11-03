# UI Guide

Nguồn chuẩn cho mọi task có “Đổi giao diện: Có”. TechVerse dựng giao diện bằng **shadcn/ui + Tailwind CSS v4** (D-024). Màn mới chọn một mẫu trong [`javabuilder-patterns.md`](javabuilder-patterns.md) trước; chỉ thiết kế riêng khi không mẫu nào phù hợp. Chỉ lấy bố cục, tỷ lệ, công thức màu của javabuilder.online; không lấy logo, chữ, ảnh hay code.

Danh mục component, ví dụ ghép trang và điều cấm chi tiết: skill [`ui-components`](../../.claude/skills/ui-components/SKILL.md).

## Nền tảng

- Tailwind v4 cấu hình bằng CSS (`app/src/styles.css`: `@import` + `@theme inline`), **không** có `tailwind.config.js`.
- shadcn style `new-york`, base Radix (gói hợp nhất `radix-ui`), icon `lucide-react`, primitive ở `app/src/components/ui/`, alias `@/*` → `src/*`.
- Ghép class bằng `cn` (gói `cn`, thay `clsx` + `tailwind-merge`).
- Thêm primitive: `npx shadcn@latest add <tên>` trong `app/`, **chỉ khi có trang dùng**. Sau khi add, gỡ mọi khối `:root`/`.dark` CLI tự chèn vào `styles.css` và đưa token vào `tokens.css`.
- Giai đoạn chuyển (tới khi module `article-flow` chuyển xong luồng bài viết): chỉ nạp theme + utilities, **chưa bật preflight**; CSS legacy vẫn chạy và (không nằm trong layer) thắng utility khi trùng thuộc tính.

## Theme và token

- Tối là mặc định (không có thuộc tính); sáng là `data-theme='light'` trên `<html>`, lưu localStorage `techverse-theme`. **Không dùng class `.dark`.** Biến thể `dark:` của Tailwind đã khai báo theo `:root:not([data-theme='light'])`.
- Mọi giá trị màu nằm trong `app/src/styles/tokens.css`; component/trang chỉ dùng utility theo token (`bg-card`, `text-muted-foreground`, `border-border`, `bg-tone-blue-bg`…). Không viết hex/rgb/hsl, không `text-white`/`bg-black`.
- Token shadcn là nguồn chuẩn: `background`, `foreground`, `card`, `popover`, `primary` (`#0056d2`, D-010), `secondary`, `muted`, `muted-foreground`, `accent`, `destructive`, `border`, `input`, `ring`, `sidebar-*`. Bổ sung: `accent-text` (chữ/icon/link nhấn), `success`, `warning`, `info`, `violet`, `rose`, `scrim` (nền phủ dialog/sheet), `code-*`.
- `--muted` là **nền** (theo shadcn), chữ phụ dùng `muted-foreground`.
- Token cũ (`--bg`, `--surface`, `--surface-2`, `--text`, `--on-primary`) chỉ là alias tới token shadcn để CSS legacy chạy tiếp; code mới không dùng.
- Font: Inter duy nhất (D-014). Bán kính chuẩn `--radius` .625rem.
- Test `app/src/styles/tokens.test.ts` đo tương phản từ token thật; đổi token phải giữ test xanh (≥ 4.5:1).

## Badge `tone`

Tám tone: `blue`, `green`, `purple`, `amber`, `rose`, `sky`, `cyan`, `slate`. Tối: nền bậc 900 ở 25%, chữ bậc 300, viền 300 ở 30%. Sáng: nền 100, chữ 700 (green/amber 800), viền 200.

- Chủ đề/danh mục/tag: `toneFor(tên)` trong `@/lib/utils` (băm tên ổn định, không ra `slate`).
- Trạng thái: `statusTone(mã)` — xanh lá đã xong/duyệt, hổ phách chờ, sky yêu cầu sửa, hồng từ chối/gỡ/đình chỉ, slate trung tính.
- `<Badge tone={toneFor(topic.name)}>`; không tự gán màu ở từng trang.

## Kích thước và thang chữ

| Thành phần | Quy định | Utility |
|---|---|---|
| Vùng nội dung | tối đa 1280px, lề ngang 24–32px | `mx-auto max-w-7xl px-6 lg:px-8` |
| Khoảng cách khối | 24px (trang app) / 32px (lưới lớn) | `gap-6` / `gap-8` |
| Card lớn / card trong lưới | bo 18px / 10px | `rounded-2xl` / `rounded-lg` |
| Control | cao 36px; màn cảm ứng vùng bấm ≥ 44px | mặc định shadcn; Button đã có `pointer-coarse:min-h-11 min-w-11` |
| Sidebar | 256px; mobile Sheet 320px | shadcn `sidebar` |

| Vai trò | Cỡ/dòng · đậm | Utility |
|---|---|---|
| H1 hero | 48/48 · 700 | `text-5xl font-bold` |
| H1 bài viết | 30/37.5 · 700 | `text-3xl font-bold` |
| H1 trang app | 24/32 · 700 | `text-2xl font-bold` |
| H2 | 20 · 700 | `text-xl font-bold` |
| Tiêu đề card lưới | 16 · 700, tối đa 2 dòng | `text-base font-bold line-clamp-2` |
| Tiêu đề khối | 14 · 600 | `text-sm font-semibold` |
| Nội dung, ô nhập | 14 · 400 | `text-sm` |
| Meta | 12 · 400, muted | `text-xs text-muted-foreground` |
| Nhãn trường | 11 · 600, in hoa, giãn .05em | `text-[11px] font-semibold uppercase tracking-[.05em]` |

## Phong cách

- Không gradient (quyết định 2); card nổi bật dùng nền đặc theo tone. Nút chính `primary` đặc, không đổ bóng phát sáng; chữ nhấn là một màu đặc `accent-text`.
- Đã bỏ khỏi trang chủ: “Featured content”, “Khóa học nổi bật”, khu community (D-015/D-016) — không khôi phục.
- Chưa có toast (`sonner`) — tách module sau; danh sách Admin/Moderator là hàng trong Card, không dùng Table.

## Khung trang và mẫu

- Khung: shadcn Sidebar trái thu gọn được, mobile là Sheet; ba vai trò User/Admin/Moderator ghép menu riêng ngoài primitive (`components/layout/`).
- Mẫu (chi tiết số đo ở `javabuilder-patterns.md` mục 4): đầu trang 4.1, card bộ lọc 4.2, lưới card 4.3, chi tiết hai cột 4.4, hàng trong card 4.5, hồ sơ/cài đặt hai cột 4.6, tiêu đề khu vực 4.7.

## Trạng thái bắt buộc

Mọi màn có dữ liệu phải có: đang tải (`Skeleton`), rỗng (`EmptyState`), lỗi. Xác nhận nguy hiểm dùng `AlertDialog`, không `window.confirm`/`alert`.

## Kiểm tra trước khi giao

Tương phản chữ ≥ 4.5:1; vùng bấm ≥ 44×44px trên màn cảm ứng; không chỉ dựa vào hover; icon SVG `lucide-react`, không emoji; không cuộn ngang trên mobile; có focus ring (`ring`); kiểm dark và light.
