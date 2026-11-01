# HTML và CSS: xây dựng thẻ bài viết responsive dễ sử dụng

Thiết kế bố cục thẻ bài viết không tràn màn hình và có trạng thái focus rõ cho bàn phím.

## Bối cảnh

Một thẻ bài viết cần đọc được ở màn hình nhỏ và thao tác được bằng bàn phím. Chỉ căn đẹp trên desktop chưa đủ để đánh giá giao diện.

## Ý tưởng chính

Dùng phần tử có ngữ nghĩa trước, sau đó bổ sung CSS. Tiêu đề dài nên được xuống dòng thay vì làm khối cha tràn ngang. Focus-visible giúp người dùng biết vị trí khi điều hướng không dùng chuột.

## Ví dụ minh họa

```css
.article-card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 0;
  border: 1px solid #cbd5e1;
  border-radius: 1rem;
  padding: 1rem;
}

.article-card h2 {
  overflow-wrap: anywhere;
  margin: 0;
}

.article-card a:focus-visible {
  outline: 3px solid #2563eb;
  outline-offset: 4px;
}

.article-card-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
  gap: 1rem;
}
```

## Phân tích từng bước

1. Dùng article cho một nội dung độc lập và heading đúng cấp.
2. Dùng thẻ a cho điều hướng, button cho hành động.
3. Kiểm tra cả nền sáng và nền tối thay vì giả định một màu luôn đủ tương phản.

## Lỗi thường gặp

- Không bỏ outline mà không cung cấp chỉ báo focus khác.
- Ảnh có ý nghĩa cần alt phù hợp; ảnh trang trí dùng alt rỗng.
- Không dùng fixed width lớn cho toàn bộ card.

> Code trong bài phục vụ học tập. Hãy điều chỉnh theo kiến trúc, phiên bản thư viện và quy tắc bảo mật của dự án trước khi sử dụng.

## Bài tập thực hành

Thử tiêu đề 200 ký tự, zoom 200% và màn hình rộng 320px; ghi lại vị trí bị tràn nếu có.

## Checklist tự kiểm tra

- Đã giải thích được đầu vào, đầu ra và giới hạn của ví dụ.
- Đã nghĩ tới dữ liệu rỗng, dữ liệu không hợp lệ và tình huống thất bại.
- Đã tách phần minh họa khỏi cấu hình và bí mật của môi trường thật.

---

**Kết luận:** Thiết kế bố cục thẻ bài viết không tràn màn hình và có trạng thái focus rõ cho bàn phím.
