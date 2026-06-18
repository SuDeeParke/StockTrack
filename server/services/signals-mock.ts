import { createHash } from 'crypto'
import type { IndicatorSnapshot, OHLCVBar, Signal } from '../types/index.js'

const today = new Date().toISOString().slice(0, 10)

export const MOCK_SIGNALS: Signal[] = [
  { ticker: '600519.SH', market: 'CN', signal_type: 'BUY',   date: today, price: 1800.0, indicators: { macd: 2.5,  rsi: 45.2, kdj_k: 60.1 }, stale: false },
  { ticker: '000858.SZ', market: 'CN', signal_type: 'SELL',  date: today, price: 145.3,  indicators: { macd: -1.2, rsi: 72.8, kdj_k: 80.3 }, stale: false },
  { ticker: '300750.SZ', market: 'CN', signal_type: 'WATCH', date: today, price: 220.5,  indicators: { macd: 0.3,  rsi: 55.0, kdj_k: 55.5 }, stale: false },
  { ticker: '601318.SH', market: 'CN', signal_type: 'BUY',   date: today, price: 45.6,   indicators: { macd: 1.1,  rsi: 38.5, kdj_k: 42.0 }, stale: false },
  { ticker: '000001.SZ', market: 'CN', signal_type: 'WATCH', date: today, price: 12.3,   indicators: { macd: -0.2, rsi: 50.0, kdj_k: 48.0 }, stale: false },
  { ticker: 'AAPL.US',   market: 'US', signal_type: 'BUY',   date: today, price: 195.5,  indicators: { macd: 1.8,  rsi: 42.3, kdj_k: 58.0 }, stale: false },
  { ticker: 'TSLA.US',   market: 'US', signal_type: 'WATCH', date: today, price: 175.2,  indicators: { macd: -0.5, rsi: 48.1, kdj_k: 50.2 }, stale: false },
]

const KNOWN_TICKERS = new Set(MOCK_SIGNALS.map((s) => s.ticker))

export function genOHLCV(ticker: string, days: number): OHLCVBar[] {
  const seed = parseInt(createHash('md5').update(ticker).digest('hex').slice(0, 8), 16)
  let state = seed
  function rand(): number {
    state = (state * 1664525 + 1013904223) & 0xffffffff
    return (state >>> 0) / 0xffffffff
  }
  function uniform(lo: number, hi: number): number {
    return lo + rand() * (hi - lo)
  }

  const bars: OHLCVBar[] = []
  let base = 100.0
  for (let i = 0; i < days; i++) {
    const d = new Date()
    d.setDate(d.getDate() - (days - i - 1))
    const dateStr = d.toISOString().slice(0, 10)
    const open = base * (1 + uniform(-0.02, 0.02))
    const close = open * (1 + uniform(-0.03, 0.03))
    const high = Math.max(open, close) * (1 + uniform(0, 0.01))
    const low = Math.min(open, close) * (1 - uniform(0, 0.01))
    const volume = uniform(1_000_000, 50_000_000)
    bars.push({
      date: dateStr,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume: Math.round(volume),
    })
    base = close
  }
  return bars
}

export function getIndicatorSnapshot(ticker: string): IndicatorSnapshot | null {
  const sig = MOCK_SIGNALS.find((s) => s.ticker === ticker)
  if (!sig) return null
  return {
    ticker,
    market: sig.market,
    date: sig.date,
    macd: sig.indicators['macd'],
    rsi: sig.indicators['rsi'],
    kdj_k: sig.indicators['kdj_k'],
  }
}

export function isKnownTicker(ticker: string): boolean {
  return KNOWN_TICKERS.has(ticker)
}
