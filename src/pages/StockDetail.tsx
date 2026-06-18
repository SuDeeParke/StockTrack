import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import ReactECharts from 'echarts-for-react'
import { api } from '../api/client'

type IndicatorTab = 'macd' | 'rsi' | 'boll'

export default function StockDetail() {
  const { ticker = '' } = useParams<{ ticker: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<IndicatorTab>('macd')
  const isUS = ticker.endsWith('.US')

  const { data: ohlcv = [], isLoading: ohlcvLoading } = useQuery({
    queryKey: ['ohlcv', ticker],
    queryFn: () => api.getOHLCV(ticker, 90),
    enabled: !!ticker,
  })

  const { data: indicators } = useQuery({
    queryKey: ['indicators', ticker],
    queryFn: () => api.getIndicators(ticker),
    enabled: !!ticker,
  })

  const { data: allSignals = [] } = useQuery({
    queryKey: ['signals', 'ALL'],
    queryFn: () => api.getSignals('ALL'),
  })

  const signalHistory = allSignals.filter((s) => s.ticker === ticker).slice(0, 10)
  const latestSignal = signalHistory[0]

  const upColor = isUS ? '#22c55e' : '#ef4444'
  const downColor = isUS ? '#ef4444' : '#22c55e'

  const klineOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    xAxis: [
      {
        type: 'category',
        data: ohlcv.map((b) => b.date),
        axisLabel: { color: '#64748b', fontSize: 11 },
        axisLine: { lineStyle: { color: '#2a2d3e' } },
      },
      {
        type: 'category',
        gridIndex: 1,
        data: ohlcv.map((b) => b.date),
        show: false,
      },
    ],
    yAxis: [
      {
        scale: true,
        splitLine: { lineStyle: { color: '#2a2d3e' } },
        axisLabel: { color: '#64748b' },
      },
      {
        gridIndex: 1,
        splitNumber: 2,
        scale: true,
        axisLabel: { color: '#64748b', fontSize: 10 },
        splitLine: { show: false },
      },
    ],
    grid: [
      { left: 60, right: 20, top: 20, height: '60%' },
      { left: 60, right: 20, top: '75%', height: '20%' },
    ],
    dataZoom: [
      { type: 'inside', xAxisIndex: [0, 1], start: 60, end: 100 },
      {
        type: 'slider',
        xAxisIndex: [0, 1],
        start: 60,
        end: 100,
        height: 20,
        bottom: 5,
        borderColor: '#2a2d3e',
        fillerColor: '#00d2ff22',
        handleStyle: { color: '#00d2ff' },
        textStyle: { color: '#64748b' },
      },
    ],
    series: [
      {
        type: 'candlestick',
        data: ohlcv.map((b) => [b.open, b.close, b.low, b.high]),
        itemStyle: {
          color: upColor,
          color0: downColor,
          borderColor: upColor,
          borderColor0: downColor,
        },
      },
      {
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: ohlcv.map((b) => ({
          value: b.volume,
          itemStyle: {
            color: b.close >= b.open ? `${upColor}99` : `${downColor}99`,
          },
        })),
      },
    ],
  }

  const macdOption = indicators
    ? {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis' },
        xAxis: {
          type: 'category',
          data: [indicators.date],
          axisLabel: { color: '#64748b' },
          axisLine: { lineStyle: { color: '#2a2d3e' } },
        },
        yAxis: {
          splitLine: { lineStyle: { color: '#2a2d3e' } },
          axisLabel: { color: '#64748b' },
        },
        series: [
          {
            name: 'MACD',
            type: 'bar',
            data: [indicators.macd_hist ?? 0],
            itemStyle: {
              color: (indicators.macd_hist ?? 0) >= 0 ? upColor : downColor,
            },
          },
          {
            name: 'DIF',
            type: 'line',
            data: [indicators.macd ?? 0],
            lineStyle: { color: '#00d2ff' },
            symbol: 'none',
          },
          {
            name: 'DEA',
            type: 'line',
            data: [indicators.macd_signal ?? 0],
            lineStyle: { color: '#f59e0b' },
            symbol: 'none',
          },
        ],
      }
    : null

  const rsiOption = indicators
    ? {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis' },
        xAxis: {
          type: 'category',
          data: [indicators.date],
          axisLabel: { color: '#64748b' },
        },
        yAxis: {
          min: 0,
          max: 100,
          splitLine: { lineStyle: { color: '#2a2d3e' } },
          axisLabel: { color: '#64748b' },
        },
        series: [
          {
            name: 'RSI(14)',
            type: 'line',
            data: [indicators.rsi ?? 50],
            lineStyle: { color: '#00d2ff', width: 2 },
            symbol: 'circle',
            symbolSize: 6,
            markLine: {
              data: [
                {
                  yAxis: 70,
                  lineStyle: { color: '#ef4444', type: 'dashed' },
                },
                {
                  yAxis: 30,
                  lineStyle: { color: '#22c55e', type: 'dashed' },
                },
              ],
              label: { color: '#64748b' },
            },
          },
        ],
      }
    : null

  const SIGNAL_COLORS: Record<string, string> = {
    BUY: 'var(--color-buy)',
    SELL: 'var(--color-sell)',
    WATCH: 'var(--color-watch)',
  }
  const SIGNAL_LABELS: Record<string, string> = {
    BUY: '买入',
    SELL: '卖出',
    WATCH: '观察',
  }

  const TABS: { key: IndicatorTab; label: string }[] = [
    { key: 'macd', label: 'MACD' },
    { key: 'rsi', label: 'RSI' },
  ]

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-sm opacity-60 transition-opacity hover:opacity-100"
          style={{ color: 'var(--color-muted)' }}
        >
          ← 返回
        </button>
        <h1
          className="font-mono text-2xl font-bold"
          style={{ color: 'var(--color-primary)' }}
        >
          {ticker}
        </h1>
        <span
          className="rounded px-2 py-0.5 text-xs font-semibold"
          style={{
            background: isUS ? '#3b82f622' : '#ef444422',
            color: isUS ? '#3b82f6' : '#ef4444',
          }}
        >
          {isUS ? '美股' : '沪深'}
        </span>
        {latestSignal && (
          <span
            className="rounded px-2 py-0.5 text-xs font-semibold"
            style={{
              background: `${SIGNAL_COLORS[latestSignal.signal_type]}22`,
              color: SIGNAL_COLORS[latestSignal.signal_type],
            }}
          >
            {SIGNAL_LABELS[latestSignal.signal_type]}
          </span>
        )}
        {latestSignal && <span className="text-lg font-semibold">{latestSignal.price.toFixed(2)}</span>}
      </div>

      <div
        className="mb-4 rounded-lg p-4"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div
          className="mb-3 text-sm font-semibold"
          style={{ color: 'var(--color-muted)' }}
        >
          K 线 · 90 天
        </div>
        {ohlcvLoading ? (
          <div
            className="h-64 animate-pulse rounded"
            style={{ background: 'var(--color-border)' }}
          />
        ) : ohlcv.length > 0 ? (
          <ReactECharts option={klineOption} style={{ height: 340 }} theme="dark" />
        ) : (
          <div
            className="flex h-64 items-center justify-center"
            style={{ color: 'var(--color-muted)' }}
          >
            暂无 K 线数据
          </div>
        )}
      </div>

      <div
        className="mb-4 rounded-lg p-4"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div className="mb-4 flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className="rounded px-3 py-1 text-sm transition-colors"
              style={{
                background: activeTab === t.key ? 'var(--color-primary)' : 'transparent',
                color: activeTab === t.key ? '#000' : 'var(--color-muted)',
                border: `1px solid ${
                  activeTab === t.key ? 'var(--color-primary)' : 'var(--color-border)'
                }`,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        {!indicators ? (
          <div
            className="flex h-32 items-center justify-center"
            style={{ color: 'var(--color-muted)' }}
          >
            暂无指标数据
          </div>
        ) : activeTab === 'macd' && macdOption ? (
          <ReactECharts option={macdOption} style={{ height: 180 }} theme="dark" />
        ) : activeTab === 'rsi' && rsiOption ? (
          <ReactECharts option={rsiOption} style={{ height: 180 }} theme="dark" />
        ) : null}
      </div>

      <div
        className="rounded-lg p-4"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div
          className="mb-3 text-sm font-semibold"
          style={{ color: 'var(--color-muted)' }}
        >
          信号历史
        </div>
        {signalHistory.length === 0 ? (
          <div className="text-sm" style={{ color: 'var(--color-muted)' }}>
            暂无信号记录
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {signalHistory.map((sig, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span style={{ color: 'var(--color-muted)' }}>{sig.date}</span>
                <span
                  className="font-semibold"
                  style={{ color: SIGNAL_COLORS[sig.signal_type] }}
                >
                  {SIGNAL_LABELS[sig.signal_type]}
                </span>
                <span>{sig.price.toFixed(2)}</span>
                {sig.indicators.rsi !== undefined && (
                  <span style={{ color: 'var(--color-muted)' }}>
                    RSI {sig.indicators.rsi.toFixed(1)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
