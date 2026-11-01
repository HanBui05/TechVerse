# UI Guide

Nguồn chuẩn cho mọi task có “Đổi giao diện: Có”. Màn mới phải chọn một mẫu có sẵn trước; chỉ thiết kế riêng khi không có mẫu nào phù hợp.

## Hướng tham chiếu

Tham khảo `javabuilder.online` về **bố cục và cấu trúc menu**, không sao chép logo, ảnh, văn bản, và không mượn công nghệ của họ (họ dùng Tailwind + shadcn/ui; TechVerse giữ CSS thường).

Trang tham chiếu: sidebar cố định 256px, ngăn kéo mobile 320px, hero + thẻ cộng đồng + các khối nổi bật (tiêu đề, một dòng mô tả, “View all”), cài đặt theme/ngôn ngữ trong sidebar, nhãn HOT/NEW/PRO trên menu.

**Bảng màu (đã chốt): theo web mẫu.** Giao diện sáng là mặc định, màu nhấn xanh dương `#0056d2`; chế độ tối dùng bảng slate. Giá trị tham chiếu:

| | Sáng | Tối |
|---|---|---|
| Nền chính / phụ | `#fff` / `#f9fafb` | `#0f172a` / `#1e293b` |
| Chữ chính / phụ | `#111827` / `#4b5563` | `#f1f5f9` / `#cbd5e1` |
| Viền | `#e5e7eb` | `#334155` |
| Nhấn | `#0056d2` | `#0056d2` |
| Bán kính bo | `.625rem` | |

Hero dùng gradient nhẹ từ trắng sang xanh nhạt. Màu tím, hồng, cyan cũ của TechVerse sẽ bỏ dần khi cải tổ UI. Font: chưa quyết (hiện giữ DM Sans và Space Grotesk; web mẫu dùng Inter và Geist).

## Token

Nguồn: `app/src/styles.css` (`:root` và `:root[data-theme='light']`): `--bg`, `--sidebar`, `--surface`, `--surface-2`, `--border`, `--muted`, `--text`, `--primary`, `--cyan`, `--pink`. Khi cải tổ UI, đổi giá trị các token này theo bảng trên, không tạo hệ token song song.

- Màu mới phải đi qua biến CSS, không viết hex cứng trong component. Cần màu mới thì thêm token ở `:root` cho cả hai theme.
- Font: DM Sans (thân), Space Grotesk (tiêu đề).

## Khung trang

- Khung chung: sidebar trái cố định, thu gọn được; trên mobile là ngăn kéo. Admin và Moderator có sidebar riêng (`components/layout/`).
- Mỗi tính năng mới ứng với một mục menu; dùng lại khung trên.

## Mẫu trang

1. Danh sách có lọc + phân trang (dùng `Pagination`).
2. Trang chi tiết (đọc nội dung, bài liên quan).
3. Biểu mẫu (tạo/sửa).
4. Dashboard (thẻ số liệu).

## Trạng thái bắt buộc

Mọi màn có dữ liệu phải có: đang tải, rỗng, lỗi.

## Kiểm tra trước khi giao (từ `ui-ux-pro-max`)

Tương phản chữ ≥ 4.5:1; mục bấm ≥ 44×44px; không chỉ dựa vào hover; dùng icon SVG (`lucide-react`), không dùng emoji; không cuộn ngang trên mobile; có focus ring.
