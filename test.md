Chủ đề: Java Backend
Tiêu đề: Xây dựng REST API đầu tiên với Spring Boot
Đối tượng: Người mới bắt đầu học backend
Mục tiêu: Giải thích REST API là gì và minh họa cách tạo một endpoint đơn giản.

Bài viết nên có các phần:

1. REST API là gì và thường được sử dụng để làm gì?
2. Những công cụ cần chuẩn bị: Java, Spring Boot và một trình kiểm thử như curl.
3. Ví dụ endpoint GET /api/hello trả về lời chào.
4. Cách chạy ứng dụng và kiểm tra endpoint.
5. Kết luận và hướng phát triển tiếp theo.

Lưu nội dung thành file spring-boot-rest-api.md, ví dụ:

# Xây dựng REST API đầu tiên với Spring Boot

REST API giúp các ứng dụng trao đổi dữ liệu qua HTTP.
Trong bài này, chúng ta sẽ tạo một endpoint đơn giản bằng Spring Boot.

## Chuẩn bị

- JDK tương thích với dự án Spring Boot.
- Một dự án Spring Boot có dependency Spring Web.
- Terminal để chạy lệnh curl.

## Tạo endpoint

Tạo một controller với endpoint `GET /api/hello`:

```java
@RestController
@RequestMapping("/api")
public class HelloController {

    @GetMapping("/hello")
    public String hello() {
        return "Xin chào TechVerse!";
    }
}
```

## Kiểm tra

Sau khi chạy ứng dụng trên cổng 8080:

```bash
curl http://localhost:8080/api/hello
```

Kết quả mong đợi:

```text
Xin chào TechVerse!
```

## Kết luận

Bạn đã tạo được một endpoint cơ bản. Bước tiếp theo là thử trả về
dữ liệu JSON và tìm hiểu cách xử lý lỗi trong API.