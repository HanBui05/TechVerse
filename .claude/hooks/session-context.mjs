// SessionStart (startup/clear/compact): inject only the resume state of the active module,
// so a fresh session knows what is done (do not redo), what to skip and what is next.
import { readFileSync } from 'node:fs'
import { activeModule, firstEntries, section } from './lib.mjs'

const mod = activeModule()
let text
if (!mod) {
  text = '[TechVerse] Không có “Module đang làm” trong plans/PLAN.md. Hỏi người dùng module/task trước khi đọc thêm.'
} else if (!mod.log) {
  text = `[TechVerse] Module đang làm: ${mod.slug}. Chưa có ${mod.logRel}; đọc ${mod.spec}.`
} else {
  const log = readFileSync(mod.log, 'utf8')
  text = [
    `[TechVerse — ngữ cảnh tự nạp] Module đang làm: ${mod.slug}. Spec: ${mod.spec}. Log: ${mod.logRel}.`,
    'Phần dưới là trạng thái chuẩn. Mục “Đã xong” không đọc lại code/test, không làm lại, không kiểm lại; mục “Bỏ qua” không mở. Chỉ đọc thêm mục task tiếp theo trong spec và chi tiết log khi task cần.',
    section(log, 'Bắt đầu từ đây'),
    section(log, 'Quyết định người dùng chưa có trong spec'),
    section(log, 'Câu hỏi mở'),
    firstEntries(section(log, 'Nhật ký phiên'), 2),
  ].filter(Boolean).join('\n\n')
}
process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } }))
