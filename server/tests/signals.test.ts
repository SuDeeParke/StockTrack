import { describe, it, expect } from 'vitest'
import app from '../index.js'

describe('Signals API', () => {
  it('GET /api/signals returns ≥5 records', async () => {
    const res = await app.request('/api/signals')
    expect(res.status).toBe(200)
    const data = await res.json() as any[]
    expect(data.length).toBeGreaterThanOrEqual(5)
    expect(data[0]).toHaveProperty('ticker')
    expect(data[0]).toHaveProperty('market')
    expect(data[0]).toHaveProperty('signal_type')
  })

  it('GET /api/signals?market=CN returns only CN', async () => {
    const res = await app.request('/api/signals?market=CN')
    expect(res.status).toBe(200)
    const data = await res.json() as any[]
    expect(data.length).toBeGreaterThan(0)
    data.forEach((s: any) => expect(s.market).toBe('CN'))
  })

  it('GET /api/signals?market=US returns only US', async () => {
    const res = await app.request('/api/signals?market=US')
    expect(res.status).toBe(200)
    const data = await res.json() as any[]
    expect(data.length).toBeGreaterThan(0)
    data.forEach((s: any) => expect(s.market).toBe('US'))
  })

  it('GET /api/stocks/600519.SH/ohlcv?days=30 returns 30 bars', async () => {
    const res = await app.request('/api/stocks/600519.SH/ohlcv?days=30')
    expect(res.status).toBe(200)
    const data = await res.json() as any[]
    expect(data).toHaveLength(30)
    expect(data[0]).toHaveProperty('open')
    expect(data[0]).toHaveProperty('close')
  })

  it('GET /api/stocks/NOTEXIST.XX/ohlcv returns 404', async () => {
    const res = await app.request('/api/stocks/NOTEXIST.XX/ohlcv')
    expect(res.status).toBe(404)
  })

  it('GET /api/stocks/AAPL.US/indicators returns snapshot with rsi', async () => {
    const res = await app.request('/api/stocks/AAPL.US/indicators')
    expect(res.status).toBe(200)
    const data = await res.json() as any
    expect(data.ticker).toBe('AAPL.US')
    expect(data).toHaveProperty('rsi')
  })

  it('GET /api/stocks/FAKE.XX/indicators returns 404', async () => {
    const res = await app.request('/api/stocks/FAKE.XX/indicators')
    expect(res.status).toBe(404)
  })
})
