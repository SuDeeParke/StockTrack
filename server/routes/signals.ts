import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { MOCK_SIGNALS, genOHLCV, getIndicatorSnapshot, isKnownTicker } from '../services/signals-mock.js'
import { fetchSignals, fetchOHLCV, fetchIndicators, isAvailable } from '../services/baostock-client.js'

export const signalsRouter = new Hono()

const signalsQuery = z.object({
  market: z.enum(['CN', 'US', 'ALL']).default('ALL'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

const ohlcvQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).default(90),
})

signalsRouter.get('/api/signals', zValidator('query', signalsQuery), async (c) => {
  const { market, limit } = c.req.valid('query')
  if (await isAvailable()) {
    try {
      const data = await fetchSignals(market, limit)
      return c.json(data)
    } catch { /* fall through to mock */ }
  }
  let results = MOCK_SIGNALS
  if (market !== 'ALL') results = results.filter((s) => s.market === market)
  return c.json(results.slice(0, limit))
})

signalsRouter.get('/api/stocks/:ticker/ohlcv', zValidator('query', ohlcvQuery), async (c) => {
  const ticker = decodeURIComponent(c.req.param('ticker'))
  const { days } = c.req.valid('query')
  if (await isAvailable()) {
    try {
      const data = await fetchOHLCV(ticker, days)
      return c.json(data)
    } catch (e: any) {
      if (e?.message?.includes('404')) return c.json({ detail: `Ticker '${ticker}' not found` }, 404)
      /* fall through to mock */
    }
  }
  if (!isKnownTicker(ticker)) return c.json({ detail: `Ticker '${ticker}' not found` }, 404)
  return c.json(genOHLCV(ticker, days))
})

signalsRouter.get('/api/stocks/:ticker/indicators', async (c) => {
  const ticker = decodeURIComponent(c.req.param('ticker'))
  if (await isAvailable()) {
    try {
      const data = await fetchIndicators(ticker)
      return c.json(data)
    } catch (e: any) {
      if (e?.message?.includes('404')) return c.json({ detail: `Ticker '${ticker}' not found` }, 404)
      /* fall through to mock */
    }
  }
  const snapshot = getIndicatorSnapshot(ticker)
  return c.json(snapshot)
})
