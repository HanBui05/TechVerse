import { useState } from 'react'
import { afterEach, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AiOutlineEditor } from './AiOutlineEditor'
import { outlineErrors, type OutlineDraft } from '../../services/aiAssistService'

const options = [{ id: 'jwt', name: 'JWT' }, { id: 'spring', name: 'Spring Boot' }, { id: 'oauth', name: 'OAuth2' }]
const outline = (over: Partial<OutlineDraft> = {}): OutlineDraft => ({
  title: 'Spring Security cho người mới', summary: 's'.repeat(60), tagIds: ['jwt'], suggestedTagIds: ['spring', 'gone'],
  sections: [{ heading: 'Mục một nè', subsections: ['Con một', 'Con hai'] }, { heading: 'Mục hai nè', subsections: [] }, { heading: 'Mục ba nè', subsections: [] }], ...over,
})
let latest: OutlineDraft
function Harness({ initial = outline(), showErrors = false }: { initial?: OutlineDraft; showErrors?: boolean }) {
  const [value, setValue] = useState(initial)
  latest = value
  return <AiOutlineEditor value={value} tags={options} onChange={setValue} showErrors={showErrors} language="vi" />
}
afterEach(cleanup)

it('maps suggested IDs through options, hides unknown ones and keeps the total at 10', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  expect(screen.queryByText('gone')).toBeNull()
  const suggestion = screen.getByRole('checkbox', { name: 'Spring Boot' })
  expect(suggestion.getAttribute('aria-checked')).toBe('false')
  await user.click(suggestion)
  expect(latest.tagIds).toEqual(['jwt', 'spring'])
  await user.click(screen.getByRole('checkbox', { name: 'Spring Boot' }))
  expect(latest.tagIds).toEqual(['jwt'])
  cleanup()
  render(<Harness initial={outline({ tagIds: ['jwt', ...Array.from({ length: 9 }, (_, i) => `t${i}`)] })} />)
  expect((screen.getByRole('checkbox', { name: 'Spring Boot' }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getByText('Đã đủ 10 thẻ. Bỏ một thẻ để thêm gợi ý.')).toBeTruthy()
})

it('adds, deletes and reorders H2/H3 with buttons only, keeping focus on the pressed control', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  expect((screen.getByRole('button', { name: 'Đưa Mục 1 lên' }) as HTMLButtonElement).disabled).toBe(true)
  await user.click(screen.getByRole('button', { name: 'Đưa Mục 1 xuống' }))
  expect(latest.sections.map(s => s.heading)).toEqual(['Mục hai nè', 'Mục một nè', 'Mục ba nè'])
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Đưa Mục 2 xuống' }))
  await user.click(screen.getByRole('button', { name: 'Đưa Mục con 2.2 lên' }))
  expect(latest.sections[1].subsections).toEqual(['Con hai', 'Con một'])
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Đưa Mục con 2.1 xuống' }))
  await user.click(screen.getByRole('button', { name: 'Xóa Mục con 2.1' }))
  expect(latest.sections[1].subsections).toEqual(['Con một'])
  await user.click(screen.getAllByRole('button', { name: 'Mục con' })[0])
  expect(latest.sections[0].subsections).toEqual([''])
  await user.click(screen.getByRole('button', { name: /Thêm H2/ }))
  expect(latest.sections).toHaveLength(4)
  await user.click(screen.getByRole('button', { name: 'Xóa Mục 4' }))
  expect(latest.sections).toHaveLength(3)
  fireEvent.change(screen.getByLabelText('Tiêu đề mục 1'), { target: { value: 'Đổi tên mục' } })
  expect(latest.sections[0].heading).toBe('Đổi tên mục')
})

it('blocks a fifth H3 and a ninth H2', () => {
  render(<Harness initial={outline({ sections: Array.from({ length: 8 }, (_, i) => ({ heading: `Mục số ${i}`, subsections: ['Con a1', 'Con a2', 'Con a3', 'Con a4'].map(s => `${s}-${i}`) })) })} />)
  expect((screen.getByRole('button', { name: /Thêm H2/ }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getAllByRole('button', { name: 'Mục con' }).every(b => (b as HTMLButtonElement).disabled)).toBe(true)
})

it('validates like AiDraftRequest: lengths at the boundary, 3–8 H2, distinct headings ignoring case and spaces', () => {
  const at = (n: number) => 'a'.repeat(n)
  expect(outlineErrors(outline())).toEqual({})
  expect(outlineErrors(outline({ title: at(5), summary: at(50) }))).toEqual({})
  expect(outlineErrors(outline({ title: at(4), summary: at(501) }))).toEqual({ title: 'titleLength', summary: 'summaryLength' })
  expect(outlineErrors(outline({ title: at(256), summary: ' '.repeat(10) + at(49) }))).toEqual({ title: 'titleLength', summary: 'summaryLength' })
  expect(outlineErrors(outline({ sections: outline().sections.slice(0, 2) }))).toEqual({ sections: 'sectionCount' })
  const sections = [{ heading: at(120), subsections: [at(4)] }, { heading: ' MỤC HAI NÈ ', subsections: ['mục hai nè'] }, { heading: 'Mục ba nè', subsections: [at(121)] }]
  expect(outlineErrors(outline({ sections }))).toEqual({ 'h-0-0': 'headingLength', 'h-1-0': 'headingDuplicate', 'h-2-0': 'headingLength' })
})

it('shows inline errors linked through aria-describedby only when asked', () => {
  render(<Harness initial={outline({ summary: 'ngắn' })} />)
  expect(screen.queryByText('Tóm tắt cần 50–500 ký tự.')).toBeNull()
  cleanup()
  render(<Harness initial={outline({ summary: 'ngắn' })} showErrors />)
  const summary = screen.getByLabelText(/Tóm tắt/)
  expect(summary.getAttribute('aria-invalid')).toBe('true')
  expect(document.getElementById(summary.getAttribute('aria-describedby')!)?.textContent).toBe('Tóm tắt cần 50–500 ký tự.')
})
