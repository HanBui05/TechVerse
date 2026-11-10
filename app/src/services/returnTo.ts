// Post-login destination for Reader course pages. Only these paths are accepted: state and storage are never trusted as an open redirect.
const RETURN_PATH = /^\/(courses(\/[\w-]+(\/lessons\/[\w-]+)?)?|me\/courses)$/
const KEY = 'techverse-return-to'

export const safeReturnTo = (value: unknown): string | null => (typeof value === 'string' && RETURN_PATH.test(value) ? value : null)
/** Google sign-in leaves the SPA, so the destination waits in sessionStorage; every click overwrites or clears a stale one. */
export const rememberReturnTo = (value: unknown) => { const safe = safeReturnTo(value); if (safe) sessionStorage.setItem(KEY, safe); else sessionStorage.removeItem(KEY) }
/** Reader home (`/`) becomes the remembered course page; management destinations always win. */
export function resolveReturnTo(home: string, stored: unknown = sessionStorage.getItem(KEY)) {
  sessionStorage.removeItem(KEY)
  return home === '/' ? safeReturnTo(stored) ?? home : home
}
