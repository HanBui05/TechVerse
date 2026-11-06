import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ArticleStatusBadges } from './ArticleStatusBadges'

afterEach(cleanup)

it('shows publication and workflow as two labelled badges plus the unpublished-changes marker', () => {
  render(<ArticleStatusBadges language="vi" article={{ workflowStatus: 'DRAFT', publicationStatus: 'PUBLISHED', hasUnpublishedChanges: true }} />)
  const list = screen.getByRole('list', { name: 'Trạng thái bài viết' })
  expect(list.textContent).toContain('Đang công khai')
  expect(list.textContent).toContain('Bản nháp')
  expect(list.textContent).toContain('Có thay đổi chưa gửi')
  expect(list.textContent).not.toMatch(/DRAFT|PUBLISHED/)
})

it('shows the AI flag only in moderator mode', () => {
  const article = { workflowStatus: 'PENDING', publicationStatus: 'UNPUBLISHED', hasUnpublishedChanges: false, aiAssisted: true } as const
  const { rerender } = render(<ArticleStatusBadges language="vi" article={article} />)
  expect(screen.queryByText('AI hỗ trợ')).toBeNull()
  rerender(<ArticleStatusBadges language="vi" article={article} moderator />)
  expect(screen.getByText('AI hỗ trợ')).not.toBeNull()
})

it('does not claim unpublished changes for a never-published article and translates to English', () => {
  render(<ArticleStatusBadges language="en" article={{ workflowStatus: 'PENDING', publicationStatus: 'UNPUBLISHED', hasUnpublishedChanges: true }} />)
  const list = screen.getByRole('list', { name: 'Article status' })
  expect(list.textContent).toContain('Not published')
  expect(list.textContent).toContain('Pending review')
  expect(list.textContent).not.toContain('Unsubmitted changes')
})
