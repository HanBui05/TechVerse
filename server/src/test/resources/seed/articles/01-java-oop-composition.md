# Java OOP: ưu tiên composition khi xây dựng dịch vụ thông báo

Phân biệt kế thừa và composition qua ví dụ gửi thông báo, giúp thay đổi kênh gửi mà không sửa logic nghiệp vụ.

## Bối cảnh

Một dịch vụ đăng ký có thể gửi thông báo qua email hôm nay và thêm kênh khác sau này. Nếu logic đăng ký phụ thuộc trực tiếp vào một lớp gửi cụ thể, mỗi thay đổi hạ tầng dễ kéo theo thay đổi nghiệp vụ.

## Ý tưởng chính

Composition nghĩa là một đối tượng sử dụng đối tượng khác để hoàn thành công việc. Interface mô tả điều cần làm, còn lớp triển khai quyết định làm thế nào. Không cần tạo một cây kế thừa chỉ để tái sử dụng vài dòng code.

## Ví dụ minh họa

```java
interface NotificationSender {
    void send(String recipient, String message);
}

final class ConsoleSender implements NotificationSender {
    @Override
    public void send(String recipient, String message) {
        System.out.println(recipient + ": " + message);
    }
}

final class RegistrationNotice {
    private final NotificationSender sender;

    RegistrationNotice(NotificationSender sender) {
        this.sender = sender;
    }

    void welcome(String email) {
        sender.send(email, "Chào mừng đến với TechVerse!");
    }
}
```

## Phân tích từng bước

1. RegistrationNotice phụ thuộc vào hợp đồng NotificationSender, không biết nhà cung cấp email.
2. ConsoleSender là ví dụ minh họa; thay bằng adapter gửi email không làm đổi hàm welcome.
3. Constructor thể hiện rõ phụ thuộc cần có để đối tượng hoạt động.

## Lỗi thường gặp

- Không tạo interface cho mọi lớp theo thói quen; ưu tiên các ranh giới thật sự cần thay thế.
- Không ghi email, mật khẩu hoặc token thật vào log khi triển khai thực tế.
- Composition không loại bỏ hoàn toàn kế thừa; chọn theo quan hệ nghiệp vụ.

> Code trong bài phục vụ học tập. Hãy điều chỉnh theo kiến trúc, phiên bản thư viện và quy tắc bảo mật của dự án trước khi sử dụng.

## Bài tập thực hành

Tạo một FakeSender lưu thông báo vào danh sách, sau đó kiểm tra welcome chỉ gửi đúng một thông báo.

## Checklist tự kiểm tra

- Đã giải thích được đầu vào, đầu ra và giới hạn của ví dụ.
- Đã nghĩ tới dữ liệu rỗng, dữ liệu không hợp lệ và tình huống thất bại.
- Đã tách phần minh họa khỏi cấu hình và bí mật của môi trường thật.

---

**Kết luận:** Phân biệt kế thừa và composition qua ví dụ gửi thông báo, giúp thay đổi kênh gửi mà không sửa logic nghiệp vụ.
