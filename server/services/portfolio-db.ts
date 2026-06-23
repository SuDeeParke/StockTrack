import { db, encryptJSON, decryptJSON } from './db.js'
import { randomUUID } from 'crypto'
import { genOHLCV } from './signals-mock.js'
import type {
  Position,
  AccountBalance,
  OrderRequest,
  Order,
  RiskCheckResult,
} from '../types/index.js'

const round2 = (n: number) => Math.round(n * 100) / 100

function getCurrentPrice(ticker: string): number {
  try {
    const bars = genOHLCV(ticker, 30)
    return bars.length ? bars[bars.length - 1].close : 0
  } catch {
    return 0
  }
}

const DEFAULT_BALANCE: AccountBalance = {
  total_assets: 150000,
  cash: 150000,
  market_value: 0,
  daily_pnl: 0,
  daily_pnl_pct: 0,
}

function loadBalance(userId: number): AccountBalance {
  const row = db.prepare('SELECT data FROM balance WHERE user_id = ?').get(userId) as any
  if (!row) return { ...DEFAULT_BALANCE }
  const decrypted = decryptJSON<AccountBalance>(row.data)
  return decrypted ?? { ...DEFAULT_BALANCE }
}

function saveBalance(userId: number, balance: AccountBalance): void {
  const data = encryptJSON(balance)
  db.prepare(
    'INSERT INTO balance (user_id, data) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data'
  ).run(userId, data)
}

// ── Public API ──────────────────────────────────────────────────────

export function getPositions(userId: number): Position[] {
  const rows = db
    .prepare('SELECT * FROM user_positions WHERE user_id = ? ORDER BY ticker')
    .all(userId) as any[]
  return rows.map((row) => {
    const cp = round2(getCurrentPrice(row.ticker))
    return {
      ticker: row.ticker,
      market: row.market,
      name: row.name,
      qty: row.shares,
      avg_cost: row.cost_basis,
      current_price: cp,
      market_value: round2(row.shares * cp),
      pnl: round2((cp - row.cost_basis) * row.shares),
      pnl_pct:
        row.cost_basis > 0
          ? round2(((cp - row.cost_basis) / row.cost_basis) * 100)
          : 0,
    }
  })
}

export function getBalance(userId: number): AccountBalance {
  const balance = loadBalance(userId)
  const rows = db
    .prepare('SELECT ticker, shares FROM user_positions WHERE user_id = ?')
    .all(userId) as any[]
  let market_value = 0
  for (const row of rows) {
    market_value += row.shares * getCurrentPrice(row.ticker)
  }
  market_value = round2(market_value)
  const total_assets = round2(balance.cash + market_value)
  return {
    total_assets,
    cash: balance.cash,
    market_value,
    daily_pnl: balance.daily_pnl,
    daily_pnl_pct: balance.daily_pnl_pct,
  }
}

export function checkRisk(userId: number, req: OrderRequest): RiskCheckResult {
  if (req.qty <= 0) return { passed: false, reason: 'qty must be > 0' }
  if (req.price <= 0) return { passed: false, reason: 'price must be > 0' }

  if (req.side === 'BUY') {
    const balance = getBalance(userId)
    if (req.qty * req.price > balance.cash * 0.9) {
      return {
        passed: false,
        reason:
          'Insufficient funds: order exceeds 90% of available cash',
      }
    }
  } else {
    const row = db
      .prepare('SELECT shares FROM user_positions WHERE user_id = ? AND ticker = ?')
      .get(userId, req.ticker) as any
    if (!row || row.shares < req.qty) {
      return { passed: false, reason: 'Insufficient position qty' }
    }
  }

  return { passed: true }
}

function applyFill(userId: number, order: any): void {
  const { ticker, market, side, qty, price } = order
  const balance = loadBalance(userId)
  const existing = db
    .prepare('SELECT * FROM user_positions WHERE user_id = ? AND ticker = ?')
    .get(userId, ticker) as any
  const now = new Date().toISOString()

  if (side === 'BUY') {
    if (existing) {
      const newShares = existing.shares + qty
      const newCost =
        (existing.shares * existing.cost_basis + qty * price) / newShares
      db.prepare(
        'UPDATE user_positions SET shares = ?, cost_basis = ?, updated_at = ? WHERE id = ?'
      ).run(newShares, newCost, now, existing.id)
    } else {
      db.prepare(
        `INSERT INTO user_positions (user_id, ticker, name, market, shares, cost_basis, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`
      ).run(userId, ticker, ticker, market, qty, price, now, now)
    }
    balance.cash -= qty * price
  } else {
    // SELL
    if (existing) {
      const newShares = existing.shares - qty
      if (newShares <= 0) {
        db.prepare('DELETE FROM user_positions WHERE id = ?').run(existing.id)
      } else {
        db.prepare(
          'UPDATE user_positions SET shares = ?, updated_at = ? WHERE id = ?'
        ).run(newShares, now, existing.id)
      }
      balance.cash += qty * price
    }
    // if no existing position, SELL is a no-op (risk check should have blocked)
  }

  saveBalance(userId, balance)
}

export function placeOrder(
  userId: number,
  req: OrderRequest
): Order {
  const risk = checkRisk(userId, req)
  if (!risk.passed) throw new Error(risk.reason)

  const id = randomUUID()
  const now = new Date().toISOString()
  const order: Order = {
    order_id: id,
    ticker: req.ticker,
    market: req.market,
    side: req.side,
    qty: req.qty,
    price: req.price,
    status: 'PENDING',
    filled_qty: 0,
    filled_price: 0,
    created_at: now,
    updated_at: now,
    paper_trade: req.paper_trade ?? true,
  }

  const data = encryptJSON(order)
  db.prepare(
    'INSERT INTO orders (user_id, order_id, data) VALUES (?, ?, ?)'
  ).run(userId, id, data)

  // Async fill
  Promise.resolve().then(() => {
    try {
      const filled: Order = {
        ...order,
        status: 'FILLED',
        filled_qty: req.qty,
        filled_price: req.price,
        updated_at: new Date().toISOString(),
      }
      const filledData = encryptJSON(filled)
      db.prepare(
        'UPDATE orders SET data = ? WHERE user_id = ? AND order_id = ?'
      ).run(filledData, userId, id)
      applyFill(userId, filled)
    } catch (err) {
      console.error('async fill failed', err)
    }
  })

  return order
}

export function getOrders(userId: number): Order[] {
  const rows = db
    .prepare('SELECT data FROM orders WHERE user_id = ? ORDER BY rowid DESC')
    .all(userId) as any[]
  return rows.map((r: any) => decryptJSON<Order>(r.data)).filter(Boolean)
}

export function getOrder(userId: number, id: string): Order | null {
  const orders = getOrders(userId)
  return orders.find((o) => o.order_id === id) ?? null
}
