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

// ── Math helpers (private) ───────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function computeRSI(closes: number[], period: number): number {
  if (closes.length < period + 1) return 50
  const deltas: number[] = []
  for (let i = 1; i < closes.length; i++) deltas.push(closes[i] - closes[i - 1])

  let avgGain = 0
  let avgLoss = 0
  for (let i = 0; i < period; i++) {
    if (deltas[i] > 0) avgGain += deltas[i]
    else avgLoss += Math.abs(deltas[i])
  }
  avgGain /= period
  avgLoss /= period

  for (let i = period; i < deltas.length; i++) {
    const d = deltas[i]
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? Math.abs(d) : 0)) / period
  }

  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  const rsi = 100 - 100 / (1 + rs)
  return Math.max(0, Math.min(100, rsi))
}

function computeEMA(closes: number[], period: number): number[] {
  const multiplier = 2 / (period + 1)
  const ema: number[] = []
  const sma = closes.slice(0, period).reduce((a, b) => a + b, 0) / period
  ema.push(sma)
  for (let i = period; i < closes.length; i++) {
    ema.push((closes[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1])
  }
  return ema
}

function computeMACD(closes: number[]): number {
  if (closes.length < 26) return 0
  const ema12 = computeEMA(closes, 12)
  const ema26 = computeEMA(closes, 26)
  return ema12[ema12.length - 1] - ema26[ema26.length - 1]
}

function computeKDJ_K(bars: OHLCVBar[], period: number): number {
  if (bars.length < period) return 50
  const start = bars.length - period
  const window = bars.slice(start)
  const highest = Math.max(...window.map((b) => b.high))
  const lowest = Math.min(...window.map((b) => b.low))
  if (highest === lowest) return 50
  // seeded K: seed prevK = 50, iterate over window
  let k = 50
  for (let i = 0; i < window.length; i++) {
    const wClose = bars[start + i].close
    const wLow = Math.min(...bars.slice(start, start + i + 1).map((b) => b.low))
    const wHigh = Math.max(...bars.slice(start, start + i + 1).map((b) => b.high))
    const wRsv = wHigh === wLow ? 50 : ((wClose - wLow) / (wHigh - wLow)) * 100
    k = (2 / 3) * k + (1 / 3) * wRsv
  }
  return Math.max(0, Math.min(100, k))
}

// ── Exported helpers ─────────────────────────────────────────────────────────

export function computeIndicators(ohlcv: OHLCVBar[]): { macd: number; rsi: number; kdj_k: number } {
  const closes = ohlcv.map((b) => b.close)
  const rsi = computeRSI(closes, 14)
  const macd = computeMACD(closes)
  const kdj_k = computeKDJ_K(ohlcv, 9)
  return { macd: round2(macd), rsi: round2(rsi), kdj_k: round2(kdj_k) }
}

export function deriveSignal(ind: { rsi: number; macd: number; kdj_k: number }): 'BUY' | 'SELL' | 'WATCH' {
  if (ind.rsi < 30) return 'BUY'
  if (ind.rsi > 70) return 'SELL'
  return 'WATCH'
}

export function getIndicatorSnapshot(ticker: string): IndicatorSnapshot {
  const bars = genOHLCV(ticker, 90)
  const ind = computeIndicators(bars)
  const market: 'CN' | 'US' = /^\d{6}(\.(SH|SZ))?$/.test(ticker) ? 'CN' : 'US'
  const last = bars[bars.length - 1]
  return {
    ticker,
    market,
    date: last ? last.date : new Date().toISOString().slice(0, 10),
    macd: ind.macd,
    rsi: ind.rsi,
    kdj_k: ind.kdj_k,
  }
}

export function isKnownTicker(ticker: string): boolean {
  return KNOWN_TICKERS.has(ticker)
}
