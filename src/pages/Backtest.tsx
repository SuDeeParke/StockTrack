import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import ReactECharts from 'echarts-for-react'
import { api, type BacktestRequest, type BacktestResult } from '../api/client'

const CN_TICKERS = ['600519.SH', '000858.SZ', '300750.SZ', '601318.SH', '000001.SZ']
const US_TICKERS = ['AAPL.US', 'TSLA.US', 'MSFT.US', 'NVDA.US', 'GOOGL.US']

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color?: string
}) {
  return (
    <div
      className="rounded-lg p-4"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div className="mb-1 text-xs" style={{ color: 'var(--color-muted)' }}>
        {label}
      </div>
      <div
        className="font-mono text-xl font-bold"
        style={{ color: color ?? 'var(--color-text)' }}
      >
        {value}
      </div>
    </div>
  )
}

export default function Backtest() {
  const [strategyId, setStrategyId] = useState('')
  const [selectedTickers, setSelectedTickers] = useState<string[]>([
    '600519.SH',
    '000858.SZ',
  ])
  const [startDate, setStartDate] = useState('2022-01-01')
  const [endDate, setEndDate] = useState('2024-01-01')
  const [result, setResult] = useState<BacktestResult | null>(null)
  const [polling, setPolling] = useState(false)
  const pollingRef = useRef<number | null>(null)

  const { data: strategies = [] } = useQuery({
    queryKey: ['backtest-strategies'],
    queryFn: () => api.getStrategies(),
  })

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
    onError: () => {
      stopPolling()
    },
  })

  useEffect(() => stopPolling, [])

  const allTickers = [...CN_TICKERS, ...US_TICKERS]

  const toggleTicker = (ticker: string) => {
    setSelectedTickers((prev) =>
      prev.includes(ticker) ? prev.filter((item) => item !== ticker) : [...prev, ticker],
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
          data: result.equity_curve.map((point) => point.date),
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
            data: result.equity_curve.map((point) => point.equity),
            lineStyle: { color: '#00d2ff', width: 2 },
            symbol: 'none',
            areaStyle: { color: '#00d2ff11' },
          },
          {
            name: '基准',
            type: 'line',
            data: result.equity_curve.map((point) => point.benchmark),
            lineStyle: { color: '#64748b', width: 1, type: 'dashed' },
            symbol: 'none',
          },
        ],
      }
    : null

  const inputStyle = {
    width: '100%',
    borderRadius: 6,
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    padding: '6px 10px',
    fontSize: 13,
  }

  return (
    <div className="flex gap-6">
      <div className="flex w-64 flex-shrink-0 flex-col gap-4">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>
          策略回测
        </h1>

        <div>
          <div className="mb-1 text-xs font-semibold" style={{ color: 'var(--color-muted)' }}>
            策略
          </div>
          <select
            value={strategyId}
            onChange={(event) => setStrategyId(event.target.value)}
            style={inputStyle}
          >
            {strategies.map((strategy) => (
              <option key={strategy.id} value={strategy.id}>
                {strategy.name}
              </option>
            ))}
          </select>
          {strategyId && (
            <div className="mt-1 text-xs" style={{ color: 'var(--color-muted)' }}>
              {strategies.find((strategy) => strategy.id === strategyId)?.description}
            </div>
          )}
        </div>

        <div>
          <div className="mb-1 text-xs font-semibold" style={{ color: 'var(--color-muted)' }}>
            股票池（{selectedTickers.length} 只）
          </div>
          <div className="flex flex-wrap gap-1">
            {allTickers.map((ticker) => {
              const active = selectedTickers.includes(ticker)

              return (
                <button
                  key={ticker}
                  onClick={() => toggleTicker(ticker)}
                  className="rounded px-2 py-0.5 text-xs font-mono transition-colors"
                  style={{
                    background: active ? 'var(--color-primary)22' : 'var(--color-surface)',
                    color: active ? 'var(--color-primary)' : 'var(--color-muted)',
                    border: `1px solid ${
                      active ? 'var(--color-primary)' : 'var(--color-border)'
                    }`,
                  }}
                >
                  {ticker}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <div className="mb-1 text-xs font-semibold" style={{ color: 'var(--color-muted)' }}>
            开始日期
          </div>
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <div className="mb-1 text-xs font-semibold" style={{ color: 'var(--color-muted)' }}>
            结束日期
          </div>
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            style={inputStyle}
          />
        </div>

        <button
          onClick={handleRun}
          disabled={mutation.isPending || polling || selectedTickers.length === 0}
          className="rounded py-2 text-sm font-semibold transition-opacity"
          style={{
            background: 'var(--color-primary)',
            color: '#000',
            opacity: mutation.isPending || polling ? 0.6 : 1,
          }}
        >
          {mutation.isPending || polling ? '运行中...' : '▶ 运行回测'}
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-4">
        {!result && !mutation.isPending && (
          <div
            className="flex flex-1 items-center justify-center"
            style={{ color: 'var(--color-muted)' }}
          >
            选择策略和股票，点击「运行回测」
          </div>
        )}

        {(mutation.isPending || polling) && !result && (
          <div className="flex items-center gap-2 p-4" style={{ color: 'var(--color-muted)' }}>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            正在运行回测...
          </div>
        )}

        {result?.status === 'FAILED' && (
          <div
            className="rounded p-4"
            style={{
              background: '#ef444422',
              color: '#ef4444',
              border: '1px solid #ef444444',
            }}
          >
            回测失败：{result.error}
          </div>
        )}

        {result?.status === 'DONE' && result.stats && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                label="总收益率"
                value={`${result.stats.total_return_pct > 0 ? '+' : ''}${result.stats.total_return_pct.toFixed(2)}%`}
                color={
                  result.stats.total_return_pct >= 0
                    ? 'var(--color-buy)'
                    : 'var(--color-sell)'
                }
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
              <div
                className="rounded-lg p-4"
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div className="mb-3 text-sm font-semibold" style={{ color: 'var(--color-muted)' }}>
                  权益曲线
                </div>
                <ReactECharts option={equityOption} style={{ height: 280 }} theme="dark" />
              </div>
            )}

            <div
              className="overflow-hidden rounded-lg"
              style={{ border: '1px solid var(--color-border)' }}
            >
              <div
                className="px-4 py-3 text-sm font-semibold"
                style={{
                  background: 'var(--color-surface)',
                  color: 'var(--color-muted)',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                交易记录（{result.trades.length} 笔）
              </div>
              <div className="max-h-64 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr
                      style={{
                        background: 'var(--color-surface)88',
                        borderBottom: '1px solid var(--color-border)',
                      }}
                    >
                      {['代码', '方向', '日期', '价格', '股数', '盈亏'].map((header) => (
                        <th
                          key={header}
                          className="px-3 py-2 text-left font-semibold"
                          style={{ color: 'var(--color-muted)' }}
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...result.trades].sort((a, b) => b.pnl - a.pnl).map((trade, index) => (
                      <tr
                        key={`${trade.ticker}-${trade.date}-${trade.action}-${index}`}
                        style={{ borderBottom: '1px solid var(--color-border)22' }}
                      >
                        <td className="px-3 py-2 font-mono">{trade.ticker}</td>
                        <td
                          className="px-3 py-2 font-semibold"
                          style={{
                            color:
                              trade.action === 'BUY'
                                ? 'var(--color-buy)'
                                : 'var(--color-sell)',
                          }}
                        >
                          {trade.action === 'BUY' ? '买入' : '卖出'}
                        </td>
                        <td className="px-3 py-2" style={{ color: 'var(--color-muted)' }}>
                          {trade.date}
                        </td>
                        <td className="px-3 py-2">{trade.price.toFixed(2)}</td>
                        <td className="px-3 py-2">{trade.shares}</td>
                        <td
                          className="px-3 py-2 font-mono"
                          style={{
                            color: trade.pnl >= 0 ? 'var(--color-buy)' : 'var(--color-sell)',
                          }}
                        >
                          {trade.pnl >= 0 ? '+' : ''}
                          {trade.pnl.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
