---
paths:
  - "app/**"
---

# Luật frontend (`app/`)

## Giao diện

- Task có “Đổi giao diện: Có”: bám [`docs/design/UI_GUIDE.md`](../../docs/design/UI_GUIDE.md). Chỉ nạp `ui-ux-pro-max` khi spec còn quyết định thiết kế bỏ ngỏ; spec đã chốt bố cục/màu/chữ thì bám spec.
- Không dùng `ui-styling`, `banner-design`, `brand`, `slides`, `design`. Không thêm Tailwind hay thư viện UI mới nếu spec không yêu cầu.

## Ngân sách test

- Test tích hợp render cả `App` chỉ cho luồng chính: mỗi màn khoảng 5 ca (thành công, một lỗi validation, một lỗi API, regression đã biết).
- Chuỗi dài hơn 20 ký tự trong test: dùng `user.paste` hoặc `fireEvent.change`, không dùng `user.type`.
- Chạy một file: `cd app && npx vitest run <file> [-t "<tên>"]`; cần chi tiết thì thêm `--reporter=verbose` ngay lần đầu.

## Ảnh chụp

- Không chụp hay so pixel cho trang không đổi giao diện; chứng minh bằng kiểm tĩnh (grep selector, class dùng chung).
- Trang có đổi giao diện: tối đa một lượt chụp các trạng thái spec yêu cầu, đọc tối đa 2 ảnh. Không tự viết công cụ chụp mới; thiếu công cụ thì ghi “chưa kiểm”.
- Ảnh có nhiễu: không kết luận từ một lần; kiểm tra ảnh thật là trang đúng (không phải trang lỗi) trước khi tin số liệu so sánh.
- Chrome headless bằng `--window-size` không thu nhỏ được dưới khoảng 500px; viewport mobile cần giả lập thiết bị.
- Công cụ Chrome (MCP) chỉ nạp khi phiên bắt đầu: nếu chưa thấy sau khi cài, báo người dùng khởi động lại.

## CSS

- Tách/di chuyển CSS: kiểm tra các class cùng nằm trên một phần tử (kể cả truyền qua prop `className`), vì đổi thứ tự nạp file làm đổi cascade mà ảnh chụp có thể không thấy.
- Màu đi qua token trong `app/src/styles/tokens.css`; không viết literal màu trong component/CSS trang.
- Style mới của một trang scope dưới class riêng của trang; không đổi class dùng chung với trang khác.
- Task giữ nguyên hành vi: inventory + kiểm tra tĩnh thứ tự cascade + các trang spec yêu cầu; chỉ mở rộng khi kiểm tra tĩnh báo lỗi.
