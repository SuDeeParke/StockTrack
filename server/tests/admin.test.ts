import { describe, it, expect } from 'vitest'
import app from '../index.js'

describe('Admin + Health API', () => {
  it('GET /api/health returns status ok', async () => {
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    const data = await res.json() as any
    expect(data.status).toBe('ok')
    expect(data).toHaveProperty('version')
  })

  it('POST /api/admin/refresh triggers data refresh', async () => {
    const res = await app.request('/api/admin/refresh', { method: 'POST' })
    expect([200, 202]).toContain(res.status)
    const data = await res.json() as any
    expect(['done', 'already_running']).toContain(data.status)
  })

  it('POST /api/admin/refresh returns last_refresh after done', async () => {
    const res = await app.request('/api/admin/refresh', { method: 'POST' })
    expect(res.status).toBe(200)
    const data = await res.json() as any
    expect(data.status).toBe('done')
    expect(data.last_refresh).toBeTruthy()
  })

  it('GET /api/health reflects last_refresh after refresh', async () => {
    await app.request('/api/admin/refresh', { method: 'POST' })
    const res = await app.request('/api/health')
    const data = await res.json() as any
    expect(data.last_refresh).toBeTruthy()
  })
})
