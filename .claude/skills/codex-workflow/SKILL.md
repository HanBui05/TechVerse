---
name: codex-workflow
description: Thủ tục làm việc với Codex trong TechVerse — tự gọi review, nhận kết quả, commit khi người dùng nhận task, nhờ Codex đồng bộ spec cuối module. Dùng khi task đã test + build đạt (chuẩn bị review), khi có kết quả review, khi người dùng nhận task và khi kết thúc module.
---

# Codex workflow

Chính sách (ai quyết, giới hạn vòng, sửa gì) ở `CLAUDE.md`. File này là thủ tục. Review gate (Stop hook của Codex) luôn tắt.

`<script>` = `~/.claude/plugins/cache/openai-codex/codex/<bản mới nhất>/scripts/codex-companion.mjs` (2026-11-05: `1.0.6`; tìm bản mới nhất: `Get-ChildItem "$env:USERPROFILE\.claude\plugins\cache\openai-codex\codex" -Directory | Sort-Object Name -Descending | Select-Object -First 1`). Mọi lệnh chạy bằng **PowerShell** (Git Bash đổi `/PID` của `taskkill` thành đường dẫn → `cancel` hỏng).

## 1. Review

1. `node "<script>" status ""` — đã có job review đang chạy (kể cả người dùng tự gõ `/codex:review`) thì chờ job đó. Job treo của phiên cũ thì `cancel <job-id>`.
2. Chạy `--wait` qua `run_in_background` của công cụ PowerShell (review 5–10 phút; không dùng chế độ nền riêng của Codex vì job chết khi phiên đóng). Chờ thông báo, không poll. Đọc kết quả: `sed -n '/^# Codex/,$p' "<output-file>"`.
   - Vòng 1: `node "<script>" review --wait` — **không kèm focus**. Task rủi ro cao theo spec: `adversarial-review --wait "<focus>"`.
   - Vòng 2 **chỉ khi vòng 1 có phát hiện phải sửa**: `node "<script>" adversarial-review --wait "<focus>"`.
   - Focus: `Xong khi: plans/<module>.md — Task <n>. Test đã chạy: <lệnh> → <đạt/lỗi>. Vòng 2: chỉ xem <file/phần sửa sau vòng 1>.`
   - Codex không chạy được Vitest/Gradle trong sandbox Windows, chỉ đối chiếu log → log phải ghi lệnh + số đạt trước khi review.
   - Sandbox chặn Git Bash: luật shell PowerShell cho reviewer ở `AGENTS.md` mục Reviewer. Review lâu bất thường hoặc nhiều `bash -lc`/`Command failed` → kiểm lại mục đó.
   - Task “Đổi giao diện: Có”: chạy vòng 1 ở nền, trong lúc đó kiểm bằng mắt; sửa sau kiểm mắt gộp vào lượt sửa vòng 1.
3. Phạm vi: diff chưa commit = task đang làm. File mới chưa track: `git add -N <file>` trước khi review.
4. Kết quả tiếng Anh: dán nguyên văn trong khối trích dẫn + dịch đủ từng phát hiện. Kiểm từng góp ý trên code trước khi sửa.
5. Vòng 1 có blocker thuộc diện sửa → sửa, chạy lại test liên quan + build, ghi log, tự chạy vòng 2. Không có → xong review, không chạy vòng 2. Vòng 2 còn phát hiện → trình bày + một khuyến nghị, người dùng quyết.

## 2. Người dùng nhận task

1. Ghi “Task <n> đã nhận (<ngày>)” vào log (“Bắt đầu từ đây”, nhật ký phiên) và dòng module ở `PLAN.md`. **Không** đánh `[x]` spec, **không** nhờ Codex đồng bộ spec (để cuối module).
2. Commit cục bộ trên nhánh module (không push, không `main`): `git add -A && git commit -m "<type>(<scope>): <thay đổi trong code>"` — luật commit trong `CLAUDE.md`. Tài liệu plan: `docs(plans): <nội dung đổi>`. Kiểm `git status --short` trước: không có file bí mật/ảnh nguồn lớn.

## 3. Cuối module

1. Đồng bộ spec một lần (Claude không sửa spec): chạy nền
   `node "<script>" task --write "Đồng bộ spec plans/<module>.md theo log plans/<module>.log.md, làm đúng mục 'Đồng bộ với Claude' trong AGENTS.md. Người dùng đã nhận các task <danh sách + ngày>. Đánh [x] các mục 'Xong khi' log ghi đạt (mục 'chưa kiểm' để [ ]). Đưa mọi mục 'Lệch khác spec' trong log vào thân spec. Không sửa mục kế hoạch thực thi của Claude trong log. Cuối cùng liệt kê ngắn những gì đã đổi."`
   Kiểm bằng `git diff --word-diff=plain` (dòng dài), báo người dùng, commit `docs(plans): ...`.
2. Squash các commit của nhánh module thành một commit chỉ khi người dùng yêu cầu commit/PR cuối module.
