import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2, Plus } from 'lucide-react'
import * as React from 'react'

import { api, type UserPositionWithDerived } from '../api/client'
import { useMediaQuery } from '../hooks/use-media-query'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Badge } from '../components/ui/badge'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Checkbox } from '../components/ui/checkbox'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/alert-dialog'
import { cn } from '../lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PositionFormValues {
  ticker: string
  name: string
  market: 'CN' | 'US'
  shares: string
  cost_basis: string
  note: string
}

type Mode = 'create' | 'edit'

interface PositionFormProps {
  mode: Mode
  initial?: PositionFormValues
  editId?: number
  onSuccess: () => void
  onCancel: () => void
}

interface DeleteConfirmProps {
  ticker: string
  id: number
  onSuccess: () => void
  trigger: React.ReactNode
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY_FORM: PositionFormValues = {
  ticker: '',
  name: '',
  market: 'US',
  shares: '',
  cost_basis: '',
  note: '',
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '-'
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatShares(value: number): string {
  return value.toLocaleString('zh-CN')
}

function inferMarket(ticker: string): 'CN' | 'US' {
  return /^\d{6}(\.(SH|SZ))?$/.test(ticker) ? 'CN' : 'US'
}

// ---------------------------------------------------------------------------
// PositionForm
// ---------------------------------------------------------------------------

function PositionForm({
  mode,
  initial,
  editId,
  onSuccess,
  onCancel,
}: PositionFormProps) {
  const queryClient = useQueryClient()
  const [values, setValues] = useState<PositionFormValues>(
    initial ?? EMPTY_FORM,
  )
  const [error, setError] = useState<string | null>(null)
  const [sharesError, setSharesError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: (data: {
      ticker: string
      name: string
      market: 'CN' | 'US'
      shares: number
      cost_basis: number
      note: string
    }) => api.createPosition(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions'] })
      queryClient.invalidateQueries({ queryKey: ['positions-signals'] })
      queryClient.invalidateQueries({ queryKey: ['signals'] })
      onSuccess()
    },
    onError: (err: Error) => {
      const detail = (err as { response?: { data?: { detail?: string } } })
        .response?.data?.detail
      setError(detail ?? err.message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: {
      id: number
      ticker: string
      name: string
      market: 'CN' | 'US'
      shares: number
      cost_basis: number
      note: string
    }) => api.updatePosition(data.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions'] })
      queryClient.invalidateQueries({ queryKey: ['positions-signals'] })
      queryClient.invalidateQueries({ queryKey: ['signals'] })
      onSuccess()
    },
    onError: (err: Error) => {
      const detail = (err as { response?: { data?: { detail?: string } } })
        .response?.data?.detail
      setError(detail ?? err.message)
    },
  })

  const handleChange = useCallback(
    (field: keyof PositionFormValues, value: string) => {
      setValues((prev) => ({ ...prev, [field]: value }))
      if (field === 'shares') {
        setSharesError(null)
      }
    },
    [],
  )

  const handleTickerBlur = useCallback(() => {
    const ticker = values.ticker.trim()
    if (ticker) {
      const market = inferMarket(ticker)
      setValues((prev) => ({ ...prev, market }))
    }
  }, [values.ticker])

  const validateShares = useCallback(
    (shares: number): string | null => {
      if (values.market === 'CN') {
        if (shares < 100 || shares % 100 !== 0) {
          return 'A 股数量需为 100 的整数倍且不少于 100'
        }
      } else {
        if (shares < 1) {
          return '美股数量需不少于 1'
        }
      }
      return null
    },
    [values.market],
  )

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)

      const shares = Number(values.shares)
      if (!values.ticker.trim() && mode === 'create') {
        setError('代码不能为空')
        return
      }
      if (!values.name.trim()) {
        setError('名称不能为空')
        return
      }
      if (!values.shares.trim() || isNaN(shares) || shares <= 0) {
        setError('数量必须大于 0')
        return
      }

      const sharesErr = validateShares(shares)
      if (sharesErr) {
        setSharesError(sharesErr)
        return
      }

      const costBasis = Number(values.cost_basis)
      if (!values.cost_basis.trim() || isNaN(costBasis) || costBasis <= 0) {
        setError('成本必须大于 0')
        return
      }

      const payload = {
        ticker: values.ticker.trim(),
        name: values.name.trim(),
        market: values.market,
        shares,
        cost_basis: costBasis,
        note: values.note.trim(),
      }

      if (mode === 'create') {
        createMutation.mutate(payload)
      } else if (editId != null) {
        updateMutation.mutate({ id: editId, ...payload })
      }
    },
    [values, mode, editId, createMutation, updateMutation, validateShares],
  )

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="ticker">代码</Label>
          <Input
            id="ticker"
            placeholder="AAPL"
            value={values.ticker}
            onChange={(e) => handleChange('ticker', e.target.value)}
            onBlur={mode === 'create' ? handleTickerBlur : undefined}
            disabled={mode === 'edit'}
            required={mode === 'create'}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name">名称</Label>
          <Input
            id="name"
            placeholder="Apple Inc."
            value={values.name}
            onChange={(e) => handleChange('name', e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="market">市场</Label>
        <Select
          value={values.market}
          onValueChange={(v: 'CN' | 'US') =>
            handleChange('market', v)
          }
        >
          <SelectTrigger id="market">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="CN">A 股</SelectItem>
            <SelectItem value="US">美股</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="shares">数量</Label>
          <Input
            id="shares"
            type="number"
            step="1"
            min="1"
            placeholder={values.market === 'CN' ? '100' : '1'}
            value={values.shares}
            onChange={(e) => handleChange('shares', e.target.value)}
            required
          />
          {sharesError && (
            <p className="text-xs text-rose-400">{sharesError}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cost_basis">成本</Label>
          <Input
            id="cost_basis"
            type="number"
            step="any"
            min="0.01"
            placeholder="150.00"
            value={values.cost_basis}
            onChange={(e) => handleChange('cost_basis', e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="note">备注（可选）</Label>
        <Input
          id="note"
          placeholder="可选备注"
          value={values.note}
          onChange={(e) => handleChange('note', e.target.value)}
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit" disabled={isPending}>
          {mode === 'create' ? '添加' : '保存'}
        </Button>
      </DialogFooter>
    </form>
  )
}

// ---------------------------------------------------------------------------
// DeleteConfirm
// ---------------------------------------------------------------------------

function DeleteConfirm({ ticker, id, onSuccess, trigger }: DeleteConfirmProps) {
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: (posId: number) => api.deletePosition(posId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions'] })
      queryClient.invalidateQueries({ queryKey: ['positions-signals'] })
      queryClient.invalidateQueries({ queryKey: ['signals'] })
      onSuccess()
    },
  })

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除</AlertDialogTitle>
          <AlertDialogDescription>
            确认删除 {ticker}？
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteMutation.mutate(id)}
            disabled={deleteMutation.isPending}
          >
            删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ---------------------------------------------------------------------------
// BulkDeleteConfirm
// ---------------------------------------------------------------------------

interface BulkDeleteConfirmProps {
  selected: Set<number>
  positions: UserPositionWithDerived[]
  onSuccess: () => void
}

function BulkDeleteConfirm({
  selected,
  positions,
  onSuccess,
}: BulkDeleteConfirmProps) {
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: (ids: number[]) => api.bulkDeletePositions(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions'] })
      queryClient.invalidateQueries({ queryKey: ['positions-signals'] })
      queryClient.invalidateQueries({ queryKey: ['signals'] })
      onSuccess()
    },
  })

  const selectedPositions = positions.filter((p) => selected.has(p.id))
  const tickerList = selectedPositions.map((p) => p.ticker).join('、')

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          删除选中
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除</AlertDialogTitle>
          <AlertDialogDescription>
            确认删除以下 {selected.size} 项持仓？{tickerList}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteMutation.mutate([...selected])}
            disabled={deleteMutation.isPending}
          >
            删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ---------------------------------------------------------------------------
// Manage
// ---------------------------------------------------------------------------

export default function Manage() {
  const isDesktop = useMediaQuery('(min-width: 768px)')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<{
    id: number
    values: PositionFormValues
  } | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const {
    data: positions,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['positions'],
    queryFn: () => api.listPositions(),
  })

  const addButton = (
    <Button
      onClick={() => {
        setEditing(null)
        setDialogOpen(true)
      }}
    >
      <Plus className="mr-1 h-4 w-4" />
      添加持仓
    </Button>
  )

  const handleEdit = useCallback(
    (pos: UserPositionWithDerived) => {
      setEditing({
        id: pos.id,
        values: {
          ticker: pos.ticker,
          name: pos.name,
          market: pos.market,
          shares: String(pos.shares),
          cost_basis: String(pos.cost_basis),
          note: pos.note ?? '',
        },
      })
      setDialogOpen(true)
    },
    [],
  )

  const handleDialogClose = useCallback(() => {
    setDialogOpen(false)
    setEditing(null)
  }, [])

  const toggleSelect = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (!positions) return
    if (selected.size === positions.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(positions.map((p) => p.id)))
    }
  }, [positions, selected.size])

  const clearSelection = useCallback(() => setSelected(new Set()), [])

  const pnlClass = (val: number | null | undefined) =>
    val != null && val >= 0 ? 'text-emerald-400' : 'text-rose-400'

  const header = (
    <div className="flex items-center justify-between mb-4">
      <h1 className="text-2xl font-bold text-zinc-50">管理</h1>
      {addButton}
    </div>
  )

  // Add/Edit dialog rendered once; reachable from any list state.
  const formDialog = isDesktop ? (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? '编辑持仓' : '添加持仓'}</DialogTitle>
          <DialogDescription>
            {editing ? '修改持仓信息' : '输入新的持仓信息'}
          </DialogDescription>
        </DialogHeader>
        <PositionForm
          mode={editing ? 'edit' : 'create'}
          initial={editing?.values}
          editId={editing?.id}
          onSuccess={handleDialogClose}
          onCancel={handleDialogClose}
        />
      </DialogContent>
    </Dialog>
  ) : (
    <Sheet open={dialogOpen} onOpenChange={setDialogOpen}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>{editing ? '编辑持仓' : '添加持仓'}</SheetTitle>
          <SheetDescription>
            {editing ? '修改持仓信息' : '输入新的持仓信息'}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          <PositionForm
            mode={editing ? 'edit' : 'create'}
            initial={editing?.values}
            editId={editing?.id}
            onSuccess={handleDialogClose}
            onCancel={handleDialogClose}
          />
        </div>
      </SheetContent>
    </Sheet>
  )

  const selectionBar = positions && positions.length > 0 && selected.size > 0 ? (
    <div className="flex items-center gap-3 mb-3 px-1">
      <span className="text-sm text-zinc-400">已选 {selected.size} 项</span>
      <BulkDeleteConfirm
        selected={selected}
        positions={positions}
        onSuccess={clearSelection}
      />
    </div>
  ) : null

  let body: React.ReactNode
  if (isLoading) {
    body = (
      <div className="flex items-center justify-center h-48">
        <p className="text-zinc-500">加载中...</p>
      </div>
    )
  } else if (isError) {
    body = (
      <Alert variant="destructive">
        <AlertDescription>
          {(error as { response?: { data?: { detail?: string } } })
            ?.response?.data?.detail ??
            (error as Error).message ??
            '加载失败'}
        </AlertDescription>
      </Alert>
    )
  } else if (!positions || positions.length === 0) {
    body = (
      <div className="flex items-center justify-center h-48">
        <p className="text-zinc-500">还没有持仓，点击右上角添加</p>
      </div>
    )
  } else if (isDesktop) {
    body = (
      <>
        {selectionBar}
        <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={
                  positions.length > 0 &&
                  selected.size === positions.length
                }
                onCheckedChange={toggleSelectAll}
              />
            </TableHead>
            <TableHead>代码</TableHead>
            <TableHead>名称</TableHead>
            <TableHead>市场</TableHead>
            <TableHead className="text-right">持仓</TableHead>
            <TableHead className="text-right">成本</TableHead>
            <TableHead className="text-right">现价</TableHead>
            <TableHead className="text-right">市值</TableHead>
            <TableHead className="text-right">盈亏</TableHead>
            <TableHead className="text-right">盈亏%</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.map((p) => (
            <TableRow
              key={p.id}
              data-state={
                selected.has(p.id) ? 'selected' : undefined
              }
            >
              <TableCell>
                <Checkbox
                  checked={selected.has(p.id)}
                  onCheckedChange={() => toggleSelect(p.id)}
                />
              </TableCell>
              <TableCell className="font-medium text-zinc-50">
                {p.ticker}
              </TableCell>
              <TableCell className="text-zinc-300">
                {p.name}
              </TableCell>
              <TableCell>
                <Badge variant={p.market === 'CN' ? 'cn' : 'us'}>
                  {p.market}
                </Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums text-zinc-50">
                {formatShares(p.shares)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(p.cost_basis)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(p.current_price)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(p.market_value)}
              </TableCell>
              <TableCell
                className={cn(
                  'text-right tabular-nums',
                  pnlClass(p.pnl),
                )}
              >
                {formatCurrency(p.pnl)}
              </TableCell>
              <TableCell
                className={cn(
                  'text-right tabular-nums',
                  pnlClass(p.pnl_pct),
                )}
              >
                {p.pnl_pct != null
                  ? `${p.pnl_pct >= 0 ? '+' : ''}${p.pnl_pct.toFixed(2)}%`
                  : '-'}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(p)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <DeleteConfirm
                    ticker={p.ticker}
                    id={p.id}
                    onSuccess={clearSelection}
                    trigger={
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    }
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </>
    )
  } else {
    body = (
      <>
        {selectionBar}
        <div className="space-y-3">
          {positions.map((p) => (
        <div
          key={p.id}
          className={cn(
            'rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-2',
            selected.has(p.id) && 'border-zinc-600',
          )}
        >
          {/* Row 1 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selected.has(p.id)}
                onCheckedChange={() => toggleSelect(p.id)}
              />
              <span className="font-semibold text-zinc-50">
                {p.ticker}
              </span>
              <span className="text-sm text-zinc-400">
                {p.name}
              </span>
              <Badge variant={p.market === 'CN' ? 'cn' : 'us'}>
                {p.market}
              </Badge>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEdit(p)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <DeleteConfirm
                ticker={p.ticker}
                id={p.id}
                onSuccess={clearSelection}
                trigger={
                  <Button variant="ghost" size="sm">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                }
              />
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <span className="text-zinc-500">持仓 </span>
              <span className="text-zinc-300 tabular-nums">
                {formatShares(p.shares)}
              </span>
            </div>
            <div>
              <span className="text-zinc-500">成本 </span>
              <span className="text-zinc-300 tabular-nums">
                {formatCurrency(p.cost_basis)}
              </span>
            </div>
            <div>
              <span className="text-zinc-500">现价 </span>
              <span className="text-zinc-300 tabular-nums">
                {formatCurrency(p.current_price)}
              </span>
            </div>
          </div>

          {/* Row 3 */}
          <div className="flex items-center justify-between text-sm">
            <div>
              <span className="text-zinc-500">市值 </span>
              <span className="text-zinc-50 tabular-nums font-medium">
                {formatCurrency(p.market_value)}
              </span>
            </div>
            <div className={cn('tabular-nums', pnlClass(p.pnl))}>
              <span>
                {formatCurrency(p.pnl)}（
                {p.pnl_pct != null
                  ? `${p.pnl_pct >= 0 ? '+' : ''}${p.pnl_pct.toFixed(2)}%`
                  : '-'}
                ）
              </span>
            </div>
          </div>
        </div>
      ))}
        </div>
      </>
    )
  }

  return (
    <div className="p-6">
      {header}
      {body}
      {formDialog}
    </div>
  )
}
