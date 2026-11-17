# Brief cho Opus: tối ưu bộ tài liệu điều khiển AI của TechVerse

Viết 2026-11-13 theo yêu cầu người dùng. Đây **không phải spec module**; là bản giao việc làn nhẹ (chỉ sửa tài liệu, luật, hook; không đụng `app/`, `server/`). Người thực thi: Claude Opus, một phiên.

## 1. Bối cảnh và mục tiêu

Dự án chạy hai AI: Codex viết spec và review, Claude code. Người dùng `/clear` sau mỗi task, nên mọi thứ AI biết đầu phiên đều đến từ file: `CLAUDE.md`, `AGENTS.md`, `.claude/rules/`, `.claude/skills/`, hook SessionStart, memory, `plans/PLAN.md`, spec và log module, `docs/PROJECT_CONTEXT.md`.

Hệ quả: một dòng sai hoặc thừa trong các file này bị trả giá lại ở **mọi** phiên của cả hai AI. Bộ tài liệu hiện tại có khung tốt (luật vùng nạp theo đường dẫn, hook nạp điểm tiếp tục, ngân sách kiểm chứng rõ), nhưng sau 11 ngày và 12 module đã tích tụ ba loại vấn đề:

1. **Thông tin sai so với code** — AI đọc và tin, dẫn tới hành động sai.
2. **Nội dung đã hết hạn vẫn nạp mỗi phiên** — tốn token, làm loãng phần quan trọng.
3. **Một luật ghi ở nhiều nơi** — đã bắt đầu lệch nhau.

Mục tiêu của brief: sửa ba loại trên mà **không đổi quy trình** người dùng đã chốt và không mất quyết định còn hiệu lực. Không viết lại cho đẹp; chỉ cắt, sửa sai, gom về một nơi.

## 2. Cách làm việc trong phiên này

- Số liệu dưới đây đo ngày 2026-11-13 trên nhánh `feature/course-free`. Codex có thể đã sửa `PLAN.md`/spec sau đó: **đọc lại từng file ngay trước khi sửa**, phát hiện nào không còn đúng thì bỏ qua và ghi một dòng vào báo cáo cuối.
- Làm theo thứ tự mục 4 (ưu tiên giảm dần). Mỗi nhóm một commit `docs(...)`/`chore(claude): ...` theo luật commit trong `CLAUDE.md` (không attribution AI, không push).
- Mục 5 là việc cần người dùng quyết. Gom thành **một** danh sách kèm khuyến nghị và hỏi một lần ở cuối phiên; trong lúc chờ vẫn làm hết phần không phụ thuộc. Người dùng không thích hộp thoại hỏi: viết câu hỏi thành văn bản trong câu trả lời.
- Di chuyển nội dung thì giữ nguyên văn quyết định có ngày của người dùng; chỉ đổi chỗ. Xóa hẳn chỉ khi nội dung đã bị quyết định sau thay thế hoặc sai với code.
- Sửa hook thì chạy thử hook bằng tay (mục 6) trước khi commit.

## 3. Hiện trạng đã đo

| Thứ | Số đo | Ghi chú |
|---|---|---|
| `CLAUDE.md` | 58 dòng | Nạp mọi phiên Claude. Chất lượng ổn, hơi dày chú thích lịch sử |
| `AGENTS.md` | 62 dòng | Nạp mọi phiên Codex; bắt Codex đọc thêm `PLAN.md` + `PROJECT_CONTEXT.md` mục 1–3, 7 |
| `plans/PLAN.md` | 105 dòng, 27 KB | Cả hai AI đọc đầu task; phần lớn là lịch sử |
| `docs/PROJECT_CONTEXT.md` | 324 dòng | Chốt 2026-11-02, chưa cập nhật sau 4 module |
| `plans/course-free.log.md` | 166 dòng, 40 KB | “Bắt đầu từ đây” 9 gạch đầu dòng, hook nạp nguyên văn |
| Spec lớn | `article-flow.md` 104 KB, `ai-assist.md` 83 KB, `ui-foundation-v2.md` 65 KB | Vượt mục tiêu 30 KB trong `AGENTS.md`; module đã xong |
| `.claude/rules/backend.md` | 49 dòng | 8 dòng Spring AI nạp cho mọi việc trong `server/` |
| Memory | 4 file | `project-resume-point` đã được sửa ngày 2026-11-13 (bỏ trạng thái cũ) |
| CI | chỉ `./gradlew test` | Không ai chạy full `npm test` của frontend |

## 4. Phát hiện và việc cần làm

### Ưu tiên 1 — Sai so với code (sửa trước)

**1.1 `docs/PROJECT_CONTEXT.md` lỗi thời.** `AGENTS.md` bắt Codex đọc mục 1–3 và 7 trước mọi task, `PLAN.md` dòng 3 bắt đọc cả file, nên các chỗ sai này đi thẳng vào spec mới:

- Mục 1, 5: ghi khóa học “mới dừng ở schema”, “Course, lesson, enrollment/progress: chưa làm”. Thực tế đã có `Course*` entity, 3 controller khóa học, trang `app/src/pages/Courses/`.
- Mở đầu và mục 7: “Flyway V1–V10/V11”. Thực tế có V12. `docs/README.md` còn ghi `final.sql` là V1–V7 (đầu file `final.sql` ghi V1–V11).
- Mục 3, 7: “access token ở `sessionStorage`”. `docs/RUNBOOK.md` ghi token chỉ ở bộ nhớ, và `sessionStorage` chỉ còn xuất hiện trong file test. Xác minh trong `app/src/services/api/client.ts` rồi sửa cho khớp.
- Mục 3: cây thư mục có `references/` (không tồn tại); `docs/` mô tả là “SQL hợp nhất và quy ước Git”.
- Mục 5 “Đang làm dở”: nhánh `codex/setup-agent-workflow`, dashboard khung. Mục 6 “Việc nên làm tiếp” khuyên làm course miễn phí (đã xong).
- Mục 8: bảng endpoint thiếu toàn bộ AI assist, khóa học, và ghi `/api/v1/articles` cần đăng nhập trong khi khóa học public là `permitAll`.
- Mục 2: “Test frontend: `npm test`” trái luật “chỉ chạy test liên quan”.

Cách sửa: tách file thành phần **ổn định** và phần **dễ lỗi thời**.

- Giữ và sửa đúng: mục 1 (tổng quan, một đoạn), 2 (stack, cách chạy), 3 (kiến trúc), 7 (quy ước cố định), 12 (muốn sửa X xem file Y — thêm dòng cho khóa học, AI), 13 (thuật ngữ).
- Xóa mục 5 và 6: trạng thái chỉ ở `PLAN.md` (D-007). Thay bằng một dòng trỏ `PLAN.md`.
- Mục 8: thay bảng endpoint bằng hai dòng trỏ Swagger (`/swagger-ui.html`) và thư mục `controller/`, kèm danh sách nhóm route theo quyền lấy từ `SecurityConfiguration`. Bảng chép tay sẽ lại lệch sau mỗi module.
- Mục 4: cập nhật bảng “đang được mã sử dụng” (thêm nhóm khóa học, `saved_articles`), bảng “có schema chưa có API” chỉ còn phần thật sự chưa làm (orders, payment, exercise, forum…).
- Đầu file ghi ngày cập nhật mới và câu “file này không ghi trạng thái task”.
- Mục tiêu: phần Codex phải đọc mỗi task (1–3, 7) không quá khoảng 90 dòng.

**1.2 `AGENTS.md` dòng 50 trái skill `codex-workflow`.** `AGENTS.md` ghi “Dùng `/codex:review --background`”; skill ghi chạy `--wait` qua nền của PowerShell và **không** dùng chế độ nền của Codex vì job chết khi phiên đóng. Lệnh này do Claude gọi, không phải Codex. Sửa dòng 50 thành: review do Claude khởi chạy theo skill `codex-workflow`; Codex chỉ cần biết vòng 1 là `review`, task rủi ro cao là `adversarial-review`.

**1.3 `plans/PLAN.md` mâu thuẫn với `CLAUDE.md`.**

- Dòng 3: “Đọc `PROJECT_CONTEXT.md` trước khi nhận task” — `CLAUDE.md` ghi chỉ đọc khi task đụng tới. Sửa cho khớp `CLAUDE.md`.
- Dòng 41 và dòng 105: nhắc skill `brainstorming`/`superpowers:brainstorming`. `CLAUDE.md` cấm `superpowers:*` từ 2026-11-06. Hỏi người dùng lệnh cấm có áp dụng cho Codex không (mục 5, câu 3); trong lúc chờ, ghi rõ “chỉ Codex” ở dòng 41.
- Hai dòng cùng ID `D-016`. Đổi dòng thứ hai thành `D-016b` (không đánh số lại các ID khác vì spec/log cũ dẫn chiếu chúng).
- Dòng `Course free`: trạng thái “Đã chốt” trong khi cả 6 task đã nhận; ô “Task hiện tại” là chuỗi 8 mệnh đề. `CLAUDE.md` yêu cầu một câu trạng thái + trỏ log. Rút thành: “Mọi task đã nhận (2026-11-10); còn đồng bộ spec cuối module và rebase/PR, xem log.”

### Ưu tiên 2 — Nội dung hết hạn nạp mỗi phiên

**2.1 Rút gọn `PLAN.md` (mục tiêu ≤ khoảng 60 dòng).** File này là bảng điều khiển, hiện gánh thêm lịch sử:

- **Bảng module:** 9 dòng đứng ở “Đang review”/“Chờ người dùng nhận kết quả” từ 2026-11-02/03 dù code đã merge vào `main` từ lâu. Opus không tự đánh “Hoàn tất” (nghiệm thu là cổng của người dùng): liệt kê 9 dòng này ở mục 5 câu 1 để người dùng xác nhận một lần. Sau khi xác nhận, chuyển mọi module `Hoàn tất` xuống một danh sách gọn “Đã xong” (tên — ngày — link spec/log), bảng chính chỉ giữ module đang mở.
- **Nhật ký quyết định D-001…D-029:** chuyển nguyên văn sang `plans/DECISIONS.md`, `PLAN.md` giữ một dòng trỏ. Lý do: quyết định còn hiệu lực đều đã nằm trong `CLAUDE.md`/`AGENTS.md`/rules; bảng này chỉ cần khi tra lý do. Trước khi chuyển, `grep -rn "D-0[0-9][0-9]"` trong `CLAUDE.md`, `AGENTS.md`, `.claude/`, `docs/` và sửa các dẫn chiếu “xem `PLAN.md`” thành file mới.
- **Mục “Quy trình”:** trùng `CLAUDE.md`/`AGENTS.md`. Giữ phần chỉ có ở đây (hai làn, thứ tự backend trước giao diện, chuỗi trạng thái hợp lệ); bỏ dòng “Skill”.
- **“Câu hỏi mở”:** xóa mục đã hết hạn — “Module đầu tiên cần cải tổ: chưa chọn”, “Docker daemon chưa chạy (kiểm 2026-11-02)”, “Tên nhánh của task do Codex làm”. Khối “Miền khóa học” (dòng 87–95, khoảng 9 KB): phần `course-free` đã thành spec và đã xong thì xóa; phần hướng trả phí/hoa hồng/video/AI tutor chuyển sang [`course-payment.directions.md`](course-payment.directions.md) mục “Hướng người dùng đã nêu trước đây” (file đó đã tóm tắt; đối chiếu để không mất ý, đặc biệt các quyết định có ngày: không hoàn tiền 2026-11-06, chia vai Admin/Moderator, không dùng YouTube cho khóa trả phí). `.superpowers/` giữ hay xóa: hỏi ở mục 5 câu 4.

**2.2 “Bắt đầu từ đây” của log phình theo thời gian.** Hook SessionStart nạp nguyên mục này. Ở `course-free.log.md` nó đã thành nhật ký ngược: 5 gạch đầu dòng “Task … đã nhận” kèm chi tiết review, dữ liệu DB dev của từng task. Phiên mới chỉ cần: việc tiếp theo, đang chờ gì, phần chưa kiểm **còn hiệu lực**, trạng thái nhánh.

- Thêm luật vào `CLAUDE.md` (mục “Giữ quyết định qua `/clear`”, thay cho câu mô tả hiện có): “Bắt đầu từ đây” tối đa 8 dòng, dòng đầu theo mẫu `- **Task tiếp:** <việc> · Giao diện: Có/Không`; task đã nhận gộp thành một dòng liệt kê; chi tiết thuộc về “Nhật ký phiên”.
- Viết lại mục này của `course-free.log.md` theo luật mới (nội dung bỏ ra chuyển xuống nhật ký nếu chưa có ở đó).
- Mục `## Task 1b — Kế hoạch thực thi` (khoảng 50 dòng cuối log) thuộc task đã nhận: để nguyên, không cần xóa (hook không nạp), nhưng ghi vào luật: kế hoạch thực thi của task đã nhận không đọc lại.

**2.3 Gợi ý plugin của hook đoán sai.** `session-context.mjs` đoán “task giao diện” bằng regex `giao diện|wireframe|UI|app/` trên cả mục resume. Mục này gần như luôn chứa chữ “giao diện” trong phần lịch sử, nên gợi ý bật/tắt `ui-ux-pro-max` không đáng tin (file tự ghi `shortcut:` về điểm này). Sửa `pluginHint`: nếu resume có `Giao diện: Có|Không` (mẫu ở 2.2) thì dùng giá trị đó; không có thì giữ regex cũ. Khoảng 3 dòng code.

Hiện `settings.json` tắt plugin còn `settings.local.json` bật, tức plugin đang bật ở máy người dùng và 7 skill `ui-ux-pro-max:*` (5 cái bị `frontend.md` cấm) được liệt kê mỗi phiên. Module tiếp theo bắt đầu bằng backend: nhắc người dùng tắt ở `settings.local.json` (file cục bộ của người dùng, không tự sửa).

**2.4 Luật Spring AI nằm trong `backend.md`.** 8 dòng “Spring AI 2.0.2” nạp cho mọi task backend dù chỉ liên quan mã `Ai*`. Tách sang `.claude/rules/backend-ai.md` với `paths` trỏ các file AI (`server/**/*Ai*`, `server/**/ai/**`); kiểm tra glob khớp bằng cách liệt kê file thật. `backend.md` còn khoảng 40 dòng, có chỗ cho luật của module thanh toán.

**2.5 Spec và log của module đã xong.** Không sửa nội dung (không áp dụng hồi tố). Chuyển spec/log/wireframe/review của module `Hoàn tất` vào `plans/archive/` để `grep` trong `plans/` không trả về hàng trăm dòng của module cũ (thử `grep -i "giá" plans/` hiện ra 80+ dòng nhiễu). Việc này đổi nhiều link nên **chỉ làm sau khi người dùng đồng ý** (mục 5 câu 2) và sau khi `PLAN.md` đã rút gọn; dùng `git mv`, rồi `grep -rn "plans/<slug>"` sửa link trong `PLAN.md`, `docs/`, `.claude/`. Hook chỉ đọc module đang làm nên không ảnh hưởng.

### Ưu tiên 3 — Một luật ghi nhiều nơi

**3.1 Ngân sách kiểm chứng ghi ở 6 nơi** (`CLAUDE.md`, `AGENTS.md`, `backend.md`, `frontend.md`, `_template.md`, D-018/019/021) và đã lệch một lần (D-021 thay D-018/019). Định một nguồn cho mỗi người đọc:

- Claude: chi tiết ở `backend.md`/`frontend.md` (đã đầy đủ). `CLAUDE.md` mục “Ngân sách kiểm chứng” rút còn 3 dòng: nguyên tắc (chỉ kiểm phần bị sửa, cuối task chạy một lần), trỏ hai rule, giới hạn log 10 dòng.
- Codex: giữ mục trong `AGENTS.md` (Codex không nạp `.claude/rules/`), nhưng thêm một câu “luật thực thi phía Claude ở `.claude/rules/`; hai nơi lệch nhau thì báo người dùng”.
- `_template.md`: dòng mẫu “Xong khi” giữ, bỏ đoạn lặp lại luật.

**3.2 `CLAUDE.md` gọn thêm.** Giữ cấu trúc. Bỏ chú thích lịch sử không đổi hành vi (“thay luật 2026-11-03”, “người dùng chốt … ” lặp nhiều lần — giữ ngày ở những luật đứng trên chỉ dẫn mặc định như luật commit). Gộp hai gạch đầu dòng về hook thành một. Mục “Model theo loại việc”: người dùng hiện giao Opus thực thi cả việc tài liệu và payment; hỏi mục 5 câu 5 rồi cập nhật cho khớp `.claude/settings.json`. Mục tiêu khoảng 45–50 dòng; không cắt luật nào người dùng đã chốt.

**3.3 Hai chỗ ghi “kế hoạch thực thi”.** `_template.md` có mục “Kế hoạch thực thi” trong spec (Codex viết, ≤ 40 dòng); `CLAUDE.md` nói kế hoạch thực thi ghi ở log. Cả hai đều đang dùng với nghĩa khác nhau. Thêm nửa câu vào `CLAUDE.md`: mục trong spec là của Codex; mục trong log là bản chi tiết Claude viết khi người dùng yêu cầu, và thắng khi lệch.

**3.4 Memory.** Kiểm 4 file memory còn khớp repo. `feedback-working-style` điểm 4 (không dùng hộp thoại hỏi) chỉ có trong memory — đây là luật lâu dài, ghi thêm nửa dòng vào `CLAUDE.md` mục “Giữ quyết định qua `/clear`” để Codex/phiên khác cũng thấy.

### Khoảng trống (đề xuất, không tự làm)

**G1. Không ai chạy full test frontend.** Luật “chỉ chạy test liên quan” hợp lý với điều kiện CI chạy bộ đầy đủ; nhưng `.github/workflows/ci.yml` chỉ có job backend. Lỗi hồi quy frontend ngoài file liên quan hiện không có lưới nào bắt. Đề xuất một làn nhẹ: thêm job `npm ci && npm test && npm run build` trong `app/`. Hỏi người dùng (mục 5 câu 6); nếu đồng ý thì ghi một dòng vào bảng `PLAN.md`, không làm trong brief này (đụng CI, cần chạy thử).

**G2. `docs/technical/db/final.sql` dừng ở V11.** Cần sinh lại sau V12 hoặc ghi rõ “đến V11”. Sửa câu chữ trong `docs/README.md` và `PROJECT_CONTEXT.md` cho đúng số hiện tại; việc sinh lại file để module payment (V13) làm một lần.

## 5. Câu hỏi gom cho người dùng (hỏi một lần, kèm khuyến nghị)

1. Chín dòng module cũ trong `PLAN.md` (Workflow bootstrap, UI foundation, Auth login/register, User profile, Sidebar cleanup, Seed LF fix, Forgot password UI, Docs restructure, Sidebar + login redirect): xác nhận “Hoàn tất” hết? **Khuyến nghị: có** — code đã merge `main` qua các PR sau đó.
2. Chuyển spec/log module đã xong vào `plans/archive/`? **Khuyến nghị: có.**
3. Lệnh cấm `superpowers:*` có áp dụng cho Codex (hiện `PLAN.md` ghi Codex dùng `brainstorming`)? **Khuyến nghị: giữ cho Codex dùng khi viết spec module mới**, ghi rõ trong `AGENTS.md`.
4. Xóa thư mục `.superpowers/` (21 MB, đã gitignore)? **Khuyến nghị: xóa** — việc xóa do người dùng tự làm hoặc xác nhận rõ.
5. Model mặc định: giữ Sonnet cho code thường và Opus cho spec/rủi ro cao, hay chuyển hẳn Opus? **Khuyến nghị: giữ như cũ**, riêng module `course-payment` ghi rủi ro cao (tiền, đồng thời) nên dùng Opus.
6. Thêm job frontend vào CI (G1)? **Khuyến nghị: có.**

**Trả lời (2026-11-14, người dùng giao Claude trả lời; chưa thực hiện):** 1 có; 2 có; 3 có, ghi vào `AGENTS.md`; 4 xóa, nhưng chỉ xóa khi người dùng tự làm hoặc nói rõ “xóa”; 5 giữ như cũ, `course-payment` dùng Opus; 6 có, làm thành task làn nhẹ riêng.

## 6. Xong khi

- [ ] `docs/PROJECT_CONTEXT.md`: không còn câu nào ở 1.1 sai với code; mục 5, 6 đã bỏ; phần 1–3 + 7 ≤ khoảng 90 dòng. Kiểm: `grep -n "sessionStorage\|references/\|V1–V1[01]\|setup-agent-workflow" docs/PROJECT_CONTEXT.md` không còn kết quả sai.
- [ ] `PLAN.md` ≤ khoảng 60 dòng; dòng `Module đang làm: [slug](slug.md)` giữ đúng định dạng; `plans/DECISIONS.md` chứa đủ D-001…D-029 (đếm số dòng bảng trước và sau).
- [ ] Hook còn chạy: `node .claude/hooks/session-context.mjs` in JSON có mục “Bắt đầu từ đây” ≤ 8 dòng và gợi ý plugin đúng theo `Giao diện: Có/Không`; `echo {} | node .claude/hooks/stop-log-check.mjs` thoát mã 0.
- [ ] `backend-ai.md` có `paths` khớp ít nhất các file `Ai*` thật; `backend.md` không còn mục Spring AI.
- [ ] Không còn link gãy: với mỗi file đã chuyển/đổi tên, `grep -rn "<tên cũ>"` trong `*.md` và `.claude/` không còn kết quả.
- [ ] `AGENTS.md` dòng review khớp skill `codex-workflow`; `CLAUDE.md` 45–50 dòng và mọi luật có ngày người dùng chốt vẫn còn (so `git diff` từng dòng bị xóa).
- [ ] Báo cáo cuối cho người dùng: đã đổi gì (theo file), phát hiện nào bỏ qua vì không còn đúng, 6 câu hỏi ở mục 5.

Chỉ sửa tài liệu nên kiểm tĩnh, không chạy test/build.

## 7. Không làm

- Không sửa thân spec của bất kỳ module nào (của Codex); không đánh `[x]`.
- Không đổi quy trình `Plan → Code → Test → Review → Result`, số vòng, luật commit, ngân sách kiểm chứng (chỉ gom chỗ ghi).
- Không thêm hook, skill hay công cụ mới ngoài 3 dòng sửa `pluginHint`.
- Không sửa `settings.local.json`, `~/.codex/`, plugin của người dùng.
- Không viết lại `UI_GUIDE.md`, `RUNBOOK.md`, `GIT_WORKFLOW.md`, các skill (đang đúng và chỉ nạp khi cần).
