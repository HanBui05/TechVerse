# Danh mục mẫu bố cục (khảo sát javabuilder.online)

Khảo sát ngày 2026-11-02 bằng trình duyệt (chỉ xem, đo bằng `getComputedStyle`), phục vụ module “UI foundation v2 (shadcn)” (D-024). **Chỉ lấy bố cục, cách chia vùng, tỷ lệ và công thức màu**; không lấy logo, chữ, hình ảnh hay code của họ. JavaBuilder dựng bằng Tailwind + shadcn/ui, nên các giá trị dưới đây khớp trực tiếp với lớp tiện ích Tailwind.

Trang đã xem: `/blogs`, `/blogs/<bài>`, `/challenges`, `/leaderboard`, `/profile` (khảo sát trước đó), trang chủ.

## 1. Khung chung

| Thành phần | Số đo | Gợi ý Tailwind |
|---|---|---|
| Vùng nội dung | rộng tối đa 1280px, lề 24–32px | `mx-auto max-w-7xl px-6 lg:px-8` |
| Khoảng cách giữa khối | 24px (trang app), 32px (lưới lớn) | `gap-6` / `gap-8` |
| Card | nền `card`, viền 1px, bo 18px (card lớn) / 10px (card trong lưới) | `rounded-2xl border bg-card` / `rounded-[10px]` |
| Control (input, select, nút nhỏ) | cao 36–38px, bo 8–10px, chữ 14px | mặc định shadcn (`h-9`) |
| Sidebar | 256px, ngăn kéo mobile 320px (UI_GUIDE) | `sidebar` của shadcn |

## 2. Thang chữ

| Vai trò | Cỡ/độ đậm | Ghi chú |
|---|---|---|
| H1 hero (trang giới thiệu) | 48/48 · 700 · giãn −1.2px | một từ nhấn đổi màu `accent-text` |
| H1 chi tiết bài viết | 30/37.5 · 700 | |
| H1 trang ứng dụng (hồ sơ, cài đặt) | 24/32 · 700 | |
| H2 trong nội dung | 20 · 700 | |
| Tiêu đề card trong lưới | 16 · 700, tối đa 2 dòng | `line-clamp-2` |
| Tiêu đề card/khối | 14 · 600 | |
| Nội dung, ô nhập | 14 · 400 | |
| Mô tả phụ, thời gian, meta | 12 · 400, màu muted | |
| Chip | 12 · 500–600 (chip nhỏ), 14 · 500 (chip tag trong bài) | |
| Nhãn trường | 11 · 600, in hoa, giãn .05em | |

## 3. Màu “sinh động”: chip và nhãn màu (trọng tâm người dùng yêu cầu)

Điểm làm trang của họ không đơn điệu: **mọi siêu dữ liệu (chủ đề, tag, trạng thái, lượt xem/thích, tác giả) đều là chip có màu riêng**, dùng chung một công thức:

- **Nền:** màu đó ở độ đậm thấp (khoảng 10–25%), ví dụ `bg-emerald-900/25`, `bg-blue-500/15`.
- **Chữ:** cùng tông nhưng sáng (theme tối) / đậm (theme sáng), ví dụ `text-emerald-300`, `text-blue-400`.
- **Viền:** 1px cùng tông khoảng 30–50%, ví dụ `border-blue-500/30`.
- Theme sáng đảo lại: nền `-50/-100`, chữ `-700`, viền `-200`.

Số đo thực tế (theme tối):

| Mẫu | Kích thước | Màu đo được (Tailwind tương đương) |
|---|---|---|
| Chip chủ đề chính (topic) | 14/500, p 6×12, bo 10, có icon | nền purple-900, chữ purple-500 |
| Chip hashtag | 14/400, p 6×12, bo 10, cao 34 | nền blue-950, chữ blue-400, viền blue-500/30 |
| Danh mục (đầu tiêu đề bài) | ô icon 28px bo 8 nền blue-500/15 + chữ 14/500 blue-500 | |
| Chip lượt xem | 12/400, p 4×8, bo 8 | nền emerald-900/25, chữ emerald-300, viền emerald |
| Chip lượt thích/yêu thích | 12/400, p 4×8, bo 8 | nền red-200/10, chữ red-300, viền red/50 |
| Chip trạng thái (Đã/Chưa) | 12/600, bo tròn, có icon | xanh lá = đã xong, hổ phách = chưa |
| Chip “kicker” trên H1 | 12/600, p 4×12, bo tròn, có icon | nền primary/10, chữ sky-400 |
| Tag nhỏ trong card | 12/500, p 2×8, bo 8, viền | màu theo tag |
| Tác giả | avatar tròn nhỏ (chấm màu/ảnh) + tên 12–14/500 | đặt ngay dưới tiêu đề, trong hàng meta |

**Gán màu cho chủ đề/tag:** mỗi chủ đề có một tông cố định (blue, green, purple, amber, rose, sky, cyan…), gán theo cấu hình hoặc băm tên chủ đề để luôn ra cùng màu. Gom vào variant `tone` của component Badge (`cva`), không viết màu rời từng trang.

## 4. Các mẫu bố cục và nơi dùng ở TechVerse

### 4.1 Đầu trang (page header)
Chip kicker (icon + chữ nhỏ) → H1 (có thể một từ màu nhấn) → mô tả 14–18px muted (tối đa ~670px) → hàng nút hành động → (tùy chọn) hàng chip gợi ý. Bản hero có ảnh minh họa bên phải, lưới 12 cột, gap 32 (≈ 7/12 chữ + 5/12 ảnh).
**TechVerse:** trang chủ, danh sách bài viết, trang author/admin (bản gọn không ảnh, H1 24px).

### 4.2 Card bộ lọc
Card bo 18: header (p 12×20, viền dưới): icon + tiêu đề 14/600 + chip đếm số (12/600, bo tròn, màu xanh). Thân (p 20): lưới 12 cột gap 12 — ô tìm kiếm (icon trái, cao 38) chiếm ~6 cột + 1–2 select (cao 36, bo 8) mỗi cái ~3 cột; dưới là hàng chip lọc nhanh (nút cao 28, p 6×12, bo 10, 12/600; chip đang chọn = nền primary).
**TechVerse:** Bài viết, Admin users, Author applications, Taxonomy, Moderator, Author blogs.

### 4.3 Lưới card nội dung
3 cột, gap 24. Card bo 10, viền 1px, nền card:
- Ảnh trên cùng tỉ lệ ~16:10 (`object-contain`/`cover`), có chip nổi ở góc.
- Thân (p 16, cột): hàng meta (chip danh mục + thời gian tương đối bên phải) → tiêu đề 16/700 tối đa 2 dòng → tóm tắt 14px tối đa 2 dòng → hàng tag nhỏ màu → chân card (viền trên, p-top 12): số liệu nhỏ bên trái + nút “Đọc” nhỏ bên phải → hàng tác giả (viền trên, avatar 18 bo 6 + tên 12).
**TechVerse:** danh sách bài viết, Author blogs, trang chủ (bài mới).

### 4.4 Trang chi tiết (2 cột)
Breadcrumb → lưới: nội dung (~904px) + cột phải 280px, gap 32.
Nội dung: ảnh bìa bo 18 → danh mục (ô icon + chữ màu) → H1 30/700 → hàng meta (tác giả, ngày, các chip số liệu màu) → khối “Tóm tắt” (viền trái 4px màu xanh, nền xanh đậm nhạt, bo 0 10 10 0, p 16) → hàng tag (chip chủ đề tím + hashtag xanh) → nội dung.
Cột phải: các card xếp dọc — “Về tác giả”, “Bài viết liên quan” (ảnh nhỏ + tiêu đề 2 dòng + ngày), “Hành động nhanh” (danh sách link có icon).
**TechVerse:** chi tiết bài viết, màn đọc bài của Moderator.

### 4.5 Danh sách dạng hàng trong card (thay cho bảng)
Card bo 18, header (icon màu + tiêu đề 14/600, bên phải ghi chú 12 muted). Mỗi hàng cao ~64px, viền dưới, p ~12×20: ô thứ tự/ô chọn tròn → avatar 32–36 → tên 14/600 + email 12 muted → (đẩy sang phải) số liệu màu + chip trạng thái bo tròn. Hàng đặc biệt (ví dụ “bạn”/đang chọn) có viền trái màu + nền tô nhạt cùng tông.
**TechVerse:** Admin users (kèm checkbox chọn nhiều), Author applications, Moderator articles, Taxonomy. Dùng `table` của shadcn chỉ khi cần nhiều cột số liệu.

### 4.6 Trang cài đặt/hồ sơ (2 cột)
Đã áp dụng ở `pages/Profile`: card trái 320px (định danh, menu, đăng xuất) + card phải (header icon 28 + tiêu đề 14/600 + mô tả 12 + nút nhỏ bên phải; thân p 20; nhãn 11 in hoa; lưới 2 cột gap 16).

### 4.7 Tiêu đề khu vực (section) trên trang chủ
Tiêu đề căn giữa + một dòng mô tả muted, rồi lưới card.

## 5. Ghi chú cho spec

- Card thử thách của họ dùng nền gradient màu. TechVerse hiện cấm gradient (UI_GUIDE); nếu muốn nổi bật, dùng nền tông màu đặc theo công thức mục 3. Người dùng quyết có mở lại gradient hay không.
- Không cần các mẫu chỉ phục vụ chức năng TechVerse chưa có (bục vinh danh, khóa học, thử thách theo ngày).
- Danh sách trên đã đối chiếu với component shadcn đề xuất: Badge (tone), Card, Input, Select, Button, Avatar, Checkbox, Separator, Breadcrumb, Skeleton, ScrollArea, Sidebar/Sheet, Dialog/AlertDialog, Popover/Calendar.
