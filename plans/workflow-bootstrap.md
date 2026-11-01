# Workflow Bootstrap

**Trạng thái:** xem [`PLAN.md`](PLAN.md)
**Mục tiêu:** Tạo khung điều phối tối thiểu cho quy trình `Plan → Code → Test → Review → Result`, rồi dùng chính khung đó cho một pilot nhỏ.

## Phạm vi

- Giữ `PROJECT_CONTEXT.md` làm nguồn bối cảnh kỹ thuật.
- Thêm `PLAN.md`, `CLAUDE.md`, `AGENTS.md`.
- Mỗi module có cặp `plans/<module>.md` và `plans/<module>.log.md`.
- Thêm `scripts/verify.sh` và một kiểm thử hành vi nhỏ cho script.
- Chạy pilot, review tối đa hai vòng, ghi kết quả vào log và cập nhật `PLAN.md`.

## Ngoài phạm vi

- Không tự động gọi Claude/Codex hoặc tự mở session.
- Không bật review gate, hook, scheduler hay pipeline orchestration.
- Không sửa mã sản phẩm, dependency hoặc CI hiện có.
- Không tạo thêm hệ thống trạng thái ngoài `PLAN.md` và `.log.md`.

## Luật vòng lặp

- Tranh luận plan: tối đa 2 vòng, sau đó hỏi người dùng.
- Sửa lỗi test: tối đa 3 lần, sau đó dừng và ghi blocker.
- Review: tối đa 2 vòng; vòng 2 chỉ xem diff sửa từ vòng 1.
- Reviewer chỉ chặn lỗi mức cao/trung gắn với tiêu chí “Xong khi”, bug đúng/sai hoặc bảo mật. Style/gợi ý thêm ghi vào “Ngoài phạm vi”.
- Spec đã chốt không được tự mở rộng.

## Task pilot

Tạo `scripts/verify.sh` chạy quality gate thực tế của repository:

1. Backend: `server/gradlew test bootJar`.
2. Frontend: `npm test` và `npm run build` trong `app/`.
3. Dừng ngay khi một bước lỗi và giữ nguyên output thật.

## Xong khi

- [ ] Đủ toàn bộ file/thư mục trong phạm vi và liên kết nội bộ hợp lệ.
- [ ] `CLAUDE.md` và `AGENTS.md` ngắn, đều trỏ về `PROJECT_CONTEXT.md`, `PLAN.md` và module spec.
- [ ] Kiểm thử của `verify.sh` đã được quan sát thất bại trước khi có implementation, rồi đạt sau implementation.
- [ ] `scripts/verify.sh` gọi đúng backend test/build và frontend test/build, fail-fast.
- [ ] Đã chạy `scripts/verify.sh`; kết quả thật, kể cả blocker môi trường, được ghi vào log.
- [ ] Reviewer kiểm tra theo đúng spec; chỉ blocker cao/trung mới yêu cầu sửa.
- [ ] `plans/workflow-bootstrap.log.md` và `PLAN.md` phản ánh kết quả cuối.
