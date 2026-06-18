import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { randomUUID } from 'crypto'
import { getStrategies, isValidStrategy, getJob, runBacktestAsync } from '../services/backtest-engine.js'

export const backtestRouter = new Hono()

const runBody = z.object({
  strategy_id: z.string(),
  tickers: z.array(z.string()).min(1),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  initial_capital: z.number().positive().default(100_000),
})

backtestRouter.get('/api/backtest/strategies', (c) => {
  return c.json(getStrategies())
})

backtestRouter.post('/api/backtest/run', zValidator('json', runBody), async (c) => {
  const req = c.req.valid('json')
  if (!isValidStrategy(req.strategy_id)) {
    return c.json({ detail: `Strategy '${req.strategy_id}' not found` }, 422)
  }
  const jobId = randomUUID()
  await runBacktestAsync(req, jobId)
  const job = getJob(jobId)!
  return c.json(job, 202)
})

backtestRouter.get('/api/backtest/result/:jobId', (c) => {
  const jobId = c.req.param('jobId')
  const job = getJob(jobId)
  if (!job) {
    return c.json({ detail: `Job '${jobId}' not found` }, 404)
  }
  return c.json(job)
})
