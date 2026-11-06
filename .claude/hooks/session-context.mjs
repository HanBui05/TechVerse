// SessionStart (startup/clear/compact): inject only the resume state of the active module,
// so a fresh session knows what is done (do not redo), what to skip and what is next.
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { activeModule, firstEntries, root, section } from './lib.mjs'

const UI_PLUGIN = 'ui-ux-pro-max@ui-ux-pro-max-skill'

// Local settings override project settings; an absent entry means the project default.
function uiPluginEnabled() {
  for (const file of ['settings.local.json', 'settings.json']) {
    const path = join(root, '.claude', file)
    if (!existsSync(path)) continue
    try {
      const value = JSON.parse(readFileSync(path, 'utf8')).enabledPlugins?.[UI_PLUGIN]
      if (typeof value === 'boolean') return value
    } catch {}
  }
  return true
}

// shortcut: guesses a UI task from words in the resume section; upgrade to a task field if it misfires.
function pluginHint(resume) {
  const ui = /giao diện|wireframe|\bUI\b|app\//i.test(resume)
  const enabled = uiPluginEnabled()
  if (ui && !enabled)
    return `[Plugin] Task tiếp theo có vẻ là giao diện nhưng ${UI_PLUGIN} đang tắt: bật bằng /plugin hoặc settings.local.json rồi mở phiên mới (nếu cần).`
  if (!ui && enabled)
    return `[Plugin] Task tiếp theo không phải giao diện mà ${UI_PLUGIN} đang bật: tắt trong .claude/settings.local.json để giảm token.`
  return ''
}

const mod = activeModule()
let text
if (!mod) {
  text = '[TechVerse] Không có “Module đang làm” trong plans/PLAN.md. Hỏi người dùng module/task trước khi đọc thêm.'
} else if (!mod.log) {
  text = `[TechVerse] Module đang làm: ${mod.slug}. Chưa có ${mod.logRel}; đọc ${mod.spec}.`
} else {
  const log = readFileSync(mod.log, 'utf8')
  const resume = section(log, 'Bắt đầu từ đây')
  text = [
    `[TechVerse — ngữ cảnh tự nạp] Module đang làm: ${mod.slug}. Spec: ${mod.spec}. Log: ${mod.logRel}.`,
    'Phần dưới là trạng thái chuẩn. Mục “Đã xong” không đọc lại code/test, không làm lại, không kiểm lại; mục “Bỏ qua” không mở. Chỉ đọc thêm mục task tiếp theo trong spec và chi tiết log khi task cần.',
    resume,
    section(log, 'Quyết định người dùng chưa có trong spec'),
    section(log, 'Câu hỏi mở'),
    firstEntries(section(log, 'Nhật ký phiên'), 2),
    pluginHint(resume),
  ].filter(Boolean).join('\n\n')
}
process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } }))
