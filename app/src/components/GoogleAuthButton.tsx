import { GOOGLE_AUTH_URL } from '../services/authService'

// OAuth must navigate the current browser to the backend, not call Google through fetch.
export function GoogleAuthButton() {
  return <a className="google-auth-button" href={GOOGLE_AUTH_URL}>
    <span className="google-mark" aria-hidden="true">G</span>Google
  </a>
}
