import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { ArticleCard } from './ArticleCard'
import { publicSummaryFixture as article } from '../../test/articleFixtures'

afterEach(cleanup)

function Detail() {
  const location = useLocation()
  return <p>detail {location.pathname} from {(location.state as { from: string }).from}</p>
}
const renderCard = (props: Partial<Parameters<typeof ArticleCard>[0]> = {}) => render(<MemoryRouter initialEntries={['/blogs?topicId=java']}>
  <Routes><Route path="/blogs" element={<ArticleCard article={article} from="/blogs?topicId=java" {...props} />} /><Route path="/blogs/:id" element={<Detail />} /></Routes>
</MemoryRouter>)

it('shows topic, title, summary, at most 3 tags + “+N”, reading time, author and an unpressed save button', () => {
  renderCard()
  expect(screen.getAllByText('Java').length).toBeGreaterThan(0)
  expect(screen.getByRole('heading', { name: 'Spring Boot từ đầu' })).not.toBeNull()
  expect(screen.getByText('Tóm tắt Spring')).not.toBeNull()
  expect(['Spring', 'JPA', 'REST'].map(name => screen.getByText(name))).toHaveLength(3)
  expect(screen.queryByText('Docker')).toBeNull()
  expect(screen.getByText('+2').getAttribute('title')).toBe('và 2 thẻ khác')
  expect(screen.getByText('6 phút đọc')).not.toBeNull()
  expect(screen.getByText('Trần B')).not.toBeNull()
  expect(screen.getByRole('button', { name: 'Lưu bài viết' }).getAttribute('aria-pressed')).toBe('false')
})

it('links title and “Read more” to the detail carrying the list URL in router state', async () => {
  const user = userEvent.setup()
  renderCard()
  expect(screen.getByRole('link', { name: 'Đọc tiếp: Spring Boot từ đầu' }).getAttribute('href')).toBe('/blogs/pub-1')
  await user.click(screen.getByRole('link', { name: 'Spring Boot từ đầu' }))
  expect(screen.getByText('detail /blogs/pub-1 from /blogs?topicId=java')).not.toBeNull()
})

it('uses the cover when present and an English copy on demand', () => {
  const { container } = renderCard({ article: { ...article, coverImageUrl: 'https://res.cloudinary.com/demo/c.png', saved: true, tags: [] }, language: 'en' })
  expect(container.querySelector('img[src="https://res.cloudinary.com/demo/c.png"]')?.getAttribute('loading')).toBe('lazy')
  expect(screen.getByText('6 min read')).not.toBeNull()
  expect(screen.getByRole('button', { name: 'Save article' }).getAttribute('aria-pressed')).toBe('true')
})
