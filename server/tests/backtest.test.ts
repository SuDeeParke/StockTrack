import { describe, it, expect } from 'vitest'
import app from '../index.js'

describe('Backtest API', () => {
  it('GET /api/backtest/strategies returns ≥3 strategies', async () => {
    const res = await app.request('/api/backtest/strategies')
    expect(res.status).toBe(200)
    const data = await res.json() as any[]
    expect(data.length).toBeGreaterThanOrEqual(3)
    expect(data[0]).toHaveProperty('id')
    expect(data[0]).toHaveProperty('name')
  })

  it('POST /api/backtest/run valid request returns 202', async () => {
    const res = await app.request('/api/backtest/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        strategy_id: 'macd_cross',
        tickers: ['600519.SH', 'AAPL.US'],
        start_date: '2022-01-01',
        end_date: '2024-01-01',
      }),
    })
    expect(res.status).toBe(202)
    const data = await res.json() as any
    expect(['RUNNING', 'DONE', 'PENDING']).toContain(data.status)
    expect(data).toHaveProperty('job_id')
  })

  it('POST /api/backtest/run invalid strategy returns 422', async () => {
    const res = await app.request('/api/backtest/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        strategy_id: 'nonexistent_strategy',
        tickers: ['600519.SH'],
        start_date: '2022-01-01',
        end_date: '2024-01-01',
      }),
    })
    expect(res.status).toBe(422)
  })

  it('POST /api/backtest/run empty tickers returns 400', async () => {
    const res = await app.request('/api/backtest/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        strategy_id: 'macd_cross',
        tickers: [],
        start_date: '2022-01-01',
        end_date: '2024-01-01',
      }),
    })
    expect(res.status).toBe(400)
  })

  it('GET /api/backtest/result/nonexistent returns 404', async () => {
    const res = await app.request('/api/backtest/result/nonexistent-job-id')
    expect(res.status).toBe(404)
  })

  it('run + poll returns DONE with stats and equity_curve', async () => {
    const runRes = await app.request('/api/backtest/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        strategy_id: 'rsi_reversal',
        tickers: ['000858.SZ'],
        start_date: '2022-01-01',
        end_date: '2023-01-01',
      }),
    })
    const run = await runRes.json() as any
    await new Promise((r) => setTimeout(r, 50))
    const pollRes = await app.request(`/api/backtest/result/${run.job_id}`)
    expect(pollRes.status).toBe(200)
    const result = await pollRes.json() as any
    expect(result.status).toBe('DONE')
    expect(result.stats.total_trades).toBeGreaterThan(0)
    expect(result.equity_curve.length).toBeGreaterThan(0)
  })
})
