---
name: ui-components
description: Danh mục component shadcn/ui của TechVerse, mẫu bố cục, Badge tone, ví dụ ghép trang và điều cấm. Dùng khi dựng hoặc chuyển một trang/component trong app/ sang shadcn + Tailwind v4.
---

# UI components TechVerse

Nguồn chuẩn: [`docs/design/UI_GUIDE.md`](../../../docs/design/UI_GUIDE.md) (token, thang chữ) và [`docs/design/javabuilder-patterns.md`](../../../docs/design/javabuilder-patterns.md) (số đo mẫu). Skill này chỉ là bản tra nhanh khi ghép trang.

## Danh mục primitive (`@/components/ui/*`)

| Component | Dùng cho |
|---|---|
| `button` | Mọi hành động; `variant` default/outline/secondary/ghost/destructive/link, `size` default/sm/lg/icon |
| `input`, `label`, `textarea` | Form, ô lọc, ghi chú |
| `native-select` | Mọi select chữ đơn giản (giữ `<select>` gốc, test dùng `user.selectOptions`) |
| `checkbox` | Chọn nhiều |
| `card` | Khung nội dung, bộ lọc, hàng danh sách (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`) |
| `badge` + `tone` | Chủ đề/tag/trạng thái/số liệu |
| `avatar` | Ảnh người dùng (bọc trong `UserAvatar`) |
| `separator` | Ngăn cách trong card/sidebar |
| `breadcrumb` | Chỉ Blog detail |
| `dialog`, `alert-dialog` | Modal; xác nhận nguy hiểm (thay `window.confirm`) |
| `popover`, `calendar` | Chọn ngày (vẫn cho gõ `dd/mm/yyyy`) |
| `tooltip` | Icon button, sidebar thu gọn (cần `TooltipProvider` ở shell) |
| `skeleton` | Trạng thái tải |
| `sheet`, `sidebar` | Khung điều hướng (desktop 256px, mobile 320px) |
| `pagination` | Bọc sau `components/Pagination` |

Primitive không chứa copy: nhãn vi/en truyền qua prop bắt buộc — `Pagination`/`Breadcrumb` `aria-label`; `PaginationPrevious`/`PaginationNext`/`PaginationEllipsis`/`BreadcrumbEllipsis` `label`; `DialogContent`/`DialogFooter`/`SheetContent` `closeLabel` (nút đóng chỉ hiện khi có); `Sidebar` `mobileTitle`; `SidebarTrigger`/`SidebarRail` `label`. `Calendar` cần `locale` vi/en. Focus ring dùng `ring-ring` đặc, không pha `/50`, không `aria-invalid:ring-*` (invalid báo bằng `border-destructive`); `ui/focus.test.ts` chặn khi `shadcn add` component mới.

Composite ngoài `ui/`: `UserAvatar`, `Brand`, `GoogleAuthButton`, `Pagination`, `TagPicker`, `MarkdownContent`, `EmptyState` (thêm khi có consumer đầu tiên).

## Badge tone

```tsx
import { Badge } from '@/components/ui/badge'
import { statusTone, toneFor } from '@/lib/utils'

<Badge tone={toneFor(topic.name)}>{topic.name}</Badge>
<Badge tone={statusTone(article.status)}>{statusLabel(article.status, 'article', language)}</Badge>
```

Tám tone `blue green purple amber rose sky cyan slate`. `toneFor` băm tên (không ra `slate`); `statusTone` theo bảng semantic cố định.

## Mẫu ghép trang

Đầu trang app (4.1 gọn) + card bộ lọc (4.2) + danh sách hàng trong card (4.5):

```tsx
<main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 lg:px-8">
  <header className="flex flex-col gap-1">
    <h1 className="text-2xl font-bold">{t.title}</h1>
    <p className="text-sm text-muted-foreground">{t.subtitle}</p>
  </header>
  <Card className="rounded-2xl">
    <CardContent className="grid gap-4 md:grid-cols-12">
      <div className="flex flex-col gap-2 md:col-span-6">
        <Label htmlFor="q" className="text-[11px] font-semibold uppercase tracking-[.05em]">{t.search}</Label>
        <Input id="q" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
    </CardContent>
  </Card>
  <Card className="rounded-2xl divide-y divide-border py-0">
    {items.map((item) => (
      <div key={item.id} className="flex items-center gap-4 px-6 py-4">…</div>
    ))}
  </Card>
</main>
```

Lưới card (4.3): `grid gap-6 sm:grid-cols-2 lg:grid-cols-3`, card lưới `rounded-lg`, tiêu đề `text-base font-bold line-clamp-2`. Chi tiết hai cột (4.4): `grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]`. Hồ sơ/cài đặt (4.6): `grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]`.

Xác nhận nguy hiểm:

```tsx
<AlertDialog>
  <AlertDialogTrigger asChild><Button variant="destructive">{actionLabel}</Button></AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>{actionLabel}</AlertDialogTitle>
      <AlertDialogDescription>{existingConfirmQuestion}</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>{language === 'vi' ? 'Hủy' : 'Cancel'}</AlertDialogCancel>
      <AlertDialogAction onClick={run}>{actionLabel}</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

## Nội dung dài: cuộn trong khung, không kéo dài trang

Người dùng chốt 2026-11-03: trang không được dài ra chỉ vì một khối nhiều nội dung. Khi dựng trang, tự hỏi với từng khối: **độ dài có phụ thuộc dữ liệu/người nhập không?** Có thì giới hạn chiều cao và cho cuộn bên trong.

- Áp khi: lựa chọn > ~8 mục (chip, checkbox, radio); textarea người dùng gõ tự do; timeline/lịch sử/log; danh sách con trong card hoặc Sheet; đoạn văn người dùng nhập (bio, ghi chú) được hiển thị lại. Không áp cho nội dung chính của trang (danh sách chính có phân trang, bài viết).
- Mức trần: textarea `max-h-64 overflow-y-auto` (primitive `Textarea` có `field-sizing-content` nên tự giãn vô hạn nếu thiếu); nhóm lựa chọn `max-h-80`; timeline `max-h-96`; đoạn văn hiển thị lại `max-h-48`.
- Vùng cuộn: `overflow-y-auto overscroll-contain [scrollbar-width:thin]` + `role="region"` + `aria-label` + `tabIndex={0}` + focus ring (người dùng bàn phím mới cuộn được khi bên trong không có control). Không dùng gradient làm bóng mờ mép.
- Lựa chọn hiện tại phải nhìn thấy mà không cần cuộn (dòng “Đang chọn: …” bên ngoài khung). Test: assert `region` có tên + `tabIndex` 0, không assert class.
- Mẫu: `pages/Author/AuthorApplyPage.tsx` (`scrollArea`).

## Tự kiểm trước khi gửi review

Grep trên file đã sửa, sửa hết rồi mới review (đây là các lỗi review từng bắt lại):

- Mọi `Textarea` có `max-h-*`; khối dài theo dữ liệu đã cuộn trong khung (mục trên). Kiểm bằng mắt thì đo `document.documentElement.scrollHeight` với dữ liệu dài.
- `Badge`/chip chứa chữ người nhập (có thể dài, không khoảng trắng) phải xuống dòng: `max-w-full shrink whitespace-normal [overflow-wrap:anywhere]` — Badge mặc định `whitespace-nowrap` làm tràn ngang mobile.
- Mọi `a`, `button`, `select`, dropdown, ô nhập có nút bên trong: có `pointer-coarse:min-h-11` (hoặc `h-11`) và nút trong ô căn giữa (`top-1/2 -translate-y-1/2`).
- Chữ hiển thị (tháng, ngày, nhãn) theo `language` của app, không theo locale trình duyệt (`toLocaleString("default")`, `Intl` không truyền locale).
- Preflight đã bật: heading/list cần class cỡ chữ/dấu đầu dòng; viền mặc định đã là `--border`; không `text-destructive` cho chữ.
- `className` truyền vào composite được gộp (`cn(..., className)`), không bị ghi đè.
- Tone của topic/tag/tên luôn qua `toneFor`, status qua `statusTone`; không tự ánh xạ tone trong trang (cùng giá trị phải cùng màu ở mọi trang).

## Điều cấm

- Không literal màu (hex/rgb/hsl/oklch, `text-white`, `bg-black`) ngoài `styles/tokens.css`; không gradient.
- Không class `.dark`; không `tailwind.config.js`; không CSS trang mới.
- Không nghiệp vụ, API, route, copy trong `components/ui/*`.
- Không thêm primitive khi chưa có trang dùng; không Radix `select`, `table`, `sonner`, `react-hook-form`, `zod`, UI library thứ hai.
- Không `window.confirm`/`window.alert`.
- Không khôi phục khối đã bỏ (Featured, khóa học, community); không sao chép logo/chữ/ảnh/code của javabuilder.online.
- Test không assert class Tailwind; dùng role/label/state.
