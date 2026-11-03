---
paths:
  - "server/**"
---

# Luật backend (`server/`)

Cách chạy và đọc kết quả test: dùng skill `backend-test`.

## Ngân sách test

- **Vòng lặp nhanh.** TDD chỉ chạy lớp test của task (`./gradlew test --tests '<Lớp>'`, không `clean`).
- **Cuối task: chỉ test bị ảnh hưởng.** Chạy một lần (gộp nhiều `--tests`) lớp của task + lớp regression spec nêu + lớp gọi code dùng chung đã sửa (grep caller). **Không** chạy `scripts/verify.sh` (full ~10 phút) trên máy: full backend do CI (`.github/workflows/ci.yml`) chạy khi mở PR. Chỉ chạy `verify.sh` khi người dùng yêu cầu (ví dụ tái hiện lỗi CI).
- **Mức test.**
  - Validator, mapper, logic service: JUnit/Mockito thuần, không Spring.
  - Validation/HTTP status của controller: `@WebMvcTest`.
  - `@SpringBootTest` + Testcontainers chỉ cho luồng cần DB/security thật, khoảng 3–5 ca mỗi endpoint.
- **Ưu tiên lớp tích hợp có sẵn.** Mỗi lớp tích hợp mới tốn khoảng 10–45 giây khởi động container + Spring context; không tạo lớp mới chỉ để kiểm validation.
- **Giữ cache context.** Không tự thêm tổ hợp `properties`, `@MockitoBean`, `@DirtiesContext` riêng nếu không bắt buộc; mỗi tổ hợp khác nhau làm Spring dựng lại context.

## Dữ liệu và schema

- DB đổi bằng Flyway migration mới theo thứ tự; không sửa migration đã áp dụng. `docs/technical/db/final.sql` chỉ để tham khảo, không đưa vào `db/migration`.
- File seed test (`src/test/resources/seed/**`) giữ LF (`.gitattributes`); test so sánh từng byte.
- Kiểu cột phải khớp entity vì Hibernate chạy `validate`: chuỗi `@Column(length = n)` dùng `varchar(n)`, không `char(n)` (bpchar làm context không khởi động).
- Test migration bằng Flyway thuần (không Spring): V1 tự `SET search_path TO techverse` nên muốn DB thứ hai thì `CREATE DATABASE`, không dùng schema khác; JDBC thêm `currentSchema=techverse,public` vào URL vì `SET search_path` mất khi mở kết nối mới.

## Entity và JPA

- Entity mới đi qua cascade của entity khác (vd. snapshot do `Article` cascade PERSIST) mà một entity thứ ba tham chiếu tới nó: `flush()` trước rồi mới `save` entity tham chiếu, nếu không FK bị null.
- Đổi tên/xóa enum, cột hoặc field dùng chung: trước khi sửa, grep cả `src/main` lẫn `src/test` (kể cả chuỗi SQL/JSON như `status=`, `$.data.status`), lập danh sách caller thuộc task khác; caller phải sửa tạm để biên dịch và test sẽ hỏng tới task sau thì ghi ngay vào “Lệch khác spec” + “Bắt đầu từ đây” của log.

## TDD tích hợp

- Endpoint mới: viết test tích hợp (MockMvc) cho endpoint trước khi viết service/controller, chạy thấy đỏ (404/405 hoặc assertion), rồi mới code. Không viết hết service rồi mới bổ sung test.

## Môi trường

- Chạy Gradle và `scripts/verify.sh` bằng Git Bash (không dùng WSL shim). Test tích hợp cần Docker daemon đang chạy (`docker info`).
