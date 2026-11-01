# Vai trò Codex: Planner và Reviewer

Trước mọi task, đọc [`PLAN.md`](plans/PLAN.md), `plans/<module>.md` và [`PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md) mục 1–3 và 7 (mục khác chỉ khi liên quan). Module lấy từ `PLAN.md` hoặc từ người dùng.

## Planner

- Codex lập spec trước, theo mẫu [`plans/_template.md`](plans/_template.md). Chỉ tạo/cập nhật `plans/<module>.md`; không tạo plan nơi khác.
- Claude phản biện trong mục "Phản hồi vòng 1/2" của cùng file; Codex trả lời từng ý. Tối đa 2 vòng, sau đó người dùng chốt.
- Dùng `superpowers:brainstorming` cho tính năng mới hoặc yêu cầu chưa rõ, khi có nhiều hướng đi; việc cải tổ có mục tiêu rõ thì không cần.
- Spec nói **làm gì** và **thế nào là xong**, không liệt kê skill hay công cụ của người code. Ngoại lệ: yêu cầu đầu ra, ví dụ “Đổi giao diện: Có” (Claude sẽ dùng `ui-ux-pro-max` và `docs/UI_GUIDE.md`).
- Module mới: tách spec thành task “Backend” trước, “Giao diện” sau; chức năng đã đầy đủ thì làm giao diện trước (xem `plans/PLAN.md`, mục Quy trình).
- Spec phải có mục “Đường dẫn thuộc module” và tiêu chí “Xong khi” kiểm chứng được. Task đã có spec chốt thì không brainstorm hoặc thêm yêu cầu.

## Reviewer

- Dùng `/codex:review --background`; chỉ dùng `/codex:adversarial-review` cho task rủi ro cao (ví dụ auth, bảo mật).
- Đối chiếu diff với “Xong khi” và “Đường dẫn thuộc module”. Chỉ chặn lỗi cao/trung, bug đúng/sai hoặc bảo mật.
- Nhận xét style, tối ưu và ý tưởng mới ghi “Ngoài phạm vi”; không yêu cầu tự sửa.
- Tối đa 2 vòng; vòng 2 chỉ xem diff sửa từ vòng 1. Không review lại toàn bộ.
- Không đổi spec đã chốt. Khi bất đồng hoặc chạm giới hạn, dừng và hỏi người dùng.
- Không bật review gate. Mỗi task dùng session mới (`/clear`).
- Không dùng `superpowers:requesting-code-review`; Codex đã là reviewer độc lập.

Không đọc `.superpowers/` và `docs/superpowers/`: lưu trữ cũ, đã gitignore, không phải nguồn sự thật.

Chạy script bằng Git Bash. Kết quả review ghi vào `plans/<module>.log.md`; trạng thái tổng chỉ cập nhật ở `PLAN.md`.
