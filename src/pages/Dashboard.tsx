import { useState, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpDown } from 'lucide-react'
import { api, type Market, type SignalType } from '../api/client'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Skeleton } from '../components/ui/skeleton'
import { Alert, AlertDescription } from '../components/ui/alert'
import { cn } from '../lib/utils'

type SortKey = 'date' | 'rsi' | 'price'

const MARKET_TABS: { label: string; value: Market }[] = [
  { label: '全部', value: 'ALL' },
  { label: '沪深', value: 'CN' },
  { label: '美股', value: 'US' },
]

const SIGNAL_LABELS: Record<string, string> = {
  BUY: '买入',
  SELL: '卖出',
  WATCH: '观察',
}

const ORDERABLE_SIGNAL_TYPES: SignalType[] = ['BUY', 'SELL']
const SKELETON_OPACITY_CLASSES = [
  'opacity-100',
  'opacity-85',
  'opacity-70',
  'opacity-55',
  'opacity-40',
]

function MarketBadge({ market }: { market: string }) {
  return (
    <Badge variant={market === 'CN' ? 'cn' : 'us'}>
      {market === 'CN' ? '沪深' : '美股'}
    </Badge>
  )
}

function SignalBadge({ type }: { type: string }) {
  const variant = type === 'BUY' ? 'buy' : type === 'SELL' ? 'sell' : 'watch'
  return (
    <Badge variant={variant as 'buy' | 'sell' | 'watch'}>
      {SIGNAL_LABELS[type] ?? type}
    </Badge>
  )
}

function RsiCell({ rsi }: { rsi?: number }) {
  if (rsi === undefined) return <span className="text-zinc-600">—</span>

  const cls =
    rsi > 70
      ? 'text-rose-400'
      : rsi < 30
        ? 'text-emerald-400'
        : 'text-zinc-300'

  return <span className={cn('font-mono', cls)}>{rsi.toFixed(1)}</span>
}

function SkeletonTable() {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800">
      {SKELETON_OPACITY_CLASSES.map((opacityClass) => (
        <Skeleton key={opacityClass} className={cn('h-12 w-full rounded-none', opacityClass)} />
      ))}
    </div>
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
    if (sortKey === key) setSortAsc((asc) => !asc)
    else {
      setSortKey(key)
      setSortAsc(false)
    }
  }

  const handleTrade = (
    event: MouseEvent<HTMLButtonElement>,
    ticker: string,
    side: 'BUY' | 'SELL',
  ) => {
    event.stopPropagation()
    navigate(`/trade?ticker=${encodeURIComponent(ticker)}&side=${side}`)
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-zinc-50">信号看板</h1>
        {dataUpdatedAt > 0 && (
          <span className="text-xs text-zinc-500">
            更新于 {new Date(dataUpdatedAt).toLocaleTimeString('zh-CN')}
          </span>
        )}
      </div>

      {hasStale && (
        <Alert variant="warning" className="mb-4">
          <AlertDescription>⚠️ 部分数据未及时更新，显示最近已知数据</AlertDescription>
        </Alert>
      )}

      <Tabs
        value={market}
        onValueChange={(value) => setMarket(value as Market)}
        className="w-full"
      >
        <TabsList className="mb-4 w-auto">
          {MARKET_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={market} className="mt-0">
          {isLoading ? (
            <SkeletonTable />
          ) : isError ? (
            <Alert variant="destructive">
              <AlertDescription>加载失败，请检查后端服务是否启动</AlertDescription>
            </Alert>
          ) : (
            <>
              {/* 桌面表格：md 以上显示 */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>股票代码</TableHead>
                      <TableHead>名称</TableHead>
                      <TableHead>市场</TableHead>
                      <TableHead>信号</TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 text-xs font-medium uppercase tracking-wider text-zinc-500"
                          onClick={() => handleSort('date')}
                        >
                          日期 <ArrowUpDown className="ml-1 h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 text-xs font-medium uppercase tracking-wider text-zinc-500"
                          onClick={() => handleSort('price')}
                        >
                          价格 <ArrowUpDown className="ml-1 h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead>MACD</TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 text-xs font-medium uppercase tracking-wider text-zinc-500"
                          onClick={() => handleSort('rsi')}
                        >
                          RSI <ArrowUpDown className="ml-1 h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map((sig) => (
                      <TableRow
                        key={sig.ticker + sig.date}
                        onClick={() => navigate(`/stock/${sig.ticker}`)}
                        className="cursor-pointer"
                      >
                        <TableCell className="font-mono font-semibold text-zinc-50">
                          {sig.ticker}
                        </TableCell>
                        <TableCell className="text-zinc-300">
                          {sig.name ?? '—'}
                        </TableCell>
                        <TableCell>
                          <MarketBadge market={sig.market} />
                        </TableCell>
                        <TableCell>
                          <SignalBadge type={sig.signal_type} />
                        </TableCell>
                        <TableCell className="font-mono text-zinc-500">{sig.date}</TableCell>
                        <TableCell className="font-mono">{sig.price.toFixed(2)}</TableCell>
                        <TableCell className="font-mono text-zinc-500">
                          {sig.indicators.macd?.toFixed(2) ?? '—'}
                        </TableCell>
                        <TableCell>
                          <RsiCell rsi={sig.indicators.rsi} />
                        </TableCell>
                        <TableCell>
                          {ORDERABLE_SIGNAL_TYPES.includes(sig.signal_type) ? (
                            <Button
                              size="sm"
                              variant={sig.signal_type === 'BUY' ? 'default' : 'destructive'}
                              className={
                                sig.signal_type === 'BUY'
                                  ? 'bg-emerald-500 text-zinc-950 hover:bg-emerald-500/90'
                                  : undefined
                              }
                              onClick={(event) =>
                                handleTrade(event, sig.ticker, sig.signal_type as 'BUY' | 'SELL')
                              }
                            >
                              下单
                            </Button>
                          ) : (
                            <span className="text-xs text-zinc-600">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* 移动端卡片列表：md 以下显示 */}
              <div className="flex flex-col gap-2 md:hidden">
                {sorted.map((sig) => (
                  <div
                    key={sig.ticker + sig.date}
                    onClick={() => navigate(`/stock/${sig.ticker}`)}
                    className="cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900/60 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-mono text-sm font-semibold text-zinc-50">
                          {sig.name ?? sig.ticker}
                        </div>
                        <div className="font-mono text-xs text-zinc-500">{sig.ticker}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MarketBadge market={sig.market} />
                        <SignalBadge type={sig.signal_type} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-base font-bold text-zinc-50">
                          {sig.price.toFixed(2)}
                        </span>
                        <span className="font-mono text-xs text-zinc-500">{sig.date}</span>
                        {sig.indicators.rsi !== undefined && (
                          <span className="text-xs text-zinc-500">
                            RSI <RsiCell rsi={sig.indicators.rsi} />
                          </span>
                        )}
                      </div>
                      {ORDERABLE_SIGNAL_TYPES.includes(sig.signal_type) && (
                        <Button
                          size="sm"
                          variant={sig.signal_type === 'BUY' ? 'default' : 'destructive'}
                          className={
                            sig.signal_type === 'BUY'
                              ? 'bg-emerald-500 text-zinc-950 hover:bg-emerald-500/90'
                              : undefined
                          }
                          onClick={(event) =>
                            handleTrade(event, sig.ticker, sig.signal_type as 'BUY' | 'SELL')
                          }
                        >
                          下单
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {sorted.length === 0 && (
                <div className="p-8 text-center text-zinc-500">暂无信号数据</div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
