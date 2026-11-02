# Bộ dữ liệu mẫu TechVerse

Bộ này gồm **24 topic, 96 tag và 24 bài Markdown tiếng Việt**. Đây là fixture test thủ công, không phải Flyway migration và không tự chạy khi khởi động app.

## 1. Tạo topic và tag: chọn một trong hai cách

### Nạp sẵn Author và bài viết vào DB local

Sau khi đã nạp topic/tag, chạy [demo-authors-articles.sql](demo-authors-articles.sql) trên database `techverse` ở môi trường development. Script tạo **4 Author đã duyệt, 24 bài PUBLISHED và 96 liên kết tag** từ các file Markdown hiện có. Không cần restart backend.

- Email: `author01@demo.techverse.test` đến `author04@demo.techverse.test`.
- Mật khẩu demo chung: `TechVerseDemo@2026` (trong DB lưu BCrypt, không dùng cho production).
- Mỗi tài khoản có LEARNER và AUTHOR; không cấp ADMIN/MODERATOR.
- Script chạy trong một transaction; chạy lại không nhân đôi hoặc ghi đè bản ghi hiện có. Dừng nếu email/ID xung đột hoặc topic/tag thiếu/inactive.
- Đây là ngoại lệ seed local, bỏ qua quy trình submit/duyệt qua API. Không dùng script để nhập nội dung thật hoặc kiểm thử luồng upload.
- Ảnh bìa là URL Unsplash bên ngoài, **không phải ảnh đã upload Cloudinary**. Bài PUBLISHED dùng để xem giao diện; khi tạo bài thật vẫn phải upload ảnh qua API của dự án. URL ngoài có thể không tải được khi mất mạng.
- Ảnh nguồn: [Markus Spiske — code](https://unsplash.com/it/foto/software-colorato-o-codice-web-sul-monitor-di-un-computer-Skf7HxARcoc), [Vishnu Kalanad — code](https://unsplash.com/photos/computer-screen-displaying-colorful-code-evzHeMgbKOg), [Markus Spiske — screen](https://unsplash.com/es/fotos/una-pantalla-de-computadora-con-mucho-texto-fN6HM1hrgxk).
- Bộ gốc có một bài mỗi topic; bài liên quan cùng topic chỉ xuất hiện nếu DB có thêm bài PUBLISHED cùng topic.

### Cách nhanh: chạy SQL

1. Khởi động backend để Flyway cập nhật schema và initializer tạo admin.
2. Trong công cụ quản lý PostgreSQL, kết nối đúng database TechVerse.
3. Mở và chạy toàn bộ [topics-tags.sql](topics-tags.sql) bằng UTF-8.
4. Refresh bảng hoặc danh sách trên giao diện.

SQL cần có ít nhất một tài khoản **ADMIN đang active**. Các dòng mới ghi created_by và updated_by bằng admin active được tạo sớm nhất. Không tạo account, không đổi role, không sửa mật khẩu.

Chạy lại không tạo bản trùng tên, không sửa description và không tự active lại mục đang inactive. Nếu một tên đã có nhưng inactive, hãy để admin kiểm tra trước khi active lại qua chức năng quản lý.

Chỉ dùng trong môi trường development/test. Không chạy docs/technical/db/final.sql lên database hiện có để nạp seed.

### Cách test API tạo từng mục

- Đăng nhập admin và dùng access token.
- POST `/api/v1/admin/topics`: lấy **một object** trong [topics.json](topics.json) làm body.
- POST `/api/v1/admin/tags`: lấy **một object** trong [tags.json](tags.json) làm body.
- Không gửi cả mảng JSON: các endpoint hiện nhận một object mỗi request.
- Chạy SQL rồi tạo cùng tên qua API sẽ bị báo trùng; đó là hành vi đúng.

Ví dụ body tạo topic:

```json
{
  "name": "Java Core",
  "description": "Nền tảng Java, lập trình hướng đối tượng và xử lý tập dữ liệu."
}
```

Ví dụ body tạo tag:

```json
{
  "name": "Java",
  "description": "Nội dung về Java, thuộc nhóm kiến thức Java Core."
}
```

Các JSON chỉ chứa name và description, không chứa id, token hoặc thông tin tài khoản.

## 2. Import bài viết qua giao diện

1. Đăng nhập tài khoản đã được duyệt AUTHOR.
2. Vào Blog của tôi → Tạo bài viết.
3. Chọn một hàng trong danh mục dưới; nhập tiêu đề và tóm tắt tương ứng.
4. Chọn đúng **một topic** và các tag gợi ý.
5. Ở Nhập tệp Markdown, chọn file trong thư mục articles.
6. Chọn ảnh bìa từ máy nếu muốn. Không có ảnh là hợp lệ; không cần dán URL.
7. Lưu nháp hoặc gửi kiểm duyệt.
8. Đăng nhập MODERATOR để duyệt, rồi dùng tài khoản người đọc để xem bài PUBLISHED.

File Markdown chỉ nạp nội dung; **không tự điền title, summary, topic hoặc tags**. Metadata đầy đủ có trong [articles.json](articles.json). topicName/tagNames là tên gợi ý, không phải UUID để gửi thẳng vào API tạo bài. Khi test bằng API, lấy ID thật từ endpoint options.

Các file không có YAML front matter, raw HTML, ảnh ngoài hoặc secret. Không có ảnh mẫu vì backend yêu cầu ảnh được upload và quản lý theo đúng bài viết. Nội dung dưới 1 MB mỗi file; code chỉ hiển thị, không thực thi.

Nếu tạo bài mới bằng API, dùng Idempotency-Key mới cho **mỗi bài mới**. Retry cùng request mới tái sử dụng khóa cũ; không tái sử dụng một khóa để tạo các bài khác nhau. Không tự insert articles bằng SQL vì sẽ bỏ qua ownership, validation và kiểm duyệt.

## 3. Danh mục bài viết

### 1. Java OOP: ưu tiên composition khi xây dựng dịch vụ thông báo

- File: [articles/01-java-oop-composition.md](articles/01-java-oop-composition.md)
- Topic: Java Core
- Tags: Java, OOP, Collections, Streams
- Tóm tắt: Phân biệt kế thừa và composition qua ví dụ gửi thông báo, giúp thay đổi kênh gửi mà không sửa logic nghiệp vụ.

### 2. Spring Boot: đặt ranh giới giao dịch ở service thay vì controller

- File: [articles/02-spring-service-transaction.md](articles/02-spring-service-transaction.md)
- Topic: Spring Boot
- Tags: Spring Boot, Dependency Injection, Bean Validation, Transactions
- Tóm tắt: Tổ chức controller, service và repository qua tình huống đổi tiêu đề bài viết trong một giao dịch.

### 3. PostgreSQL: thiết kế index cho danh sách bài viết theo topic

- File: [articles/03-postgresql-index-pagination.md](articles/03-postgresql-index-pagination.md)
- Topic: Database & SQL
- Tags: PostgreSQL, SQL, Indexing, Flyway
- Tóm tắt: Đọc điều kiện lọc, thứ tự sắp xếp và EXPLAIN để chọn index phù hợp với truy vấn bài viết.

### 4. Redis: hiểu cache-aside và TTL qua thông tin topic

- File: [articles/04-redis-cache-aside.md](articles/04-redis-cache-aside.md)
- Topic: Redis & Caching
- Tags: Redis, Caching, TTL, Cache Aside
- Tóm tắt: Mô tả luồng đọc cache, đọc database khi miss và xóa cache sau khi cập nhật dữ liệu.

### 5. JWT và session: vì sao logout cần nhiều hơn xóa cookie

- File: [articles/05-auth-session-token.md](articles/05-auth-session-token.md)
- Topic: Authentication & Security
- Tags: JWT, OAuth2, Spring Security, Session Management
- Tóm tắt: Phân biệt thời hạn token, trạng thái phiên ở Redis và tác dụng thật của thao tác logout.

### 6. JavaScript: xử lý lỗi HTTP đúng khi dùng async/await

- File: [articles/06-javascript-async-await.md](articles/06-javascript-async-await.md)
- Topic: JavaScript
- Tags: JavaScript, Async Await, Promises, Event Loop
- Tóm tắt: Tách lỗi kết nối và lỗi HTTP, kiểm tra response.ok và không nuốt thông báo lỗi từ server.

### 7. TypeScript: mô hình hóa trạng thái tải dữ liệu bằng union

- File: [articles/07-typescript-discriminated-union.md](articles/07-typescript-discriminated-union.md)
- Topic: TypeScript
- Tags: TypeScript, Generics, Type Guards, Utility Types
- Tóm tắt: Dùng discriminated union để tránh tổ hợp trạng thái loading, data và error mâu thuẫn nhau.

### 8. React: form có kiểm soát và chống bấm lưu liên tục

- File: [articles/08-react-controlled-form.md](articles/08-react-controlled-form.md)
- Topic: React
- Tags: React, Hooks, Forms, State Management
- Tóm tắt: Kết hợp state hiển thị với ref khóa thao tác để tránh gửi nhiều request do nhấp nhanh.

### 9. Next.js: tổ chức route và layout cho khu vực tác giả

- File: [articles/09-nextjs-route-layout.md](articles/09-nextjs-route-layout.md)
- Topic: Next.js
- Tags: Next.js, SSR, Routing, Server Components
- Tóm tắt: Minh họa cách phân nhóm trang bài viết và tái sử dụng layout trong ứng dụng dùng App Router.

### 10. HTML và CSS: xây dựng thẻ bài viết responsive dễ sử dụng

- File: [articles/10-css-responsive-accessibility.md](articles/10-css-responsive-accessibility.md)
- Topic: HTML & CSS
- Tags: HTML, CSS, Flexbox, Accessibility
- Tóm tắt: Thiết kế bố cục thẻ bài viết không tràn màn hình và có trạng thái focus rõ cho bàn phím.

### 11. Node.js: phản hồi lỗi nhất quán trong HTTP server

- File: [articles/11-node-error-handling.md](articles/11-node-error-handling.md)
- Topic: Node.js
- Tags: Node.js, Express, Middleware, Error Handling
- Tóm tắt: Phân biệt lỗi nghiệp vụ với lỗi bất ngờ và tránh để lộ stack trace trong phản hồi HTTP.

### 12. Python: dùng dataclass để mô hình hóa kết quả đọc bài

- File: [articles/12-python-dataclasses.md](articles/12-python-dataclasses.md)
- Topic: Python
- Tags: Python, Dataclasses, Iterators, Typing
- Tóm tắt: Tổ chức dữ liệu bằng dataclass bất biến và xử lý danh sách với hàm thuần dễ kiểm thử.

### 13. Thuật toán: tìm kiếm nhị phân và lỗi lệch một vị trí

- File: [articles/13-algorithms-binary-search.md](articles/13-algorithms-binary-search.md)
- Topic: Data Structures & Algorithms
- Tags: Algorithms, Hash Map, Binary Search, Big O
- Tóm tắt: Hiểu bất biến khoảng tìm kiếm và các test biên giúp phát hiện lỗi trong binary search.

### 14. REST API: phân trang ổn định và filter rõ ràng

- File: [articles/14-rest-api-pagination.md](articles/14-rest-api-pagination.md)
- Topic: REST API Design
- Tags: REST API, Pagination, Idempotency, HTTP
- Tóm tắt: Thiết kế danh sách bài viết với filter tùy chọn, giới hạn kích thước trang và thứ tự nhất quán.

### 15. Docker Compose: tổ chức PostgreSQL và Redis cho môi trường local

- File: [articles/15-docker-compose-local.md](articles/15-docker-compose-local.md)
- Topic: Docker & Containers
- Tags: Docker, Docker Compose, Containers, Health Checks
- Tóm tắt: Đọc cấu hình dịch vụ, volume và health check mà không nhầm địa chỉ giữa container và máy host.

### 16. CI/CD: xây dựng quality gate trước khi merge

- File: [articles/16-ci-workflow-quality-gate.md](articles/16-ci-workflow-quality-gate.md)
- Topic: CI/CD & DevOps
- Tags: CI/CD, GitHub Actions, Build Automation, Environment Variables
- Tóm tắt: Sắp xếp kiểm tra dependency, test và build để phát hiện lỗi sớm trước khi đưa code vào nhánh chính.

### 17. Testing: kiểm thử biên thay vì chỉ kiểm tra happy path

- File: [articles/17-testing-validation-boundaries.md](articles/17-testing-validation-boundaries.md)
- Topic: Software Testing
- Tags: Unit Testing, Integration Testing, JUnit, Mockito
- Tóm tắt: Từ một hàm kiểm tra độ dài tên, xây dựng các ca rỗng, sát giới hạn và vượt giới hạn.

### 18. Git teamwork: tạo feature branch và đồng bộ main an toàn

- File: [articles/18-git-feature-branch.md](articles/18-git-feature-branch.md)
- Topic: Git & Teamwork
- Tags: Git, Branching, Commit Convention, Merge
- Tóm tắt: Thực hành tên branch, commit message và merge mà không dùng force push để giải quyết nhầm xung đột.

### 19. System design: thao tác Redis nguyên tử để dùng token một lần

- File: [articles/19-system-design-atomic-redis.md](articles/19-system-design-atomic-redis.md)
- Topic: System Design
- Tags: System Design, Concurrency, Rate Limiting, Scalability
- Tóm tắt: Phân tích khoảng hở giữa kiểm tra và xóa, cùng ví dụ Lua tối giản cho một khóa token đã băm.

### 20. Linux và networking: chẩn đoán kết nối theo từng lớp

- File: [articles/20-network-debugging.md](articles/20-network-debugging.md)
- Topic: Linux & Networking
- Tags: Linux, TCP/IP, DNS, Reverse Proxy
- Tóm tắt: Tách vấn đề DNS, TCP, TLS và HTTP để tìm đúng nguyên nhân khi frontend không gọi được backend.

### 21. Clean Code: Strategy Pattern cho nhiều cách định dạng nội dung

- File: [articles/21-clean-code-strategy.md](articles/21-clean-code-strategy.md)
- Topic: Clean Code & Design Patterns
- Tags: Clean Code, SOLID, Strategy Pattern, Refactoring
- Tóm tắt: Tách thuật toán biến đổi nội dung khỏi bộ điều phối, tránh một hàm lớn chứa nhiều điều kiện khó thay đổi.

### 22. Observability: dùng request ID để nối các bước xử lý

- File: [articles/22-observability-request-id.md](articles/22-observability-request-id.md)
- Topic: Observability
- Tags: Logging, Metrics, Tracing, Correlation ID
- Tóm tắt: Theo dõi một request qua controller, service và lời gọi dịch vụ ngoài mà không log dữ liệu nhạy cảm.

### 23. Web performance: debounce tìm kiếm mà không hiển thị kết quả cũ

- File: [articles/23-web-performance-debounce.md](articles/23-web-performance-debounce.md)
- Topic: Web Performance
- Tags: Performance, Lazy Loading, Debouncing, Web Vitals
- Tóm tắt: Kết hợp khoảng chờ gõ với hủy request trước đó để giảm tải và tránh kết quả về sai thứ tự.

### 24. Tích hợp AI: coi đầu ra mô hình là dữ liệu chưa được tin cậy

- File: [articles/24-ai-safe-integration.md](articles/24-ai-safe-integration.md)
- Topic: AI Integration
- Tags: AI, LLM, Prompting, Data Privacy
- Tóm tắt: Thiết kế ranh giới dữ liệu, kiểm tra đầu ra và kiểm soát chi phí khi thêm AI vào ứng dụng học tập.

## 4. Gợi ý test nhanh

- Import một bài Java, một bài CSS và một bài Redis để kiểm tra nhiều code language.
- Kiểm tra heading, danh sách, blockquote, code block và tiếng Việt.
- Tạo nhiều bài cùng topic hoặc dùng lại tag để test tìm kiếm, phân trang, bài liên quan.
- Cho một bài ở DRAFT, một bài PENDING và một bài PUBLISHED; người đọc chỉ thấy nội dung được phép.
- Đổi topic/tag thành inactive rồi xác nhận mục đó không được gán mới qua options.
- Chạy lại SQL và kiểm tra số lượng không tăng nếu bộ tên không thay đổi.

## 5. Nhóm topic

- Java Core: Java, OOP, Collections, Streams
- Spring Boot: Spring Boot, Dependency Injection, Bean Validation, Transactions
- Database & SQL: PostgreSQL, SQL, Indexing, Flyway
- Redis & Caching: Redis, Caching, TTL, Cache Aside
- Authentication & Security: JWT, OAuth2, Spring Security, Session Management
- JavaScript: JavaScript, Async Await, Promises, Event Loop
- TypeScript: TypeScript, Generics, Type Guards, Utility Types
- React: React, Hooks, Forms, State Management
- Next.js: Next.js, SSR, Routing, Server Components
- HTML & CSS: HTML, CSS, Flexbox, Accessibility
- Node.js: Node.js, Express, Middleware, Error Handling
- Python: Python, Dataclasses, Iterators, Typing
- Data Structures & Algorithms: Algorithms, Hash Map, Binary Search, Big O
- REST API Design: REST API, Pagination, Idempotency, HTTP
- Docker & Containers: Docker, Docker Compose, Containers, Health Checks
- CI/CD & DevOps: CI/CD, GitHub Actions, Build Automation, Environment Variables
- Software Testing: Unit Testing, Integration Testing, JUnit, Mockito
- Git & Teamwork: Git, Branching, Commit Convention, Merge
- System Design: System Design, Concurrency, Rate Limiting, Scalability
- Linux & Networking: Linux, TCP/IP, DNS, Reverse Proxy
- Clean Code & Design Patterns: Clean Code, SOLID, Strategy Pattern, Refactoring
- Observability: Logging, Metrics, Tracing, Correlation ID
- Web Performance: Performance, Lazy Loading, Debouncing, Web Vitals
- AI Integration: AI, LLM, Prompting, Data Privacy
