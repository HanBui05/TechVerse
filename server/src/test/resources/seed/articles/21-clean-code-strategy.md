# Clean Code: Strategy Pattern cho nhiều cách định dạng nội dung

Tách thuật toán biến đổi nội dung khỏi bộ điều phối, tránh một hàm lớn chứa nhiều điều kiện khó thay đổi.

## Bối cảnh

Khi hỗ trợ cả Markdown và văn bản thuần, hai loại dữ liệu có cách xử lý khác nhau. Một bộ điều phối nhỏ có thể chọn chiến lược phù hợp mà không gộp tất cả vào một hàm dài.

## Ý tưởng chính

Strategy Pattern đóng gói các cách thực hiện có thể thay thế. Mẫu này hữu ích khi các thuật toán thật sự có vòng đời riêng; với hai nhánh ngắn ổn định, if/else có thể đơn giản hơn.

## Ví dụ minh họa

```java
interface ContentFormatter {
    String format(String input);
}

final class MarkdownFormatter implements ContentFormatter {
    @Override
    public String format(String input) {
        return input.strip();
    }
}

final class ImportPreview {
    private final ContentFormatter formatter;

    ImportPreview(ContentFormatter formatter) {
        this.formatter = formatter;
    }

    String preview(String text) {
        if (text == null || text.isBlank()) {
            throw new IllegalArgumentException("Empty content");
        }
        return formatter.format(text);
    }
}
```

## Phân tích từng bước

1. Interface thể hiện điểm thay đổi là cách format, không phải toàn bộ nghiệp vụ import.
2. Kiểm tra định dạng file và kích thước vẫn cần ở ranh giới upload.
3. Ví dụ không sanitize HTML; validate nội dung là trách nhiệm bổ sung.

## Lỗi thường gặp

- Không biến một đoạn strip thành hàng loạt abstraction trong sản phẩm nhỏ nếu chưa có nhu cầu.
- Không nhầm định dạng Markdown với việc thực thi code.
- Không bỏ cơ chế an toàn của renderer vì đã dùng một formatter.

> Code trong bài phục vụ học tập. Hãy điều chỉnh theo kiến trúc, phiên bản thư viện và quy tắc bảo mật của dự án trước khi sử dụng.

## Bài tập thực hành

Thêm PlainTextFormatter có quy tắc escape rõ ràng và viết test với dấu sao, backtick và thẻ HTML.

## Checklist tự kiểm tra

- Đã giải thích được đầu vào, đầu ra và giới hạn của ví dụ.
- Đã nghĩ tới dữ liệu rỗng, dữ liệu không hợp lệ và tình huống thất bại.
- Đã tách phần minh họa khỏi cấu hình và bí mật của môi trường thật.

---

**Kết luận:** Tách thuật toán biến đổi nội dung khỏi bộ điều phối, tránh một hàm lớn chứa nhiều điều kiện khó thay đổi.
