import app from '../index.js'

let tokenPromise: Promise<string> | null = null

export async function setupAuth(): Promise<string> {
  if (!tokenPromise) {
    tokenPromise = (async () => {
      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'changeme' }),
      })
      const data = await res.json() as { token: string }
      return data.token
    })()
  }
  return tokenPromise
}

export async function authHeaders(): Promise<Record<string, string>> {
  const token = await setupAuth()
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}
