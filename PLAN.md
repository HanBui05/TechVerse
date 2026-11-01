# Kế hoạch thực hiện TechVerse

Đọc [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) trước khi nhận task. Mỗi module có đúng một spec `plans/<module>.md` và một nhật ký `plans/<module>.log.md`.

## Trạng thái module

| Module | Spec | Trạng thái | Người thực hiện | Task hiện tại | Xong khi | Nhật ký |
|---|---|---|---|---|---|---|
| Workflow bootstrap | [`plans/workflow-bootstrap.md`](plans/workflow-bootstrap.md) | Chờ người dùng nhận kết quả | Codex (pilot) | Đã dựng khung, luật, script và chạy pilot | Kết quả/test/review đã ghi; full verify còn cần Docker | [`plans/workflow-bootstrap.log.md`](plans/workflow-bootstrap.log.md) |

Trạng thái hợp lệ: `Đề xuất` → `Đang lập kế hoạch` → `Chờ người dùng chốt` → `Đã chốt` → `Đang thực hiện` → `Đang review` → `Chờ người dùng nhận kết quả` → `Hoàn tất`; dùng `Bị chặn` khi không thể tạo ra kết quả để bàn giao vì cần quyết định hoặc môi trường bên ngoài.

## Cổng người dùng

Người dùng quyết định tại bốn cổng: chốt plan; xử lý bất đồng giữa Planner/Reviewer/Implementer; khi chạm giới hạn vòng lặp; nhận kết quả cuối.

## Nhật ký quyết định

| ID | Ngày | Quyết định | Lý do | Trạng thái |
|---|---|---|---|---|
| D-001 | 2026-11-02 | Plan chỉ nằm trong `plans/`; không tạo `docs/superpowers/plans/` | Một nguồn sự thật, tránh plan song song | Đã chốt |
| D-002 | 2026-11-02 | Tranh luận tối đa 2 vòng; review tối đa 2 vòng/task; sửa test tối đa 3 lần | Chống vòng lặp luẩn quẩn | Đã chốt |
| D-003 | 2026-11-02 | `scripts/verify.sh` dùng Gradle Wrapper và npm | Repository không có Maven Wrapper; đây là lệnh tương đương chạy thật | Đã chốt |
| D-004 | 2026-11-02 | Review gate luôn tắt; mỗi task dùng một session mới (`/clear`) | Giữ quyền quyết định ở người dùng, tránh tích lũy ngữ cảnh | Đã chốt |
