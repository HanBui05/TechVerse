# Node.js: phản hồi lỗi nhất quán trong HTTP server

Phân biệt lỗi nghiệp vụ với lỗi bất ngờ và tránh để lộ stack trace trong phản hồi HTTP.

## Bối cảnh

Lỗi không chỉ là một dòng log. Client cần status rõ ràng và thông báo có thể hiển thị, còn thông tin chẩn đoán chi tiết nên nằm ở phía server.

## Ý tưởng chính

Ví dụ dùng HTTP server tích hợp của Node.js để minh họa hai nhánh 404 và 500. Với ứng dụng framework, đặt cơ chế chuyển lỗi tại middleware hoặc bộ xử lý lỗi tập trung.

## Ví dụ minh họa

```javascript
import { createServer } from "node:http";

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/health") {
      json(response, 200, { status: "ok" });
      return;
    }

    json(response, 404, { code: "NOT_FOUND", message: "Không tìm thấy tài nguyên" });
  } catch {
    if (!response.headersSent) {
      json(response, 500, { code: "INTERNAL_ERROR", message: "Có lỗi hệ thống" });
    } else {
      response.destroy();
    }
  }
}).listen(3001);
```

## Phân tích từng bước

1. Status giúp client phân biệt dữ liệu không có và lỗi máy chủ.
2. Mỗi nhánh phải kết thúc rõ ràng để tránh gửi response lần hai.
3. Trong ứng dụng thật, thêm log có request ID nhưng không chứa secret.

## Lỗi thường gặp

- Không trả error.stack ra API công khai.
- Không để promise bị reject mà không có nơi xử lý.
- Đừng dùng ví dụ health check để kết luận mọi phụ thuộc DB hoặc Redis đều khỏe.

> Code trong bài phục vụ học tập. Hãy điều chỉnh theo kiến trúc, phiên bản thư viện và quy tắc bảo mật của dự án trước khi sử dụng.

## Bài tập thực hành

Thêm route có lỗi chủ động và xác nhận body không chứa đường dẫn source code hoặc biến môi trường.

## Checklist tự kiểm tra

- Đã giải thích được đầu vào, đầu ra và giới hạn của ví dụ.
- Đã nghĩ tới dữ liệu rỗng, dữ liệu không hợp lệ và tình huống thất bại.
- Đã tách phần minh họa khỏi cấu hình và bí mật của môi trường thật.

---

**Kết luận:** Phân biệt lỗi nghiệp vụ với lỗi bất ngờ và tránh để lộ stack trace trong phản hồi HTTP.
