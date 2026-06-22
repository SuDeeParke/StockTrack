import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
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
  // Use process.cwd()-based path — reliable after esbuild bundling
  const publicDir = join(process.cwd(), 'server', 'dist', 'public')
  if (existsSync(publicDir)) {
    console.log(`[server] Serving frontend from ${publicDir}`)
    // Serve static assets (JS/CSS/images)
    app.use('/assets/*', serveStatic({ root: 'server/dist/public' }))
    app.use('/favicon.svg', serveStatic({ root: 'server/dist/public' }))
    app.use('/icons.svg', serveStatic({ root: 'server/dist/public' }))
    // SPA fallback — serve index.html for all remaining routes
    const indexHtml = readFileSync(join(publicDir, 'index.html'), 'utf-8')
    app.get('/*', (c) => c.html(indexHtml))
  }

  startScheduler()
  serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`[server] Hono running on http://localhost:${PORT}`)
  })
}

export default app
