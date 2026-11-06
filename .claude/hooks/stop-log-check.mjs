// Stop: if code or Claude rules changed after the active module log was last written,
// block once and ask Claude to record the session (resume section + session journal).
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { activeModule, root } from './lib.mjs'

const input = JSON.parse(readFileSync(0, 'utf8') || '{}')
if (input.stop_hook_active) process.exit(0) // already reminded in this stop cycle
const mod = activeModule()
if (!mod?.log) process.exit(0)

// Claude-owned areas only; spec and PLAN.md are excluded because Codex edits them in parallel.
// Code only: rule/doc edits alone do not force a log update (user decision 2026-11-06).
const watched = ['app', 'server']
const porcelain = execFileSync('git', ['status', '--porcelain', '-uall', '--', ...watched], { cwd: root, encoding: 'utf8' })
const logTime = statSync(mod.log).mtimeMs
const newer = porcelain.split('\n').filter(Boolean)
  .map(l => l.slice(3).replace(/^"|"$/g, '').split(' -> ').pop())
  .filter(f => existsSync(join(root, f)) && statSync(join(root, f)).mtimeMs > logTime + 1000)

if (newer.length) {
  const sample = newer.slice(0, 5).join(', ') + (newer.length > 5 ? `, … (+${newer.length - 5})` : '')
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason: `File sửa sau lần ghi log cuối (${sample}). Trước khi dừng, cập nhật ${mod.logRel}: (1) “Bắt đầu từ đây” nếu trạng thái/task tiếp theo/chưa kiểm đổi; (2) thêm hoặc bổ sung mục hôm nay ở “Nhật ký phiên” (đã làm, quyết định mới, bài học, việc dở — chỉ điều phiên sau cần). Thỏa thuận mới với người dùng → ghi đúng file luật. Thay đổi quá nhỏ thì ghi một dòng vào nhật ký. Cập nhật dòng module trong plans/PLAN.md nếu trạng thái đổi.`,
  }))
}
