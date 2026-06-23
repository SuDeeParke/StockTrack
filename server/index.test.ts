import { authHeaders } from './tests/helpers.js'
import app from './index.js'

describe('GET /api/health', () => {
  it('returns server health payload', async () => {
    const response = await app.request('/api/health', { headers: await authHeaders() })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      status: 'ok',
      version: '0.1.0',
      last_refresh: null,
    })
  })
})
