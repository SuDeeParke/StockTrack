import { describe, it, expect } from 'vitest'
import app from '../index.js'

describe('Portfolio API', () => {
  it('GET /api/portfolio/positions returns ≥1 positions', async () => {
    const res = await app.request('/api/portfolio/positions')
    expect(res.status).toBe(200)
    const data = await res.json() as any[]
    expect(data.length).toBeGreaterThanOrEqual(1)
    expect(data[0]).toHaveProperty('ticker')
    expect(data[0]).toHaveProperty('market_value')
    expect(data[0]).toHaveProperty('pnl')
  })

  it('GET /api/portfolio/balance returns account balance', async () => {
    const res = await app.request('/api/portfolio/balance')
    expect(res.status).toBe(200)
    const data = await res.json() as any
    expect(data).toHaveProperty('total_assets')
    expect(data).toHaveProperty('cash')
    expect(data).toHaveProperty('market_value')
  })

  it('GET /api/portfolio/orders returns array', async () => {
    const res = await app.request('/api/portfolio/orders')
    expect(res.status).toBe(200)
    const data = await res.json() as any[]
    expect(Array.isArray(data)).toBe(true)
  })

  it('POST /api/portfolio/orders places a paper order', async () => {
    const res = await app.request('/api/portfolio/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticker: '600519.SH',
        market: 'CN',
        side: 'BUY',
        qty: 10,
        price: 100,
        paper_trade: true,
      }),
    })
    expect(res.status).toBe(201)
    const order = await res.json() as any
    expect(order).toHaveProperty('order_id')
    expect(order.status).toBe('PENDING')
    expect(order.paper_trade).toBe(true)
  })

  it('GET /api/portfolio/orders/:orderId returns the order', async () => {
    const postRes = await app.request('/api/portfolio/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker: 'AAPL.US', market: 'US', side: 'BUY', qty: 5, price: 100 }),
    })
    const order = await postRes.json() as any
    const getRes = await app.request(`/api/portfolio/orders/${order.order_id}`)
    expect(getRes.status).toBe(200)
    const fetched = await getRes.json() as any
    expect(fetched.order_id).toBe(order.order_id)
  })

  it('GET /api/portfolio/orders/nonexistent returns 404', async () => {
    const res = await app.request('/api/portfolio/orders/nonexistent-order-id')
    expect(res.status).toBe(404)
  })

  it('POST /api/portfolio/orders fails risk check when qty is too large', async () => {
    const res = await app.request('/api/portfolio/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticker: '600519.SH',
        market: 'CN',
        side: 'BUY',
        qty: 1000000,
        price: 1800,
        paper_trade: true,
      }),
    })
    expect(res.status).toBe(422)
  })

  it('POST /api/portfolio/orders invalid body returns 400', async () => {
    const res = await app.request('/api/portfolio/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker: 'AAPL.US' }),
    })
    expect(res.status).toBe(400)
  })
})
