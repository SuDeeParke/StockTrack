import { randomUUID } from 'crypto'
import { db, encryptJSON, decryptJSON } from './db.js'
import type { AccountBalance, Order, OrderRequest, Position, RiskCheckResult } from '../types/index.js'

const DEFAULT_BALANCE: AccountBalance = {
  total_assets: 150000,
  cash: 150000,
  market_value: 0,
  daily_pnl: 0,
  daily_pnl_pct: 0,
}

function loadPositions(userId: number): Position[] {
  const row = db.prepare('SELECT data FROM positions WHERE user_id = ?').get(userId) as { data: string } | undefined
  if (!row) return []
  return decryptJSON<Position[]>(row.data)
}

function savePositions(userId: number, positions: Position[]): void {
  db.prepare(`
    INSERT INTO positions (user_id, data) VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET data = excluded.data
  `).run(userId, encryptJSON(positions))
}

function loadBalance(userId: number): AccountBalance {
  const row = db.prepare('SELECT data FROM balance WHERE user_id = ?').get(userId) as { data: string } | undefined
  if (!row) return { ...DEFAULT_BALANCE }
  return decryptJSON<AccountBalance>(row.data)
}

function saveBalance(userId: number, balance: AccountBalance): void {
  db.prepare(`
    INSERT INTO balance (user_id, data) VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET data = excluded.data
  `).run(userId, encryptJSON(balance))
}

export function getPositions(userId: number): Position[] {
  return loadPositions(userId)
}

export function getBalance(userId: number): AccountBalance {
  const positions = loadPositions(userId)
  const balance = loadBalance(userId)
  const market_value = positions.reduce((s, p) => s + p.market_value, 0)
  balance.market_value = market_value
  balance.total_assets = balance.cash + market_value
  return balance
}

export function getOrders(userId: number): Order[] {
  const rows = db.prepare('SELECT data FROM orders WHERE user_id = ? ORDER BY rowid DESC').all(userId) as { data: string }[]
  return rows.map((r) => decryptJSON<Order>(r.data))
}

export function getOrder(userId: number, orderId: string): Order | undefined {
  const row = db.prepare('SELECT data FROM orders WHERE user_id = ? AND order_id = ?').get(userId, orderId) as { data: string } | undefined
  if (!row) return undefined
  return decryptJSON<Order>(row.data)
}

export function checkRisk(userId: number, req: OrderRequest): RiskCheckResult {
  if (req.qty <= 0) return { passed: false, reason: 'qty must be > 0' }
  if (req.price <= 0) return { passed: false, reason: 'price must be > 0' }
  const balance = getBalance(userId)
  if (req.side === 'BUY') {
    if (req.qty * req.price > balance.cash * 0.9)
      return { passed: false, reason: 'Insufficient funds: order exceeds 90% of available cash' }
  }
  if (req.side === 'SELL') {
    const positions = loadPositions(userId)
    const pos = positions.find((p) => p.ticker === req.ticker)
    if (!pos || pos.qty < req.qty) return { passed: false, reason: 'Insufficient position qty' }
  }
  return { passed: true }
}

export function placeOrder(userId: number, req: OrderRequest): Order {
  const orderId = randomUUID()
  const now = new Date().toISOString()
  const order: Order = {
    order_id: orderId,
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

  db.prepare('INSERT INTO orders (user_id, order_id, data) VALUES (?, ?, ?)').run(userId, orderId, encryptJSON(order))

  Promise.resolve().then(() => {
    const filled: Order = {
      ...order,
      status: 'FILLED',
      filled_qty: req.qty,
      filled_price: req.price,
      updated_at: new Date().toISOString(),
    }
    db.prepare('UPDATE orders SET data = ? WHERE user_id = ? AND order_id = ?').run(encryptJSON(filled), userId, orderId)
    applyFill(userId, filled)
  })

  return order
}

function applyFill(userId: number, order: Order): void {
  const { ticker, market, side, qty, price } = order
  const positions = loadPositions(userId)
  const balance = loadBalance(userId)
  const idx = positions.findIndex((p) => p.ticker === ticker)

  if (side === 'BUY') {
    if (idx >= 0) {
      const p = positions[idx]
      const newQty = p.qty + qty
      const newAvgCost = (p.qty * p.avg_cost + qty * price) / newQty
      positions[idx] = {
        ...p,
        qty: newQty,
        avg_cost: newAvgCost,
        current_price: price,
        market_value: newQty * price,
        pnl: (price - newAvgCost) * newQty,
        pnl_pct: ((price - newAvgCost) / newAvgCost) * 100,
      }
    } else {
      positions.push({
        ticker,
        market,
        name: ticker,
        qty,
        avg_cost: price,
        current_price: price,
        market_value: qty * price,
        pnl: 0,
        pnl_pct: 0,
      })
    }
    balance.cash -= qty * price
  } else {
    if (idx >= 0) {
      const p = positions[idx]
      const newQty = p.qty - qty
      if (newQty <= 0) {
        positions.splice(idx, 1)
      } else {
        positions[idx] = {
          ...p,
          qty: newQty,
          current_price: price,
          market_value: newQty * price,
          pnl: (price - p.avg_cost) * newQty,
          pnl_pct: ((price - p.avg_cost) / p.avg_cost) * 100,
        }
      }
      balance.cash += qty * price
    }
  }

  savePositions(userId, positions)
  saveBalance(userId, balance)
}
