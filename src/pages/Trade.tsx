import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  api,
  type AccountBalance,
  type Order,
  type OrderRequest,
  type OrderSide,
  type UserPositionWithDerived,
  type RiskCheckResult,
} from '../api/client'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Input } from '../components/ui/input'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../components/ui/select'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../components/ui/table'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'

type Tab = 'positions' | 'order' | 'history'

function BalanceCard({ b }: { b: AccountBalance }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
      {[
        { label: '总资产', value: `¥${b.total_assets.toLocaleString()}` },
        { label: '现金', value: `¥${b.cash.toLocaleString()}` },
        { label: '持仓市值', value: `¥${b.market_value.toLocaleString()}` },
        {
          label: '今日盈亏',
          value: `${b.daily_pnl >= 0 ? '+' : ''}¥${b.daily_pnl.toLocaleString()} (${b.daily_pnl_pct.toFixed(2)}%)`,
          pnl: b.daily_pnl,
        },
      ].map(({ label, value, pnl }) => (
        <Card key={label}>
          <CardHeader>
            <CardTitle>{label}</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`font-mono text-lg font-bold ${
                pnl !== undefined
                  ? pnl >= 0
                    ? 'text-emerald-400'
                    : 'text-rose-400'
                  : 'text-zinc-50'
              }`}
            >
              {value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function PositionsTab({ positions }: { positions: UserPositionWithDerived[] }) {
  if (positions.length === 0) {
    return <div className="py-16 text-center text-zinc-500">暂无持仓</div>
  }

  return (
    <div className="overflow-x-auto">
    <Table>
      <TableHeader>
        <TableRow>
          {['代码', '名称', '市场', '持仓', '成本', '现价', '市值', '盈亏', '盈亏%'].map((h) => (
            <TableHead key={h}>{h}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {positions.map((p) => (
          <TableRow key={`${p.market}:${p.ticker}`}>
            <TableCell className="font-mono">{p.ticker}</TableCell>
            <TableCell>{p.name}</TableCell>
            <TableCell>
              <Badge variant={p.market === 'CN' ? 'cn' : 'us'}>{p.market}</Badge>
            </TableCell>
            <TableCell>{p.shares}</TableCell>
            <TableCell className="font-mono">{p.cost_basis.toFixed(2)}</TableCell>
            <TableCell className="font-mono">{p.current_price.toFixed(2)}</TableCell>
            <TableCell className="font-mono">¥{p.market_value.toLocaleString()}</TableCell>
            <TableCell className={`font-mono ${p.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {p.pnl >= 0 ? '+' : ''}¥{p.pnl.toFixed(2)}
            </TableCell>
            <TableCell className={`font-mono ${p.pnl_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {p.pnl_pct >= 0 ? '+' : ''}{p.pnl_pct.toFixed(2)}%
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </div>
  )
}

function OrderTab() {
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const [ticker, setTicker] = useState(searchParams.get('ticker') ?? '600519.SH')
  const [market, setMarket] = useState<'CN' | 'US'>('CN')
  const [side, setSide] = useState<OrderSide>(searchParams.get('side') === 'SELL' ? 'SELL' : 'BUY')
  const [qty, setQty] = useState('100')
  const [price, setPrice] = useState('1750.00')
  const [riskResult, setRiskResult] = useState<RiskCheckResult | null>(null)
  const [submitted, setSubmitted] = useState<Order | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const nextTicker = searchParams.get('ticker')
    const nextSide = searchParams.get('side')
    if (nextTicker) setTicker(nextTicker)
    if (nextSide === 'BUY' || nextSide === 'SELL') setSide(nextSide)
  }, [searchParams])

  const riskMutation = useMutation({
    mutationFn: (req: OrderRequest) => api.riskCheck(req),
    onSuccess: (result) => { setError(''); setSubmitted(null); setRiskResult(result) },
    onError: (e: any) => { setRiskResult(null); setError(e?.response?.data?.detail ?? '风控检查失败') },
  })

  const orderMutation = useMutation({
    mutationFn: (req: OrderRequest) => api.placeOrder(req),
    onSuccess: (order) => {
      setSubmitted(order)
      setRiskResult(null)
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['positions'] })
      queryClient.invalidateQueries({ queryKey: ['balance'] })
      queryClient.invalidateQueries({ queryKey: ['positions-signals'] })
      queryClient.invalidateQueries({ queryKey: ['signals'] })
    },
    onError: (e: any) => setError(e?.response?.data?.detail ?? '下单失败'),
  })

  const buildReq = (): OrderRequest => ({
    ticker, market, side, qty: Number(qty), price: Number(price), paper_trade: true,
  })

  return (
    <div className="max-w-md">
      <h2 className="mb-4 text-lg font-bold text-zinc-50">模拟下单</h2>
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <div className="mb-1 text-xs text-zinc-500">代码</div>
            <Input value={ticker} onChange={(e) => setTicker(e.target.value)} />
          </div>
          <div>
            <div className="mb-1 text-xs text-zinc-500">市场</div>
            <Select value={market} onValueChange={(v) => setMarket(v as 'CN' | 'US')}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CN">CN</SelectItem>
                <SelectItem value="US">US</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <div className="mb-1 text-xs text-zinc-500">方向</div>
          <div className="flex gap-2">
            {(['BUY', 'SELL'] as const).map((s) => (
              <Button
                key={s}
                type="button"
                variant={side === s ? 'default' : 'outline'}
                className={`flex-1 ${
                  side === s && s === 'BUY' ? 'bg-emerald-500 hover:bg-emerald-500/90 text-zinc-950' : ''
                } ${side === s && s === 'SELL' ? 'bg-rose-500 hover:bg-rose-500/90 text-zinc-50' : ''}`}
                onClick={() => setSide(s)}
              >
                {s === 'BUY' ? '买入' : '卖出'}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <div className="mb-1 text-xs text-zinc-500">数量</div>
            <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div className="flex-1">
            <div className="mb-1 text-xs text-zinc-500">价格</div>
            <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
        </div>

        <Alert variant="warning">
          <AlertDescription>模拟交易模式，不会产生真实交易</AlertDescription>
        </Alert>

        <Button
          type="button"
          variant="outline"
          onClick={() => { setSubmitted(null); setError(''); riskMutation.mutate(buildReq()) }}
          disabled={riskMutation.isPending}
        >
          风控检查
        </Button>

        {riskResult && !riskResult.passed && (
          <Alert variant="destructive">
            <AlertDescription>风控拒绝：{riskResult.reason}</AlertDescription>
          </Alert>
        )}

        {riskResult?.passed && !submitted && (
          <div className="flex flex-col gap-2">
            <Alert>
              <AlertDescription>风控通过，确认提交？</AlertDescription>
            </Alert>
            <Button
              type="button"
              className={side === 'BUY' ? 'bg-emerald-500 hover:bg-emerald-500/90 text-zinc-950' : 'bg-rose-500 hover:bg-rose-500/90 text-zinc-50'}
              onClick={() => { setError(''); orderMutation.mutate(buildReq()) }}
              disabled={orderMutation.isPending}
            >
              确认{side === 'BUY' ? '买入' : '卖出'} {qty} 股 @ {price}
            </Button>
          </div>
        )}

        {submitted && (
          <Alert>
            <AlertDescription>
              下单成功，订单 #{submitted.order_id.slice(0, 8)} 状态：{submitted.status}
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>错误：{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  )
}

function OrderHistoryTab({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return <div className="py-16 text-center text-zinc-500">暂无订单记录</div>
  }

  return (
    <div className="overflow-x-auto">
    <Table>
      <TableHeader>
        <TableRow>
          {['订单号', '代码', '方向', '数量', '价格', '状态', '成交价', '时间'].map((h) => (
            <TableHead key={h}>{h}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.order_id}>
            <TableCell className="font-mono text-xs text-zinc-500">
              {order.order_id.slice(0, 8)}
            </TableCell>
            <TableCell className="font-mono">{order.ticker}</TableCell>
            <TableCell>
              <Badge variant={order.side === 'BUY' ? 'buy' : 'sell'}>
                {order.side === 'BUY' ? '买入' : '卖出'}
              </Badge>
            </TableCell>
            <TableCell>{order.qty}</TableCell>
            <TableCell className="font-mono">{order.price.toFixed(2)}</TableCell>
            <TableCell>
              <Badge
                variant={
                  order.status === 'FILLED'
                    ? 'buy'
                    : order.status === 'REJECTED'
                      ? 'sell'
                      : 'watch'
                }
              >
                {order.status}
              </Badge>
            </TableCell>
            <TableCell className="font-mono">
              {order.filled_price ? order.filled_price.toFixed(2) : '-'}
            </TableCell>
            <TableCell className="text-xs text-zinc-500">
              {order.created_at.slice(0, 19)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </div>
  )
}

export default function Trade() {
  const [searchParams] = useSearchParams()
  const hasOrderPrefill = searchParams.has('ticker') || searchParams.has('side')
  const [tab, setTab] = useState<Tab>(hasOrderPrefill ? 'order' : 'positions')

  useEffect(() => {
    if (searchParams.has('ticker') || searchParams.has('side')) setTab('order')
  }, [searchParams])

  const { data: positions = [] } = useQuery({
    queryKey: ['positions'],
    queryFn: () => api.listPositions(),
  })
  const { data: balance } = useQuery({
    queryKey: ['balance'],
    queryFn: () => api.getBalance(),
  })
  const { data: orders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: () => api.getOrders(),
  })

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-zinc-50">交易面板</h1>

      {balance && <BalanceCard b={balance} />}

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="positions">持仓（{positions.length}）</TabsTrigger>
          <TabsTrigger value="order">下单</TabsTrigger>
          <TabsTrigger value="history">历史订单（{orders.length}）</TabsTrigger>
        </TabsList>
        <TabsContent value="positions">
          <PositionsTab positions={positions} />
        </TabsContent>
        <TabsContent value="order">
          <OrderTab />
        </TabsContent>
        <TabsContent value="history">
          <OrderHistoryTab orders={orders} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
