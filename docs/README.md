# Tài liệu TechVerse

Mỗi tài liệu một dòng. Thư mục con chỉ tạo khi có tài liệu thật cho nhóm đó (dự kiến: `technical/`, `operations/`, `design/`, `template/`).

| Tài liệu | Nội dung |
|---|---|
| [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) | Bối cảnh dự án, kiến trúc, quy ước; mục 1–3 và 7 đọc trước mọi task |
| [`GIT_WORKFLOW.md`](GIT_WORKFLOW.md) | Quy trình nhánh, commit, pull request |
| [`technical/db/final.sql`](technical/db/final.sql) | Schema gộp từ Flyway V1–V7, chỉ để tham khảo/ERD. Nguồn sự thật là `server/src/main/resources/db/migration`; cập nhật lại khi có migration mới |
| [`design/UI_GUIDE.md`](design/UI_GUIDE.md) | Hướng dẫn giao diện: bảng màu, font, mẫu trang, kiểm tra trước khi giao |

Không thuộc `docs/`: spec và nhật ký module ở [`plans/`](../plans/PLAN.md) (mẫu spec: `plans/_template.md`); luật cho AI ở `CLAUDE.md`, `AGENTS.md`, `.claude/rules/`.
