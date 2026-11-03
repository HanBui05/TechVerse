---
name: visual-check
description: Thủ tục kiểm bằng mắt giao diện TechVerse bằng Claude in Chrome — dev server, đăng nhập theo vai trò, đo bằng JS, dark/light, mobile qua iframe, giới hạn ảnh. Dùng khi task có “Đổi giao diện: Có” cần kiểm bằng mắt, hoặc khi cần xem một trang chạy thật.
---

# Kiểm bằng mắt

Môi trường (cổng, CORS, tài khoản theo vai trò, luồng phiên) ở [`docs/RUNBOOK.md`](../../../docs/RUNBOOK.md).

## Chuẩn bị

- Cổng 3000 đã có Vite của repo (của người dùng) thì dùng chung, không tắt. Không có thì `cd <repo>/app && npm run dev -- --port 3000 --strictPort` chạy nền; xong thì tắt đúng tiến trình mình bật.
- Không khởi động lại backend của người dùng. Backend không chạy, chạy code cũ hoặc vẫn lỗi → ghi “chưa kiểm: <một dòng nguyên nhân>”.
- Đăng nhập: điền form `/login` bằng JS (setter `value` + sự kiện `input`, rồi bấm submit), sau đó đổi route bằng `history.pushState` + `popstate`, không tải lại trang. Vai trò chưa có tài khoản → “chưa kiểm” cho vai trò đó.

## Đo

- Trang không đổi giao diện: không chụp; chứng minh bằng kiểm tĩnh (grep selector, class dùng chung).
- Trang đổi giao diện: một lượt, đọc tối đa 2 ảnh (`scale: 0.5`); còn lại đo bằng `javascript_tool`:
  - bố cục: `getBoundingClientRect` (cột, card, sidebar 256/48px, sheet 320px), `scrollWidth > innerWidth`;
  - chữ: `letter-spacing`, `margin` của `h1` và `p` đầu trang;
  - màu: `backgroundColor`, `borderTopColor` của thẻ/khung ở cả dark và light (đổi theme tạm bằng `document.documentElement.dataset.theme`).
- Ảnh lạ: kiểm ảnh đúng trang (không phải trang lỗi) trước khi kết luận.
- Hộp thoại/sheet Radix đóng có hiệu ứng: đo trạng thái đóng sau ≥1 giây.

## Mobile

- `resize_window` không đổi `innerWidth`. Cách làm: đăng nhập ở tab chính → `document.body.innerHTML = ''` → thêm `<iframe src="/route" style="width:390px;height:844px">` cùng origin → đo qua `iframe.contentDocument` / `contentWindow` (media query theo bề rộng iframe).
- Không giả lập được `pointer: coarse`: vùng chạm 44px chỉ kiểm bằng test quét nguồn; ghi “chưa kiểm trên thiết bị cảm ứng thật”.

## Kết thúc

Đóng tab đã mở. Log ghi route đã kiểm (theme, desktop/mobile) và phần “chưa kiểm” kèm lý do.
