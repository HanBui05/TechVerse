# AI assist — Log

Trạng thái chính thức: xem [`PLAN.md`](PLAN.md). Spec: [`ai-assist.md`](ai-assist.md). Ba mục đầu và “Nhật ký phiên” được hook SessionStart tự nạp sau `/clear`; giữ chúng ngắn.

## Bắt đầu từ đây (cập nhật 2026-11-04)

- **Module mới, đang lập kế hoạch.** Nhánh `feature/ai-assist` tạo từ `main` (`52e484e`). Q1–Q7 đã chốt (A, Groq, cờ AI V11, trang riêng, preview chỉ lưu sau completed, tiếng Việt). Codex đã trả lời vòng 1; **Claude đã ghi vòng 2** (1 điểm: spike tương thích Groq ở đầu Task 1a). Tiếp: Codex trả lời vòng 2 → người dùng chốt spec → Task 1a (session mới). Task: 1a → 1b → 1c → wireframe → 2a → 2b.
- Chưa có code. Không code trước khi spec được chốt.
- Nền sẵn có từ `article-flow`: editor `/author/blogs/new`, `/author/blogs/:id/edit`; API Author create/save/submit (`Idempotency-Key`), `imageIssues`, validator Markdown (cấm raw HTML/link nguy hiểm, ≤1 MiB), rate-limit Redis, Moderator duyệt version. Spring Boot 4.1.1, Postgres `postgres:16-alpine` (chưa có pgvector), Redis 7.

## Quyết định người dùng chưa có trong spec

- (không có)

## Câu hỏi mở cho người dùng

- (không có — Q3/Q4 hoãn sang module RAG theo Q1=A)

## Nhật ký phiên
### 2026-11-05 — Codex trả lời vòng 2 và đồng bộ spec đã chốt
- Codex chấp nhận đề xuất vòng 2; đã đưa spike tương thích Groq thành bước đầu và tiêu chí “Xong khi” của Task 1a: outline strict JSON Schema + stream ngắn qua runtime thật, kiểm `include_reasoning`/content, ghi `x-ratelimit-*`; không commit khóa/output, không thêm test mạng.
- Đã đưa quyết định chốt ngày 2026-11-05 vào thân spec, xóa dòng khỏi bảng quyết định chờ và rút gọn phần phản biện sau khi chốt. Nếu spike không đạt thì dừng hỏi; thiếu khóa/kết nối thì ghi “Chưa kiểm” và người dùng quyết định.
- Đã cập nhật `PLAN.md`: spec ở trạng thái Đã chốt, tiếp Task 1a.

### 2026-11-04 — Claude phản biện vòng 2
- Soát phần sửa vòng 1: đạt. Một điểm thiếu: kiểm tương thích Groq (`include_reasoning`, strict schema, reasoning trong stream, TPM cho LONG) đang ở smoke cuối module → đề xuất spike gọi thật một lần ở đầu Task 1a, cần `AI_API_KEY` Groq của người dùng.
- Quyết định người dùng mới: Q6 đổi từ dialog sang trang riêng sau khi so sánh (đã ghi ở bản quyết định, Codex đã đưa vào spec).

### 2026-11-04 — Codex trả lời vòng 1 và đồng bộ quyết định
- Codex đã đưa Q1–Q7 và ngôn ngữ đầu ra vào thân spec; xóa toàn bộ dòng tương ứng khỏi “Quyết định người dùng chưa có trong spec”.
- Xác minh Groq bằng tài liệu chính thức: base URL Spring AI có `/openai/v1`, model `openai/gpt-oss-120b`, stream/JSON Schema/tool/reasoning/token/error/rate-limit; phần reasoning theo từng chunk chưa có tài liệu đủ rõ nên giữ câu hỏi kỹ thuật + smoke gate.
- Thu phạm vi về bản 1; rút thiết kế bản 2/3 thành định hướng ngắn. Thêm Task 1c/2b cho V11 `ai_assisted`, handoff `aiGenerationId` đã xác thực, DTO Author/Moderator và badge Moderator; Reader không hiển thị.
- Đã trả lời từng điểm Sai 1–2, Thiếu 1–9, Thừa 1–2 và ba đề xuất ngoài spec trong `ai-assist.md`.

### 2026-11-04 — Claude phản biện vòng 1 + chốt Groq
- Ghi “Phản hồi vòng 1” vào spec: 2 sai (retry hai lớp `spring.ai.retry.max-attempts` mặc định 10; token reasoning cần `max-completion-tokens`), 9 thiếu (security matcher `/api/v1/author/ai/**` ở 1a + dispatch ASYNC, cách cài SSE, context cache test, heading khớp dàn ý, hoàn quota khi lỗi server, hợp nhất tag, ngôn ngữ đầu ra, SHA-256, deadline theo độ dài), 2 thừa, 3 đề xuất ngoài spec.
- Người dùng chốt Q2 = Groq. Tiếp: Codex trả lời vòng 1 + cập nhật spec; người dùng chốt Q1, Q3–Q7.

### 2026-11-04 — Codex viết spec AI assist
- Codex đã đưa toàn bộ quyết định người dùng vào `ai-assist.md`; mục quyết định chờ đồng bộ đã được dọn.
- Spec chốt nền Spring AI 2.0.2/Boot 4.1.1, contract outline/SSE/cancel/rewrite, prompt, validation, quota, ChatMemory, tool và thiết kế RAG có điều kiện.
- Chia chi tiết Task Backend → cổng wireframe → UI, test theo ngân sách; không sửa code ứng dụng.
- Còn chờ người dùng chốt Q1–Q7 và Claude phản biện vòng 1.

### 2026-11-04 — Mở module
- Tạo nhánh `feature/ai-assist` từ `main`, log này, dòng module trong `PLAN.md`. Ghi quyết định ý tưởng/luồng/công nghệ của người dùng. Tiếp: Codex viết spec chi tiết; Claude phản biện vòng 1.
