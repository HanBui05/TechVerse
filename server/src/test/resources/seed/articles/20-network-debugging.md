# Linux và networking: chẩn đoán kết nối theo từng lớp

Tách vấn đề DNS, TCP, TLS và HTTP để tìm đúng nguyên nhân khi frontend không gọi được backend.

## Bối cảnh

Một lỗi Request failed có thể đến từ sai hostname, cổng chưa mở, chứng chỉ TLS hoặc backend trả 403. Kiểm tra theo từng lớp giúp tránh sửa ngẫu nhiên cấu hình ứng dụng.

## Ý tưởng chính

Các lệnh dưới là ví dụ đọc thông tin trong môi trường local hoặc Linux có công cụ tương ứng. Không quét hay kiểm tra hệ thống ngoài phạm vi mình quản lý.

## Ví dụ minh họa

```bash
# 1. Kiểm tra phân giải tên; có thể cần cài công cụ DNS.
nslookup localhost

# 2. Liệt kê socket đang lắng nghe trên Linux.
ss -ltn

# 3. Quan sát status và header từ dịch vụ local.
curl -i --max-time 5 http://localhost:8080/

# 4. Chỉ kiểm tra đường mạng đến endpoint được phép.
# 404 hoặc 401 vẫn cho thấy đã có phản hồi HTTP từ server.
```

## Phân tích từng bước

1. Connection refused khác với phản hồi HTTP 401 hoặc 403.
2. CORS là quy tắc áp dụng bởi trình duyệt; curl thành công không chứng minh cấu hình CORS đã đúng.
3. Reverse proxy có thể đổi đường dẫn hoặc header trước khi request đến backend.

## Lỗi thường gặp

- Không chia sẻ file HAR khi chưa loại bỏ cookie và Authorization.
- Không tắt TLS verification làm cách sửa lâu dài.
- Không công khai cổng database chỉ để giải quyết sai cấu hình mạng nội bộ.

> Code trong bài phục vụ học tập. Hãy điều chỉnh theo kiến trúc, phiên bản thư viện và quy tắc bảo mật của dự án trước khi sử dụng.

## Bài tập thực hành

Mô tả lần lượt việc kiểm tra khi Swagger truy cập được nhưng trang React báo lỗi gọi API.

## Checklist tự kiểm tra

- Đã giải thích được đầu vào, đầu ra và giới hạn của ví dụ.
- Đã nghĩ tới dữ liệu rỗng, dữ liệu không hợp lệ và tình huống thất bại.
- Đã tách phần minh họa khỏi cấu hình và bí mật của môi trường thật.

---

**Kết luận:** Tách vấn đề DNS, TCP, TLS và HTTP để tìm đúng nguyên nhân khi frontend không gọi được backend.
