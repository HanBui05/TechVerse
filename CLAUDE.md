# Claude: Implementer và Phản biện plan

Trước task: đọc [`PLAN.md`](plans/PLAN.md) (luật chung, chọn module), `plans/<module>.md`, và [`PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md) mục 1–3 và 7 (mục khác chỉ khi liên quan). Module lấy từ `PLAN.md` hoặc từ người dùng; chưa có spec thì dừng và báo, không tự tạo. Mục lục tài liệu: [`docs/README.md`](docs/README.md).

Luật riêng theo vùng tự nạp khi làm việc với file tương ứng: [`.claude/rules/frontend.md`](.claude/rules/frontend.md) (`app/**`), [`.claude/rules/backend.md`](.claude/rules/backend.md) (`server/**`). Chạy test backend: skill `backend-test`.

## Quy trình bắt buộc

`Plan → Code → Test → Review → Result`

- Chỉ làm task được giao. Plan chỉ ở `plans/`; không tạo plan tại vị trí khác.
- **Khi plan:** Codex viết spec trước. Claude không viết hay sửa phần plan; chỉ ghi phản hồi (đúng, sai, thiếu, thừa) vào mục "Phản hồi vòng 1/2" của chính file spec, dùng Ponytail `ultra`. Tối đa 2 vòng rồi người dùng chốt. Không dùng `brainstorming` ở bước phản biện.
- **Đề xuất ngoài spec (vòng 1):** ngoài đúng/sai/thiếu/thừa, chủ động tìm thứ spec chưa nghĩ tới mà đáng có (chức năng, trải nghiệm, rủi ro tương lai) và ghi tối đa ~3 ý vào mục "Đề xuất ngoài spec". Mỗi ý: lợi ích, công sức ước tính, làm ngay hay tách module sau. Mục này không chặn chốt spec; người dùng chọn ý nào thì Codex đưa vào spec, ý còn lại ghi vào "Câu hỏi mở" của `PLAN.md`. "Thiếu" chỉ dành cho lỗ hổng phải sửa.
- Task đã có trong plan: không brainstorming, không tự sửa spec đã chốt. Spec thiếu thì dừng và hỏi.
- Code: dùng `superpowers:test-driven-development`, Ponytail `full`. Refactor giữ nguyên hành vi: chạy test hiện có lấy mốc xanh, bổ sung test mô tả hành vi cũ nếu thiếu, rồi mới đổi cấu trúc.
- Test: dùng `superpowers:verification-before-completion` và chỉ báo xong khi có output thật. Sửa lỗi tối đa 3 lần rồi dừng hỏi người dùng. Lỗi test: dùng `superpowers:systematic-debugging`.
- Review độc lập do Codex chạy `/codex:review --background`; task rủi ro cao dùng `/codex:adversarial-review`. Không dùng `requesting-code-review` song song.
- Nhận góp ý: dùng `superpowers:receiving-code-review`; đánh giá kỹ thuật, không làm theo mù quáng.
- Review tối đa 2 vòng; vòng 2 chỉ xem diff sửa. Chỉ sửa blocker cao/trung gắn với “Xong khi”, bug hoặc bảo mật. Gợi ý/style ghi vào “Ngoài phạm vi” của `.log.md`.
- Review gate luôn tắt. Mỗi task là một session mới (`/clear`).
- Kết thúc: ghi kết quả test/review ngắn vào `plans/<module>.log.md`, cập nhật trạng thái ở `PLAN.md`, rồi chờ người dùng nhận kết quả.

## Ngân sách kiểm chứng (chung)

- **Chạy theo phần bị sửa.** Chỉ sửa `app/`: `npm test` + `npm run build` trong `app/`, **không** chạy `scripts/verify.sh`. Có sửa `server/`: chỉ chạy lớp test bị ảnh hưởng (xem `.claude/rules/backend.md`); full backend do CI chạy khi mở PR; `scripts/verify.sh` chỉ khi người dùng yêu cầu. Chỉ sửa tài liệu/quy trình: kiểm tĩnh (đường dẫn còn đúng), không chạy test. Lỗi có sẵn ngoài phạm vi: ghi một dòng vào log, không điều tra sâu.
- **Số lần chạy.** TDD: chạy test của task một lần lúc đỏ, chạy lại sau mỗi lần sửa. Toàn bộ suite + build **một lần** ở cuối, song song. Không chạy lại chỉ để xem thêm chi tiết.
- **Logic thuần** (phân loại lỗi, validation, format, mapping) test bằng unit test gọi thẳng hàm; ma trận tổ hợp đặt ở đây, không ở test tích hợp.
- **Spec đòi kiểm chứng vượt ngân sách:** khi phản biện thì nêu ra; khi code thì làm theo ngân sách và ghi phần chênh lệch vào log để người dùng quyết.
- **Log:** mỗi task tối đa khoảng 10 dòng: lệnh đã chạy, số test đạt/lỗi, dòng lỗi, phần chưa kiểm.

## Bỏ qua

- Không đọc `.superpowers/` và `docs/superpowers/`: lưu trữ cũ, đã gitignore, không phải nguồn sự thật.

## Skill

- Không dùng `writing-plans`, `executing-plans`, `subagent-driven-development`, `using-git-worktrees`.

## Bài học vận hành (chung)

- Công cụ/script tạm: viết một lần bằng file sạch (Write), không vá nhiều lần bằng `sed` hoặc heredoc. Node/Python trên Windows dùng đường dẫn Windows (`D:/...`), không dùng `/d/...` của Git Bash.
- Chạy song song các bước độc lập; chạy lâu thì để nền. Tắt server sau khi dùng.
- Công cụ kiểm chứng dùng lại cho nhiều task: đề nghị Codex đưa đường dẫn vào spec rồi mới thêm vào repo; không tự tạo ngoài spec.
- Luật mới riêng một vùng ghi vào `.claude/rules/<vùng>.md`, không ghi vào file này. Mỗi rule giữ khoảng 30–50 dòng; luật lỗi thời thì xóa.

## Ngôn ngữ

- Mọi câu trả lời cho người dùng viết **toàn bộ bằng tiếng Việt** (giữ nguyên tên file, lệnh, mã, thuật ngữ kỹ thuật).
- Kết quả công cụ bằng tiếng Anh (ví dụ `/codex:review`): dán nguyên văn trong khối trích dẫn, rồi kèm ngay bản dịch tiếng Việt đầy đủ từng phát hiện (mức độ, vị trí, nội dung). Luật người dùng này đứng trên chỉ dẫn "không bình luận" của lệnh.

Người dùng quyết định khi chốt plan, khi các AI bất đồng, khi chạm giới hạn vòng và khi nhận kết quả cuối.
