import { createHash } from 'crypto'
import type {
  BacktestRequest, BacktestResult, BacktestStats,
  BacktestStrategy, EquityPoint, Trade,
} from '../types/index.js'

export const STRATEGIES: BacktestStrategy[] = [
  { id: 'macd_cross',    name: 'MACD 金叉',    description: 'MACD DIF 上穿 DEA 买入，下穿卖出',  markets: ['CN', 'US'] },
  { id: 'rsi_reversal',  name: 'RSI 超卖反弹', description: 'RSI<30 买入，RSI>70 卖出',          markets: ['CN', 'US'] },
  { id: 'boll_breakout', name: '布林带突破',    description: '收盘价突破上轨买入，跌破下轨卖出', markets: ['CN', 'US'] },
  { id: 'kdj_signal',    name: 'KDJ 信号',      description: 'KDJ J线超卖回升买入',              markets: ['CN'] },
  { id: 'volume_surge',  name: '放量突破',      description: '成交量放大 2 倍且价格创新高买入',  markets: ['CN', 'US'] },
]

const STRATEGY_IDS = new Set(STRATEGIES.map((s) => s.id))

export function isValidStrategy(id: string): boolean {
  return STRATEGY_IDS.has(id)
}

export function getStrategies(): BacktestStrategy[] {
  return STRATEGIES
}

function buildSeed(req: BacktestRequest): number {
  const payload = [
    req.strategy_id,
    [...req.tickers].sort().join(','),
    req.start_date,
    req.end_date,
    ((req.initial_capital ?? 100_000)).toFixed(2),
  ].join('|')
  return parseInt(createHash('sha256').update(payload, 'utf8').digest('hex').slice(0, 16), 16)
}

function makePrng(seed: number) {
  let s = seed >>> 0
  return {
    random(): number {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0
      return s / 0x100000000
    },
    uniform(lo: number, hi: number): number {
      return lo + this.random() * (hi - lo)
    },
    randint(lo: number, hi: number): number {
      return Math.floor(this.uniform(lo, hi + 1))
    },
    choice<T>(arr: T[]): T {
      return arr[Math.floor(this.random() * arr.length)]
    },
  }
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function dateDiffDays(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000)
}

export function simulateBacktest(req: BacktestRequest): BacktestResult {
  const rng = makePrng(buildSeed(req))
  const days = dateDiffDays(req.start_date, req.end_date)
  if (days < 10) throw new Error('回测区间至少需要 10 天')

  const initialCapital = req.initial_capital ?? 100_000
  let capital = initialCapital
  let benchmarkCapital = initialCapital
  const equityCurve: EquityPoint[] = []
  const trades: Trade[] = []

  const step = Math.max(1, Math.floor(days / 100))
  for (let i = 0; i < days; i += step) {
    const pointDate = addDays(req.start_date, i)
    const dailyRet = rng.uniform(-0.015, 0.02)
    const benchRet = rng.uniform(-0.01, 0.015)
    capital *= 1 + dailyRet
    benchmarkCapital *= 1 + benchRet
    equityCurve.push({
      date: pointDate,
      equity: Math.round(capital * 100) / 100,
      benchmark: Math.round(benchmarkCapital * 100) / 100,
    })
  }

  for (const ticker of req.tickers) {
    const nTrades = rng.randint(3, 8)
    for (let t = 0; t < nTrades; t++) {
      const tradeDate = addDays(req.start_date, rng.randint(1, days - 1))
      const price = rng.uniform(10, 500)
      const shares = Math.round(rng.uniform(100, 1000))
      const pnl = Math.round(price * shares * rng.uniform(-0.1, 0.2) * 100) / 100
      trades.push({
        ticker,
        action: rng.choice(['BUY', 'SELL'] as const),
        date: tradeDate,
        price: Math.round(price * 100) / 100,
        shares,
        pnl,
      })
    }
  }

  trades.sort((a, b) => a.date.localeCompare(b.date))

  const finalEquity = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].equity : capital
  const totalReturn = (finalEquity - initialCapital) / initialCapital * 100
  const years = Math.max(days / 365, 0.01)
  const annReturn = ((finalEquity / initialCapital) ** (1 / years) - 1) * 100

  const returns: number[] = []
  for (let i = 1; i < equityCurve.length; i++) {
    const prev = equityCurve[i - 1].equity
    const curr = equityCurve[i].equity
    returns.push((curr - prev) / prev)
  }
  const avgR = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0
  const variance = returns.length > 0 ? returns.reduce((s, r) => s + (r - avgR) ** 2, 0) / returns.length : 1
  const stdR = Math.sqrt(variance) || 1
  const sharpe = avgR / stdR * Math.sqrt(252)

  let peak = initialCapital
  let maxDD = 0
  for (const pt of equityCurve) {
    if (pt.equity > peak) peak = pt.equity
    const dd = (peak - pt.equity) / peak * 100
    if (dd > maxDD) maxDD = dd
  }

  const winTrades = trades.filter((t) => t.pnl > 0)
  const winRate = trades.length > 0 ? winTrades.length / trades.length * 100 : 0

  const stats: BacktestStats = {
    total_return_pct: Math.round(totalReturn * 100) / 100,
    annualized_return_pct: Math.round(annReturn * 100) / 100,
    sharpe_ratio: Math.round(sharpe * 1000) / 1000,
    max_drawdown_pct: Math.round(maxDD * 100) / 100,
    win_rate_pct: Math.round(winRate * 10) / 10,
    total_trades: trades.length,
  }

  return {
    job_id: '',
    status: 'DONE',
    strategy_id: req.strategy_id,
    tickers: req.tickers,
    start_date: req.start_date,
    end_date: req.end_date,
    equity_curve: equityCurve,
    trades,
    stats,
    created_at: new Date().toISOString(),
  }
}

const _jobs = new Map<string, BacktestResult>()

export function getJob(jobId: string): BacktestResult | undefined {
  return _jobs.get(jobId)
}

export async function runBacktestAsync(req: BacktestRequest, jobId: string): Promise<void> {
  _jobs.set(jobId, {
    job_id: jobId, status: 'RUNNING',
    strategy_id: req.strategy_id, tickers: req.tickers,
    start_date: req.start_date, end_date: req.end_date,
    equity_curve: [], trades: [], stats: null,
    created_at: new Date().toISOString(),
  })
  Promise.resolve().then(() => {
    try {
      const result = simulateBacktest(req)
      result.job_id = jobId
      _jobs.set(jobId, result)
    } catch (err) {
      _jobs.set(jobId, {
        job_id: jobId, status: 'FAILED',
        strategy_id: req.strategy_id, tickers: req.tickers,
        start_date: req.start_date, end_date: req.end_date,
        equity_curve: [], trades: [], stats: null,
        error: err instanceof Error ? err.message : String(err),
        created_at: new Date().toISOString(),
      })
    }
  })
}
