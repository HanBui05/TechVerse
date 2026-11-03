# Claude: Implementer và Phản biện plan

Trước task, đọc theo thứ tự rồi làm luôn, không hỏi lại điều đã ghi: (1) dòng module trong [`PLAN.md`](plans/PLAN.md); (2) mục task trong `plans/<module>.md` — khi code chỉ đọc mục task đó + “Đường dẫn thuộc module”, “Ngoài phạm vi”, “Ràng buộc”, “Quyết định”; không đọc mục task đã xong hay “Phản hồi/Trả lời vòng 1/2”; (3) **toàn bộ** `plans/<module>.log.md`, nhất là “Quyết định người dùng”, “Lệch khác spec”, “Chưa kiểm”; (4) luật vùng. [`PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md) mục 1–3 và 7 chỉ đọc khi task đụng tới. Cần chạy app thật (kiểm bằng mắt, thử API, tài khoản theo vai trò): đọc [`docs/RUNBOOK.md`](docs/RUNBOOK.md) trước, không tự dò cấu hình. Module lấy từ `PLAN.md` hoặc từ người dùng; chưa có spec thì dừng và báo, không tự tạo. Mục lục tài liệu: [`docs/README.md`](docs/README.md).

## Giữ quyết định qua `/clear`

- **Thỏa thuận trong chat phải ghi vào file ngay**, trước khi làm tiếp: luật lâu dài → `CLAUDE.md` hoặc `.claude/rules/<vùng>.md`; riêng module → mục “Quyết định người dùng” (có ngày) trong `plans/<module>.log.md`. Chỉ “đồng ý” trong chat hay chỉ lưu memory là mất sau `/clear`.
- **Thứ tự ưu tiên khi lệch nhau:** quyết định người dùng mới nhất (log, có ngày) > spec đã chốt > tài liệu khác. Spec chưa được Codex cập nhật theo log thì làm theo log, không dừng hỏi; ghi một dòng “spec chờ Codex cập nhật”.
- **Chỉ dừng hỏi** khi spec + log không trả lời được và lựa chọn làm đổi thứ người dùng thấy (route, API, dữ liệu, copy, phạm vi). Chi tiết kỹ thuật có mặc định hợp lý thì tự chọn và ghi vào “Lệch khác spec” của log.
- **Bàn giao cuối task:** log có mục “Bắt đầu từ đây” ở đầu file (xong gì, chờ gì, task tiếp theo, chưa kiểm gì) và chi tiết task bên dưới; đủ để session sau làm tiếp mà không cần chat cũ. Dòng module trong `PLAN.md` chỉ ghi trạng thái ngắn + trỏ tới log, không chép lịch sử.
- **Hook tự động** (`.claude/settings.json`, script ở `.claude/hooks/`): SessionStart nạp “Bắt đầu từ đây”, “Quyết định … chưa có trong spec”, “Câu hỏi mở” và 2 mục mới nhất của “Nhật ký phiên” từ log của module ghi ở dòng `Module đang làm:` trong `PLAN.md` — đã có thì không đọc lại các mục đó. Mục “Đã xong” không đọc lại code/test, không làm lại; mục “Bỏ qua” không mở. Stop chặn một lần khi `app/`, `server/`, `.claude/rules|skills` hoặc `CLAUDE.md` sửa sau lần ghi log cuối → cập nhật log rồi mới dừng.
- **Nhật ký phiên:** cuối mỗi phiên có thay đổi, thêm một mục `### <ngày> — <chủ đề>` ở đầu “Nhật ký phiên” (≤ 6 dòng: đã làm, quyết định mới, bài học, việc dở). Chỉ điều phiên sau cần; chi tiết kỹ thuật để ở mục Task. Giữ “Bắt đầu từ đây” luôn đúng hiện trạng.
- **Codex sửa spec/`PLAN.md` song song:** đọc lại ngay trước khi sửa hoặc tóm tắt hai file này; không dựa vào bản đã đọc đầu phiên.
- **Memory chỉ là con trỏ** (vai trò người dùng, cách làm việc, chỗ tiếp tục); nội dung chuẩn nằm trong repo. Memory lệch repo thì sửa memory theo repo.

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
- **Commit WIP theo task** (người dùng chốt 2026-11-03): người dùng nhận task xong thì commit cục bộ trên nhánh module `wip(<module>): Task <n> — <tên>` (không push), để review task sau chỉ xem diff chưa commit của chính task đó. Cuối module squash các commit WIP thành một commit (giữ quyết định “một commit cuối module”). Không commit lên `main`.
- **Review có ngữ cảnh nghiệp vụ:** focus của `adversarial-review` nêu mục “Xong khi” của task (đường dẫn spec + tên task) và lệnh test đã chạy kèm kết quả; Codex review đọc các mục đó theo `AGENTS.md`.
- **Claude tự gọi review, không chờ người dùng** (người dùng chốt 2026-11-03): sau khi test + build đạt và đã ghi log, chạy **chờ kết quả** (`--wait`, không chạy nền: job nền chết khi phiên đóng; trong lúc chờ cũng không có việc song song) bằng **PowerShell** (Git Bash đổi `/PID` của `taskkill` thành đường dẫn nên `cancel` hỏng) `node "<script>" review ""`; adversarial: `adversarial-review "<focus>"`. `<script>` = `~/.claude/plugins/cache/openai-codex/codex/<bản mới nhất>/scripts/codex-companion.mjs`. Trước khi chạy, `node "<script>" status ""`: đã có job review đang chạy (kể cả người dùng tự gõ `/codex:review`) thì chờ job đó, không chạy thêm. Có kết quả thì sửa ngay blocker thuộc diện dưới, chạy lại test liên quan + build, ghi log, rồi tự chạy vòng 2.
- Nhận góp ý: dùng `superpowers:receiving-code-review`; đánh giá kỹ thuật, không làm theo mù quáng.
- Review tối đa 2 vòng; vòng 2 luôn dùng `adversarial-review "<focus>"` (focus nêu file/phần sửa sau vòng 1), vì `review` thường không nhận focus (người dùng chốt 2026-11-03). Chỉ sửa blocker cao/trung gắn với “Xong khi”, bug hoặc bảo mật. Gợi ý/style ghi vào “Ngoài phạm vi” của `.log.md`.
- Sau vòng 1: blocker thuộc diện trên thì **sửa luôn, không hỏi**, rồi báo. Sau vòng 2 còn phát hiện: trình bày kèm đánh giá và một khuyến nghị, người dùng quyết (chạm giới hạn vòng).
- Review gate (Stop hook của Codex) luôn tắt; review chạy theo luật tự gọi ở trên. Mỗi task là một session mới (`/clear`).
- Kết thúc: ghi kết quả test/review ngắn vào `plans/<module>.log.md`, cập nhật trạng thái ở `PLAN.md`, rồi chờ người dùng nhận kết quả.
- **Đồng bộ spec sau khi người dùng nhận task** (người dùng chốt 2026-11-03): Claude không sửa spec; ghi log xong thì chạy nền bằng PowerShell `node "<script>" task --write "<prompt>"` nhờ Codex đồng bộ spec theo log (theo mục “Đồng bộ với Claude” trong `AGENTS.md`), rồi báo người dùng phần Codex đã đổi.

## Ngân sách kiểm chứng (chung)

- **Chạy theo phần bị sửa.** Chỉ sửa `app/`: chỉ chạy file test liên quan (`npx vitest run <file...>`, xem `.claude/rules/frontend.md`) + `npm run build`; **không** chạy full `npm test` (trừ khi người dùng yêu cầu) và không chạy `scripts/verify.sh`. Có sửa `server/`: chỉ chạy lớp test bị ảnh hưởng (xem `.claude/rules/backend.md`); full backend do CI chạy khi mở PR; `scripts/verify.sh` chỉ khi người dùng yêu cầu. Chỉ sửa tài liệu/quy trình: kiểm tĩnh (đường dẫn còn đúng), không chạy test. Lỗi có sẵn ngoài phạm vi: ghi một dòng vào log, không điều tra sâu.
- **Số lần chạy.** TDD: chạy test của task một lần lúc đỏ, chạy lại sau mỗi lần sửa. Cuối task chạy test liên quan + build **một lần**, song song; không chạy full suite. Không chạy lại chỉ để xem thêm chi tiết.
- **Logic thuần** (phân loại lỗi, validation, format, mapping) test bằng unit test gọi thẳng hàm; ma trận tổ hợp đặt ở đây, không ở test tích hợp.
- **Spec đòi kiểm chứng vượt ngân sách:** khi phản biện thì nêu ra; khi code thì làm theo ngân sách và ghi phần chênh lệch vào log để người dùng quyết.
- **Log:** mỗi task tối đa khoảng 10 dòng: lệnh đã chạy, số test đạt/lỗi, dòng lỗi, phần chưa kiểm.

## Bỏ qua

- Không đọc `.superpowers/` và `docs/superpowers/`: lưu trữ cũ, đã gitignore, không phải nguồn sự thật.

## Skill

- Không dùng `writing-plans`, `executing-plans`, `subagent-driven-development`, `using-git-worktrees`.

## Bài học vận hành (chung)

- Công cụ/script tạm: viết một lần bằng file sạch (Write), không vá nhiều lần bằng `sed` hoặc heredoc. Node/Python trên Windows dùng đường dẫn Windows (`D:/...`), không dùng `/d/...` của Git Bash.
- Chạy song song các bước độc lập; chạy lâu thì để nền. Tắt server sau khi dùng (chỉ server do Claude bật; server của người dùng thì để nguyên).
- **Windows:** lệnh có cờ dạng `/X` (`taskkill /PID`, `findstr /C`) chạy bằng PowerShell — Git Bash đổi `/X` thành đường dẫn. Script sửa file phải giữ kiểu xuống dòng sẵn có (đọc → bỏ `` → sửa → ghi lại CRLF nếu file vốn CRLF); ghi file từ PowerShell dùng `[IO.File]::WriteAllText(p, t, (New-Object Text.UTF8Encoding $false))`, không `Set-Content -Encoding utf8` (thêm BOM). Lệnh `npm` luôn `cd` đường dẫn tuyệt đối vào `app/` trước.
- Công cụ kiểm chứng dùng lại cho nhiều task: đề nghị Codex đưa đường dẫn vào spec rồi mới thêm vào repo; không tự tạo ngoài spec.
- Luật mới riêng một vùng ghi vào `.claude/rules/<vùng>.md`, không ghi vào file này. Mỗi rule giữ khoảng 30–50 dòng; luật lỗi thời thì xóa.

## Ngôn ngữ

- Mọi câu trả lời cho người dùng viết **toàn bộ bằng tiếng Việt** (giữ nguyên tên file, lệnh, mã, thuật ngữ kỹ thuật).
- Kết quả công cụ bằng tiếng Anh (ví dụ `/codex:review`): dán nguyên văn trong khối trích dẫn, rồi kèm ngay bản dịch tiếng Việt đầy đủ từng phát hiện (mức độ, vị trí, nội dung). Luật người dùng này đứng trên chỉ dẫn "không bình luận" của lệnh.

Người dùng quyết định khi chốt plan, khi các AI bất đồng, khi chạm giới hạn vòng và khi nhận kết quả cuối.
