# Next.js: tổ chức route và layout cho khu vực tác giả

Minh họa cách phân nhóm trang bài viết và tái sử dụng layout trong ứng dụng dùng App Router.

## Bối cảnh

Khi số trang tăng lên, việc lặp lại sidebar ở từng trang dễ gây lệch giao diện. Layout dùng chung giúp tổ chức phần khung và để page tập trung vào nội dung.

## Ý tưởng chính

Đây là nội dung học tập dành cho một ứng dụng Next.js riêng. Frontend TechVerse hiện dùng React/Vite, không cần chuyển cấu trúc đang có sang Next.js để import bài này.

## Ví dụ minh họa

```text
app/
  layout.tsx
  author/
    layout.tsx
    articles/
      page.tsx
      new/
        page.tsx
      [id]/
        page.tsx

author/layout.tsx:
    render author navigation
    render children

author/articles/page.tsx:
    render article list

author/articles/[id]/page.tsx:
    render selected article
```

## Phân tích từng bước

1. Layout thể hiện cấu trúc giao diện dùng chung cho nhóm trang.
2. Route động thể hiện tài nguyên có id, không đồng nghĩa người dùng được phép xem mọi id.
3. Các kiểm tra bảo mật thực tế phải có ở backend và ranh giới dữ liệu thích hợp.

## Lỗi thường gặp

- Không lưu secret trong module hoặc biến môi trường được đưa ra client.
- Layout không thay thế kiểm tra quyền sở hữu bài viết.
- Đừng suy luận framework của một dự án chỉ từ tên thư mục app.

> Code trong bài phục vụ học tập. Hãy điều chỉnh theo kiến trúc, phiên bản thư viện và quy tắc bảo mật của dự án trước khi sử dụng.

## Bài tập thực hành

Thiết kế thêm nhóm route moderator với layout riêng, nhưng cùng dùng một component hiển thị nội dung Markdown.

## Checklist tự kiểm tra

- Đã giải thích được đầu vào, đầu ra và giới hạn của ví dụ.
- Đã nghĩ tới dữ liệu rỗng, dữ liệu không hợp lệ và tình huống thất bại.
- Đã tách phần minh họa khỏi cấu hình và bí mật của môi trường thật.

---

**Kết luận:** Minh họa cách phân nhóm trang bài viết và tái sử dụng layout trong ứng dụng dùng App Router.
