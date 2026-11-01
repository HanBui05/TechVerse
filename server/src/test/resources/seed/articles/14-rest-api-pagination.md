# REST API: phân trang ổn định và filter rõ ràng

Thiết kế danh sách bài viết với filter tùy chọn, giới hạn kích thước trang và thứ tự nhất quán.

## Bối cảnh

Danh sách là một API dễ viết nhưng dễ gây nhầm khi số lượng dữ liệu tăng. Cần thống nhất page bắt đầu từ đâu, size tối đa và điều kiện lọc được kết hợp như thế nào.

## Ý tưởng chính

Ví dụ hợp đồng bên dưới mang tính minh họa, không cam kết tên query parameter của endpoint TechVerse. Trong API thật, đọc DTO filter và Swagger trước khi gửi request.

## Ví dụ minh họa

```http
GET /articles?page=0&size=20&topicId=TOPIC_UUID&keyword=java
Accept: application/json

HTTP/1.1 200 OK
Content-Type: application/json

{
  "data": {
    "content": [
      { "id": "ARTICLE_UUID", "title": "Java OOP" }
    ],
    "page": 0,
    "size": 20,
    "hasNext": false
  }
}
```

## Phân tích từng bước

1. Cho biết keyword áp dụng vào trường nào và cách xử lý chuỗi rỗng.
2. Dùng tiêu chí phụ như id khi hai bản ghi có cùng publishedAt.
3. Giới hạn size ở backend, không tin giới hạn do frontend gửi.

## Lỗi thường gặp

- Offset pagination có thể lặp hoặc bỏ sót khi dữ liệu thay đổi giữa các lần đọc.
- Không truyền trực tiếp tên cột từ query string vào SQL.
- Filter của admin và người đọc có thể giống hình thức nhưng khác phạm vi dữ liệu được phép xem.

> Code trong bài phục vụ học tập. Hãy điều chỉnh theo kiến trúc, phiên bản thư viện và quy tắc bảo mật của dự án trước khi sử dụng.

## Bài tập thực hành

Tạo ba bài cùng topic, lọc theo tag rồi đổi page; kiểm tra chỉ bài đã publish được trả cho người đọc.

## Checklist tự kiểm tra

- Đã giải thích được đầu vào, đầu ra và giới hạn của ví dụ.
- Đã nghĩ tới dữ liệu rỗng, dữ liệu không hợp lệ và tình huống thất bại.
- Đã tách phần minh họa khỏi cấu hình và bí mật của môi trường thật.

---

**Kết luận:** Thiết kế danh sách bài viết với filter tùy chọn, giới hạn kích thước trang và thứ tự nhất quán.
