import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ArticleSaveButton } from './ArticleSaveButton'
import { setAccessToken } from '../../services/api/client'

// Each request waits until the test settles it, so clicks can pile up while one is in flight.
type Pending = { method: string; settle: (ok: boolean) => void }
let pending: Pending[] = []
beforeEach(() => {
  pending = []
  setAccessToken('reader')
  vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>(resolve => {
    const method = init?.method ?? 'GET'
    pending.push({ method, settle: ok => resolve(ok
      ? new Response(JSON.stringify({ status: 200, message: 'OK', data: { saved: method === 'PUT' } }), { status: 200 })
      : new Response(JSON.stringify({ status: 503, message: 'Down' }), { status: 503 })) })
  })))
})
afterEach(() => { cleanup(); setAccessToken(null); vi.unstubAllGlobals() })

const button = () => screen.getByRole('button', { name: 'Lưu bài viết' })
const pressed = () => button().getAttribute('aria-pressed')
const settle = async (ok = true) => { await act(async () => { pending.shift()!.settle(ok) }) }
const methods = () => vi.mocked(fetch).mock.calls.map(([, init]) => init?.method)

it('keeps one request in flight and sends the last intent after it: PUT then DELETE', async () => {
  render(<ArticleSaveButton articleId="a1" saved={false} />)
  fireEvent.click(button())
  fireEvent.click(button())
  expect(pressed()).toBe('false')
  expect(methods()).toEqual(['PUT'])
  await settle()
  expect(methods()).toEqual(['PUT', 'DELETE'])
  await settle()
  expect(pressed()).toBe('false')
  expect(pending).toHaveLength(0)
})

it('skips a request when the intent returns to the confirmed state: DELETE, PUT, DELETE sends DELETE once', async () => {
  render(<ArticleSaveButton articleId="a1" saved />)
  fireEvent.click(button())
  fireEvent.click(button())
  fireEvent.click(button())
  expect(pressed()).toBe('false')
  await settle()
  expect(methods()).toEqual(['DELETE'])
  expect(pressed()).toBe('false')
  fireEvent.click(button())
  expect(methods()).toEqual(['DELETE', 'PUT'])
  await settle()
  expect(pressed()).toBe('true')
})

it('rolls back to the confirmed state and shows the error in place when the first request fails', async () => {
  render(<ArticleSaveButton articleId="a1" saved={false} />)
  fireEvent.click(button())
  expect(pressed()).toBe('true')
  await settle(false)
  expect(pressed()).toBe('false')
  expect(screen.getByRole('alert').textContent).toContain('Hệ thống tạm thời gián đoạn')
  fireEvent.click(button())
  expect(screen.queryByRole('alert')).toBeNull()
})

it('stops the chain on a failed follow-up and rolls back to the latest success', async () => {
  const onSavedChange = vi.fn()
  render(<ArticleSaveButton articleId="a1" saved={false} onSavedChange={onSavedChange} />)
  fireEvent.click(button())
  fireEvent.click(button())
  await settle() // PUT ok → confirmed saved
  expect(methods()).toEqual(['PUT', 'DELETE'])
  fireEvent.click(button()) // intent saved again while DELETE is in flight
  await settle(false) // DELETE fails → stop, back to the PUT success
  expect(pressed()).toBe('true')
  expect(methods()).toEqual(['PUT', 'DELETE'])
  expect(screen.getByRole('alert')).not.toBeNull()
  expect(onSavedChange).toHaveBeenLastCalledWith(true)
})
