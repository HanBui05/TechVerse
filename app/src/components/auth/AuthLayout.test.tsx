import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { authInlineLink, authLinkClass, PasswordInput } from './AuthLayout'

afterEach(cleanup)

// QĐ 1A: text links in the auth card ("Quên mật khẩu", "Đăng ký ngay") need 44px on touch screens.
it.each([['authLinkClass', authLinkClass], ['authInlineLink', authInlineLink]])('%s has a 44px touch target', (_name, className) => {
  expect(className).toContain('inline-flex')
  expect(className).toContain('pointer-coarse:min-h-11')
})

it('keeps the caller className on PasswordInput', () => {
  render(<PasswordInput aria-label="pw" showLabel="show" hideLabel="hide" className="caller-class" />)
  expect(screen.getByLabelText('pw').className).toContain('caller-class')
})
