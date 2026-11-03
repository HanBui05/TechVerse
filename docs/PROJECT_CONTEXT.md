# PROJECT_CONTEXT

> Bản chốt theo workspace ngày **2026-11-02** (múi giờ Asia/Ho_Chi_Minh). Trạng thái dự án trước khi dựng workflow đã được checkpoint tại commit `b353805`; công việc workflow tiếp tục trên branch `codex/setup-agent-workflow`.

## Một người mới vào cần biết gì để làm việc được ngay?

TechVerse là monorepo gồm frontend React ở [`app/`](../app/) và backend Spring Boot ở [`server/`](../server/). Muốn bắt đầu nhanh: cài **JDK 21**, **Node.js `^20.19.0` hoặc `>=22.12.0`**, Docker; sao chép [`.env.example`](../.env.example) thành `.env` và điền secret; chạy PostgreSQL 16 + Redis 7; sau đó chạy backend ở cổng `8080` và frontend ở cổng `3000`. Hiện phần hoàn thiện nhất là auth/profile/author/article/moderation/admin taxonomy; đừng nhầm các bảng course/payment/exercise/forum trong schema với tính năng đã có API. Khi sửa backend phải đi theo `controller -> DTO -> service -> repository/entity`, đặt `@Transactional` ở service, giữ nguyên envelope phản hồi và để Flyway quản lý DB.

### Nguồn sự thật và thứ tự ưu tiên

1. Mã chạy thực tế và cấu hình: [`server/src/main`](../server/src/main/), [`app/src`](../app/src/), [`server/build.gradle`](../server/build.gradle), [`app/package-lock.json`](../app/package-lock.json).
2. Lịch sử schema chạy thật: [`server/src/main/resources/db/migration/`](../server/src/main/resources/db/migration/). Đây là nguồn Flyway áp dụng khi khởi động.
3. Schema hợp nhất V1–V10 để đọc/ERD hoặc tạo **DB rỗng** thủ công: [`docs/technical/db/final.sql`](../docs/technical/db/final.sql). File này tự ghi rõ không được đưa vào thư mục migration và không chạy lên DB đã có dữ liệu.
4. Hành vi được kiểm chứng: [`server/src/test`](../server/src/test/) và các file `*.test.ts(x)` trong [`app/src`](../app/src/).

## 1. Tổng quan

TechVerse là nền tảng học và chia sẻ kiến thức công nghệ cho sinh viên CNTT, lập trình viên và người học công nghệ: người dùng có thể đăng ký/đăng nhập, quản lý hồ sơ, xin trở thành tác giả, viết bài Markdown, gửi kiểm duyệt và đọc bài đã xuất bản; admin quản lý người dùng, hồ sơ tác giả, topic/tag, còn moderator duyệt bài. Dự án đang ở giai đoạn **đang phát triển**, chưa phải bản phát hành: vertical slice auth–article đã có backend, frontend và test; các miền khóa học, thanh toán, bài tập, phỏng vấn và cộng đồng mới dừng ở schema hoặc UI placeholder.

## 2. Tech stack và cách chạy

### Phiên bản đã xác nhận từ repository

| Thành phần | Phiên bản / lựa chọn | Nguồn |
|---|---|---|
| Java | 21 | [`server/build.gradle`](../server/build.gradle), [`server/Dockerfile`](../server/Dockerfile) |
| Spring Boot | 4.1.1 | [`server/build.gradle`](../server/build.gradle) |
| Gradle Wrapper | 9.8.1 | [`server/gradle/wrapper/gradle-wrapper.properties`](../server/gradle/wrapper/gradle-wrapper.properties) |
| PostgreSQL | 16 Alpine, schema `techverse` | [`compose.yaml`](../compose.yaml), [`application.yaml`](../server/src/main/resources/application.yaml) |
| Redis | 7 Alpine | [`compose.yaml`](../compose.yaml) |
| Frontend | React 19.3.1, TypeScript 7.0.2, Vite 8.3.5 | [`app/package-lock.json`](../app/package-lock.json) |
| Test | JUnit 5/Spring Test/Testcontainers; Vitest 5.0.5 + Testing Library | [`server/build.gradle`](../server/build.gradle), [`app/package.json`](../app/package.json) |

Lưu ý: `app/package.json` đang dùng nhiều dependency với giá trị `latest`; phiên bản ở bảng là phiên bản đã khóa trong `package-lock.json`. Vite hiện yêu cầu Node.js `^20.19.0 || >=22.12.0`, nhưng dự án chưa có `.nvmrc` hay trường `engines` riêng.

### Khởi tạo local trên Windows PowerShell

1. Tạo file môi trường từ [`.env.example`](../.env.example), điền các biến bắt buộc, tuyệt đối không commit `.env`.
2. Khởi động hạ tầng: `docker compose up -d postgres redis`.
3. Backend: vào `server/`, chạy `.\gradlew.bat bootRun --args="--spring.profiles.active=dev"`.
4. Frontend: vào `app/`, chạy `npm ci`, rồi `npm run dev`.
5. Mở frontend tại `http://localhost:3000`; API tại `http://localhost:8080`; Swagger UI tại `http://localhost:8080/swagger-ui.html`.

### Build và test

| Việc | Windows | Linux/macOS |
|---|---|---|
| Build backend | `cd server; .\gradlew.bat bootJar` | `cd server && ./gradlew bootJar` |
| Chạy backend | `cd server; .\gradlew.bat bootRun --args="--spring.profiles.active=dev"` | `cd server && ./gradlew bootRun --args='--spring.profiles.active=dev'` |
| Test backend | `cd server; .\gradlew.bat test` | `cd server && ./gradlew test` |
| Cài frontend | `cd app; npm ci` | `cd app && npm ci` |
| Chạy frontend | `cd app; npm run dev` | `cd app && npm run dev` |
| Test frontend | `cd app; npm test` | `cd app && npm test` |
| Build frontend | `cd app; npm run build` | `cd app && npm run build` |

Test integration backend dùng Testcontainers nên Docker daemon phải hoạt động. `docker compose up --build` chưa phải đường chạy khuyến nghị cho Google OAuth/email cho đến khi xử lý khoảng trống biến môi trường nêu ở [mục lỗi đã biết](#lỗi-đã-biết-và-rủi-ro-đã-xác-minh).

## 3. Kiến trúc và cấu trúc thư mục

```text
TechVerse/
├─ app/                       React SPA
│  └─ src/
│     ├─ components/         UI dùng lại và layout/sidebars
│     ├─ pages/              Trang theo route/nghiệp vụ
│     ├─ services/           API client, auth, profile, đăng ký
│     ├─ data/               i18n và dữ liệu trình bày
│     └─ types/              Kiểu dùng chung phía frontend
├─ server/                    Spring Boot REST API
│  └─ src/
│     ├─ main/java/com/techverse/server/
│     │  ├─ controller/      HTTP, validation, DTO vào/ra
│     │  ├─ service/impl/    Interface và nghiệp vụ/transaction
│     │  ├─ repository/      Spring Data, specification, JDBC đặc thù
│     │  ├─ entity/          JPA entity của phần đã triển khai
│     │  ├─ dto/             request/response/internal DTO
│     │  ├─ configuration/   Security, OAuth2, JWT, OpenAPI, storage
│     │  ├─ exception/       Mã lỗi và global handler
│     │  ├─ validation/      Annotation/validator nghiệp vụ
│     │  ├─ event/listener/  Email và tác vụ sau commit
│     │  └─ properties/      Configuration properties
│     ├─ main/resources/     YAML, Flyway, Redis Lua
│     └─ test/               Unit + integration tests/fixtures
├─ docs/                      SQL hợp nhất và quy ước Git
├─ references/                Ảnh tham chiếu giao diện
├─ compose.yaml               PostgreSQL, Redis, server
└─ .github/workflows/ci.yml   CI backend
```

### Luồng phụ thuộc cố định

- Controller chỉ giải quyết HTTP, quyền, validation và map DTO; không trả entity trực tiếp.
- Service interface nằm ở `service/`, implementation ở `service/impl/`; transaction đặt tại implementation. Trường hợp import/upload có khóa/rate limit đặc thù vẫn phải giữ ranh giới nghiệp vụ hiện có.
- Repository làm việc với JPA entity hoặc JDBC projection; filter phức tạp đặt trong `repository/specification/`.
- Frontend gọi API qua [`app/src/services/api/client.ts`](../app/src/services/api/client.ts), access token ở `sessionStorage`, refresh token qua cookie HTTP-only và có single-flight refresh.

## 4. Data model

### Quy tắc chung

- PostgreSQL dùng UUID, `timestamptz`, schema `techverse`; hầu hết bảng có audit `created_at`, `created_by`, `updated_at`, `updated_by`.
- Email, tên topic và tag dùng `citext` để unique không phân biệt hoa/thường.
- Không dùng soft-delete thống nhất bằng `deleted_at`: tài khoản/taxonomy dùng `is_active`; nội dung dùng cột `status`.
- Bốn role dựng sẵn: `LEARNER`, `AUTHOR`, `MODERATOR`, `ADMIN`.
- File tham chiếu hợp nhất: [`docs/technical/db/final.sql`](../docs/technical/db/final.sql). Migration chạy thật: [`V1`](../server/src/main/resources/db/migration/V1__initial_schema.sql), [`V2`](../server/src/main/resources/db/migration/V2__remove_email_verification_and_initialize_user_audit.sql), [`V3`](../server/src/main/resources/db/migration/V3__initialize_social_account_audit.sql), [`V4`](../server/src/main/resources/db/migration/V4__add_admin_user_query_indexes.sql), [`V5`](../server/src/main/resources/db/migration/V5__index_author_profile_status_for_admin_user_filter.sql), [`V6`](../server/src/main/resources/db/migration/V6__add_author_profile_version.sql), [`V7`](../server/src/main/resources/db/migration/V7__add_author_suspension_and_restoration_audit.sql), [`V8`](../server/src/main/resources/db/migration/V8__create_author_application_review_history.sql), [`V9`](../server/src/main/resources/db/migration/V9__add_topic_icon.sql), [`V10`](../server/src/main/resources/db/migration/V10__add_article_publication_versions.sql) (V10 dừng nếu `articles` đã có dữ liệu: làm mới DB dev theo D-022, xem RUNBOOK).

### Các bảng đang được mã ứng dụng sử dụng

| Bảng | Cột quan trọng | Quan hệ chính |
|---|---|---|
| `users` | `full_name`, `email`, `password` nullable cho social-only, `phone_number`, `date_of_birth`, `avatar_url`, `is_active` | Gốc của role, social account, author profile và nội dung; audit tự tham chiếu `users` |
| `roles` | `name`, `description` | N–N với `users` qua `user_roles` |
| `user_roles` | `user_id`, `role_id` | FK tới `users`, `roles`; unique cặp user-role |
| `social_accounts` | `provider`, `provider_id` | N–1 `users`; unique provider identity và user-provider |
| `author_profiles` | `bio`, `expertise`, `portfolio_url`, `status`, review/suspend/restore audit, `version` | 1–1 `users`; reviewer/suspender/restorer đều FK `users` |
| `topics` | `name`, `description`, `is_active` | 1–N `articles` và các miền nội dung tương lai |
| `tags` | `name`, `description`, `is_active` | N–N `articles` qua `article_tags` |
| `articles` | Working copy của tác giả: `title`, `summary`, `content`, `cover_image_url`, `content_fingerprint`; hai trục `workflow_status` (DRAFT/PENDING/PUBLISHED/CHANGES_REQUESTED) và `publication_status` (UNPUBLISHED/PUBLISHED/AUTHOR_HIDDEN/HIDDEN/AUTHOR_DELETED/REMOVED) + `hidden_from_publication_status`; `published_version_id`, moderation fields | N–1 `users` tác giả; N–1 `topics`; N–N `tags`; trỏ snapshot đang công khai (FK cùng bài) |
| `article_publication_versions` | Snapshot bất biến đã duyệt: `version_number`, nội dung, `topic_id`, `content_fingerprint`, `reading_minutes`, `approved_by/at` | N–1 `articles` (RESTRICT: bài từng công khai chỉ xóa mềm); tag qua `article_publication_version_tags`; trigger chặn UPDATE/DELETE |
| `article_moderation_history` | Lịch sử append-only: actor, action, note, trạng thái trước/sau, version | N–1 `articles` (CASCADE khi xóa cứng bài chưa từng công khai); trigger chặn UPDATE |
| `article_tags` | `article_id`, `tag_id` | FK tới `articles`, `tags`; unique cặp article-tag |

Refresh session, token và password-reset OTP không nằm trong SQL; chúng được lưu ở Redis qua [`AuthSessionRepository`](../server/src/main/java/com/techverse/server/repository/AuthSessionRepository.java), [`TokenRepository`](../server/src/main/java/com/techverse/server/repository/TokenRepository.java) và [`PasswordResetRepository`](../server/src/main/java/com/techverse/server/repository/PasswordResetRepository.java).

### Bảng đã có schema nhưng chưa có vertical slice API/UI hoàn chỉnh

| Miền | Bảng và quan hệ cốt lõi |
|---|---|
| Lưu nội dung/tài liệu | `saved_articles(user_id, article_id)`; `documents(author_id, ...)`; `saved_documents(user_id, document_id)` |
| Khóa học | `courses(author_id, topic_id, ...)` 1–N `lessons(course_id, position)` |
| Bán hàng/quyền học | `orders(user_id)` 1–N `order_items(order_id, course_id, commission_policy_id)`; `payment_transactions(order_id)`; `course_enrollments(user_id, course_id, order_item_id)`; `lesson_progress(user_id, lesson_id)`; `refunds(payment_transaction_id, order_item_id)` |
| Luyện tập/phỏng vấn | `exercise_sets(author_id, topic_id)` 1–N `exercise_questions`; `exercise_attempts(user_id, exercise_set_id)`; `interview_questions(author_id, topic_id)` |
| Cộng đồng/kiểm duyệt | `forum_posts(user_id, parent_id)` tự tham chiếu; `comments(user_id, parent_id, target_type, target_id)` đa hình; `reports(reporter_id, target_type, target_id, handled_by)` |

## 5. Trạng thái hiện tại

### Đã xong ở mức có mã backend + frontend hoặc API + test

- Đăng ký, đăng nhập mật khẩu, access/refresh JWT, logout một/tất cả thiết bị.
- Google OAuth2 signup/login, nhập avatar Google và frontend callback/session synchronization.
- Quên mật khẩu bằng OTP Redis + email, reset và revoke session.
- Hồ sơ người dùng và upload avatar Cloudinary.
- Nộp/gửi lại hồ sơ tác giả; admin duyệt, từ chối, đình chỉ, khôi phục.
- Admin quản lý người dùng, topic và tag.
- Tác giả tạo/sửa draft, import Markdown/text, upload ảnh, gắn topic/tag và gửi duyệt.
- Moderator đọc/duyệt/yêu cầu sửa bài; người dùng đã đăng nhập đọc và lọc bài published.
- Giao diện theme/ngôn ngữ lưu local và các sidebar theo role.

### Đang làm dở

- Khung workflow `Plan → Code → Test → Review → Result` đang được dựng trên branch `codex/setup-agent-workflow`; xem [`PLAN.md`](../plans/PLAN.md) để biết trạng thái task thay vì suy luận từ tên branch.
- Admin dashboard và moderator dashboard mới là khung hiển thị; số liệu/hoạt động/online users chưa có API thật.
- CI hiện chỉ chạy backend; frontend test/build chưa nằm trong quality gate.
- Frontend đã có chức năng đọc/viết bài nhưng bundle chưa code-split.

### Chưa làm

- API/service/UI cho document và saved content.
- Course, lesson, enrollment/progress.
- Order, payment, commission, refund.
- Exercise và interview practice.
- Forum, comment, report.
- Dashboard analytics/online activity thật.

### Lỗi đã biết và rủi ro đã xác minh

- **Backend integration test phụ thuộc Docker:** lần kiểm tra ngày 2026-11-02, `bootJar` đạt; `test` chạy 71 test, 53 đạt và 18 lỗi khởi tạo vì Testcontainers không tìm thấy Docker. Đây là blocker môi trường hiện tại, chưa phải bằng chứng 18 lỗi nghiệp vụ. Report local ở `server/build/reports/tests/test/index.html` sau khi chạy.
- **Compose thiếu biến:** [`application-dev.yaml`](../server/src/main/resources/application-dev.yaml) yêu cầu `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SENDGRID_TEMPLATE_REGISTER_SUCCESS`, nhưng service `server` trong [`compose.yaml`](../compose.yaml) chưa forward các biến này; [`.env.example`](../.env.example) cũng chưa liệt kê đủ toàn bộ biến SendGrid. Google OAuth/email đăng ký trong container cần sửa cấu hình trước.
- **Bundle lớn:** `npm run build` đạt nhưng Vite cảnh báo chunk JS minified khoảng `860.63 kB`, vượt ngưỡng `500 kB`.
- **Dependency reproducibility:** nhiều dependency frontend ghi `latest`; phải dùng `npm ci` và giữ lockfile, đồng thời nên pin version/Node.
- Chưa ghi nhận lỗi chức năng tái hiện khác từ lần kiểm tra này.

## 6. Việc nên làm tiếp theo

1. Hoàn tất pilot workflow, review diff và chỉ commit đúng file trong task; không đưa secret/build artifact vào commit.
2. Sửa `compose.yaml` và `.env.example` để đồng bộ Google OAuth + SendGrid; thêm smoke test khởi động profile `dev` bằng Compose.
3. Chạy toàn bộ backend integration test trên máy có Docker và xử lý lỗi thật nếu còn; giữ `bootJar`, frontend test/build cùng xanh.
4. Thêm frontend `npm ci && npm test && npm run build` vào [CI](../.github/workflows/ci.yml).
5. Code-split theo route, ưu tiên các màn admin/author/moderator để giảm initial bundle.
6. Sau khi ổn định vertical slice bài viết, chọn **một** miền tiếp theo và làm end-to-end. Với mục tiêu nền tảng học, ưu tiên hợp lý là `courses -> lessons -> enrollments/progress`; chưa nên bắt đầu payment trước khi course miễn phí hoạt động.

## 7. Quy ước và quyết định cố định

- Tên package gốc: `com.techverse.server`; API version prefix `/api/v1`.
- Backend theo layered architecture; DTO tách khỏi entity, không trả entity JPA ra controller.
- Entity kế thừa audit từ [`BaseEntity`](../server/src/main/java/com/techverse/server/entity/BaseEntity.java), dùng constructor/method nghiệp vụ có kiểm soát; không thêm Lombok `@Data` vào entity.
- `@Transactional` đặt ở service implementation; read path dùng `readOnly = true` khi phù hợp.
- Success response dùng `ApiResponse<T>` với `status`, `message`, `data`; error dùng `ErrorResponse` với `status`, `code`, `message`, `error`, `timestamp`, `path`, `fieldErrors`. Không tự đổi sang raw object hoặc `ProblemDetail` nếu chưa có quyết định toàn dự án. Xem [`ApiResponse`](../server/src/main/java/com/techverse/server/dto/response/ApiResponse.java) và [`GlobalExceptionHandler`](../server/src/main/java/com/techverse/server/exception/GlobalExceptionHandler.java).
- DB thay đổi bằng Flyway migration mới theo thứ tự tiếp theo; **không sửa V1–V10 đã áp dụng**, không đưa `final.sql` vào `db/migration`, không dùng JPA `ddl-auto` để tạo schema (`validate` đang là chuẩn).
- Không soft-delete tùy ý: bám semantics `is_active`/`status` hiện có và FK `ON DELETE` trong schema.
- Quyền phải được chặn ở backend (`SecurityConfiguration`/`@PreAuthorize`); route guard frontend chỉ là UX.
- Token access ở `sessionStorage`; refresh token qua cookie; không đưa provider OAuth token xuống frontend hoặc lưu lâu dài.
- Bài viết là Markdown; ảnh upload tách riêng, có idempotency key/upload key và giới hạn/rate limit hiện có.
- Git: `main` luôn ổn định, không push trực tiếp/force push; branch `feature/...`, `fix/...`, `chore/...`; commit theo `<type>(<scope>): <mô-tả>`. Xem [`docs/GIT_WORKFLOW.md`](../docs/GIT_WORKFLOW.md).
- Không commit `.env`, secret, `node_modules`, `dist`, `server/build` hay IDE files.

## 8. API endpoint hiện có

Tài liệu runtime đầy đủ được sinh từ OpenAPI tại `/swagger-ui.html`; bảng dưới đây là bản đồ nhanh từ [`controller/`](../server/src/main/java/com/techverse/server/controller/).

| Quyền | Method | Path | Mục đích |
|---|---|---|---|
| Public | POST | `/api/v1/auth/register` | Đăng ký learner |
| Public | POST | `/api/v1/auth/login` | Đăng nhập email/password |
| Public | POST | `/api/v1/auth/refresh` | Đổi refresh cookie lấy access token |
| Auth | POST | `/api/v1/auth/logout` | Thu hồi session hiện tại |
| Auth | POST | `/api/v1/auth/logout-all` | Thu hồi mọi session |
| Public | POST | `/api/v1/auth/forgot-password` | Gửi OTP reset |
| Public | POST | `/api/v1/auth/verify-reset-otp` | Đổi OTP lấy reset token một lần |
| Public | POST | `/api/v1/auth/reset-password` | Đổi mật khẩu và revoke session |
| Public | GET | `/oauth2/authorization/google` | Bắt đầu Google OAuth2 |
| Auth | GET | `/api/v1/users/me` | Xem hồ sơ mình |
| Auth | PATCH | `/api/v1/users/me` | Sửa hồ sơ mình |
| Auth | PATCH | `/api/v1/users/me/avatar` | Upload avatar JPEG/PNG/WebP tối đa 5 MiB |
| Auth | POST | `/api/v1/author-profiles/me` | Nộp hồ sơ tác giả |
| Auth | GET | `/api/v1/author-profiles/me` | Xem hồ sơ tác giả của mình |
| Auth | PATCH | `/api/v1/author-profiles/me/resubmit` | Sửa và nộp lại hồ sơ bị từ chối |
| ADMIN | GET | `/api/v1/admin/users` | Lọc/phân trang người dùng |
| ADMIN | GET | `/api/v1/admin/users/{userId}` | Chi tiết người dùng |
| ADMIN | PATCH | `/api/v1/admin/users/bulk-status` | Khóa/mở khóa nhiều tài khoản |
| ADMIN | GET | `/api/v1/admin/author-applications` | Lọc/phân trang hồ sơ tác giả |
| ADMIN | GET | `/api/v1/admin/author-applications/{id}` | Chi tiết hồ sơ |
| ADMIN | PATCH | `/api/v1/admin/author-applications/{id}/review` | Duyệt/từ chối theo version |
| ADMIN | PATCH | `/api/v1/admin/author-applications/{id}/suspend` | Đình chỉ author |
| ADMIN | PATCH | `/api/v1/admin/author-applications/{id}/restore` | Khôi phục author |
| ADMIN | POST | `/api/v1/admin/topics` | Tạo topic |
| ADMIN | GET | `/api/v1/admin/topics` | Tìm/phân trang topic |
| ADMIN | GET | `/api/v1/admin/topics/{id}` | Chi tiết topic |
| ADMIN | PATCH | `/api/v1/admin/topics/{id}` | Sửa topic |
| ADMIN | PATCH | `/api/v1/admin/topics/{id}/status` | Bật/tắt topic |
| ADMIN | POST | `/api/v1/admin/tags` | Tạo tag |
| ADMIN | GET | `/api/v1/admin/tags` | Tìm/phân trang tag |
| ADMIN | GET | `/api/v1/admin/tags/{id}` | Chi tiết tag |
| ADMIN | PATCH | `/api/v1/admin/tags/{id}` | Sửa tag |
| ADMIN | PATCH | `/api/v1/admin/tags/{id}/status` | Bật/tắt tag |
| AUTHOR | GET | `/api/v1/author/articles/options` | Lấy topic/tag đang hoạt động |
| AUTHOR | POST | `/api/v1/author/articles/import` | Đọc `.md`/`.txt` UTF-8 tối đa 1 MiB, chưa lưu bài |
| AUTHOR | POST | `/api/v1/author/articles` | Tạo draft/submit; yêu cầu `Idempotency-Key` |
| Auth | GET | `/api/v1/author/articles` | Danh sách bài của mình |
| Auth | GET | `/api/v1/author/articles/{id}` | Chi tiết bài của mình |
| AUTHOR | PATCH | `/api/v1/author/articles/{id}` | Lưu (SAVE, cho giữ ảnh chưa tải lên và trả `imageIssues`) hoặc gửi duyệt (SUBMIT); sửa được cả bài đã công khai mà không đổi bản công khai |
| AUTHOR | POST | `/api/v1/author/articles/{id}/images` | Upload ảnh draft; hỗ trợ `Upload-Key` |
| AUTHOR | POST | `/api/v1/author/articles/{id}/withdraw` | Rút bản đang chờ duyệt về DRAFT; bản công khai giữ nguyên |
| AUTHOR | POST | `/api/v1/author/articles/{id}/discard` | Bỏ bản sửa chưa gửi, khôi phục từ snapshot công khai |
| AUTHOR | PATCH | `/api/v1/author/articles/{id}/publication` | Tác giả tự ẩn/hiện (`HIDE`/`UNHIDE`) bài đã công khai |
| Auth | DELETE | `/api/v1/author/articles/{id}` | Xóa cứng bài chưa từng công khai (tombstone khóa tạo bài) hoặc xóa mềm `AUTHOR_DELETED`; tác giả bị đình chỉ vẫn xóa được |
| Auth | GET | `/api/v1/author/articles/{id}/history` | Lịch sử duyệt/xuất bản của bài mình, mới nhất trước |
| MODERATOR | GET | `/api/v1/moderator/articles` | Danh sách bài không phải draft riêng/`AUTHOR_DELETED`; lọc `workflowStatus`/`publicationStatus`; có `authorEligible`, `hasUnpublishedChanges` |
| MODERATOR | GET | `/api/v1/moderator/articles/{id}` | Working copy + `article.publishedVersion` để so, 5 lịch sử gần nhất, `authorEligible`, review token |
| MODERATOR | PATCH | `/api/v1/moderator/articles/{id}/review` | APPROVE tạo version kế tiếp (kiểm lại ảnh/tác giả/taxonomy) hoặc REQUEST_CHANGES; chống review stale |
| MODERATOR | PATCH | `/api/v1/moderator/articles/{id}/publication` | `HIDE`/`RESTORE`/`REMOVE` + `reviewToken`; HIDE/REMOVE bắt buộc lý do; RESTORE về trạng thái trước HIDE |
| MODERATOR | GET | `/api/v1/moderator/articles/{id}/history` | Lịch sử đầy đủ, mới nhất trước |
| Auth | GET | `/api/v1/articles` | Snapshot visible (PUBLISHED + tác giả active + profile không SUSPENDED); `keyword`/`topicId`/`tagId`, `sort=NEWEST/OLDEST` |
| Auth | GET | `/api/v1/articles/options` | Topic/tag phục vụ bộ lọc |
| Auth | GET | `/api/v1/articles/{id}` | Snapshot + thẻ tác giả công khai + tối đa 5 bài liên quan (cùng topic hoặc chung tag) |

## 9. Luồng nghiệp vụ chính

### Đăng nhập/session

Frontend gọi auth endpoint hoặc Google OAuth; backend phát access JWT ngắn hạn và refresh cookie. [`api/client.ts`](../app/src/services/api/client.ts) tự refresh một lần khi gặp `401`, đồng bộ concurrent request và không cho response cũ ghi đè session mới. Backend lưu session/refresh state ở Redis và dùng role claims cho authorization.

### Tác giả và bài viết

Learner nộp `author_profile` -> admin review -> khi approved, user có role `AUTHOR` -> author tạo draft/import Markdown -> upload ảnh và lưu URL -> submit thành `PENDING` -> moderator đọc với review token -> `APPROVE` chuyển `PUBLISHED` hoặc `REQUEST_CHANGES` trả về tác giả -> reader đã đăng nhập đọc qua published API.

## 10. Biến môi trường và tích hợp ngoài

Không ghi giá trị secret vào tài liệu. Danh sách khởi đầu ở [`.env.example`](../.env.example); cấu hình tiêu thụ nằm trong [`application*.yaml`](../server/src/main/resources/).

| Nhóm | Biến |
|---|---|
| PostgreSQL | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST_PORT`, `DATABASE_HOST`, `DATABASE_PORT` |
| Redis | `REDIS_HOST`, `REDIS_PORT`, `REDIS_HOST_PORT` |
| Server/web | `SERVER_PORT`, `SPRING_PROFILES_ACTIVE`, `WEB_URL`, frontend `VITE_API_BASE_URL` |
| JWT/reset | `JWT_SECRET_KEY`, `PASSWORD_RESET_SECRET` |
| Google OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| SendGrid | `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `SENDGRID_FROM_NAME`, `SENDGRID_TEMPLATE_REGISTER_SUCCESS`, `SENDGRID_TEMPLATE_RESET_PASSWORD_OTP` |
| Cloudinary | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_ARTICLE_FOLDER`, `CLOUDINARY_CLEANUP_ENABLED` |
| Dev admin | `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD` |

Tích hợp đang dùng: PostgreSQL/Flyway, Redis cho session/rate limit/password reset, Google OAuth2, SendGrid email, Cloudinary avatar/ảnh bài viết, Swagger/OpenAPI. Không có payment gateway hoặc queue/broker ở mã hiện tại.

## 11. Chiến lược test hiện tại

- Backend unit test cho JWT, image/content processing, Cloudinary, OAuth handler, initializer; integration test dùng PostgreSQL Testcontainers cho controller/service/persistence và Flyway.
- Frontend dùng Vitest + Testing Library, tập trung vào auth race/session, role routing, pagination, quản trị, đọc Markdown và quy trình tạo/upload/submit bài.
- CI hiện chạy `./gradlew test` trên Java 21 cho push `main` và pull request; chưa chạy frontend.
- Fixture demo ở [`server/src/test/resources/seed/`](../server/src/test/resources/seed/) chỉ phục vụ test/demo, không phải production seed.

## 12. Muốn sửa X thì xem file Y

| Việc | File/đường dẫn bắt đầu |
|---|---|
| Route và role guard frontend | [`app/src/App.tsx`](../app/src/App.tsx) |
| Cơ chế token/refresh và gọi API | [`app/src/services/api/client.ts`](../app/src/services/api/client.ts), [`authService.ts`](../app/src/services/authService.ts) |
| Login/Google callback | [`LoginPage.tsx`](../app/src/pages/Login/LoginPage.tsx), [`GoogleCallbackPage.tsx`](../app/src/pages/Login/GoogleCallbackPage.tsx) |
| Hồ sơ/avatar | [`ProfilePage.tsx`](../app/src/pages/Profile/ProfilePage.tsx), [`UserController.java`](../server/src/main/java/com/techverse/server/controller/UserController.java) |
| Đăng ký/đăng nhập backend | [`AuthController.java`](../server/src/main/java/com/techverse/server/controller/AuthController.java), [`AuthServiceImpl.java`](../server/src/main/java/com/techverse/server/service/impl/AuthServiceImpl.java) |
| Google OAuth backend | [`SecurityConfiguration.java`](../server/src/main/java/com/techverse/server/configuration/SecurityConfiguration.java), [`OAuth2LoginSuccessHandler.java`](../server/src/main/java/com/techverse/server/configuration/OAuth2LoginSuccessHandler.java) |
| Quên mật khẩu | [`PasswordResetController.java`](../server/src/main/java/com/techverse/server/controller/PasswordResetController.java), [`PasswordResetServiceImpl.java`](../server/src/main/java/com/techverse/server/service/impl/PasswordResetServiceImpl.java) |
| Hồ sơ tác giả | [`AuthorProfileServiceImpl.java`](../server/src/main/java/com/techverse/server/service/impl/AuthorProfileServiceImpl.java), [`AdminAuthorApplicationServiceImpl.java`](../server/src/main/java/com/techverse/server/service/impl/AdminAuthorApplicationServiceImpl.java) |
| Tạo/sửa/upload bài | [`AuthorArticleController.java`](../server/src/main/java/com/techverse/server/controller/AuthorArticleController.java), [`AuthorArticleServiceImpl.java`](../server/src/main/java/com/techverse/server/service/impl/AuthorArticleServiceImpl.java) |
| UI quản lý bài của tác giả | [`AuthorBlogsPage.tsx`](../app/src/pages/Author/AuthorBlogsPage.tsx) |
| Kiểm duyệt bài | [`ModeratorArticleServiceImpl.java`](../server/src/main/java/com/techverse/server/service/impl/ModeratorArticleServiceImpl.java), [`ModeratorArticlesPage.tsx`](../app/src/pages/Moderator/ModeratorArticlesPage.tsx) |
| Đọc/lọc bài published | [`PublishedArticleServiceImpl.java`](../server/src/main/java/com/techverse/server/service/impl/PublishedArticleServiceImpl.java), [`BlogsPage.tsx`](../app/src/pages/Blogs/BlogsPage.tsx) |
| Admin user/topic/tag | [`server/src/main/java/com/techverse/server/controller/`](../server/src/main/java/com/techverse/server/controller/), [`app/src/pages/Admin/`](../app/src/pages/Admin/) |
| Format lỗi API | [`ErrorCode.java`](../server/src/main/java/com/techverse/server/exception/ErrorCode.java), [`GlobalExceptionHandler.java`](../server/src/main/java/com/techverse/server/exception/GlobalExceptionHandler.java) |
| Security/CORS/quyền endpoint | [`SecurityConfiguration.java`](../server/src/main/java/com/techverse/server/configuration/SecurityConfiguration.java) |
| Schema DB đang chạy | [`server/src/main/resources/db/migration/`](../server/src/main/resources/db/migration/) |
| Schema hợp nhất/ERD | [`docs/technical/db/final.sql`](../docs/technical/db/final.sql) |
| Cấu hình local/Compose | [`compose.yaml`](../compose.yaml), [`.env.example`](../.env.example), [`application-dev.yaml`](../server/src/main/resources/application-dev.yaml) |
| Thêm/sửa test backend | [`server/src/test/java/com/techverse/server/`](../server/src/test/java/com/techverse/server/) |
| Thêm/sửa test frontend | Các file `*.test.ts(x)` trong [`app/src`](../app/src/) |

## 13. Thuật ngữ nghiệp vụ và câu hỏi còn mở

- **Learner:** role mặc định của tài khoản.
- **Author profile/application:** hồ sơ xin quyền tác giả; có lifecycle `PENDING`, `APPROVED`, `REJECTED`, `SUSPENDED`.
- **Article review token:** token/version chống moderator ghi đè một lần nộp bài đã thay đổi.
- **Idempotency-Key / Upload-Key:** UUID giúp retry create/upload mà không nhân bản dữ liệu.
- **Câu hỏi mở:** miền tiếp theo sau articles là course miễn phí hay dashboard analytics; có cho public đọc bài không cần đăng nhập hay giữ policy hiện tại; khi nào pin dependency/Node và bổ sung frontend CI; `docs/technical/db/final.sql` có được commit làm schema reference chính thức hay chỉ là artifact local.
