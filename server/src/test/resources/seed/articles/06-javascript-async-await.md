# JavaScript: xử lý lỗi HTTP đúng khi dùng async/await

Tách lỗi kết nối và lỗi HTTP, kiểm tra response.ok và không nuốt thông báo lỗi từ server.

## Bối cảnh

fetch trả về một Promise, nhưng phản hồi HTTP 404 hoặc 500 không tự làm Promise bị reject. Nếu chỉ viết try/catch mà không kiểm tra status, giao diện có thể báo thành công sai.

## Ý tưởng chính

Hàm dưới đọc dữ liệu JSON và dừng khi response không thành công. Dự án có API client dùng chung thì nên xử lý ở client đó, thay vì sao chép nhiều hàm fetch rời rạc.

## Ví dụ minh họa

```javascript
async function loadArticles(signal) {
  const response = await fetch("/api/v1/articles", {
    signal,
    credentials: "include"
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message ?? "Không thể tải bài viết");
  }

  return payload?.data;
}

async function showArticles(signal) {
  try {
    return await loadArticles(signal);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return;
    throw error;
  }
}
```

## Phân tích từng bước

1. response.ok kiểm tra status thuộc nhóm thành công.
2. Không giả định mọi phản hồi, kể cả từ proxy, đều có JSON hợp lệ.
3. AbortError là tình huống hủy chủ động; không nhất thiết hiển thị như lỗi hệ thống.

## Lỗi thường gặp

- Ví dụ fetch không thay thế Bearer token và luồng refresh của API client thật.
- Không log toàn bộ header Authorization khi debug.
- Đừng biến mọi lỗi thành mảng rỗng vì sẽ che mất lỗi quyền truy cập.

> Code trong bài phục vụ học tập. Hãy điều chỉnh theo kiến trúc, phiên bản thư viện và quy tắc bảo mật của dự án trước khi sử dụng.

## Bài tập thực hành

Giả lập phản hồi 200, 401, 403, 500 và HTML không phải JSON; mô tả giao diện nên hiển thị gì.

## Checklist tự kiểm tra

- Đã giải thích được đầu vào, đầu ra và giới hạn của ví dụ.
- Đã nghĩ tới dữ liệu rỗng, dữ liệu không hợp lệ và tình huống thất bại.
- Đã tách phần minh họa khỏi cấu hình và bí mật của môi trường thật.

---

**Kết luận:** Tách lỗi kết nối và lỗi HTTP, kiểm tra response.ok và không nuốt thông báo lỗi từ server.
