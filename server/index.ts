import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { signalsRouter } from './routes/signals.js'
import { backtestRouter } from './routes/backtest.js'
import { portfolioRouter } from './routes/portfolio.js'
import { adminRouter } from './routes/admin.js'
import { startScheduler } from './services/scheduler.js'

const app = new Hono()

app.use('*', logger())
app.use('*', cors({ origin: ['http://localhost:5173'] }))

app.route('/', adminRouter)
app.route('/', signalsRouter)
app.route('/', backtestRouter)
app.route('/', portfolioRouter)

const PORT = Number(process.env.PORT) || 3000

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  // Serve static frontend if server/dist/public exists (production mode)
  const staticDir = new URL('../public', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
  if (existsSync(staticDir)) {
    app.use('/*', serveStatic({ root: './server/dist/public' }))
    app.get('/*', serveStatic({ path: './server/dist/public/index.html' }))
    console.log(`[server] Serving frontend from ${staticDir}`)
  }

  startScheduler()
  serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`[server] Hono running on http://localhost:${PORT}`)
  })
}

export default app
