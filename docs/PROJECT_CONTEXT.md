# PROJECT_CONTEXT

> Cập nhật **2026-11-14**. File này chỉ mô tả phần ổn định (kiến trúc, quy ước, nơi tìm code); **không ghi trạng thái task** — trạng thái ở [`plans/PLAN.md`](../plans/PLAN.md) và log module.

## Nguồn sự thật và thứ tự ưu tiên

1. Mã chạy thực tế và cấu hình: [`server/src/main`](../server/src/main/), [`app/src`](../app/src/), [`server/build.gradle`](../server/build.gradle), [`app/package-lock.json`](../app/package-lock.json).
2. Lịch sử schema chạy thật: [`server/src/main/resources/db/migration/`](../server/src/main/resources/db/migration/) (hiện V1–V12). Đây là nguồn Flyway áp dụng khi khởi động.
3. Schema hợp nhất để đọc/ERD hoặc tạo **DB rỗng** thủ công: [`docs/technical/db/final.sql`](technical/db/final.sql) — hiện chỉ gộp **đến V11** (chưa có V12 khóa học); không đưa vào thư mục migration, không chạy lên DB đã có dữ liệu.
4. Hành vi được kiểm chứng: [`server/src/test`](../server/src/test/) và các file `*.test.ts(x)` trong [`app/src`](../app/src/).

## 1. Tổng quan

TechVerse là nền tảng học và chia sẻ kiến thức công nghệ cho sinh viên CNTT và người học lập trình. Đã có backend + frontend + test cho: đăng ký/đăng nhập (mật khẩu, Google), hồ sơ, đăng ký tác giả và Admin duyệt, bài viết Markdown có kiểm duyệt và bản công khai bất biến, lưu bài, tạo bài bằng AI (dàn ý → stream bản nháp), khóa học miễn phí (khóa → chương → bài, Moderator duyệt, học thử, tiến độ), quản trị người dùng/topic/tag. Các bảng thanh toán, bài tập, phỏng vấn, diễn đàn, bình luận, báo cáo có trong schema V1 nhưng **chưa có API** (xem mục 4).

## 2. Tech stack và cách chạy

| Thành phần | Phiên bản / lựa chọn | Nguồn |
|---|---|---|
| Java | 21 | [`server/build.gradle`](../server/build.gradle) |
| Spring Boot | 4.1.1 (+ Spring AI 2.0.2, nhà cung cấp tương thích OpenAI) | [`server/build.gradle`](../server/build.gradle) |
| Gradle Wrapper | 9.8.1 | `server/gradle/wrapper/gradle-wrapper.properties` |
| PostgreSQL | 16 Alpine, schema `techverse` | [`compose.yaml`](../compose.yaml) |
| Redis | 7 Alpine (session, rate limit, idempotency, OTP) | [`compose.yaml`](../compose.yaml) |
| Frontend | React 19, TypeScript, Vite 8, shadcn/ui + Tailwind v4 | [`app/package-lock.json`](../app/package-lock.json) |
| Test | JUnit 5/Spring Test/Testcontainers; Vitest + Testing Library | `server/build.gradle`, `app/package.json` |

`app/package.json` dùng nhiều dependency `latest`: luôn `npm ci` và giữ lockfile. Node `^20.19.0 || >=22.12.0`.

Chạy trên máy dev (chi tiết cổng, DB, tài khoản theo vai trò: [`RUNBOOK.md`](RUNBOOK.md)):

1. Sao chép [`.env.example`](../.env.example) thành `.env`, điền secret; không commit `.env`.
2. `docker compose up -d postgres redis`.
3. Backend: trong `server/`, `./gradlew bootRun --args='--spring.profiles.active=dev'` (cổng 8080, Swagger `/swagger-ui.html`).
4. Frontend: trong `app/`, `npm ci` rồi `npm run dev` (cổng 3000).

Test và build: `./gradlew test --tests '<Lớp>'` (backend, cần Docker cho Testcontainers), `npx vitest run <file>` và `npm run build` (frontend). Phạm vi chạy test mỗi task theo ngân sách ở `CLAUDE.md`/`AGENTS.md`; CI ([`ci.yml`](../.github/workflows/ci.yml)) hiện chỉ chạy `./gradlew test`.

## 3. Kiến trúc và cấu trúc thư mục

```text
TechVerse/
├─ app/src/                  React SPA
│  ├─ components/            UI dùng lại (ui/ = shadcn), layout/sidebars
│  ├─ pages/                 Trang theo route: Admin, Author (+ Courses), Blogs, Courses, Moderator (+ Courses), Profile…
│  ├─ services/              API client và service theo miền
│  ├─ data/, types/, lib/, hooks/
├─ server/src/main/java/com/techverse/server/
│  ├─ controller/            HTTP, validation, DTO vào/ra
│  ├─ service/ + impl/       Interface và nghiệp vụ/transaction
│  ├─ repository/            Spring Data, specification, JDBC đặc thù
│  ├─ entity/, dto/, enums/, exception/, validation/, properties/
│  ├─ configuration/         Security, OAuth2, JWT, OpenAPI, Cloudinary, AI
│  └─ event/listener/        Email và tác vụ sau commit
├─ server/src/main/resources YAML, Flyway, Redis Lua
├─ docs/                     Bối cảnh, runbook, Git, design, SQL hợp nhất (mục lục: docs/README.md)
├─ plans/                    PLAN.md, spec + log từng module
├─ compose.yaml              PostgreSQL, Redis, server
└─ .github/workflows/ci.yml  CI backend
```

Luồng phụ thuộc cố định:

- Controller chỉ lo HTTP, quyền, validation và map DTO; không trả entity.
- Service interface ở `service/`, implementation ở `service/impl/`; transaction đặt ở implementation.
- Repository làm việc với JPA entity hoặc JDBC projection; filter phức tạp ở `repository/specification/`.
- Frontend gọi API qua [`app/src/services/api/client.ts`](../app/src/services/api/client.ts): access token giữ trong biến bộ nhớ và `sessionStorage['techverse-access-token']`, refresh token là cookie HttpOnly, refresh single-flight khi gặp 401; cờ `localStorage['techverse-authenticated']` quyết định có thử refresh khi tải trang.

## 4. Data model

### Quy tắc chung

- UUID, `timestamptz`, schema `techverse`; hầu hết bảng có audit `created_at/by`, `updated_at/by`.
- Email, tên topic/tag dùng `citext`.
- Không soft-delete thống nhất: tài khoản/taxonomy dùng `is_active`; nội dung dùng cột trạng thái.
- Bốn role: `LEARNER`, `AUTHOR`, `MODERATOR`, `ADMIN`.
- Nội dung có kiểm duyệt (bài viết, khóa học) theo cùng mẫu: bản làm việc của tác giả + snapshot công khai bất biến (trigger chặn UPDATE/DELETE) + lịch sử kiểm duyệt append-only; hai trục `workflow_status` và `publication_status`.

### Bảng đang được mã sử dụng

| Miền | Bảng |
|---|---|
| Tài khoản | `users`, `roles`, `user_roles`, `social_accounts`, `author_profiles`, `author_application_reviews` |
| Taxonomy | `topics`, `tags` |
| Bài viết | `articles`, `article_tags`, `article_publication_versions` (+ `_tags`), `article_moderation_history`, `saved_articles` |
| Khóa học (V12) | `courses`, `course_tags`, `course_chapters`, `lessons`, `course_publication_versions` (+ `_tags`, `_chapters`, `_lessons`), `course_moderation_history`, `course_enrollments` (chỉ nguồn `FREE`), `lesson_progress` |

Refresh session, token, OTP reset, quota AI và receipt idempotency nằm ở Redis, không ở SQL.

### Có schema nhưng chưa có API

| Miền | Bảng |
|---|---|
| Bán hàng | `orders`, `order_items`, `payment_transactions`, `commission_policies`, `refunds` (người dùng chốt không hoàn tiền: sẽ xóa ở migration của `course-payment`); giá khóa bị V12 khóa ở 0 (`ck_courses_free`) |
| Tài liệu | `documents`, `saved_documents` |
| Luyện tập/phỏng vấn | `exercise_sets`, `exercise_questions`, `exercise_attempts`, `interview_questions` |
| Cộng đồng/kiểm duyệt | `forum_posts`, `comments`, `reports` |

## 5. Quy ước và quyết định cố định

- Package gốc `com.techverse.server`; API prefix `/api/v1`.
- Entity kế thừa audit từ [`BaseEntity`](../server/src/main/java/com/techverse/server/entity/BaseEntity.java), dùng method nghiệp vụ có kiểm soát; không `@Data` trên entity.
- `@Transactional` ở service implementation; đọc dùng `readOnly = true` khi phù hợp.
- Thành công: `ApiResponse<T>` (`status`, `message`, `data`); lỗi: `ErrorResponse` (`status`, `code`, `message`, `error`, `timestamp`, `path`, `fieldErrors`). Không đổi sang raw object/`ProblemDetail`. Frontend dịch theo `code`.
- DB đổi bằng Flyway migration mới; **không sửa migration đã áp dụng**; Hibernate `ddl-auto=validate`. Migration mới không backfill dữ liệu cũ: DB dev cũ làm mới theo RUNBOOK.
- Quyền chặn ở backend (`SecurityConfiguration` mặc định `denyAll` + kiểm trong service); route guard frontend chỉ là UX.
- Không đưa token OAuth của provider xuống frontend hay lưu lâu dài.
- Bài viết/bài học là Markdown; ảnh upload riêng qua Cloudinary, có `Idempotency-Key`/`Upload-Key` và rate limit.
- Git: theo [`GIT_WORKFLOW.md`](GIT_WORKFLOW.md) (nhánh `feature/`, `fix/`, `chore/`; không push `main`).
- Không commit `.env`, secret, `node_modules`, `dist`, `server/build`, file IDE.

## 6. API

Danh sách endpoint đầy đủ: Swagger tại `/swagger-ui.html` khi backend chạy, hoặc đọc [`controller/`](../server/src/main/java/com/techverse/server/controller/). Nhóm quyền theo [`SecurityConfiguration`](../server/src/main/java/com/techverse/server/configuration/SecurityConfiguration.java) (role cụ thể kiểm trong service):

- **Public:** `POST /auth/register|login|refresh|forgot-password|verify-reset-otp|reset-password`, `/oauth2/**`, `GET /courses/**` (JWT tùy chọn; bài “Học thử” mở cho Guest).
- **Đăng nhập:** `/users/me/**`, `/author-profiles/me/**`, `GET /articles/**` và lưu bài, `/me/saved-articles`, `POST /courses/*/start`, `PUT|DELETE /courses/*/lessons/*/completion`, `/me/courses`.
- **Theo vai trò (đăng nhập + kiểm role):** `/admin/**` (ADMIN), `/author/articles/**`, `/author/courses/**`, `/author/ai/**` (AUTHOR), `/moderator/articles/**`, `/moderator/courses/**` (MODERATOR).
- Mọi đường khác: `denyAll` — endpoint mới phải khai trong `SecurityConfiguration`.

## 7. Luồng nghiệp vụ chính

- **Phiên đăng nhập:** backend phát access JWT ngắn hạn + refresh cookie; session ở Redis; `client.ts` tự refresh một lần khi 401 và không cho response cũ ghi đè session mới.
- **Tác giả:** Learner nộp hồ sơ → Admin duyệt → có role `AUTHOR`.
- **Bài viết / khóa học:** tác giả soạn bản làm việc → gửi duyệt (`PENDING`) → Moderator duyệt (tạo snapshot công khai mới) hoặc yêu cầu sửa; sau đó tác giả tự ẩn/hiện, Moderator ẩn/khôi phục/gỡ. Sửa bản làm việc không đổi bản công khai.
- **Học khóa:** đăng nhập rồi bấm học tạo enrollment `FREE`; hoàn thành bài ghi `lesson_progress`; Admin/Moderator không học.

## 8. Biến môi trường và tích hợp ngoài

Không ghi giá trị secret. Danh sách ở [`.env.example`](../.env.example); cấu hình đọc trong [`application*.yaml`](../server/src/main/resources/). Nhóm: PostgreSQL, Redis, server/web (`WEB_URL`, `VITE_API_BASE_URL`), JWT/reset, Google OAuth, SendGrid, Cloudinary, AI (`AI_*`), admin khởi tạo.

Tích hợp đang dùng: PostgreSQL/Flyway, Redis, Google OAuth2, SendGrid, Cloudinary, nhà cung cấp AI tương thích OpenAI (Groq), Swagger. Chưa có cổng thanh toán hay queue.

## 9. Chiến lược test

- Backend: unit test thuần cho logic; `@WebMvcTest` cho validation/status; `@SpringBootTest` + Testcontainers PostgreSQL cho luồng cần DB/security. Test không gọi dịch vụ AI thật.
- Frontend: Vitest + Testing Library theo trang/component.
- Fixture demo ở [`server/src/test/resources/seed/`](../server/src/test/resources/seed/) chỉ cho test/demo.

## 10. Muốn sửa X thì xem file Y

| Việc | File/đường dẫn bắt đầu |
|---|---|
| Route và role guard frontend | [`app/src/App.tsx`](../app/src/App.tsx) |
| Token/refresh và gọi API | [`client.ts`](../app/src/services/api/client.ts), [`authService.ts`](../app/src/services/authService.ts) |
| Đăng ký/đăng nhập backend | [`AuthController.java`](../server/src/main/java/com/techverse/server/controller/AuthController.java), [`AuthServiceImpl.java`](../server/src/main/java/com/techverse/server/service/impl/AuthServiceImpl.java) |
| Google OAuth, Security/CORS/quyền endpoint | [`SecurityConfiguration.java`](../server/src/main/java/com/techverse/server/configuration/SecurityConfiguration.java), [`OAuth2LoginSuccessHandler.java`](../server/src/main/java/com/techverse/server/configuration/OAuth2LoginSuccessHandler.java) |
| Hồ sơ/avatar | [`ProfilePage.tsx`](../app/src/pages/Profile/ProfilePage.tsx), [`UserController.java`](../server/src/main/java/com/techverse/server/controller/UserController.java) |
| Hồ sơ tác giả | [`AuthorProfileServiceImpl.java`](../server/src/main/java/com/techverse/server/service/impl/AuthorProfileServiceImpl.java), [`AdminAuthorApplicationServiceImpl.java`](../server/src/main/java/com/techverse/server/service/impl/AdminAuthorApplicationServiceImpl.java) |
| Tạo/sửa bài viết | [`AuthorArticleServiceImpl.java`](../server/src/main/java/com/techverse/server/service/impl/AuthorArticleServiceImpl.java), [`app/src/pages/Author/`](../app/src/pages/Author/) |
| Kiểm duyệt bài viết | [`ModeratorArticleServiceImpl.java`](../server/src/main/java/com/techverse/server/service/impl/ModeratorArticleServiceImpl.java), [`app/src/pages/Moderator/`](../app/src/pages/Moderator/) |
| Đọc/lưu bài công khai | [`PublishedArticleServiceImpl.java`](../server/src/main/java/com/techverse/server/service/impl/PublishedArticleServiceImpl.java), [`SavedArticleServiceImpl.java`](../server/src/main/java/com/techverse/server/service/impl/SavedArticleServiceImpl.java), [`app/src/pages/Blogs/`](../app/src/pages/Blogs/) |
| Tạo bài bằng AI | `server/.../service/impl/Ai*.java`, [`AuthorAiController.java`](../server/src/main/java/com/techverse/server/controller/AuthorAiController.java), [`AiArticlePage.tsx`](../app/src/pages/Author/AiArticlePage.tsx) |
| Khóa học (tác giả) | [`AuthorCourseServiceImpl.java`](../server/src/main/java/com/techverse/server/service/impl/AuthorCourseServiceImpl.java), [`app/src/pages/Author/Courses/`](../app/src/pages/Author/Courses/) |
| Khóa học (kiểm duyệt) | [`ModeratorCourseServiceImpl.java`](../server/src/main/java/com/techverse/server/service/impl/ModeratorCourseServiceImpl.java), [`app/src/pages/Moderator/Courses/`](../app/src/pages/Moderator/Courses/) |
| Khóa học (học, tiến độ) | [`PublishedCourseServiceImpl.java`](../server/src/main/java/com/techverse/server/service/impl/PublishedCourseServiceImpl.java), [`CourseAccessService.java`](../server/src/main/java/com/techverse/server/service/impl/CourseAccessService.java), [`app/src/pages/Courses/`](../app/src/pages/Courses/) |
| Admin user/topic/tag | [`controller/`](../server/src/main/java/com/techverse/server/controller/), [`app/src/pages/Admin/`](../app/src/pages/Admin/) |
| Format lỗi API | [`ErrorCode.java`](../server/src/main/java/com/techverse/server/exception/ErrorCode.java), [`GlobalExceptionHandler.java`](../server/src/main/java/com/techverse/server/exception/GlobalExceptionHandler.java) |
| Schema DB | [`db/migration/`](../server/src/main/resources/db/migration/), [`final.sql`](technical/db/final.sql) |
| Cấu hình local | [`compose.yaml`](../compose.yaml), [`.env.example`](../.env.example), [`application-dev.yaml`](../server/src/main/resources/application-dev.yaml) |

## 11. Thuật ngữ

- **Learner:** role mặc định của tài khoản.
- **Author profile/application:** hồ sơ xin quyền tác giả; `PENDING`, `APPROVED`, `REJECTED`, `SUSPENDED`.
- **Bản làm việc / snapshot công khai:** tác giả sửa bản làm việc; người đọc chỉ thấy snapshot đã duyệt.
- **Review token:** chống Moderator duyệt một bản đã đổi sau khi mở.
- **Idempotency-Key / Upload-Key:** UUID để retry tạo/tải lên không nhân bản dữ liệu.
- **Học thử:** bài học tác giả bật cho Guest xem không cần đăng nhập.
