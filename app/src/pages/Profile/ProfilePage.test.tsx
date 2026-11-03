import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { latestBirthDate, ProfilePage } from './ProfilePage'
import { profileCopy } from '../../data/profile'
import type { UserProfile } from '../../services/profileService'

const t = profileCopy.vi
const fetchMock = vi.fn<typeof fetch>()
const local: UserProfile = { id: 'u1', fullName: 'Nguyễn An', email: 'an@example.com', phoneNumber: '0912345678', dateOfBirth: '2000-05-24', avatarUrl: null, roles: ['LEARNER'], createdAt: '', updatedAt: '', hasLocalPassword: true }
const google: UserProfile = { ...local, id: 'g1', hasLocalPassword: false }

function apiResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify({ status, message: 'Raw backend detail', data }), { status, headers: { 'Content-Type': 'application/json' } })
}

function renderPage(profile = local, onLogoutAll: () => Promise<void> = vi.fn(async () => {})) {
  const onProfileChange = vi.fn()
  const onLogout = vi.fn()
  const element = (next: UserProfile) => <ProfilePage language="vi" profile={next} onProfileChange={onProfileChange} onLogout={onLogout} onLogoutAll={onLogoutAll} />
  const utils = render(element(profile))
  return { ...utils, onProfileChange, onLogout, onLogoutAll, rerenderWith: (next: UserProfile) => utils.rerender(element(next)) }
}

// Personal information opens read-only; editing starts from the header button.
const renderEditing = (profile = local) => { const utils = renderPage(profile); fireEvent.click(screen.getByRole('button', { name: t.edit })); return utils }
const input = (label: string) => screen.getByLabelText(label) as HTMLInputElement
const change = (label: string, value: string) => fireEvent.change(input(label), { target: { value } })
const saveButton = () => screen.getByRole('button', { name: t.save })
const patchBody = () => JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const yearsAgo = (years: number, extraDays = 0) => { const date = new Date(); date.setFullYear(date.getFullYear() - years); date.setDate(date.getDate() + extraDays); return isoDate(date) }
// The birth date field shows dd/mm/yyyy; the API still uses yyyy-mm-dd.
const shown = (iso: string) => iso.split('-').reverse().join('/')

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('panels', () => {
  it('shows only real sections and lets a local account open the password panel', async () => {
    const user = userEvent.setup()
    renderPage()
    const nav = screen.getByRole('navigation', { name: t.navLabel })
    expect(Array.from(nav.querySelectorAll('button')).map(button => button.textContent)).toEqual([t.personal, t.password])
    for (const removed of ['Bài viết của tôi', 'Bảo mật', 'Lịch sử đăng nhập', 'TRƯỜNG ĐẠI HỌC', 'GITHUB URL']) expect(screen.queryByText(removed)).toBeNull()
    await user.click(screen.getByRole('button', { name: t.password }))
    expect(screen.getByLabelText(t.currentPassword)).toBeTruthy()
    expect(screen.queryByLabelText(t.name)).toBeNull()
  })

  it('hides password change and the section selector for Google-only accounts', () => {
    renderPage(google)
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(screen.queryByText(t.password)).toBeNull()
    expect(screen.getByLabelText(t.name)).toBeTruthy()
  })
})

describe('personal information', () => {
  it('opens read-only with an edit button and shows empty values as not set', () => {
    renderPage({ ...local, phoneNumber: null })
    // Same aligned field grid as edit mode, but read-only, so switching modes does not shift the layout.
    for (const label of [t.name, t.email, t.phone, t.dob]) expect(input(label).readOnly).toBe(true)
    expect(screen.queryByRole('button', { name: t.save })).toBeNull()
    expect(screen.queryByRole('button', { name: t.pickDate })).toBeNull()
    expect(input(t.name).value).toBe('Nguyễn An')
    expect(input(t.dob).value).toBe('24/05/2000')
    expect(input(t.phone).placeholder).toBe(t.notSet)
    expect(screen.getByText(t.basicInfo)).toBeTruthy()
    expect(screen.getByRole('button', { name: t.edit })).toBeTruthy()
  })

  it('cancel discards edits and returns to read-only without calling the API', () => {
    renderEditing()
    expect(screen.queryByRole('button', { name: t.edit })).toBeNull()
    change(t.name, 'Tên tạm')
    fireEvent.click(screen.getByRole('button', { name: t.cancel }))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(input(t.name).readOnly).toBe(true)
    expect(input(t.name).value).toBe('Nguyễn An')
    expect(screen.getByRole('button', { name: t.edit })).toBeTruthy()
  })

  it('fills the birth date from the calendar popover, opened on the typed month', async () => {
    const user = userEvent.setup()
    renderEditing()
    await user.click(screen.getByRole('button', { name: t.pickDate }))
    const grid = await screen.findByRole('grid')
    await user.click(within(grid).getByText('20').closest('button')!)
    expect(input(t.dob).value).toBe('20/05/2000')
    await waitFor(() => expect(screen.queryByRole('grid')).toBeNull())
  })

  it('names calendar months in the app language, not the browser locale', async () => {
    const user = userEvent.setup()
    renderEditing()
    await user.click(screen.getByRole('button', { name: t.pickDate }))
    await screen.findByRole('grid')
    const months = [...document.querySelectorAll('[data-slot="popover-content"] select option')].map(option => option.textContent)
    expect(months).toContain(new Date(2000, 4).toLocaleString('vi', { month: 'short' }))
    expect(months).not.toContain(new Date(2000, 4).toLocaleString('en-US', { month: 'short' }))
  })

  it('disables calendar days after the 6-year cutoff', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 3, 12))
    try {
      const user = userEvent.setup()
      renderEditing({ ...local, dateOfBirth: null })
      await user.click(screen.getByRole('button', { name: t.pickDate }))
      const grid = await screen.findByRole('grid')
      // Cutoff is 03/11/2020: that day is selectable, the next is not ([0] skips December outside days).
      expect(within(grid).getAllByText('3')[0].closest('button')!.disabled).toBe(false)
      expect(within(grid).getAllByText('4')[0].closest('button')!.disabled).toBe(true)
    } finally { vi.useRealTimers() }
  })

  it('shows only real fields with a read-only email', () => {
    renderEditing()
    expect(input(t.name).value).toBe('Nguyễn An')
    expect(input(t.email).readOnly).toBe(true)
    expect(input(t.phone).value).toBe('0912345678')
    expect(input(t.dob).value).toBe('24/05/2000')
    expect(input(t.dob).placeholder).toBe('dd/mm/yyyy')
  })

  it('clamps the 6-year cutoff on 29 February like the backend Period check', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2028, 1, 29, 12))
    try { expect(latestBirthDate()).toBe('2022-02-28') } finally { vi.useRealTimers() }
  })

  it.each([['03032005', '03/03/2005'], ['20022005', '20/02/2005'], ['2002200599', '20/02/2005']])('formats typed digits %s as %s', async (typed, expected) => {
    const user = userEvent.setup()
    renderEditing({ ...local, dateOfBirth: null })
    await user.type(input(t.dob), typed)
    expect(input(t.dob).value).toBe(expected)
  })

  it('sends the typed day-month-year as an ISO date', async () => {
    fetchMock.mockResolvedValue(apiResponse(local))
    const user = userEvent.setup()
    renderEditing({ ...local, dateOfBirth: null })
    await user.type(input(t.dob), '20022005')
    fireEvent.click(saveButton())
    await screen.findByText(t.saved)
    expect(patchBody()).toEqual({ dateOfBirth: '2005-02-20' })
  })

  it('keeps save disabled while pristine, including trailing spaces on the name', () => {
    renderEditing()
    expect(saveButton().hasAttribute('disabled')).toBe(true)
    change(t.name, 'Nguyễn An  ')
    expect(saveButton().hasAttribute('disabled')).toBe(true)
  })

  it('patches only dirty fields, locks inputs while saving and resets to the saved baseline', async () => {
    let resolve: (response: Response) => void = () => {}
    fetchMock.mockReturnValue(new Promise(done => { resolve = done }))
    const { onProfileChange, rerenderWith } = renderEditing()
    change(t.phone, '0987654321')
    fireEvent.click(saveButton())
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(patchBody()).toEqual({ phoneNumber: '0987654321' })
    for (const label of [t.name, t.phone, t.dob]) expect(input(label).disabled).toBe(true)
    expect(screen.getByRole('button', { name: t.saving }).hasAttribute('disabled')).toBe(true)
    const saved = { ...local, phoneNumber: '0987654321' }
    resolve(apiResponse(saved))
    await screen.findByText(t.saved)
    expect(onProfileChange).toHaveBeenCalledWith(saved)
    rerenderWith(saved)
    expect(input(t.phone).readOnly).toBe(true)
    expect(input(t.phone).value).toBe('0987654321')
    expect(screen.getByRole('button', { name: t.edit })).toBeTruthy()
  })

  it('sends null when phone and date of birth are cleared', async () => {
    fetchMock.mockResolvedValue(apiResponse({ ...local, phoneNumber: null, dateOfBirth: null }))
    renderEditing()
    change(t.phone, '')
    change(t.dob, '')
    fireEvent.click(saveButton())
    await screen.findByText(t.saved)
    expect(patchBody()).toEqual({ phoneNumber: null, dateOfBirth: null })
  })

  it.each([
    ['empty name', t.name, '   ', t.nameRequired],
    ['151-character name', t.name, 'a'.repeat(151), t.nameTooLong],
    ['9-digit phone', t.phone, '091234567', t.phoneInvalid],
    ['phone with letters', t.phone, '09123abc678', t.phoneInvalid],
    ['21-character phone', t.phone, '0'.repeat(21), t.phoneInvalid],
    ['birth date today', t.dob, shown(isoDate(new Date())), t.dobInvalid],
    ['5-year-old birth date', t.dob, shown(yearsAgo(5)), t.dobInvalid],
    ['impossible day 31/02', t.dob, '31/02/2005', t.dobFormat],
    ['month 20', t.dob, '20/20/2005', t.dobFormat],
    ['incomplete date', t.dob, '03/03/20', t.dobFormat],
  ])('rejects a %s next to the field without calling the API', (_name, label, value, message) => {
    renderEditing()
    change(label, value)
    fireEvent.click(saveButton())
    expect(fetchMock).not.toHaveBeenCalled()
    expect(input(label).getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById(input(label).getAttribute('aria-describedby') || '')?.textContent).toBe(message)
  })

  it('accepts a spaced phone number and a birth date exactly 6 years ago', async () => {
    fetchMock.mockResolvedValue(apiResponse(local))
    renderEditing()
    change(t.phone, '+84 912 345 678')
    change(t.dob, shown(yearsAgo(6)))
    fireEvent.click(saveButton())
    await screen.findByText(t.saved)
    expect(patchBody()).toEqual({ phoneNumber: '+84 912 345 678', dateOfBirth: yearsAgo(6) })
  })

  it('keeps fields being edited when the shared profile changes after an avatar upload', () => {
    const { rerenderWith } = renderEditing()
    change(t.name, 'Tên đang sửa')
    rerenderWith({ ...local, fullName: 'Server Name', phoneNumber: '0900000000', avatarUrl: 'https://example.com/new.png' })
    expect(input(t.name).value).toBe('Tên đang sửa')
    expect(input(t.phone).value).toBe('0900000000')
  })

  it.each([[400, t.checkInfo], [500, t.systemError]])('maps status %i to fixed copy', async (status, message) => {
    fetchMock.mockResolvedValue(apiResponse(null, status))
    renderEditing()
    change(t.name, 'Tên mới')
    fireEvent.click(saveButton())
    expect((await screen.findByRole('alert')).textContent).toBe(message)
    expect(screen.queryByText('Raw backend detail')).toBeNull()
  })
})

describe('avatar', () => {
  const png = (size = 1024) => new File([new Uint8Array(size)], 'me.png', { type: 'image/png' })

  it.each([
    ['a GIF', new File(['x'], 'me.gif', { type: 'image/gif' })],
    ['a file over 5 MiB', png(5 * 1024 * 1024 + 1)],
  ])('rejects %s without calling the API', async (_name, file) => {
    const user = userEvent.setup({ applyAccept: false })
    renderPage()
    await user.upload(screen.getByLabelText(t.changeAvatar), file)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toBe(t.avatarInvalid)
  })

  it('uploads from the avatar label, blocks repeats while pending and shares the new profile', async () => {
    let resolve: (response: Response) => void = () => {}
    fetchMock.mockReturnValue(new Promise(done => { resolve = done }))
    const user = userEvent.setup()
    const { onProfileChange } = renderPage()
    const fileInput = screen.getByLabelText(t.changeAvatar) as HTMLInputElement
    expect(fileInput.closest('label')?.querySelector('[data-slot="user-avatar"]')).not.toBeNull()
    await user.upload(fileInput, png())
    expect(fileInput.disabled).toBe(true)
    expect(screen.getByRole('status').textContent).toBe(t.avatarUploading)
    const [url, init] = fetchMock.mock.calls[0]
    expect(new URL(String(url)).pathname).toBe('/api/v1/users/me/avatar')
    expect(init?.body).toBeInstanceOf(FormData)
    const updated = { ...local, avatarUrl: 'https://example.com/new.png' }
    resolve(apiResponse(updated))
    await screen.findByText(t.avatarUpdated)
    expect(onProfileChange).toHaveBeenCalledWith(updated)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each([[413, t.avatarInvalid], [415, t.avatarInvalid], [429, t.avatarRateLimited], [503, t.systemError]])('maps status %i to fixed copy', async (status, message) => {
    fetchMock.mockResolvedValue(apiResponse(null, status))
    const user = userEvent.setup()
    renderPage()
    await user.upload(screen.getByLabelText(t.changeAvatar), png())
    expect((await screen.findByRole('alert')).textContent).toBe(message)
  })
})

describe('logout from all devices', () => {
  const opener = () => screen.getByRole('button', { name: t.logoutAll })
  const dialog = () => screen.queryByRole('alertdialog')

  it('places log out above log out everywhere and never uses browser dialogs', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    const user = userEvent.setup()
    renderPage()
    const logout = screen.getByRole('button', { name: t.logout })
    expect(logout.compareDocumentPosition(opener()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await user.click(opener())
    const open = await screen.findByRole('alertdialog', { name: t.logoutAllTitle })
    expect(open.textContent).toContain(t.logoutAllBody)
    expect(document.activeElement?.textContent).toBe(t.cancel)
    expect(confirmSpy).not.toHaveBeenCalled()
  })

  it('closes with Cancel or Escape and returns focus to the opener', async () => {
    const user = userEvent.setup()
    const { onLogoutAll } = renderPage()
    await user.click(opener())
    await user.click(await screen.findByRole('button', { name: t.cancel }))
    await waitFor(() => expect(dialog()).toBeNull())
    expect(document.activeElement).toBe(opener())
    await user.click(opener())
    await screen.findByRole('alertdialog')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(dialog()).toBeNull())
    expect(document.activeElement).toBe(opener())
    expect(onLogoutAll).not.toHaveBeenCalled()
  })

  it('blocks repeats and Escape while pending, then keeps the dialog open with a fixed error', async () => {
    let reject: (error: Error) => void = () => {}
    const onLogoutAll = vi.fn(() => new Promise<void>((_done, fail) => { reject = fail }))
    const user = userEvent.setup()
    renderPage(local, onLogoutAll)
    await user.click(opener())
    const confirm = await screen.findByRole('button', { name: t.confirmLogoutAll })
    await user.click(confirm)
    fireEvent.click(screen.getByRole('button', { name: t.loggingOut }))
    expect(onLogoutAll).toHaveBeenCalledTimes(1)
    await user.keyboard('{Escape}')
    expect(dialog()).not.toBeNull()
    reject(new Error('Raw backend detail'))
    expect((await screen.findByRole('alert')).textContent).toBe(t.logoutAllError)
    expect(dialog()).not.toBeNull()
  })
})
