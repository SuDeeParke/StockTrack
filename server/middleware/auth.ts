import { verify } from 'hono/jwt'
import type { MiddlewareHandler } from 'hono'

// Extend Hono's ContextVariableMap so c.set/c.get are typed for our custom variables
declare module 'hono' {
  interface ContextVariableMap {
    userId: string
    username: string
  }
}

function getJwtSecret(): string {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET env var is required')
  return s
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const token = authHeader.slice(7)
  try {
    const payload = await verify(token, getJwtSecret(), 'HS256') as { sub: string; username: string }
    c.set('userId', payload.sub)
    c.set('username', payload.username)
    await next()
  } catch {
    return c.json({ error: 'Unauthorized' }, 401)
  }
}
