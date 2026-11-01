# Docker Compose: tổ chức PostgreSQL và Redis cho môi trường local

Đọc cấu hình dịch vụ, volume và health check mà không nhầm địa chỉ giữa container và máy host.

## Bối cảnh

Khi backend chạy trên máy còn PostgreSQL nằm trong container, host kết nối khác với trường hợp backend cũng nằm trong Compose. Hiểu ranh giới mạng giúp tránh nhiều lỗi connection refused.

## Ý tưởng chính

Đoạn cấu hình này dành cho học tập trong một thư mục demo riêng. Không ghi đè compose.yaml hiện có của TechVerse. Dùng giá trị môi trường riêng và không commit mật khẩu thực.

## Ví dụ minh họa

```yaml
services:
  database:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: demo
      POSTGRES_USER: demo
      POSTGRES_PASSWORD: ${DEMO_DB_PASSWORD:?Set DEMO_DB_PASSWORD}
    volumes:
      - demo_pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U demo -d demo"]
      interval: 5s
      timeout: 3s
      retries: 10

  cache:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  demo_pg_data:
```

## Phân tích từng bước

1. Hai service cùng mạng Compose có thể gọi tên database và cache.
2. Không khai báo ports thì ví dụ không mở cổng cho máy host truy cập.
3. Volume giữ dữ liệu qua việc tạo lại container, nhưng không thay thế backup.

## Lỗi thường gặp

- localhost bên trong container là chính container đó.
- depends_on thông thường không đồng nghĩa database đã sẵn sàng nhận truy vấn.
- Không chạy down -v trên dự án thật nếu chưa hiểu dữ liệu nào sẽ bị xóa.

> Code trong bài phục vụ học tập. Hãy điều chỉnh theo kiến trúc, phiên bản thư viện và quy tắc bảo mật của dự án trước khi sử dụng.

## Bài tập thực hành

Giải thích địa chỉ kết nối khi backend chạy trong Compose và khi backend chạy từ IntelliJ trên host.

## Checklist tự kiểm tra

- Đã giải thích được đầu vào, đầu ra và giới hạn của ví dụ.
- Đã nghĩ tới dữ liệu rỗng, dữ liệu không hợp lệ và tình huống thất bại.
- Đã tách phần minh họa khỏi cấu hình và bí mật của môi trường thật.

---

**Kết luận:** Đọc cấu hình dịch vụ, volume và health check mà không nhầm địa chỉ giữa container và máy host.
