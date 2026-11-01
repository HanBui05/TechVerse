# JWT và session: vì sao logout cần nhiều hơn xóa cookie

Phân biệt thời hạn token, trạng thái phiên ở Redis và tác dụng thật của thao tác logout.

## Bối cảnh

Xóa token khỏi trình duyệt không đồng nghĩa vô hiệu hóa mọi bản sao của token đó. Người dùng có thể đã mở tab khác, hoặc một client vẫn giữ access token cũ.

## Ý tưởng chính

JWT có thể được xác minh chữ ký mà không cần hỏi database. Nếu hệ thống muốn logout có hiệu lực trước exp, cần kiểm tra thêm trạng thái thu hồi hoặc session. Ví dụ dưới mô tả sessionId ổn định cho một lần đăng nhập, không yêu cầu mọi dự án phải dùng đúng một mô hình.

## Ví dụ minh họa

```text
login:
    create session sid owned by userId
    issue access token with sub=userId, sid=sid, exp=...
    issue refresh credential associated with sid

authenticated request:
    verify signature, issuer, audience and expiry
    require token type = ACCESS
    require session sid exists and belongs to sub
    enforce endpoint permissions

logout current device:
    authenticate caller
    invalidate caller session sid
    clear refresh cookie with matching cookie scope
```

## Phân tích từng bước

1. sub nhận diện người dùng; sid nhận diện một phiên đăng nhập cụ thể.
2. Hai trình duyệt có thể cùng userId nhưng khác sid.
3. Backend kiểm tra quyền; ẩn nút ở giao diện không phải biện pháp phân quyền.

## Lỗi thường gặp

- Không đưa mật khẩu, API key hoặc dữ liệu nhạy cảm vào JWT payload.
- Không chấp nhận refresh token làm access token.
- Refresh đồng thời với logout cần cập nhật Redis nguyên tử để tránh hồi sinh phiên.

> Code trong bài phục vụ học tập. Hãy điều chỉnh theo kiến trúc, phiên bản thư viện và quy tắc bảo mật của dự án trước khi sử dụng.

## Bài tập thực hành

Viết checklist test login ở hai trình duyệt, logout một phiên, rồi thử lại access token của cả hai phiên.

## Checklist tự kiểm tra

- Đã giải thích được đầu vào, đầu ra và giới hạn của ví dụ.
- Đã nghĩ tới dữ liệu rỗng, dữ liệu không hợp lệ và tình huống thất bại.
- Đã tách phần minh họa khỏi cấu hình và bí mật của môi trường thật.

---

**Kết luận:** Phân biệt thời hạn token, trạng thái phiên ở Redis và tác dụng thật của thao tác logout.
