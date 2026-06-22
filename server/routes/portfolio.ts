import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { getPositions, getBalance, getOrders, getOrder, checkRisk, placeOrder } from '../services/portfolio-db.js'

export const portfolioRouter = new Hono()

const orderBody = z.object({
  ticker: z.string().min(1),
  market: z.enum(['CN', 'US']),
  side: z.enum(['BUY', 'SELL']),
  qty: z.number().int().positive(),
  price: z.number().positive(),
  paper_trade: z.boolean().default(true),
})

portfolioRouter.get('/api/portfolio/positions', (c) => {
  return c.json(getPositions(Number(c.get('userId'))))
})

portfolioRouter.get('/api/portfolio/balance', (c) => {
  return c.json(getBalance(Number(c.get('userId'))))
})

portfolioRouter.get('/api/portfolio/orders', (c) => {
  return c.json(getOrders(Number(c.get('userId'))))
})

portfolioRouter.get('/api/portfolio/orders/:orderId', (c) => {
  const userId = Number(c.get('userId'))
  const orderId = c.req.param('orderId')
  const order = getOrder(userId, orderId)
  if (!order) return c.json({ detail: `Order '${orderId}' not found` }, 404)
  return c.json(order)
})

portfolioRouter.post('/api/portfolio/risk-check', zValidator('json', orderBody), (c) => {
  const req = c.req.valid('json')
  return c.json(checkRisk(Number(c.get('userId')), req))
})

portfolioRouter.post('/api/portfolio/orders', zValidator('json', orderBody), (c) => {
  const userId = Number(c.get('userId'))
  const req = c.req.valid('json')
  const risk = checkRisk(userId, req)
  if (!risk.passed) return c.json({ detail: risk.reason }, 422)
  const order = placeOrder(userId, req)
  return c.json(order, 201)
})
