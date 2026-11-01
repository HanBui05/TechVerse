# Web performance: debounce tìm kiếm mà không hiển thị kết quả cũ

Kết hợp khoảng chờ gõ với hủy request trước đó để giảm tải và tránh kết quả về sai thứ tự.

## Bối cảnh

Người dùng gõ một từ có thể tạo ra nhiều lần thay đổi input. Gửi request ở mỗi ký tự vừa tốn tài nguyên vừa dễ gặp tình huống request cũ trả về sau request mới.

## Ý tưởng chính

Debounce gom các thay đổi gần nhau; AbortController giúp hủy request không còn cần thiết. Đoạn hook dưới tập trung vào cleanup, chưa triển khai phân trang hoặc luồng Bearer token của dự án.

## Ví dụ minh họa

```jsx
import { useEffect, useState } from "react";

export function useSearch(keyword) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          "/api/demo/search?q=" + encodeURIComponent(keyword),
          { signal: controller.signal }
        );
        if (!response.ok) throw new Error("Search failed");
        const data = await response.json();
        if (active) setItems(data.items ?? []);
      } catch (error) {
        if (active) {
          // App thật cần hiển thị trạng thái lỗi phù hợp.
          setItems([]);
        }
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [keyword]);

  return items;
}
```

## Phân tích từng bước

1. Cleanup hủy cả timer chưa chạy và request đang xử lý.
2. encodeURIComponent ngăn từ khóa làm sai cấu trúc query string.
3. Trong dự án dùng request helper chung thì bổ sung signal qua helper để giữ cơ chế xác thực.

## Lỗi thường gặp

- Debounce không thay thế rate limit phía server.
- Không giữ dữ liệu của người dùng trước khi đổi tài khoản.
- Không giả định response luôn có trường items như ví dụ minh họa.

> Code trong bài phục vụ học tập. Hãy điều chỉnh theo kiến trúc, phiên bản thư viện và quy tắc bảo mật của dự án trước khi sử dụng.

## Bài tập thực hành

Làm request cho từ khóa cũ chậm hơn từ khóa mới, sau đó xác nhận danh sách không bị ghi đè bởi kết quả cũ.

## Checklist tự kiểm tra

- Đã giải thích được đầu vào, đầu ra và giới hạn của ví dụ.
- Đã nghĩ tới dữ liệu rỗng, dữ liệu không hợp lệ và tình huống thất bại.
- Đã tách phần minh họa khỏi cấu hình và bí mật của môi trường thật.

---

**Kết luận:** Kết hợp khoảng chờ gõ với hủy request trước đó để giảm tải và tránh kết quả về sai thứ tự.
