# Claude: Implementer và Phản biện plan

Trước task: đọc [`PLAN.md`](plans/PLAN.md) (luật chung, chọn module), `plans/<module>.md`, và [`PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md) mục 1–3 và 7 (mục khác chỉ khi liên quan). Module lấy từ `PLAN.md` hoặc từ người dùng; chưa có spec thì dừng và báo, không tự tạo.

## Quy trình bắt buộc

`Plan → Code → Test → Review → Result`

- Chỉ làm task được giao. Plan chỉ ở `plans/`; không tạo plan tại vị trí khác.
- **Khi plan:** Codex viết spec trước. Claude không viết hay sửa phần plan; chỉ ghi phản hồi (đúng, sai, thiếu, thừa) vào mục "Phản hồi vòng 1/2" của chính file spec, dùng Ponytail `ultra`. Tối đa 2 vòng rồi người dùng chốt. Không dùng `brainstorming` ở bước phản biện.
- Task đã có trong plan: không brainstorming, không tự sửa spec đã chốt. Spec thiếu thì dừng và hỏi.
- Code: dùng `superpowers:test-driven-development`, Ponytail `full`. Refactor giữ nguyên hành vi: chạy test hiện có lấy mốc xanh, bổ sung test mô tả hành vi cũ nếu thiếu, rồi mới đổi cấu trúc.
- Test: chạy `scripts/verify.sh` bằng Git Bash (không dùng WSL shim); dùng `superpowers:verification-before-completion` và chỉ báo xong khi có output thật. Sửa lỗi tối đa 3 lần rồi dừng hỏi người dùng.
- Review độc lập do Codex chạy `/codex:review --background`; task rủi ro cao dùng `/codex:adversarial-review`. Không dùng `requesting-code-review` song song.
- Nhận góp ý: dùng `superpowers:receiving-code-review`; đánh giá kỹ thuật, không làm theo mù quáng.
- Lỗi test: dùng `superpowers:systematic-debugging`.
- Review tối đa 2 vòng; vòng 2 chỉ xem diff sửa. Chỉ sửa blocker cao/trung gắn với “Xong khi”, bug hoặc bảo mật. Gợi ý/style ghi vào “Ngoài phạm vi” của `.log.md`.
- Review gate luôn tắt. Mỗi task là một session mới (`/clear`).
- Kết thúc: ghi kết quả test/review ngắn (dòng lỗi hoặc đạt/không đạt, không dán toàn bộ output) vào `plans/<module>.log.md`, cập nhật trạng thái ở `PLAN.md`, rồi chờ người dùng nhận kết quả.

## Bỏ qua

- Không đọc `.superpowers/` và `docs/superpowers/`: lưu trữ cũ, đã gitignore, không phải nguồn sự thật.

## Skill

- Không dùng `writing-plans`, `executing-plans`, `subagent-driven-development`, `using-git-worktrees`.
- Task có đổi giao diện (spec ghi “Đổi giao diện: Có”): dùng `ui-ux-pro-max`, bám [`docs/UI_GUIDE.md`](docs/UI_GUIDE.md). Không dùng `ui-styling`, `banner-design`, `brand`, `slides`, `design`. Không thêm Tailwind hay thư viện UI mới nếu spec không yêu cầu.

## Bài học vận hành (cập nhật dần)

- Công cụ/script tạm: viết một lần bằng file sạch (Write), không vá nhiều lần bằng `sed` hoặc heredoc. Node/Python trên Windows dùng đường dẫn Windows (`D:/...`), không dùng `/d/...` của Git Bash.
- Chạy song song các bước độc lập (test, build, chụp ảnh); chạy lâu thì để nền. Tắt dev server sau khi dùng.
- Kiểm chứng tương xứng với rủi ro. Task giữ nguyên hành vi: inventory + kiểm tra tĩnh thứ tự cascade + các trang spec yêu cầu; chỉ mở rộng sang trang khác khi kiểm tra tĩnh báo lỗi hoặc người dùng yêu cầu.
- Ảnh chụp có nhiễu: không kết luận từ một lần; so với nhiều lần chụp nền và chụp lại khi lệch vài điểm ảnh.
- Tách/di chuyển CSS: kiểm tra các class cùng nằm trên một phần tử (kể cả truyền qua prop `className`), vì đổi thứ tự nạp file làm đổi cascade mà ảnh chụp có thể không thấy (ví dụ phần tử ngoài khung nhìn).
- Công cụ kiểm chứng dùng lại cho nhiều task: đề nghị Codex đưa đường dẫn vào spec rồi mới thêm vào repo; không tự tạo ngoài spec.
- Công cụ Chrome chỉ nạp khi phiên bắt đầu: nếu chưa thấy sau khi cài, báo người dùng khởi động lại, không tìm lại nhiều lần.

Người dùng quyết định khi chốt plan, khi các AI bất đồng, khi chạm giới hạn vòng và khi nhận kết quả cuối.
