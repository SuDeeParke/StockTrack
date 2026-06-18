import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  api,
  type AccountBalance,
  type Order,
  type OrderRequest,
  type OrderSide,
  type Position,
  type RiskCheckResult,
} from '../api/client'

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
          color: b.daily_pnl >= 0 ? 'var(--color-buy)' : 'var(--color-sell)',
        },
      ].map(({ label, value, color }) => (
        <div
          key={label}
          className="rounded-lg p-4"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div className="mb-1 text-xs" style={{ color: 'var(--color-muted)' }}>
            {label}
          </div>
          <div className="font-mono text-lg font-bold" style={{ color: color ?? 'var(--color-text)' }}>
            {value}
          </div>
        </div>
      ))}
    </div>
  )
}

function PositionsTab({ positions }: { positions: Position[] }) {
  if (positions.length === 0) {
    return (
      <div className="py-16 text-center" style={{ color: 'var(--color-muted)' }}>
        暂无持仓
      </div>
    )
  }

  return (
    <div className="overflow-auto rounded-lg" style={{ border: '1px solid var(--color-border)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
            {['代码', '名称', '市场', '持仓', '成本', '现价', '市值', '盈亏', '盈亏%'].map((header) => (
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
          {positions.map((position) => (
            <tr
              key={`${position.market}:${position.ticker}`}
              style={{ borderBottom: '1px solid var(--color-border)22' }}
            >
              <td className="px-3 py-2 font-mono">{position.ticker}</td>
              <td className="px-3 py-2">{position.name}</td>
              <td className="px-3 py-2">
                <span
                  className="rounded px-2 py-0.5 text-xs font-semibold"
                  style={{
                    background: position.market === 'CN' ? '#ef444422' : '#3b82f622',
                    color: position.market === 'CN' ? '#ef4444' : '#3b82f6',
                  }}
                >
                  {position.market}
                </span>
              </td>
              <td className="px-3 py-2">{position.qty}</td>
              <td className="px-3 py-2">{position.avg_cost.toFixed(2)}</td>
              <td className="px-3 py-2">{position.current_price.toFixed(2)}</td>
              <td className="px-3 py-2 font-mono">¥{position.market_value.toLocaleString()}</td>
              <td
                className="px-3 py-2 font-mono"
                style={{ color: position.pnl >= 0 ? 'var(--color-buy)' : 'var(--color-sell)' }}
              >
                {position.pnl >= 0 ? '+' : ''}¥{position.pnl.toFixed(2)}
              </td>
              <td
                className="px-3 py-2 font-mono"
                style={{ color: position.pnl_pct >= 0 ? 'var(--color-buy)' : 'var(--color-sell)' }}
              >
                {position.pnl_pct >= 0 ? '+' : ''}
                {position.pnl_pct.toFixed(2)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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

  const inputStyle = {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text)',
    borderRadius: 6,
    padding: '6px 10px',
    fontSize: 13,
  }

  const riskMutation = useMutation({
    mutationFn: (req: OrderRequest) => api.riskCheck(req),
    onSuccess: (result) => {
      setError('')
      setSubmitted(null)
      setRiskResult(result)
    },
    onError: (e: any) => {
      setRiskResult(null)
      setError(e?.response?.data?.detail ?? '风控检查失败')
    },
  })

  const orderMutation = useMutation({
    mutationFn: (req: OrderRequest) => api.placeOrder(req),
    onSuccess: (order) => {
      setSubmitted(order)
      setRiskResult(null)
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['positions'] })
      queryClient.invalidateQueries({ queryKey: ['balance'] })
    },
    onError: (e: any) => setError(e?.response?.data?.detail ?? '下单失败'),
  })

  const buildReq = (): OrderRequest => ({
    ticker,
    market,
    side,
    qty: Number(qty),
    price: Number(price),
    paper_trade: true,
  })

  const handleCheck = () => {
    setSubmitted(null)
    setError('')
    riskMutation.mutate(buildReq())
  }

  const handleConfirm = () => {
    setError('')
    orderMutation.mutate(buildReq())
  }

  return (
    <div className="max-w-md">
      <h2 className="mb-4 text-lg font-bold" style={{ color: 'var(--color-text)' }}>
        模拟下单
      </h2>
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <div className="mb-1 text-xs" style={{ color: 'var(--color-muted)' }}>
              代码
            </div>
            <input value={ticker} onChange={(e) => setTicker(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
          </div>
          <div>
            <div className="mb-1 text-xs" style={{ color: 'var(--color-muted)' }}>
              市场
            </div>
            <select
              value={market}
              onChange={(e) => setMarket(e.target.value as 'CN' | 'US')}
              style={inputStyle}
            >
              <option value="CN">CN</option>
              <option value="US">US</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <div className="mb-1 text-xs" style={{ color: 'var(--color-muted)' }}>
              方向
            </div>
            <div className="flex gap-2">
              {(['BUY', 'SELL'] as const).map((currentSide) => (
                <button
                  key={currentSide}
                  type="button"
                  onClick={() => setSide(currentSide)}
                  className="flex-1 rounded py-1.5 text-sm font-semibold transition-colors"
                  style={{
                    background:
                      side === currentSide
                        ? currentSide === 'BUY'
                          ? 'var(--color-buy)'
                          : 'var(--color-sell)'
                        : 'var(--color-surface)',
                    color: side === currentSide ? '#000' : 'var(--color-muted)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  {currentSide === 'BUY' ? '买入' : '卖出'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <div className="mb-1 text-xs" style={{ color: 'var(--color-muted)' }}>
              数量
            </div>
            <input
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              style={{ ...inputStyle, width: '100%' }}
            />
          </div>
          <div className="flex-1">
            <div className="mb-1 text-xs" style={{ color: 'var(--color-muted)' }}>
              价格
            </div>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              style={{ ...inputStyle, width: '100%' }}
            />
          </div>
        </div>

        <div className="rounded px-2 py-1 text-xs" style={{ background: '#f59e0b22', color: '#f59e0b' }}>
          模拟交易模式，不会产生真实交易
        </div>

        <button
          type="button"
          onClick={handleCheck}
          disabled={riskMutation.isPending}
          className="rounded py-2 text-sm font-semibold"
          style={{
            background: 'var(--color-surface)',
            color: 'var(--color-primary)',
            border: '1px solid var(--color-primary)',
          }}
        >
          风控检查
        </button>

        {riskResult && !riskResult.passed && (
          <div
            className="rounded p-3 text-sm"
            style={{
              background: '#ef444422',
              color: '#ef4444',
              border: '1px solid #ef444444',
            }}
          >
            风控拒绝：{riskResult.reason}
          </div>
        )}

        {riskResult?.passed && !submitted && (
          <div className="flex flex-col gap-2">
            <div
              className="rounded p-3 text-sm"
              style={{
                background: '#22c55e22',
                color: '#22c55e',
                border: '1px solid #22c55e44',
              }}
            >
              风控通过，确认提交？
            </div>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={orderMutation.isPending}
              className="rounded py-2 text-sm font-semibold"
              style={{
                background: side === 'BUY' ? 'var(--color-buy)' : 'var(--color-sell)',
                color: '#000',
              }}
            >
              确认{side === 'BUY' ? '买入' : '卖出'} {qty} 股 @ {price}
            </button>
          </div>
        )}

        {submitted && (
          <div
            className="rounded p-3 text-sm"
            style={{
              background: '#22c55e22',
              color: '#22c55e',
              border: '1px solid #22c55e44',
            }}
          >
            下单成功，订单 #{submitted.order_id.slice(0, 8)} 状态：{submitted.status}
          </div>
        )}

        {error && (
          <div className="rounded p-3 text-sm" style={{ background: '#ef444422', color: '#ef4444' }}>
            错误：{error}
          </div>
        )}
      </div>
    </div>
  )
}

function OrderHistoryTab({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return (
      <div className="py-16 text-center" style={{ color: 'var(--color-muted)' }}>
        暂无订单记录
      </div>
    )
  }

  return (
    <div className="overflow-auto rounded-lg" style={{ border: '1px solid var(--color-border)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
            {['订单号', '代码', '方向', '数量', '价格', '状态', '成交价', '时间'].map((header) => (
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
          {orders.map((order) => (
            <tr key={order.order_id} style={{ borderBottom: '1px solid var(--color-border)22' }}>
              <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--color-muted)' }}>
                {order.order_id.slice(0, 8)}
              </td>
              <td className="px-3 py-2 font-mono">{order.ticker}</td>
              <td
                className="px-3 py-2 font-semibold"
                style={{ color: order.side === 'BUY' ? 'var(--color-buy)' : 'var(--color-sell)' }}
              >
                {order.side === 'BUY' ? '买入' : '卖出'}
              </td>
              <td className="px-3 py-2">{order.qty}</td>
              <td className="px-3 py-2">{order.price.toFixed(2)}</td>
              <td className="px-3 py-2">
                <span
                  className="rounded px-1.5 py-0.5 text-xs font-semibold"
                  style={{
                    background:
                      order.status === 'FILLED'
                        ? '#22c55e22'
                        : order.status === 'REJECTED'
                          ? '#ef444422'
                          : '#f59e0b22',
                    color:
                      order.status === 'FILLED'
                        ? '#22c55e'
                        : order.status === 'REJECTED'
                          ? '#ef4444'
                          : '#f59e0b',
                  }}
                >
                  {order.status}
                </span>
              </td>
              <td className="px-3 py-2">{order.filled_price ? order.filled_price.toFixed(2) : '-'}</td>
              <td className="px-3 py-2 text-xs" style={{ color: 'var(--color-muted)' }}>
                {order.created_at.slice(0, 19)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Trade() {
  const [searchParams] = useSearchParams()
  const hasOrderPrefill = searchParams.has('ticker') || searchParams.has('side')
  const [tab, setTab] = useState<Tab>(hasOrderPrefill ? 'order' : 'positions')

  useEffect(() => {
    if (searchParams.has('ticker') || searchParams.has('side')) {
      setTab('order')
    }
  }, [searchParams])

  const { data: positions = [] } = useQuery({
    queryKey: ['positions'],
    queryFn: () => api.getPositions(),
  })
  const { data: balance } = useQuery({
    queryKey: ['balance'],
    queryFn: () => api.getBalance(),
  })
  const { data: orders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: () => api.getOrders(),
  })

  const tabs: { id: Tab; label: string }[] = [
    { id: 'positions', label: `持仓（${positions.length}）` },
    { id: 'order', label: '下单' },
    { id: 'history', label: `历史订单（${orders.length}）` },
  ]

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>
        交易面板
      </h1>

      {balance && <BalanceCard b={balance} />}

      <div className="mb-6 flex gap-1" style={{ borderBottom: '1px solid var(--color-border)' }}>
        {tabs.map((currentTab) => (
          <button
            key={currentTab.id}
            type="button"
            onClick={() => setTab(currentTab.id)}
            className="px-4 py-2 text-sm font-semibold transition-colors"
            style={{
              color: tab === currentTab.id ? 'var(--color-primary)' : 'var(--color-muted)',
              borderBottom:
                tab === currentTab.id
                  ? '2px solid var(--color-primary)'
                  : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {currentTab.label}
          </button>
        ))}
      </div>

      {tab === 'positions' && <PositionsTab positions={positions} />}
      {tab === 'order' && <OrderTab />}
      {tab === 'history' && <OrderHistoryTab orders={orders} />}
    </div>
  )
}
