import { randomUUID } from 'crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { AccountBalance, Order, OrderRequest, Position, RiskCheckResult } from '../types/index.js'

const DATA_DIR = join(process.cwd(), 'data')
const POSITIONS_FILE = join(DATA_DIR, 'positions.json')
const ORDERS_FILE = join(DATA_DIR, 'orders.json')
const BALANCE_FILE = join(DATA_DIR, 'balance.json')

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
}

function loadJSON<T>(file: string, fallback: T): T {
  if (existsSync(file)) {
    try { return JSON.parse(readFileSync(file, 'utf-8')) } catch { /* fall through */ }
  }
  return fallback
}

function saveJSON(file: string, data: unknown) {
  ensureDataDir()
  writeFileSync(file, JSON.stringify(data, null, 2))
}

const DEFAULT_BALANCE: AccountBalance = {
  total_assets: 150000,
  cash: 150000,
  market_value: 0,
  daily_pnl: 0,
  daily_pnl_pct: 0,
}

let _positions: Position[] = loadJSON<Position[]>(POSITIONS_FILE, [])
let _balance: AccountBalance = loadJSON<AccountBalance>(BALANCE_FILE, DEFAULT_BALANCE)
const _ordersArr: Order[] = loadJSON<Order[]>(ORDERS_FILE, [])
const _orders = new Map<string, Order>(_ordersArr.map((o) => [o.order_id, o]))

export function getPositions(): Position[] {
  return _positions
}

export function getBalance(): AccountBalance {
  const market_value = _positions.reduce((s, p) => s + p.market_value, 0)
  _balance.market_value = market_value
  _balance.total_assets = _balance.cash + market_value
  return _balance
}

export function getOrders(): Order[] {
  return Array.from(_orders.values()).sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function getOrder(orderId: string): Order | undefined {
  return _orders.get(orderId)
}

export function checkRisk(req: OrderRequest): RiskCheckResult {
  if (req.qty <= 0) return { passed: false, reason: '委托数量必须大于 0' }
  if (req.price <= 0) return { passed: false, reason: '委托价格必须大于 0' }
  if (req.side === 'BUY') {
    const orderValue = req.qty * req.price
    if (orderValue > _balance.cash * 0.9)
      return { passed: false, reason: '可用资金不足，委托金额超过可用资金的 90%' }
  }
  if (req.side === 'SELL') {
    const pos = _positions.find((p) => p.ticker === req.ticker)
    if (!pos || pos.qty < req.qty)
      return { passed: false, reason: '持仓数量不足' }
  }
  return { passed: true }
}

function applyFill(order: Order) {
  const { ticker, market, side, qty, price } = order
  const idx = _positions.findIndex((p) => p.ticker === ticker)

  if (side === 'BUY') {
    if (idx >= 0) {
      const p = _positions[idx]
      const newQty = p.qty + qty
      const newAvgCost = (p.qty * p.avg_cost + qty * price) / newQty
      _positions[idx] = {
        ...p,
        qty: newQty,
        avg_cost: newAvgCost,
        current_price: price,
        market_value: newQty * price,
        pnl: (price - newAvgCost) * newQty,
        pnl_pct: ((price - newAvgCost) / newAvgCost) * 100,
      }
    } else {
      _positions.push({
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
    _balance.cash -= qty * price
  } else {
    if (idx >= 0) {
      const p = _positions[idx]
      const newQty = p.qty - qty
      if (newQty <= 0) {
        _positions.splice(idx, 1)
      } else {
        _positions[idx] = {
          ...p,
          qty: newQty,
          current_price: price,
          market_value: newQty * price,
          pnl: (price - p.avg_cost) * newQty,
          pnl_pct: ((price - p.avg_cost) / p.avg_cost) * 100,
        }
      }
      _balance.cash += qty * price
    }
  }

  saveJSON(POSITIONS_FILE, _positions)
  saveJSON(BALANCE_FILE, _balance)
}

export function placeOrder(req: OrderRequest): Order {
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
  _orders.set(orderId, order)
  saveJSON(ORDERS_FILE, Array.from(_orders.values()))

  Promise.resolve().then(() => {
    const filled: Order = {
      ...order,
      status: 'FILLED',
      filled_qty: req.qty,
      filled_price: req.price,
      updated_at: new Date().toISOString(),
    }
    _orders.set(orderId, filled)
    saveJSON(ORDERS_FILE, Array.from(_orders.values()))
    applyFill(filled)
  })

  return order
}
