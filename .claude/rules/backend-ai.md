---
paths:
  - "server/**/*Ai*"
  - "server/**/ai/**"
---

# Luật Spring AI 2.0.2 (đã xác minh bằng source + gọi Groq thật, 2026-11-05)

- Prompt mang `OpenAiChatOptions` thì **thay toàn bộ** cấu hình `spring.ai.openai.chat.*`. Option runtime luôn dựng từ `((OpenAiChatOptions) model.getDefaultOptions()).mutate()` — dùng `AiPromptFactory.options(...)`.
- `extra-body` trong YAML bind thành chuỗi (`"false"` → Groq 400). Giá trị không phải chuỗi đặt bằng `extraBody(Map.of(...))` trong code.
- `spring.ai.retry.*` không có tác dụng (starter không kéo `spring-ai-retry`); chặn retry bằng `spring.ai.openai.max-retries`. `api-key` rỗng = SDK chạy no-auth, không báo lỗi.
- `SseEmitter` (Spring 7): khi callback `onTimeout` chạy, emitter đã hoàn tất → `send` ném `IllegalStateException`. Event báo hết giờ phải phát từ deadline do service tự áp (mẫu `AiDraftStreamService`), emitter để dư thời gian. MockMvc: kích timeout bằng `MockAsyncContext.getListeners()` → `onTimeout`.
- Khóa thật từ `.env` (spike/smoke): `export "$(grep -m1 '^AI_API_KEY=' ../.env | tr -d '\r')"` ngay trong lệnh chạy; không in, cắt hay đo giá trị khóa (bị chặn). Runner/proxy tạm đặt ở scratchpad hoặc xóa trước khi commit.
- Test không gọi model thật.
