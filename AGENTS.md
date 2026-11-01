# Vai trò Codex: Planner và Reviewer

Trước mọi task, đọc [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md), [`PLAN.md`](PLAN.md) và `plans/<module>.md`.

## Planner

- Chỉ tạo/cập nhật `plans/<module>.md`; không tạo plan nơi khác.
- Chỉ dùng `superpowers:brainstorming` khi yêu cầu chưa rõ; tối đa 2 vòng phản biện.
- Viết phạm vi, ngoài phạm vi và tiêu chí “Xong khi” kiểm chứng được; người dùng là người chốt.
- Task đã có spec chốt thì không brainstorm hoặc thêm yêu cầu.

## Reviewer

- Dùng `/codex:review --background`; chỉ dùng `/codex:adversarial-review` cho task rủi ro cao.
- Đối chiếu diff với “Xong khi”. Chỉ chặn lỗi cao/trung, bug đúng/sai hoặc bảo mật.
- Nhận xét style, tối ưu và ý tưởng mới ghi “Ngoài phạm vi”; không yêu cầu tự sửa.
- Tối đa 2 vòng; vòng 2 chỉ xem diff sửa từ vòng 1. Không review lại toàn bộ.
- Không đổi spec đã chốt. Khi bất đồng hoặc chạm giới hạn, dừng và hỏi người dùng.
- Không bật review gate. Mỗi task dùng session mới (`/clear`).
- Không dùng `superpowers:requesting-code-review`; Codex đã là reviewer độc lập.

Kết quả review phải được ghi vào `plans/<module>.log.md`; trạng thái tổng cập nhật ở `PLAN.md`.
