import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { fileURLToPath } from 'node:url'

const app = new Hono()

app.use('*', logger())
app.use('*', cors({ origin: ['http://localhost:5173'] }))

app.get('/api/health', (c) => {
  return c.json({ status: 'ok', version: '0.1.0', last_refresh: null })
})

const PORT = Number(process.env.PORT) || 3000

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`[server] Hono running on http://localhost:${PORT}`)
  })
}

export default app
