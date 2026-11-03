import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChangePasswordPanel } from './ChangePasswordPanel'
import { profileCopy, type ProfileTranslation } from '../../data/profile'

const t = profileCopy.vi
const fetchMock = vi.fn<typeof fetch>()

function apiResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify({ status, message: 'Raw backend detail', data }), { status, headers: { 'Content-Type': 'application/json' } })
}

function fill(values: { current?: string; next?: string; confirm?: string }, copy: ProfileTranslation = t) {
  if (values.current !== undefined) fireEvent.change(screen.getByLabelText(copy.currentPassword), { target: { value: values.current } })
  if (values.next !== undefined) fireEvent.change(screen.getByLabelText(copy.newPassword), { target: { value: values.next } })
  if (values.confirm !== undefined) fireEvent.change(screen.getByLabelText(copy.confirmPassword), { target: { value: values.confirm } })
}

const submit = (copy: ProfileTranslation = t) => fireEvent.click(screen.getByRole('button', { name: copy.changePassword }))

beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('toggles each password field independently', async () => {
  const user = userEvent.setup()
  render(<ChangePasswordPanel language="vi" />)
  const toggles = screen.getAllByRole('button', { name: t.showPassword })
  expect(toggles).toHaveLength(3)
  await user.click(toggles[1])
  expect(screen.getByLabelText(t.currentPassword).getAttribute('type')).toBe('password')
  expect(screen.getByLabelText(t.newPassword).getAttribute('type')).toBe('text')
  expect(screen.getByLabelText(t.confirmPassword).getAttribute('type')).toBe('password')
})

describe('client validation blocks the request', () => {
  it.each([
    ['blank fields', { current: '', next: '', confirm: '' }, { currentPassword: t.passwordRequired, newPassword: t.passwordRequired, confirmPassword: t.passwordRequired }],
    ['whitespace-only fields', { current: '   ', next: '        ', confirm: '        ' }, { currentPassword: t.passwordRequired, newPassword: t.passwordRequired, confirmPassword: t.passwordRequired }],
    ['a 7-character new password', { current: 'OldPass123', next: 'Short1!', confirm: 'Short1!' }, { newPassword: t.passwordLength }],
    ['a 73-character new password', { current: 'OldPass123', next: 'a'.repeat(73), confirm: 'a'.repeat(73) }, { newPassword: t.passwordLength }],
    ['a new password over 72 UTF-8 bytes', { current: 'OldPass123', next: 'é'.repeat(37), confirm: 'é'.repeat(37) }, { newPassword: t.passwordLength }],
    ['a new password equal to the current one', { current: 'SamePass123', next: 'SamePass123', confirm: 'SamePass123' }, { newPassword: t.passwordSame }],
    ['a mismatched confirmation', { current: 'OldPass123', next: 'NewPass123', confirm: 'NewPass124' }, { confirmPassword: t.passwordMismatch }],
  ])('%s', (_name, values, errors) => {
    render(<ChangePasswordPanel language="vi" />)
    fill(values)
    submit()
    expect(fetchMock).not.toHaveBeenCalled()
    for (const [key, message] of Object.entries(errors)) {
      const input = screen.getByLabelText(t[key as 'currentPassword'])
      expect(input.getAttribute('aria-invalid')).toBe('true')
      expect(document.getElementById(input.getAttribute('aria-describedby') || '')?.textContent).toBe(message)
    }
  })
})

it('sends the passwords untrimmed, clears the form and explains other devices were signed out', async () => {
  fetchMock.mockResolvedValue(apiResponse(null))
  render(<ChangePasswordPanel language="vi" />)
  fill({ current: ' OldPass123 ', next: 'NewPass123 ', confirm: 'NewPass123 ' })
  submit()
  expect(screen.getByRole('button', { name: t.changingPassword }).hasAttribute('disabled')).toBe(true)
  await screen.findByText(t.passwordChanged)
  const [url, init] = fetchMock.mock.calls[0]
  expect(new URL(String(url)).pathname).toBe('/api/v1/users/me/password')
  expect(init?.method).toBe('PATCH')
  expect(JSON.parse(String(init?.body))).toEqual({ currentPassword: ' OldPass123 ', newPassword: 'NewPass123 ', confirmPassword: 'NewPass123 ' })
  for (const label of [t.currentPassword, t.newPassword, t.confirmPassword]) expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe('')
})

describe('server errors use fixed copy, never the raw message', () => {
  it.each([
    [400, t.currentIncorrect],
    [429, t.passwordRateLimited],
    [409, t.systemError],
    [500, t.systemError],
  ])('status %i', async (status, message) => {
    fetchMock.mockResolvedValue(apiResponse(null, status))
    render(<ChangePasswordPanel language="vi" />)
    fill({ current: 'OldPass123', next: 'NewPass123', confirm: 'NewPass123' })
    submit()
    expect((await screen.findByRole('alert')).textContent).toBe(message)
    expect(screen.queryByText('Raw backend detail')).toBeNull()
  })

  it('uses English copy when English is selected', async () => {
    const en = profileCopy.en
    fetchMock.mockResolvedValue(apiResponse(null, 400))
    render(<ChangePasswordPanel language="en" />)
    fill({ current: 'OldPass123', next: 'NewPass123', confirm: 'NewPass123' }, en)
    submit(en)
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Current password is incorrect.'))
  })
})
