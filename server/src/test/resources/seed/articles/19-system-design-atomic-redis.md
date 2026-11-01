# System design: thao tác Redis nguyên tử để dùng token một lần

Phân tích khoảng hở giữa kiểm tra và xóa, cùng ví dụ Lua tối giản cho một khóa token đã băm.

## Bối cảnh

Nếu hai request cùng đọc một token còn hiệu lực trước khi bất kỳ request nào xóa nó, cả hai có thể được chấp nhận. Đây là lỗi kiểm tra rồi hành động ở hai bước riêng.

## Ý tưởng chính

Lua trong Redis cho phép gộp kiểm tra và xóa thành một thao tác nguyên tử. Ví dụ giả định khóa chứa hash token và bên gọi đã băm token nhận được. Đây không phải cơ chế OTP sáu số đầy đủ: OTP cần thêm giới hạn thử, rate limit và cách bảo vệ hash phù hợp.

## Ví dụ minh họa

```lua
-- KEYS[1]: key of a short-lived token record
-- ARGV[1]: expected hash computed by the server
local stored = redis.call("GET", KEYS[1])

if not stored then
    return 0
end

if stored ~= ARGV[1] then
    return 0
end

redis.call("DEL", KEYS[1])
return 1
```

## Phân tích từng bước

1. Chỉ một lần gọi có thể thấy giá trị đúng và xóa khóa thành công.
2. TTL vẫn phải được đặt ở lúc tạo khóa.
3. Atomicity của Redis không tạo ra transaction chung với PostgreSQL; luồng đổi mật khẩu phải xử lý ranh giới này riêng.

## Lỗi thường gặp

- Không dùng hash SHA-256 đơn thuần cho OTP ít khả năng nếu cần chống dò offline; cân nhắc HMAC với secret server.
- Không trả token reset vào log.
- Không coi Lua là giải pháp thay thế rate limit cho endpoint công khai.

> Code trong bài phục vụ học tập. Hãy điều chỉnh theo kiến trúc, phiên bản thư viện và quy tắc bảo mật của dự án trước khi sử dụng.

## Bài tập thực hành

Dùng hai client đồng thời gọi script với cùng token rồi kiểm tra chỉ một kết quả bằng 1.

## Checklist tự kiểm tra

- Đã giải thích được đầu vào, đầu ra và giới hạn của ví dụ.
- Đã nghĩ tới dữ liệu rỗng, dữ liệu không hợp lệ và tình huống thất bại.
- Đã tách phần minh họa khỏi cấu hình và bí mật của môi trường thật.

---

**Kết luận:** Phân tích khoảng hở giữa kiểm tra và xóa, cùng ví dụ Lua tối giản cho một khóa token đã băm.
