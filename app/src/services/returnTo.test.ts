import { afterEach, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { GoogleAuthButton } from '../components/GoogleAuthButton'
import { rememberReturnTo, resolveReturnTo, safeReturnTo } from './returnTo'

afterEach(() => { cleanup(); sessionStorage.clear() })

it('accepts only Reader course paths', () => {
  for (const ok of ['/courses', '/courses/c1', '/courses/c1/lessons/l2', '/me/courses']) expect(safeReturnTo(ok)).toBe(ok)
  for (const bad of ['//evil.com', '/admin', '/courses/c1/lessons', 'https://evil.com/courses', '/courses/c1?x=1', 5, null]) expect(safeReturnTo(bad)).toBeNull()
})

it('carries the destination through a Google round trip once, and never over a management home', () => {
  rememberReturnTo('/courses/c1')
  expect(resolveReturnTo('/moderator')).toBe('/moderator')
  rememberReturnTo('/courses/c1')
  expect(resolveReturnTo('/')).toBe('/courses/c1')
  expect(resolveReturnTo('/')).toBe('/')
  rememberReturnTo('/courses/c1'); rememberReturnTo(undefined)
  expect(resolveReturnTo('/')).toBe('/')
})

it('keeps the destination when Google is retried from the callback, and clears it on a fresh plain login click', () => {
  rememberReturnTo('/courses/c1')
  render(createElement(GoogleAuthButton, { keep: true }))
  fireEvent.click(screen.getByRole('link'), { preventDefault: () => {} })
  expect(resolveReturnTo('/')).toBe('/courses/c1')
  rememberReturnTo('/courses/c1')
  cleanup(); render(createElement(GoogleAuthButton, {}))
  fireEvent.click(screen.getByRole('link'))
  expect(resolveReturnTo('/')).toBe('/')
})
