---
paths:
  - "server/**"
---

# Luật backend (`server/`)

Cách chạy và đọc kết quả test: dùng skill `backend-test`.

## Ngân sách test

- **Vòng lặp nhanh.** TDD chỉ chạy lớp test của task (`./gradlew test --tests '<Lớp>'`, không `clean`). `scripts/verify.sh` chỉ chạy **một lần** ở cuối, chạy nền, không theo dõi liên tục.
- **Mức test.**
  - Validator, mapper, logic service: JUnit/Mockito thuần, không Spring.
  - Validation/HTTP status của controller: `@WebMvcTest`.
  - `@SpringBootTest` + Testcontainers chỉ cho luồng cần DB/security thật, khoảng 3–5 ca mỗi endpoint.
- **Ưu tiên lớp tích hợp có sẵn.** Mỗi lớp tích hợp mới tốn khoảng 10–45 giây khởi động container + Spring context; không tạo lớp mới chỉ để kiểm validation.
- **Giữ cache context.** Không tự thêm tổ hợp `properties`, `@MockitoBean`, `@DirtiesContext` riêng nếu không bắt buộc; mỗi tổ hợp khác nhau làm Spring dựng lại context.

## Dữ liệu và schema

- DB đổi bằng Flyway migration mới theo thứ tự; không sửa migration đã áp dụng. `docs/technical/db/final.sql` chỉ để tham khảo, không đưa vào `db/migration`.
- File seed test (`src/test/resources/seed/**`) giữ LF (`.gitattributes`); test so sánh từng byte.

## Môi trường

- Chạy Gradle và `scripts/verify.sh` bằng Git Bash (không dùng WSL shim). Test tích hợp cần Docker daemon đang chạy (`docker info`).
