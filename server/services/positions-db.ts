import { db } from './db.js'
import { genOHLCV } from './signals-mock.js'
import type { UserPosition, UserPositionWithDerived } from '../types/index.js'

function rowToPosition(row: any): UserPosition {
  return {
    id: row.id,
    ticker: row.ticker,
    name: row.name,
    market: row.market,
    shares: row.shares,
    cost_basis: row.cost_basis,
    note: row.note,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function getPositions(userId: number): UserPosition[] {
  const rows = db.prepare(
    'SELECT * FROM user_positions WHERE user_id = ? ORDER BY ticker'
  ).all(userId)
  return rows.map(rowToPosition)
}

export function getPosition(userId: number, id: number): UserPosition | undefined {
  const row = db.prepare(
    'SELECT * FROM user_positions WHERE user_id = ? AND id = ?'
  ).get(userId, id) as any
  return row ? rowToPosition(row) : undefined
}

export function createPosition(
  userId: number,
  input: { ticker: string; name: string; market: 'CN' | 'US'; shares: number; cost_basis: number; note?: string }
): UserPosition {
  const now = new Date().toISOString()
  const result = db.prepare(
    `INSERT INTO user_positions (user_id, ticker, name, market, shares, cost_basis, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(userId, input.ticker, input.name, input.market, input.shares, input.cost_basis, input.note ?? null, now, now)

  return getPosition(userId, result.lastInsertRowid as number)!
}

export function updatePosition(
  userId: number,
  id: number,
  input: { name?: string; shares?: number; cost_basis?: number; note?: string }
): UserPosition | undefined {
  const existing = getPosition(userId, id)
  if (!existing) return undefined

  const now = new Date().toISOString()
  const sets: string[] = []
  const params: any[] = []

  if (input.name !== undefined) {
    sets.push('name = ?')
    params.push(input.name)
  }
  if (input.shares !== undefined) {
    sets.push('shares = ?')
    params.push(input.shares)
  }
  if (input.cost_basis !== undefined) {
    sets.push('cost_basis = ?')
    params.push(input.cost_basis)
  }
  if (input.note !== undefined) {
    sets.push('note = ?')
    params.push(input.note)
  }

  if (sets.length === 0) return existing

  sets.push('updated_at = ?')
  params.push(now)
  params.push(userId, id)

  db.prepare(
    `UPDATE user_positions SET ${sets.join(', ')} WHERE user_id = ? AND id = ?`
  ).run(...params)

  return getPosition(userId, id)
}

export function deletePosition(userId: number, id: number): boolean {
  const result = db.prepare(
    'DELETE FROM user_positions WHERE user_id = ? AND id = ?'
  ).run(userId, id)
  return result.changes > 0
}

export function bulkDeletePositions(userId: number, ids: number[]): number {
  if (ids.length === 0) return 0
  const placeholders = ids.map(() => '?').join(', ')
  const result = db.prepare(
    `DELETE FROM user_positions WHERE user_id = ? AND id IN (${placeholders})`
  ).run(userId, ...ids)
  return result.changes
}

export function getPositionsWithDerived(userId: number): UserPositionWithDerived[] {
  const positions = getPositions(userId)
  return positions.map((p) => {
    let current_price = p.cost_basis
    try {
      const bars = genOHLCV(p.ticker, 30)
      if (bars.length > 0) {
        current_price = bars[bars.length - 1].close
      }
    } catch {
      // fall back to cost_basis on error
    }

    const market_value = Math.round(p.shares * current_price * 100) / 100
    const pnl = Math.round((current_price - p.cost_basis) * p.shares * 100) / 100
    const pnl_pct = p.cost_basis > 0
      ? Math.round(((current_price - p.cost_basis) / p.cost_basis) * 100 * 100) / 100
      : 0

    return {
      ...p,
      current_price: Math.round(current_price * 100) / 100,
      market_value,
      pnl,
      pnl_pct,
    }
  })
}
