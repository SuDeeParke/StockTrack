export type Market = 'CN' | 'US' | 'ALL'
export type SignalType = 'BUY' | 'SELL' | 'WATCH'
export type OrderSide = 'BUY' | 'SELL'
export type OrderStatus = 'PENDING' | 'FILLED' | 'CANCELLED' | 'REJECTED'
export type BacktestStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED'

export interface Signal {
  ticker: string
  market: 'CN' | 'US'
  signal_type: SignalType
  date: string
  price: number
  indicators: Record<string, number>
  stale: boolean
}

export interface OHLCVBar {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface IndicatorSnapshot {
  ticker: string
  market: 'CN' | 'US'
  date: string
  macd?: number
  macd_signal?: number
  macd_hist?: number
  rsi?: number
  kdj_k?: number
  kdj_d?: number
  kdj_j?: number
  boll_upper?: number
  boll_mid?: number
  boll_lower?: number
}

export interface BacktestStrategy {
  id: string
  name: string
  description: string
  markets: ('CN' | 'US')[]
}

export interface BacktestRequest {
  strategy_id: string
  tickers: string[]
  start_date: string
  end_date: string
  initial_capital?: number
}

export interface Trade {
  ticker: string
  action: 'BUY' | 'SELL'
  date: string
  price: number
  shares: number
  pnl: number
}

export interface BacktestStats {
  total_return_pct: number
  annualized_return_pct: number
  sharpe_ratio: number
  max_drawdown_pct: number
  win_rate_pct: number
  total_trades: number
}

export interface EquityPoint {
  date: string
  equity: number
  benchmark: number
}

export interface BacktestResult {
  job_id: string
  status: BacktestStatus
  strategy_id: string
  tickers: string[]
  start_date: string
  end_date: string
  equity_curve: EquityPoint[]
  trades: Trade[]
  stats: BacktestStats | null
  error?: string
  created_at: string
}

export interface Position {
  ticker: string
  market: 'CN' | 'US'
  name: string
  qty: number
  avg_cost: number
  current_price: number
  market_value: number
  pnl: number
  pnl_pct: number
}

export interface AccountBalance {
  total_assets: number
  cash: number
  market_value: number
  daily_pnl: number
  daily_pnl_pct: number
}

export interface OrderRequest {
  ticker: string
  market: 'CN' | 'US'
  side: OrderSide
  qty: number
  price: number
  paper_trade?: boolean
}

export interface Order {
  order_id: string
  ticker: string
  market: 'CN' | 'US'
  side: OrderSide
  qty: number
  price: number
  status: OrderStatus
  filled_qty: number
  filled_price: number
  created_at: string
  updated_at: string
  reject_reason?: string
  paper_trade: boolean
}

export interface RiskCheckResult {
  passed: boolean
  reason?: string
}
