# Spring Boot: đặt ranh giới giao dịch ở service thay vì controller

Tổ chức controller, service và repository qua tình huống đổi tiêu đề bài viết trong một giao dịch.

## Bối cảnh

Một API ngắn không đồng nghĩa toàn bộ xử lý phải nằm trong controller. Controller tập trung vào giao tiếp HTTP; service thể hiện quy tắc và ranh giới giao dịch; repository phụ trách truy cập dữ liệu.

## Ý tưởng chính

Trong ví dụ, bài viết được tải, kiểm tra chủ sở hữu rồi mới sửa. Tất cả nằm trong một transaction. Nếu quy tắc không thỏa mãn, thao tác dừng trước khi commit. Đây là đoạn rút gọn, không thay thế cơ chế khóa hoặc kiểm tra trạng thái khi cập nhật đồng thời.

## Ví dụ minh họa

```java
@Service
@RequiredArgsConstructor
public class RenameArticleService {
    private final ArticleRepository articles;

    @Transactional
    public void rename(UUID actorId, UUID articleId, String title) {
        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException("Title is required");
        }

        Article article = articles.findById(articleId)
            .orElseThrow(() -> new IllegalArgumentException("Not found"));

        if (!article.getAuthor().getId().equals(actorId)) {
            throw new SecurityException("Not the owner");
        }

        article.setTitle(title.strip());
    }
}
```

## Phân tích từng bước

1. Constructor injection giúp khai báo phụ thuộc một cách tường minh.
2. Entity được quản lý trong persistence context nên thay đổi có thể được ghi bằng dirty checking.
3. Trong dự án thật, thay exception minh họa bằng CustomException và ErrorCode thống nhất.

## Lỗi thường gặp

- @Transactional không tự giải quyết hai request cùng sửa một bản ghi.
- Gọi hàm transactional từ chính đối tượng đó thường không đi qua proxy như lời gọi từ bean khác.
- Không giữ transaction mở trong khi chờ một API bên ngoài phản hồi lâu.

> Code trong bài phục vụ học tập. Hãy điều chỉnh theo kiến trúc, phiên bản thư viện và quy tắc bảo mật của dự án trước khi sử dụng.

## Bài tập thực hành

Bổ sung kiểm tra chỉ DRAFT hoặc CHANGES_REQUESTED được đổi tiêu đề, rồi liệt kê test cho tác giả khác và trạng thái PENDING.

## Checklist tự kiểm tra

- Đã giải thích được đầu vào, đầu ra và giới hạn của ví dụ.
- Đã nghĩ tới dữ liệu rỗng, dữ liệu không hợp lệ và tình huống thất bại.
- Đã tách phần minh họa khỏi cấu hình và bí mật của môi trường thật.

---

**Kết luận:** Tổ chức controller, service và repository qua tình huống đổi tiêu đề bài viết trong một giao dịch.
