const TOKEN_TTL_MS = 8 * 60 * 1000

let cachedToken: string | null = null
let cachedAt = 0

export class SessionExpiredError extends Error {
  constructor() {
    super('Power Pages session expired or authentication is required.')
    this.name = 'SessionExpiredError'
  }
}

async function getCsrfToken(forceRefresh = false): Promise<string> {
  const now = Date.now()
  if (!forceRefresh && cachedToken && now - cachedAt < TOKEN_TTL_MS) return cachedToken

  const response = await fetch('/_layout/tokenhtml', { credentials: 'same-origin' })
  if (response.status === 401) throw new SessionExpiredError()
  if (!response.ok) throw new Error(`Unable to obtain CSRF token (${response.status}).`)

  const html = await response.text()
  const match = html.match(/value="([^"]+)"/)
  if (!match?.[1]) throw new Error('CSRF token not found in Power Pages response.')

  cachedToken = match[1]
  cachedAt = now
  return cachedToken
}

export async function powerPagesFetch(url: string, init: RequestInit = {}): Promise<Response> {
  let token = await getCsrfToken()

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const headers = new Headers(init.headers)
    headers.set('__RequestVerificationToken', token)
    if (!headers.has('Accept')) headers.set('Accept', 'application/json')
    if (init.body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

    const response = await fetch(url, { ...init, credentials: 'same-origin', headers })
    if (response.status === 401) throw new SessionExpiredError()

    if (response.status === 403 && attempt === 0) {
      cachedToken = null
      token = await getCsrfToken(true)
      continue
    }

    return response
  }

  throw new Error('Power Pages request failed after CSRF refresh.')
}
