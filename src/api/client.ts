import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})


// Request: inject Bearer token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response: redirect to login on 401
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

export type Market = 'CN' | 'US' | 'ALL'
export type SignalType = 'BUY' | 'SELL' | 'WATCH'

export interface UserPosition {
  id: number
  ticker: string
  name: string
  market: 'CN' | 'US'
  shares: number
  cost_basis: number
  note: string | null
  created_at: string
  updated_at: string
}

export interface UserPositionWithDerived extends UserPosition {
  current_price: number
  market_value: number
  pnl: number
  pnl_pct: number
}

export interface Signal {
  ticker: string
  name?: string
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
  macd?: number      // histogram (DIF-DEA)*2
  macd_dif?: number  // DIF line
  macd_dea?: number  // DEA/Signal line
  macd_signal?: number  // alias for macd_dea
  macd_hist?: number    // alias for macd
  rsi?: number
  kdj_k?: number
  kdj_d?: number
  kdj_j?: number
  boll_upper?: number
  boll_mid?: number
  boll_lower?: number
}

export type BacktestStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED'

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

export const api = {
  getSignals: (market: Market = 'ALL', limit = 50) =>
    apiClient
      .get<Signal[]>('/api/signals', { params: { market, limit } })
      .then((r) => r.data),

  getOHLCV: (ticker: string, days = 90) =>
    apiClient
      .get<OHLCVBar[]>(`/api/stocks/${encodeURIComponent(ticker)}/ohlcv`, {
        params: { days },
      })
      .then((r) => r.data),

  getIndicators: (ticker: string) =>
    apiClient
      .get<IndicatorSnapshot>(
        `/api/stocks/${encodeURIComponent(ticker)}/indicators`,
      )
      .then((r) => r.data),

  healthCheck: () =>
    apiClient.get<{ status: string }>('/api/health').then((r) => r.data),

  getStrategies: () =>
    apiClient.get<BacktestStrategy[]>('/api/backtest/strategies').then((r) => r.data),

  runBacktest: (req: BacktestRequest) =>
    apiClient.post<BacktestResult>('/api/backtest/run', req).then((r) => r.data),

  getBacktestResult: (jobId: string) =>
    apiClient.get<BacktestResult>(`/api/backtest/result/${jobId}`).then((r) => r.data),

  // Manage positions (self-managed watchlist)
  listPositions: () =>
    apiClient.get<UserPositionWithDerived[]>('/api/positions').then((r) => r.data),
  createPosition: (req: { ticker: string; name: string; market: 'CN' | 'US'; shares: number; cost_basis: number; note?: string }) =>
    apiClient.post<UserPositionWithDerived>('/api/positions', req).then((r) => r.data),
  updatePosition: (id: number, req: Partial<{ name: string; shares: number; cost_basis: number; note: string }>) =>
    apiClient.patch<UserPositionWithDerived>(`/api/positions/${id}`, req).then((r) => r.data),
  deletePosition: (id: number) =>
    apiClient.delete(`/api/positions/${id}`).then((r) => r.data),
  bulkDeletePositions: (ids: number[]) =>
    apiClient.post<{ deleted: number }>('/api/positions/bulk-delete', { ids }).then((r) => r.data),
  getPositionsSignals: () =>
    apiClient.get<Signal[]>('/api/positions/signals').then((r) => r.data),

  getBalance: () =>
    apiClient.get<AccountBalance>('/api/portfolio/balance').then((r) => r.data),

  riskCheck: (req: OrderRequest) =>
    apiClient.post<RiskCheckResult>('/api/portfolio/risk-check', req).then((r) => r.data),

  placeOrder: (req: OrderRequest) =>
    apiClient.post<Order>('/api/portfolio/orders', req).then((r) => r.data),

  getOrders: () =>
    apiClient.get<Order[]>('/api/portfolio/orders').then((r) => r.data),
}

export type OrderSide = 'BUY' | 'SELL'
export type OrderStatus = 'PENDING' | 'FILLED' | 'CANCELLED' | 'REJECTED'

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
