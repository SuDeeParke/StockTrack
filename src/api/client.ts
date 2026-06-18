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
}
