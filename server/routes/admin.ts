import { Hono } from 'hono'
import { getLastRefresh, isRefreshing, refreshSignals } from '../services/data-cache.js'

export const adminRouter = new Hono()

adminRouter.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    version: '0.1.0',
    last_refresh: getLastRefresh(),
  })
})

adminRouter.post('/api/admin/refresh', async (c) => {
  if (isRefreshing()) {
    return c.json({ status: 'already_running' }, 202)
  }
  await refreshSignals()
  return c.json({ status: 'done', last_refresh: getLastRefresh() })
})
