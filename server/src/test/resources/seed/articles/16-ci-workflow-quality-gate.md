# CI/CD: xây dựng quality gate trước khi merge

Sắp xếp kiểm tra dependency, test và build để phát hiện lỗi sớm trước khi đưa code vào nhánh chính.

## Bối cảnh

CI không chỉ là một huy hiệu xanh. Nó là cách chạy cùng một bộ kiểm tra cho mọi thành viên, tránh việc code chỉ hoạt động trên một máy.

## Ý tưởng chính

Đoạn lệnh thể hiện các bước cốt lõi có thể đưa vào workflow. Cần dùng đúng đường dẫn và hệ điều hành của runner. Không cần thêm bước deploy khi mục tiêu hiện tại chỉ là bảo đảm thay đổi có thể test và build.

## Ví dụ minh họa

```bash
# Ví dụ trên Linux runner, tại repository root.
# Dùng lockfile đã commit để cài dependency nhất quán.
(cd app && npm ci && npm test && npm run build)

# Gradle Wrapper dùng phiên bản Gradle của dự án.
(cd server && ./gradlew test bootJar)
```

## Phân tích từng bước

1. Dùng npm ci trong CI thay vì tự thay lockfile trong lúc build.
2. Kiểm thử backend cần cấu hình test riêng, không dùng database production.
3. Job phải thất bại khi lệnh kiểm tra thất bại; không thêm bỏ qua lỗi chỉ để workflow xanh.

## Lỗi thường gặp

- Không đưa .env thật vào artifact hoặc log CI.
- Không cấp quyền ghi hoặc secret cho job không cần đến chúng.
- Cache dependency không phải bằng chứng rằng source hiện tại đã build thành công.

> Code trong bài phục vụ học tập. Hãy điều chỉnh theo kiến trúc, phiên bản thư viện và quy tắc bảo mật của dự án trước khi sử dụng.

## Bài tập thực hành

Thiết kế hai job độc lập cho app và server; liệt kê secret nào thật sự cần và secret nào không được cấp.

## Checklist tự kiểm tra

- Đã giải thích được đầu vào, đầu ra và giới hạn của ví dụ.
- Đã nghĩ tới dữ liệu rỗng, dữ liệu không hợp lệ và tình huống thất bại.
- Đã tách phần minh họa khỏi cấu hình và bí mật của môi trường thật.

---

**Kết luận:** Sắp xếp kiểm tra dependency, test và build để phát hiện lỗi sớm trước khi đưa code vào nhánh chính.
