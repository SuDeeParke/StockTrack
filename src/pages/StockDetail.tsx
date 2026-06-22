import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import ReactECharts from 'echarts-for-react'
import { api } from '../api/client'
import { Badge } from '../components/ui/badge'
import { Separator } from '../components/ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { Skeleton } from '../components/ui/skeleton'

type IndicatorTab = 'macd' | 'rsi' | 'boll'

const SIGNAL_LABELS: Record<string, string> = {
  BUY: '买入',
  SELL: '卖出',
  WATCH: '观察',
}

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
        fillerColor: '#ffffff22',
        handleStyle: { color: '#fafafa' },
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
            data: [indicators.macd ?? indicators.macd_hist ?? 0],
            itemStyle: { color: (indicators.macd ?? indicators.macd_hist ?? 0) >= 0 ? upColor : downColor },
          },
          {
            name: 'DIF',
            type: 'line',
            data: [indicators.macd_dif ?? indicators.macd_signal ?? 0],
            lineStyle: { color: '#fafafa' },
            symbol: 'none',
          },
          {
            name: 'DEA',
            type: 'line',
            data: [indicators.macd_dea ?? indicators.macd_signal ?? 0],
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
            lineStyle: { color: '#fafafa', width: 2 },
            symbol: 'circle',
            symbolSize: 6,
            markLine: {
              data: [
                { yAxis: 70, lineStyle: { color: '#ef4444', type: 'dashed' } },
                { yAxis: 30, lineStyle: { color: '#22c55e', type: 'dashed' } },
              ],
              label: { color: '#64748b' },
            },
          },
        ],
      }
    : null

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-zinc-500 opacity-60 transition-opacity hover:opacity-100"
        >
          ← 返回
        </button>
        <h1 className="font-mono text-2xl font-bold text-zinc-50">{ticker}</h1>
        <Badge variant={isUS ? 'us' : 'cn'}>{isUS ? '美股' : '沪深'}</Badge>
        {latestSignal && (
          <Badge
            variant={
              latestSignal.signal_type === 'BUY'
                ? 'buy'
                : latestSignal.signal_type === 'SELL'
                  ? 'sell'
                  : 'watch'
            }
          >
            {SIGNAL_LABELS[latestSignal.signal_type]}
          </Badge>
        )}
        {latestSignal && (
          <span className="font-mono text-lg font-semibold text-zinc-50">
            {latestSignal.price.toFixed(2)}
          </span>
        )}
      </div>

      <div className="mb-4 py-2">
        <div className="mb-3 text-sm font-semibold text-zinc-500">K 线 · 90 天</div>
        {ohlcvLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : ohlcv.length > 0 ? (
          <ReactECharts option={klineOption} className="h-[340px]" theme="dark" />
        ) : (
          <div className="flex h-64 items-center justify-center text-zinc-500">暂无 K 线数据</div>
        )}
      </div>

      <Separator className="my-4" />

      <div className="mb-4 py-2">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as IndicatorTab)}>
          <TabsList>
            <TabsTrigger value="macd">MACD</TabsTrigger>
            <TabsTrigger value="rsi">RSI</TabsTrigger>
          </TabsList>
          <TabsContent value="macd">
            {!indicators ? (
              <div className="flex h-32 items-center justify-center text-zinc-500">暂无指标数据</div>
            ) : macdOption ? (
              <ReactECharts option={macdOption} className="h-[180px]" theme="dark" />
            ) : null}
          </TabsContent>
          <TabsContent value="rsi">
            {!indicators ? (
              <div className="flex h-32 items-center justify-center text-zinc-500">暂无指标数据</div>
            ) : rsiOption ? (
              <ReactECharts option={rsiOption} className="h-[180px]" theme="dark" />
            ) : null}
          </TabsContent>
        </Tabs>
      </div>

      <Separator className="my-4" />

      <div className="py-2">
        <div className="mb-3 text-sm font-semibold text-zinc-500">信号历史</div>
        {signalHistory.length === 0 ? (
          <div className="text-sm text-zinc-500">暂无信号记录</div>
        ) : (
          <div className="flex flex-col gap-2">
            {signalHistory.map((sig, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="font-mono text-zinc-500">{sig.date}</span>
                <Badge
                  variant={
                    sig.signal_type === 'BUY'
                      ? 'buy'
                      : sig.signal_type === 'SELL'
                        ? 'sell'
                        : 'watch'
                  }
                >
                  {SIGNAL_LABELS[sig.signal_type]}
                </Badge>
                <span className="font-mono text-zinc-50">{sig.price.toFixed(2)}</span>
                {sig.indicators.rsi !== undefined && (
                  <span className="text-zinc-500">RSI {sig.indicators.rsi.toFixed(1)}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
