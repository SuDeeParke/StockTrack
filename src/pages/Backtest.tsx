import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import ReactECharts from 'echarts-for-react'
import { Loader2 } from 'lucide-react'
import { api, type BacktestRequest, type BacktestResult } from '../api/client'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'

function getStatValueClass(color?: string) {
  if (color === 'var(--color-buy)') return 'text-emerald-400'
  if (color === 'var(--color-sell)') return 'text-rose-400'
  return 'text-zinc-50'
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Card className="border border-zinc-800 bg-zinc-900/60">
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`font-mono text-xl font-bold ${getStatValueClass(color)}`}>{value}</div>
      </CardContent>
    </Card>
  )
}

export default function Backtest() {
  const [strategyId, setStrategyId] = useState('')
  const [selectedTickers, setSelectedTickers] = useState<string[]>([])
  const [startDate, setStartDate] = useState('2022-01-01')
  const [endDate, setEndDate] = useState('2024-01-01')
  const [result, setResult] = useState<BacktestResult | null>(null)
  const [polling, setPolling] = useState(false)
  const pollingRef = useRef<number | null>(null)

  const { data: strategies = [] } = useQuery({
    queryKey: ['backtest-strategies'],
    queryFn: () => api.getStrategies(),
  })

  const { data: positions = [] } = useQuery({
    queryKey: ['positions'],
    queryFn: () => api.listPositions(),
  })

  const watchlist = positions.map((p) => ({ ticker: p.ticker, name: p.name }))

  useEffect(() => {
    if (strategies.length > 0 && !strategyId) {
      setStrategyId(strategies[0].id)
    }
  }, [strategies, strategyId])

  const stopPolling = () => {
    if (pollingRef.current !== null) {
      window.clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    setPolling(false)
  }

  const mutation = useMutation({
    mutationFn: (req: BacktestRequest) => api.runBacktest(req),
    onSuccess: (data) => {
      setResult(data)
      if (data.status === 'RUNNING' || data.status === 'PENDING') {
        stopPolling()
        setPolling(true)
        pollingRef.current = window.setInterval(async () => {
          const nextResult = await api.getBacktestResult(data.job_id)
          setResult(nextResult)
          if (nextResult.status === 'DONE' || nextResult.status === 'FAILED') {
            stopPolling()
          }
        }, 500)
      }
    },
    onError: () => stopPolling(),
  })

  useEffect(() => stopPolling, [])

  const toggleTicker = (ticker: string) => {
    setSelectedTickers((prev) =>
      prev.includes(ticker) ? prev.filter((t) => t !== ticker) : [...prev, ticker],
    )
  }

  const handleRun = () => {
    if (!strategyId || selectedTickers.length === 0) return
    stopPolling()
    setResult(null)
    mutation.mutate({
      strategy_id: strategyId,
      tickers: selectedTickers,
      start_date: startDate,
      end_date: endDate,
    })
  }

  const equityOption = result?.equity_curve?.length
    ? {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis' },
        legend: {
          data: ['策略净值', '基准'],
          textStyle: { color: '#64748b' },
        },
        xAxis: {
          type: 'category',
          data: result.equity_curve.map((p) => p.date),
          axisLabel: {
            color: '#64748b',
            interval: Math.max(0, Math.floor(result.equity_curve.length / 6)),
          },
          axisLine: { lineStyle: { color: '#2a2d3e' } },
        },
        yAxis: {
          scale: true,
          splitLine: { lineStyle: { color: '#2a2d3e' } },
          axisLabel: { color: '#64748b' },
        },
        series: [
          {
            name: '策略净值',
            type: 'line',
            data: result.equity_curve.map((p) => p.equity),
            lineStyle: { color: '#fafafa', width: 2 },
            symbol: 'none',
            areaStyle: { color: '#fafafa11' },
          },
          {
            name: '基准',
            type: 'line',
            data: result.equity_curve.map((p) => p.benchmark),
            lineStyle: { color: '#64748b', width: 1, type: 'dashed' },
            symbol: 'none',
          },
        ],
      }
    : null

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <div className="flex w-full flex-shrink-0 flex-col gap-4 md:w-64">
        <h1 className="text-2xl font-bold text-zinc-50">策略回测</h1>

        <Alert className="border-amber-800 bg-amber-950/50 text-amber-400">
          <AlertDescription>🎲 回测数据为模拟（随机数引擎），仅供 UX 验证</AlertDescription>
        </Alert>

        {positions.length > 0 ? (
          <>
            <div>
              <div className="mb-1 text-xs font-semibold text-zinc-500">策略</div>
              <Select value={strategyId} onValueChange={setStrategyId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择策略" />
                </SelectTrigger>
                <SelectContent>
                  {strategies.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {strategyId && (
                <div className="mt-1 text-xs text-zinc-500">
                  {strategies.find((s) => s.id === strategyId)?.description}
                </div>
              )}
            </div>

            <div>
              <div className="mb-1 text-xs font-semibold text-zinc-500">
                股票池（{selectedTickers.length} 只）
              </div>
              <div className="flex flex-wrap gap-1">
                {watchlist.map(({ ticker, name }) => {
                  const active = selectedTickers.includes(ticker)
                  const label = name !== ticker ? name : ticker
                  return (
                    <button
                      key={ticker}
                      type="button"
                      title={label}
                      onClick={() => toggleTicker(ticker)}
                      className={`ticker-tag h-auto rounded px-2 py-0.5 text-xs transition-colors ${
                        active
                          ? 'border border-zinc-500 bg-zinc-800 text-zinc-50 hover:bg-zinc-700'
                          : 'border border-zinc-800 bg-transparent text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      <span className="ticker-tag-label">
                        <span className="inner">{label}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <div className="mb-1 text-xs font-semibold text-zinc-500">开始日期</div>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>

            <div>
              <div className="mb-1 text-xs font-semibold text-zinc-500">结束日期</div>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>

            <Button
              onClick={handleRun}
              disabled={mutation.isPending || polling || selectedTickers.length === 0}
            >
              {mutation.isPending || polling ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  运行中...
                </>
              ) : (
                '▶ 运行回测'
              )}
            </Button>
          </>
        ) : (
          <Alert>
            <AlertDescription className="flex flex-col gap-2">
              <span>还没有持仓，无法选择回测股票池</span>
              <a href="/manage" className="text-zinc-50 underline">去管理添加持仓 →</a>
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-4">
        {!result && !mutation.isPending && (
          <div className="flex flex-1 items-center justify-center text-zinc-500">
            选择策略和股票，点击「运行回测」
          </div>
        )}

        {(mutation.isPending || polling) && !result && (
          <div className="flex items-center gap-2 p-4 text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在运行回测...
          </div>
        )}

        {result?.status === 'FAILED' && (
          <Alert variant="destructive">
            <AlertDescription>回测失败：{result.error}</AlertDescription>
          </Alert>
        )}

        {result?.status === 'DONE' && result.stats && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <StatCard
                label="总收益率"
                value={`${result.stats.total_return_pct > 0 ? '+' : ''}${result.stats.total_return_pct.toFixed(2)}%`}
                color={result.stats.total_return_pct >= 0 ? 'var(--color-buy)' : 'var(--color-sell)'}
              />
              <StatCard
                label="年化收益"
                value={`${result.stats.annualized_return_pct.toFixed(2)}%`}
              />
              <StatCard
                label="夏普比率"
                value={result.stats.sharpe_ratio.toFixed(3)}
                color={
                  result.stats.sharpe_ratio >= 1
                    ? 'var(--color-buy)'
                    : result.stats.sharpe_ratio < 0
                      ? 'var(--color-sell)'
                      : undefined
                }
              />
              <StatCard
                label="最大回撤"
                value={`-${result.stats.max_drawdown_pct.toFixed(2)}%`}
                color="var(--color-sell)"
              />
              <StatCard label="胜率" value={`${result.stats.win_rate_pct.toFixed(1)}%`} />
              <StatCard label="总交易次数" value={`${result.stats.total_trades}`} />
            </div>

            {equityOption && (
              <Card className="border border-zinc-800 bg-zinc-900/60 py-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold normal-case tracking-normal text-zinc-500">
                    权益曲线
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ReactECharts className="h-[200px] md:h-[280px]" option={equityOption} theme="dark" />
                </CardContent>
              </Card>
            )}

            <Card className="overflow-hidden border border-zinc-800 bg-transparent">
              <CardHeader className="border-b border-zinc-800 px-4 py-3">
                <CardTitle className="text-sm font-semibold normal-case tracking-normal text-zinc-500">
                  交易记录（{result.trades.length} 笔）
                </CardTitle>
              </CardHeader>
              <CardContent className="max-h-64 overflow-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {['代码', '方向', '日期', '价格', '股数', '盈亏'].map((h) => (
                        <TableHead key={h}>{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...result.trades].sort((a, b) => b.pnl - a.pnl).map((trade, i) => (
                      <TableRow key={`${trade.ticker}-${trade.date}-${trade.action}-${i}`}>
                        <TableCell className="font-mono">{trade.ticker}</TableCell>
                        <TableCell>
                          <Badge variant={trade.action === 'BUY' ? 'buy' : 'sell'}>
                            {trade.action === 'BUY' ? '买入' : '卖出'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-zinc-500">{trade.date}</TableCell>
                        <TableCell className="font-mono">{trade.price.toFixed(2)}</TableCell>
                        <TableCell>{trade.shares}</TableCell>
                        <TableCell
                          className={`font-mono ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                        >
                          {trade.pnl >= 0 ? '+' : ''}
                          {trade.pnl.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
