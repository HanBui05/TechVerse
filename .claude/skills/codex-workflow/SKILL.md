---
name: codex-workflow
description: Thủ tục làm việc với Codex trong TechVerse — tự gọi review (vòng 1/2), nhận kết quả, commit WIP khi người dùng nhận task, nhờ Codex đồng bộ spec theo log. Dùng khi task đã test + build đạt (chuẩn bị review), khi có kết quả review, và khi người dùng nói đã nhận/hoàn thành task.
---

# Codex workflow

Chính sách (ai quyết, giới hạn vòng, sửa gì) ở `CLAUDE.md`. File này là thủ tục.

`<script>` = `~/.claude/plugins/cache/openai-codex/codex/<bản mới nhất>/scripts/codex-companion.mjs`. Mọi lệnh chạy bằng **PowerShell** (Git Bash đổi `/PID` của `taskkill` thành đường dẫn → `cancel` hỏng).

## 1. Review

1. `node "<script>" status ""` — đã có job review đang chạy (kể cả người dùng tự gõ `/codex:review`) thì chờ job đó, không chạy thêm. Job treo của phiên cũ (tiến trình đã chết) thì `cancel <job-id>`.
2. Chạy **chờ kết quả**, không chạy nền (job nền chết khi phiên đóng):
   - Vòng 1: `node "<script>" review --wait` (task rủi ro cao theo spec: `adversarial-review --wait "<focus>"`).
   - Vòng 2: luôn `node "<script>" adversarial-review --wait "<focus>"`.
   - Focus: `Xong khi: plans/<module>.md — Task <n>. Test đã chạy: <lệnh> → <đạt/lỗi>. Vòng 2: chỉ xem <file/phần sửa sau vòng 1>.`
3. Phạm vi: diff chưa commit = task đang làm (task trước đã ở commit `wip(...)`).
4. Kết quả tiếng Anh: dán nguyên văn trong khối trích dẫn + dịch đủ từng phát hiện (mức, vị trí, nội dung). Đánh giá theo `superpowers:receiving-code-review`.
5. Vòng 1: blocker thuộc diện sửa → sửa, chạy lại test liên quan + build, ghi log, tự chạy vòng 2. Vòng 2 còn phát hiện → trình bày + một khuyến nghị, người dùng quyết.

## 2. Người dùng nhận task

1. Ghi log (“Bắt đầu từ đây”, nhật ký phiên), cập nhật dòng module ở `PLAN.md`.
2. Commit WIP cục bộ trên nhánh module (không push, không `main`): `git add -A && git commit -m "wip(<module>): Task <n> — <tên>"` + dòng `Co-Authored-By`. Kiểm `git status --short` trước: không có file bí mật/ảnh nguồn lớn.
3. Đồng bộ spec (Claude không sửa spec): chạy nền
   `node "<script>" task --write "Đồng bộ spec plans/<module>.md theo log plans/<module>.log.md, làm đúng mục 'Đồng bộ với Claude' trong AGENTS.md. Người dùng đã nhận Task <n> (<ngày>). Cuối cùng liệt kê ngắn những gì đã đổi."`
   Xong thì tự kiểm diff spec/log rồi báo người dùng phần Codex đã đổi.

## 3. Cuối module

Squash các commit `wip(<module>)` thành một commit (Conventional Commit) chỉ khi người dùng yêu cầu commit/PR cuối module.
