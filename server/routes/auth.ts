import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import { compareSync } from 'bcryptjs'
import { db } from '../services/db.js'

export const authRouter = new Hono()

function getJwtSecret(): string {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET env var is required')
  return s
}

authRouter.post('/api/auth/login', async (c) => {
  const { username, password } = await c.req.json<{ username: string; password: string }>()
  if (!username || !password) return c.json({ error: 'username and password required' }, 400)

  const user = db.prepare('SELECT id, password_hash FROM users WHERE username = ?').get(username) as
    | { id: number; password_hash: string }
    | undefined

  if (!user || !compareSync(password, user.password_hash)) {
    return c.json({ error: '用户名或密码错误' }, 401)
  }

  const token = await sign(
    { sub: String(user.id), username, exp: Math.floor(Date.now() / 1000) + 86400 },
    getJwtSecret(),
  )
  return c.json({ token, username })
})

authRouter.get('/api/auth/me', (c) => {
  const userId = c.get('userId') as string | undefined
  const username = c.get('username') as string | undefined
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)
  return c.json({ id: Number(userId), username })
})
