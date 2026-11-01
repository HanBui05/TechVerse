# Luật làm việc cho Claude

Luôn đọc [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md), [`PLAN.md`](PLAN.md), rồi đọc `plans/<module>.md` trước khi làm task.

## Quy trình bắt buộc

`Plan → Code → Test → Review → Result`

- Chỉ làm task được giao. Plan chỉ ở `plans/`; không tạo plan tại vị trí khác.
- Tính năng chưa rõ: dùng `superpowers:brainstorming`, Ponytail `ultra`, tranh luận tối đa 2 vòng rồi để người dùng chốt.
- Task đã có trong plan: không brainstorming, không tự sửa spec đã chốt.
- Code: dùng `superpowers:test-driven-development`, Ponytail `full`.
- Test: chạy `scripts/verify.sh`; dùng `superpowers:verification-before-completion` và chỉ báo xong khi có output thật. Sửa lỗi tối đa 3 lần rồi dừng hỏi người dùng.
- Review độc lập do Codex chạy `/codex:review --background`; task rủi ro cao dùng `/codex:adversarial-review`. Không dùng `requesting-code-review` song song.
- Nhận góp ý: dùng `superpowers:receiving-code-review`; đánh giá kỹ thuật, không làm theo mù quáng.
- Lỗi test: dùng `superpowers:systematic-debugging`.
- Review tối đa 2 vòng; vòng 2 chỉ xem diff sửa. Chỉ sửa blocker cao/trung gắn với “Xong khi”, bug hoặc bảo mật. Gợi ý/style ghi vào “Ngoài phạm vi” của `.log.md`.
- Review gate luôn tắt. Mỗi task là một session mới (`/clear`).
- Kết thúc: ghi output test/review vào `plans/<module>.log.md`, cập nhật `PLAN.md`, rồi chờ người dùng nhận kết quả.

Người dùng quyết định khi chốt plan, khi các AI bất đồng, khi chạm giới hạn vòng và khi nhận kết quả cuối.
