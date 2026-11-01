import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminUsersPage } from './AdminUsersPage'
import { setAccessToken } from '../../services/api/client'

afterEach(() => { cleanup(); setAccessToken(null); vi.unstubAllGlobals() })

// Translate enum labels without accidentally sending Vietnamese strings to the API.
it('displays Vietnamese roles/statuses but submits the original enum filter values', async () => {
  const urls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    urls.push(String(input))
    return new Response(JSON.stringify({ status: 200, data: { content: [], hasNext: false } }))
  }))
  setAccessToken('admin-test')
  const user = userEvent.setup()
  render(<AdminUsersPage />)
  expect(screen.queryByRole('option', { name: 'Chờ duyệt' })).not.toBeNull()
  expect((screen.getByRole('option', { name: 'Chờ duyệt' }) as HTMLOptionElement).value).toBe('PENDING')
  await user.selectOptions(screen.getByLabelText('Hồ sơ tác giả'), 'PENDING')
  await user.selectOptions(screen.getByLabelText('Vai trò'), 'AUTHOR')
  await waitFor(() => expect(urls.some(url => url.includes('authorStatus=PENDING') && url.includes('role=AUTHOR'))).toBe(true))
})
