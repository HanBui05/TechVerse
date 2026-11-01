# Tích hợp AI: coi đầu ra mô hình là dữ liệu chưa được tin cậy

Thiết kế ranh giới dữ liệu, kiểm tra đầu ra và kiểm soát chi phí khi thêm AI vào ứng dụng học tập.

## Bối cảnh

Một tính năng tóm tắt bài viết có thể hữu ích, nhưng đầu vào bài viết và đầu ra mô hình không nên được trao quyền trực tiếp lên hệ thống. Nội dung văn bản có thể chứa chỉ dẫn không đáng tin.

## Ý tưởng chính

Backend cần tự quyết định dữ liệu nào được phép gửi cho nhà cung cấp. Model không quyết định quyền đọc bài, quyền cập nhật database hoặc quyền gọi công cụ. Schema đầu ra và các giới hạn là lớp bảo vệ, không phải lời bảo đảm tuyệt đối về tính đúng.

## Ví dụ minh họa

```text
summarizeArticle(actor, articleId):
    require actor can read articleId
    load the allowed article content
    remove secrets and unnecessary personal data
    enforce request size, quota and timeout

    call provider using server-side credentials
    treat article content as untrusted reference material
    require a structured summary response

    validate returned fields and maximum lengths
    render as escaped text
    return summary without granting any new permissions
```

## Phân tích từng bước

1. Secret của nhà cung cấp chỉ nằm ở backend, không nằm trong biến frontend public.
2. Đặt timeout và giới hạn đầu vào, đầu ra để quản lý chi phí.
3. Nếu lưu kết quả cache, gắn với phiên bản hoặc dấu vân tay nội dung bài viết.

## Lỗi thường gặp

- Prompt injection không được giải quyết chỉ bằng câu 'hãy bỏ qua chỉ dẫn xấu'.
- Không gửi mật khẩu, JWT, cookie hoặc dữ liệu riêng tư không cần thiết.
- Không render HTML đầu ra của model một cách không kiểm soát.

> Code trong bài phục vụ học tập. Hãy điều chỉnh theo kiến trúc, phiên bản thư viện và quy tắc bảo mật của dự án trước khi sử dụng.

## Bài tập thực hành

Tạo một bài viết chứa câu yêu cầu tiết lộ secret và chứng minh hệ thống không có đường cấp secret cho model.

## Checklist tự kiểm tra

- Đã giải thích được đầu vào, đầu ra và giới hạn của ví dụ.
- Đã nghĩ tới dữ liệu rỗng, dữ liệu không hợp lệ và tình huống thất bại.
- Đã tách phần minh họa khỏi cấu hình và bí mật của môi trường thật.

---

**Kết luận:** Thiết kế ranh giới dữ liệu, kiểm tra đầu ra và kiểm soát chi phí khi thêm AI vào ứng dụng học tập.
