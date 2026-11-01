# Testing: kiểm thử biên thay vì chỉ kiểm tra happy path

Từ một hàm kiểm tra độ dài tên, xây dựng các ca rỗng, sát giới hạn và vượt giới hạn.

## Bối cảnh

Một test thành công chỉ chứng minh đúng tình huống mà nó đã chạy. Với dữ liệu nhập, các giá trị sát biên thường tìm ra lỗi tốt hơn những dữ liệu ngẫu nhiên luôn hợp lệ.

## Ý tưởng chính

Ví dụ JUnit kiểm tra một hàm nhỏ để thấy rõ quan hệ giữa yêu cầu và test. Đây là quy ước độ dài tính theo String.length, không phải bộ đếm ký tự hiển thị Unicode.

## Ví dụ minh họa

```java
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class NamePolicyTest {
    private boolean valid(String name) {
        return name != null
            && !name.isBlank()
            && name.strip().length() <= 100;
    }

    @Test
    void rejectsMissingOrBlankName() {
        assertFalse(valid(null));
        assertFalse(valid("   "));
    }

    @Test
    void checksTheLengthBoundary() {
        assertTrue(valid("a".repeat(100)));
        assertFalse(valid("a".repeat(101)));
    }
}
```

## Phân tích từng bước

1. Tên test nên thể hiện quy tắc cần bảo vệ.
2. Test API còn cần kiểm tra status, body và dữ liệu thực sự đã được thay đổi hay chưa.
3. Với thao tác dùng một lần, bổ sung test đồng thời thay vì chỉ gọi tuần tự.

## Lỗi thường gặp

- Không chỉ assert rằng mock đã được gọi rồi kết luận nghiệp vụ đúng.
- Không dùng sleep cố định dài để tạo race condition nếu có thể dùng barrier hoặc latch.
- Không bỏ qua test fail vì cho rằng nó không liên quan mà chưa điều tra.

> Code trong bài phục vụ học tập. Hãy điều chỉnh theo kiến trúc, phiên bản thư viện và quy tắc bảo mật của dự án trước khi sử dụng.

## Bài tập thực hành

Tạo ma trận test cho OTP: đúng, sai, hết hạn, đã dùng và hai request cùng dùng một mã.

## Checklist tự kiểm tra

- Đã giải thích được đầu vào, đầu ra và giới hạn của ví dụ.
- Đã nghĩ tới dữ liệu rỗng, dữ liệu không hợp lệ và tình huống thất bại.
- Đã tách phần minh họa khỏi cấu hình và bí mật của môi trường thật.

---

**Kết luận:** Từ một hàm kiểm tra độ dài tên, xây dựng các ca rỗng, sát giới hạn và vượt giới hạn.
