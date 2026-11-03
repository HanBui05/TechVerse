import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { GoogleAuthButton } from '../../components/GoogleAuthButton'
import { AuthAlertText, authInlineLink as linkClass, AuthShell } from '../../components/auth/AuthLayout'
import { ApiError } from '../../services/api/client'
import { completeGoogleSignIn, type GoogleSession } from '../../services/authService'

const callbackErrors: Record<string, string> = {
  AUTH_SOCIAL_EMAIL_ALREADY_REGISTERED: 'Email này đã đăng ký bằng mật khẩu. Hãy đăng nhập bằng mật khẩu; hệ thống không tự liên kết hai tài khoản.',
  AUTH_SOCIAL_ACCOUNT_INACTIVE: 'Tài khoản này đang bị khóa. Vui lòng liên hệ quản trị viên.',
  AUTH_SOCIAL_PROFILE_INVALID: 'Không thể xác minh hồ sơ hoặc email Google. Vui lòng chọn tài khoản Google đã xác minh email.',
}
const defaultError = 'Không thể đăng nhập bằng Google. Bạn có thể đã hủy xác thực hoặc phiên đăng nhập đã hết hạn. Vui lòng thử lại.'

// Only accept the documented callback states; never render arbitrary provider/query error text.
function callbackError(search: string): string | null {
  const params = new URLSearchParams(search)
  if (params.getAll('status').length !== 1) return 'Phản hồi đăng nhập không hợp lệ. Vui lòng bắt đầu lại với Google.'
  if (params.get('status') === 'success' && !params.has('code')) return null
  if (params.get('status') === 'error') {
    const code = params.get('code') || ''
    return Object.hasOwn(callbackErrors, code) ? callbackErrors[code] : defaultError
  }
  return 'Phản hồi đăng nhập không hợp lệ. Vui lòng bắt đầu lại với Google.'
}

// Finish Google signup/login once, including React StrictMode's repeated effect setup.
export function GoogleCallbackPage({ onAuthenticated, onResetSession }: {
  onAuthenticated: (session: GoogleSession) => string
  onResetSession: () => void
}) {
  const { search } = useLocation()
  const navigate = useNavigate()
  const initialError = callbackError(search)
  const [error, setError] = useState(initialError)
  const started = useRef(false)
  const completion = useRef<Promise<GoogleSession> | null>(null)

  useEffect(() => {
    if (!started.current) {
      started.current = true
      onResetSession()
    }
    if (initialError) return
    let active = true
    completion.current ??= completeGoogleSignIn()
    void completion.current.then(session => {
      if (active) navigate(onAuthenticated(session), { replace: true })
    }).catch(cause => {
      if (!active) return
      setError(cause instanceof ApiError && cause.status === 401
        ? 'Phiên Google không tồn tại hoặc đã hết hạn. Vui lòng thử lại và cho phép cookie để đăng nhập.'
        : 'Không thể hoàn tất đăng nhập Google. Hãy kiểm tra kết nối và thử lại.')
    })
    // Ignore late responses after navigation; only a still-mounted callback can commit the session.
    return () => { active = false }
  }, [initialError, onAuthenticated, onResetSession, navigate])

  return <AuthShell tagline="GOOGLE AUTHENTICATION" compactBrand>
    <h1 className="text-center text-2xl font-bold">{error ? 'Chưa thể đăng nhập' : 'Đang kết nối Google'}</h1>
    {error ? <>
      <AuthAlertText>{error}</AuthAlertText>
      <GoogleAuthButton />
      <p className="text-center text-sm"><Link className={linkClass} to="/login">Đăng nhập bằng mật khẩu</Link></p>
      <p className="text-center text-sm"><Link className={linkClass} to="/register">Quay lại đăng ký</Link></p>
    </> : <p className="text-center text-sm leading-relaxed text-muted-foreground" role="status">Đang xác thực phiên và tải hồ sơ của bạn. Vui lòng chờ...</p>}
  </AuthShell>
}
