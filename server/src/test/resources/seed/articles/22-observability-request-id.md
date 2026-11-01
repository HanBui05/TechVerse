# Observability: dùng request ID để nối các bước xử lý

Theo dõi một request qua controller, service và lời gọi dịch vụ ngoài mà không log dữ liệu nhạy cảm.

## Bối cảnh

Khi nhiều người đăng ký cùng lúc, chỉ tìm theo thời gian trong log rất dễ nhầm. Request ID giúp liên kết những dòng log thuộc cùng một lần xử lý.

## Ý tưởng chính

Một request ID được tạo hoặc kiểm tra tại điểm vào rồi truyền theo ngữ cảnh. Nếu nhận từ client, phải giới hạn chiều dài và ký tự. Với tác vụ Async, việc truyền ngữ cảnh cần được cấu hình riêng.

## Ví dụ minh họa

```text
requestId=demo-req-001 event=article_submit_started articleId=demo-article
requestId=demo-req-001 event=article_validation_passed
requestId=demo-req-001 event=article_submit_completed status=PENDING durationMs=42

requestId=demo-req-002 event=email_send_started template=register-success
requestId=demo-req-002 event=email_provider_rejected status=401
```

## Phân tích từng bước

1. Event name ổn định giúp tìm kiếm và tổng hợp log.
2. Duration hỗ trợ nhận diện phần xử lý chậm, không thay thế metric phân phối độ trễ.
3. Lỗi nhà cung cấp email nên được phân biệt với lỗi đăng ký tài khoản.

## Lỗi thường gặp

- Không ghi API key, refresh cookie, mật khẩu hoặc OTP vào log.
- Không đưa userId hoặc requestId vào metric label có số giá trị không giới hạn.
- Không giả định ThreadLocal tự theo sang thread của @Async.

> Code trong bài phục vụ học tập. Hãy điều chỉnh theo kiến trúc, phiên bản thư viện và quy tắc bảo mật của dự án trước khi sử dụng.

## Bài tập thực hành

Định nghĩa năm event cho luồng gửi OTP, xác minh OTP và đổi mật khẩu; chỉ ra dữ liệu nào bị cấm log.

## Checklist tự kiểm tra

- Đã giải thích được đầu vào, đầu ra và giới hạn của ví dụ.
- Đã nghĩ tới dữ liệu rỗng, dữ liệu không hợp lệ và tình huống thất bại.
- Đã tách phần minh họa khỏi cấu hình và bí mật của môi trường thật.

---

**Kết luận:** Theo dõi một request qua controller, service và lời gọi dịch vụ ngoài mà không log dữ liệu nhạy cảm.
