import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import {
  getPositions, getPosition, createPosition, updatePosition,
  deletePosition, bulkDeletePositions, getPositionsWithDerived,
} from '../services/positions-db.js'

export const positionsRouter = new Hono()

const createBody = z.object({
  ticker: z.string().min(1).max(32),
  name: z.string().min(1).max(64),
  market: z.enum(['CN', 'US']),
  shares: z.number().int().positive(),
  cost_basis: z.number().positive(),
  note: z.string().max(200).optional(),
})

const updateBody = z.object({
  name: z.string().min(1).max(64).optional(),
  shares: z.number().int().positive().optional(),
  cost_basis: z.number().positive().optional(),
  note: z.string().max(200).optional(),
})

const bulkDeleteBody = z.object({
  ids: z.array(z.number().int().positive()),
})

positionsRouter.get('/api/positions', (c) => {
  const userId = Number(c.get('userId'))
  return c.json(getPositionsWithDerived(userId))
})

positionsRouter.post('/api/positions', zValidator('json', createBody), (c) => {
  const userId = Number(c.get('userId'))
  const body = c.req.valid('json')

  if (body.market === 'CN') {
    if (body.shares < 100 || body.shares % 100 !== 0) {
      return c.json({ detail: 'A 股数量需为 100 的整数倍且不少于 100' }, 400)
    }
  }

  const created = createPosition(userId, body)
  return c.json(created, 201)
})

positionsRouter.patch('/api/positions/:id', zValidator('json', updateBody), (c) => {
  const userId = Number(c.get('userId'))
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ detail: 'Invalid id' }, 400)

  const body = c.req.valid('json')

  if (body.shares !== undefined) {
    const existing = getPosition(userId, id)
    if (!existing) return c.json({ detail: 'Position not found' }, 404)

    if (existing.market === 'CN') {
      if (body.shares < 100 || body.shares % 100 !== 0) {
        return c.json({ detail: 'A 股数量需为 100 的整数倍且不少于 100' }, 400)
      }
    }
  }

  const updated = updatePosition(userId, id, body)
  if (!updated) return c.json({ detail: 'Position not found' }, 404)
  return c.json(updated)
})

positionsRouter.delete('/api/positions/:id', (c) => {
  const userId = Number(c.get('userId'))
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ detail: 'Invalid id' }, 400)

  const ok = deletePosition(userId, id)
  if (!ok) return c.json({ detail: 'Position not found' }, 404)
  return c.json({ ok: true })
})

positionsRouter.post('/api/positions/bulk-delete', zValidator('json', bulkDeleteBody), (c) => {
  const userId = Number(c.get('userId'))
  const body = c.req.valid('json')
  const deleted = bulkDeletePositions(userId, body.ids)
  return c.json({ deleted })
})

positionsRouter.get('/api/positions/signals', (c) => {
  return c.json({ detail: 'not implemented' }, 501)
})
