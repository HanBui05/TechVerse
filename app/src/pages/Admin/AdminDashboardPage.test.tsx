import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AdminDashboardPage } from './AdminDashboardPage'

afterEach(cleanup)

// Dashboard only shows what exists: shortcuts to real admin pages, no placeholder stats for unbuilt features.
it.each([
  ['vi', ['Hồ sơ tác giả', 'Quản lý người dùng', 'Chủ đề', 'Thẻ']],
  ['en', ['Author applications', 'Manage users', 'Topics', 'Tags']],
] as const)('links to every real admin page in %s', (language, names) => {
  render(<MemoryRouter><AdminDashboardPage language={language} /></MemoryRouter>)
  const hrefs = names.map(name => screen.getByRole('link', { name: new RegExp(name) }).getAttribute('href'))
  expect(hrefs).toEqual(['/admin/author-applications', '/admin/users', '/admin/topics', '/admin/tags'])
})

it('drops placeholder stats and panels for features that do not exist', () => {
  render(<MemoryRouter><AdminDashboardPage language="vi" /></MemoryRouter>)
  for (const text of [/Doanh thu/, /Khóa học/, /Học viên/, /Thành viên trực tuyến/, /SỐ TIỀN/, /Hoạt động gần đây/]) expect(screen.queryByText(text)).toBeNull()
  expect(screen.getByRole('heading', { level: 1 })).toBeTruthy()
})
