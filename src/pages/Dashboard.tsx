import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, type Market } from '../api/client'

type SortKey = 'date' | 'rsi' | 'price'

const MARKET_TABS: { label: string; value: Market }[] = [
  { label: '全部', value: 'ALL' },
  { label: '沪深', value: 'CN' },
  { label: '美股', value: 'US' },
]

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

function MarketBadge({ market }: { market: string }) {
  return (
    <span
      className="rounded px-2 py-0.5 text-xs font-semibold"
      style={{
        background: market === 'CN' ? '#ef444422' : '#3b82f622',
        color: market === 'CN' ? '#ef4444' : '#3b82f6',
      }}
    >
      {market === 'CN' ? '沪深' : '美股'}
    </span>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [market, setMarket] = useState<Market>('ALL')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortAsc, setSortAsc] = useState(false)

  const {
    data: signals = [],
    isLoading,
    isError,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['signals', market],
    queryFn: () => api.getSignals(market),
    staleTime: 5 * 60 * 1000,
  })

  const hasStale = signals.some((signal) => signal.stale)

  const sorted = [...signals].sort((a, b) => {
    let cmp = 0

    if (sortKey === 'date') cmp = a.date.localeCompare(b.date)
    else if (sortKey === 'rsi') cmp = (a.indicators.rsi ?? 0) - (b.indicators.rsi ?? 0)
    else if (sortKey === 'price') cmp = a.price - b.price

    return sortAsc ? cmp : -cmp
  })

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((ascending) => !ascending)
    else {
      setSortKey(key)
      setSortAsc(false)
    }
  }

  const SortIcon = ({ k }: { k: SortKey }) => (sortKey === k ? (sortAsc ? ' ↑' : ' ↓') : '')

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>
          信号看板
        </h1>
        {dataUpdatedAt > 0 && (
          <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
            更新于 {new Date(dataUpdatedAt).toLocaleTimeString('zh-CN')}
          </span>
        )}
      </div>

      {hasStale && (
        <div
          className="mb-4 rounded px-4 py-2 text-sm"
          style={{
            background: '#f59e0b22',
            color: 'var(--color-watch)',
            border: '1px solid #f59e0b44',
          }}
        >
          ⚠️ 部分数据未及时更新，显示最近已知数据
        </div>
      )}

      <div className="mb-4 flex gap-2">
        {MARKET_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setMarket(tab.value)}
            className="rounded px-4 py-1.5 text-sm transition-colors"
            style={{
              background: market === tab.value ? 'var(--color-primary)' : 'var(--color-surface)',
              color: market === tab.value ? '#000' : 'var(--color-text)',
              border: `1px solid ${market === tab.value ? 'var(--color-primary)' : 'var(--color-border)'}`,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <SkeletonTable />
      ) : isError ? (
        <div className="rounded p-4" style={{ background: '#ef444422', color: '#ef4444' }}>
          加载失败，请检查后端服务是否启动
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--color-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr
                style={{
                  background: 'var(--color-surface)',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <Th>股票代码</Th>
                <Th>市场</Th>
                <Th>信号</Th>
                <Th onClick={() => handleSort('date')} sortable>
                  日期{SortIcon({ k: 'date' })}
                </Th>
                <Th onClick={() => handleSort('price')} sortable>
                  价格{SortIcon({ k: 'price' })}
                </Th>
                <Th>MACD</Th>
                <Th onClick={() => handleSort('rsi')} sortable>
                  RSI{SortIcon({ k: 'rsi' })}
                </Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((sig, index) => (
                <tr
                  key={sig.ticker + sig.date}
                  onClick={() => navigate(`/stock/${sig.ticker}`)}
                  className="cursor-pointer transition-colors"
                  style={{
                    background: index % 2 === 0 ? 'transparent' : 'var(--color-surface)44',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.background = 'var(--color-primary)11'
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.background =
                      index % 2 === 0 ? 'transparent' : 'var(--color-surface)44'
                  }}
                >
                  <td className="px-4 py-3 font-mono font-semibold">{sig.ticker}</td>
                  <td className="px-4 py-3">
                    <MarketBadge market={sig.market} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold" style={{ color: SIGNAL_COLORS[sig.signal_type] }}>
                      {SIGNAL_LABELS[sig.signal_type] ?? sig.signal_type}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-muted)' }}>
                    {sig.date}
                  </td>
                  <td className="px-4 py-3">{sig.price.toFixed(2)}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-muted)' }}>
                    {sig.indicators.macd?.toFixed(2) ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <RsiCell rsi={sig.indicators.rsi} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sorted.length === 0 && (
            <div className="p-8 text-center" style={{ color: 'var(--color-muted)' }}>
              暂无信号数据
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Th({
  children,
  onClick,
  sortable,
}: {
  children: React.ReactNode
  onClick?: () => void
  sortable?: boolean
}) {
  return (
    <th
      className={`px-4 py-3 text-left font-semibold ${sortable ? 'cursor-pointer select-none hover:opacity-80' : ''}`}
      style={{ color: 'var(--color-muted)' }}
      onClick={onClick}
    >
      {children}
    </th>
  )
}

function RsiCell({ rsi }: { rsi?: number }) {
  if (rsi === undefined) return <span style={{ color: 'var(--color-muted)' }}>—</span>

  const color =
    rsi > 70 ? 'var(--color-sell)' : rsi < 30 ? 'var(--color-buy)' : 'var(--color-text)'

  return <span style={{ color }}>{rsi.toFixed(1)}</span>
}

function SkeletonTable() {
  return (
    <div className="overflow-hidden rounded-lg" style={{ border: '1px solid var(--color-border)' }}>
      {[...Array(5)].map((_, index) => (
        <div
          key={index}
          className="h-12 animate-pulse"
          style={{
            background: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border)',
            opacity: 1 - index * 0.15,
          }}
        />
      ))}
    </div>
  )
}
