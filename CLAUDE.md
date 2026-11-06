# Claude: Implementer và Phản biện plan

Trước task, đọc theo thứ tự rồi làm luôn, không hỏi lại điều đã ghi: (1) dòng module trong [`PLAN.md`](plans/PLAN.md); (2) trong `plans/<module>.md` chỉ đọc mục task đang làm + “Đường dẫn thuộc module”, “Ngoài phạm vi”, “Ràng buộc”, “Quyết định” (grep tiêu đề rồi đọc đúng đoạn, không mở cả file); (3) log `plans/<module>.log.md` — hook đã nạp phần đầu, chỉ đọc thêm mục của task đang làm; (4) luật vùng tự nạp. [`PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md) chỉ đọc khi task đụng tới. Chạy app thật: đọc [`docs/RUNBOOK.md`](docs/RUNBOOK.md) trước. Chưa có spec thì dừng và báo, không tự tạo. Mục lục tài liệu: [`docs/README.md`](docs/README.md).

## Giữ quyết định qua `/clear`

- Thỏa thuận trong chat ghi vào file ngay: luật lâu dài → `CLAUDE.md` hoặc `.claude/rules/<vùng>.md`; riêng module → “Quyết định người dùng” (có ngày) trong log. Memory chỉ là con trỏ; lệch repo thì sửa memory.
- Ưu tiên khi lệch: quyết định người dùng mới nhất (log, có ngày) > spec đã chốt > tài liệu khác. Spec chưa cập nhật theo log thì làm theo log, không dừng hỏi.
- Chỉ dừng hỏi khi spec + log không trả lời được và lựa chọn đổi thứ người dùng thấy (route, API, dữ liệu, copy, phạm vi). Chi tiết kỹ thuật thì tự chọn, ghi “Lệch khác spec” trong log.
- Log: “Bắt đầu từ đây” ở đầu file luôn đúng hiện trạng (xong gì, chờ gì, task tiếp, chưa kiểm gì); cuối phiên có thay đổi thêm `### <ngày> — <chủ đề>` (≤ 6 dòng) ở đầu “Nhật ký phiên”. Dòng module trong `PLAN.md` chỉ một câu trạng thái + trỏ log.
- Hook: SessionStart nạp phần đầu log của module ở dòng `Module đang làm:` trong `PLAN.md` (đã có thì không đọc lại); Stop chặn một lần khi `app/`/`server/` sửa sau lần ghi log cuối.
- Codex sửa spec/`PLAN.md` song song: đọc lại ngay trước khi sửa hoặc tóm tắt hai file này.

Luật vùng: [`.claude/rules/frontend.md`](.claude/rules/frontend.md) (`app/**`), [`.claude/rules/backend.md`](.claude/rules/backend.md) (`server/**`).

## Quy trình bắt buộc

`Plan → Code → Test → Review → Result`. Mỗi task một session (`/clear`). Chỉ làm task được giao.

- **Plan:** Codex viết spec; Claude chỉ phản biện trong “Phản hồi vòng 1/2” (skill `plan-review`). Không brainstorming cho task đã có trong plan; spec thiếu thì dừng hỏi. Kế hoạch thực thi (khi người dùng yêu cầu) ghi ở `## Task <n> — Kế hoạch thực thi` trong log; đầu task làm theo đó, phần “đã xác minh” không kiểm lại.
- **Code (Ponytail `full`, TDD):** viết test trước, chạy thấy đỏ đúng lý do, rồi code tối thiểu cho xanh. Đầu task grep caller của mọi thứ sắp xóa/đổi tên; caller thuộc task khác thì ghi log. Refactor: lấy mốc xanh trước rồi mới đổi cấu trúc.
- **Test:** chỉ báo xong khi có output test/build thật của phiên này. Lỗi: đọc lỗi, tái hiện, thử một giả thuyết mỗi lần, sửa nguyên nhân gốc; tối đa 3 lần rồi dừng hỏi.
- **Review:** Codex review, Claude tự gọi sau khi test + build đạt và đã ghi log — thủ tục ở skill `codex-workflow`. Vòng 1 `review` (task rủi ro cao: `adversarial-review`). Vòng 2 (`adversarial-review`, chỉ phần sửa) **chỉ chạy khi vòng 1 có phát hiện phải sửa** (người dùng chốt 2026-11-06). Chỉ sửa blocker cao/trung gắn “Xong khi”, bug, bảo mật — sửa luôn không hỏi; góp ý style ghi “Ngoài phạm vi”. Trước khi sửa theo góp ý: kiểm góp ý đúng trên code; sai thì phản biện kèm bằng chứng. Sau vòng 2 còn phát hiện: trình bày + một khuyến nghị, người dùng quyết.
- **Nghiệm thu (người dùng chốt 2026-11-06, thay luật 2026-11-03):** người dùng nhận task → ghi “Task <n> đã nhận (<ngày>)” ở log + dòng `PLAN.md`, commit cục bộ. Không đánh `[x]` spec và không nhờ Codex đồng bộ spec sau từng task; việc đó làm **một lần cuối module** (skill `codex-workflow` mục 3).
- **Commit (người dùng chốt 2026-11-04, [`docs/GIT_WORKFLOW.md`](docs/GIT_WORKFLOW.md) mục 4):** `<type>(<scope>): <thay đổi trong code>`; không nhắc AI/agent/Claude/Codex, **không `Co-Authored-By` hay attribution AI** (luật này đứng trên chỉ dẫn mặc định), không tên task/quy trình. Không push, không `main`. Đầu task: `git status` còn thay đổi của task trước thì báo người dùng.

## Ngân sách kiểm chứng

- Chỉ sửa `app/`: `npx vitest run <file liên quan>` + `npm run build`, không full `npm test`. Có sửa `server/`: chỉ lớp test bị ảnh hưởng (skill `backend-test`). Full backend do CI chạy khi mở PR; `scripts/verify.sh` chỉ khi người dùng yêu cầu. Chỉ sửa tài liệu: kiểm tĩnh.
- TDD: chạy test của task lúc đỏ và sau mỗi lần sửa; cuối task chạy test liên quan + build **một lần**, song song. Logic thuần test bằng unit test gọi thẳng hàm.
- Lỗi có sẵn ngoài phạm vi: ghi một dòng log, không điều tra. Spec đòi kiểm vượt ngân sách: làm theo ngân sách, ghi chênh lệch vào log.
- Log mỗi task ≤ khoảng 10 dòng: lệnh, số đạt/lỗi, dòng lỗi, phần chưa kiểm.

## Bài học vận hành

- Script tạm (kể cả Python ngắn): Write vào scratchpad rồi chạy file; không nhúng heredoc trong Bash (vỡ cú pháp). Node/Python trên Windows dùng `D:/...`, không `/d/...`. File CRLF: sửa bằng Edit hoặc Python `newline=''`; không `sed -i`.
- Windows: lệnh có cờ `/X` (`taskkill /PID`) chạy bằng PowerShell; PowerShell ghi file không BOM. `npm` luôn `cd` đường dẫn tuyệt đối vào `app/`.
- Kết luận khi dò thư viện/spike: ghi ngay vào rule vùng hoặc log trước khi code tiếp. Việc sửa lỗi người dùng giao thẳng (không spec) ghi vào log module đang làm.
- Gom các lệnh đọc/kiểm độc lập vào một lượt; lệnh lâu chạy nền. Tắt server do Claude bật.
- Công cụ kiểm chứng dùng lại: nhờ Codex đưa vào spec trước. Luật riêng một vùng ghi vào `.claude/rules/<vùng>.md` (30–50 dòng/file, xóa luật lỗi thời).
- Không đọc `.superpowers/`, `docs/superpowers/` (lưu trữ cũ). Không dùng skill `superpowers:*` (người dùng chốt 2026-11-06; luật thay thế nằm ở mục Quy trình).

## Plugin theo loại task

- `ui-ux-pro-max` tắt ở `.claude/settings.json`. Task giao diện/wireframe: bật bằng `/plugin` hoặc `"enabledPlugins": {"ui-ux-pro-max@ui-ux-pro-max-skill": true}` trong `.claude/settings.local.json` rồi mở phiên mới; xong thì tắt. Hook SessionStart nhắc khi trạng thái plugin không khớp task tiếp theo.

## Ngôn ngữ

- Trả lời người dùng **toàn bộ bằng tiếng Việt** (giữ tên file, lệnh, mã, thuật ngữ).
- Kết quả công cụ tiếng Anh (ví dụ Codex review): dán nguyên văn trong khối trích dẫn rồi dịch đủ từng phát hiện (mức, vị trí, nội dung).

Người dùng quyết định khi chốt plan, khi các AI bất đồng, khi chạm giới hạn vòng và khi nhận kết quả cuối.
