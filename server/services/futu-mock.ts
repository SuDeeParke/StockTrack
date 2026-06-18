import { randomUUID } from 'crypto'
import type { AccountBalance, Order, OrderRequest, Position, RiskCheckResult } from '../types/index.js'

export const MOCK_POSITIONS: Position[] = [
  { ticker: '600519.SH', market: 'CN', name: '贵州茅台', qty: 10,  avg_cost: 1750.0, current_price: 1800.0, market_value: 18000.0, pnl: 500.0,  pnl_pct: 2.86 },
  { ticker: '000858.SZ', market: 'CN', name: '五粮液',   qty: 100, avg_cost: 150.0,  current_price: 145.3,  market_value: 14530.0, pnl: -470.0, pnl_pct: -3.13 },
  { ticker: 'AAPL.US',   market: 'US', name: 'Apple',   qty: 20,  avg_cost: 180.0,  current_price: 195.5,  market_value: 3910.0,  pnl: 310.0,  pnl_pct: 8.61 },
]

export const MOCK_BALANCE: AccountBalance = {
  total_assets: 150000.0,
  cash: 113560.0,
  market_value: 36440.0,
  daily_pnl: 340.0,
  daily_pnl_pct: 0.23,
}

const _orders = new Map<string, Order>()

export function getPositions(): Position[] {
  return MOCK_POSITIONS
}

export function getBalance(): AccountBalance {
  return MOCK_BALANCE
}

export function getOrders(): Order[] {
  return Array.from(_orders.values()).sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function getOrder(orderId: string): Order | undefined {
  return _orders.get(orderId)
}

export function checkRisk(req: OrderRequest): RiskCheckResult {
  const orderValue = req.qty * req.price
  if (orderValue > MOCK_BALANCE.cash * 0.9) {
    return { passed: false, reason: '可用资金不足，委托金额超过可用资金的 90%' }
  }
  if (req.qty <= 0) {
    return { passed: false, reason: '委托数量必须大于 0' }
  }
  if (req.price <= 0) {
    return { passed: false, reason: '委托价格必须大于 0' }
  }
  return { passed: true }
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
  // Simulate async fill
  Promise.resolve().then(() => {
    const filled: Order = {
      ...order,
      status: 'FILLED',
      filled_qty: req.qty,
      filled_price: req.price,
      updated_at: new Date().toISOString(),
    }
    _orders.set(orderId, filled)
  })
  return order
}
