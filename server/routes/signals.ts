import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { MOCK_SIGNALS, genOHLCV, getIndicatorSnapshot, isKnownTicker } from '../services/signals-mock.js'

export const signalsRouter = new Hono()

const signalsQuery = z.object({
  market: z.enum(['CN', 'US', 'ALL']).default('ALL'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

const ohlcvQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).default(90),
})

signalsRouter.get('/api/signals', zValidator('query', signalsQuery), (c) => {
  const { market, limit } = c.req.valid('query')
  let results = MOCK_SIGNALS
  if (market !== 'ALL') {
    results = results.filter((s) => s.market === market)
  }
  return c.json(results.slice(0, limit))
})

signalsRouter.get('/api/stocks/:ticker/ohlcv', zValidator('query', ohlcvQuery), (c) => {
  const ticker = decodeURIComponent(c.req.param('ticker'))
  const { days } = c.req.valid('query')
  if (!isKnownTicker(ticker)) {
    return c.json({ detail: `Ticker '${ticker}' not found` }, 404)
  }
  return c.json(genOHLCV(ticker, days))
})

signalsRouter.get('/api/stocks/:ticker/indicators', (c) => {
  const ticker = decodeURIComponent(c.req.param('ticker'))
  const snapshot = getIndicatorSnapshot(ticker)
  if (!snapshot) {
    return c.json({ detail: `Ticker '${ticker}' not found` }, 404)
  }
  return c.json(snapshot)
})
