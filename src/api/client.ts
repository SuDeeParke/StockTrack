import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

export type Market = 'CN' | 'US' | 'ALL'
export type SignalType = 'BUY' | 'SELL' | 'WATCH'

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
}
