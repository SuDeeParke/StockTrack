import type { IndicatorSnapshot, OHLCVBar, Signal } from '../types/index.js'

const BASE = process.env.BAOSTOCK_URL || 'http://localhost:8888'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`BaoStock ${path} → ${res.status}`)
  return res.json() as Promise<T>
}

export async function fetchSignals(market: string, limit: number): Promise<Signal[]> {
  const params = new URLSearchParams({ market, limit: String(limit) })
  return get<Signal[]>(`/api/signals?${params}`)
}

export async function fetchOHLCV(ticker: string, days: number): Promise<OHLCVBar[]> {
  return get<OHLCVBar[]>(`/api/stocks/${encodeURIComponent(ticker)}/ohlcv?days=${days}`)
}

export async function fetchIndicators(ticker: string): Promise<IndicatorSnapshot> {
  return get<IndicatorSnapshot>(`/api/stocks/${encodeURIComponent(ticker)}/indicators`)
}

export async function isAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}
