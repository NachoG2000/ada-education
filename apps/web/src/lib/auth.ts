/* The person token for a gated course (DECISIONS.md §20): minted by claim or
   join, kept in localStorage next to `ada:me`, attached to every request.
   Ungated local dev never stores one, and the empty header set keeps every
   call byte-identical to before. */

const TOKEN_KEY = "ada:token"

export function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function storeToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // no storage: the session works until the tab closes
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // no storage, nothing to clear
  }
}

export function authHeaders(): Record<string, string> {
  const token = readStoredToken()
  return token ? { authorization: `Bearer ${token}` } : {}
}
