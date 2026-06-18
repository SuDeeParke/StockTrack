# StockTrack UI 重构计划 — shadcn/ui + 极简数据可视化风

> 来源：idea-refine 会话 2026-06-18
> 目标风格：Pitch + Apple Finance — 黑底、纯 mono 数字、靠 spacing 分区、无 border 卡片
> 约束：不改后端代码；不改 tasks/plan.md 和 tasks/todo.md；ECharts 图表不动

---

## 设计目标

| 现状 | 目标 |
|------|------|
| 大量 `style={{ background, border, color }}` inline style | 全部迁移到 shadcn CSS variable token + Tailwind 类 |
| `#0f1117` 深蓝灰底，`#00d2ff` 青色主色 | `#09090b` 纯黑底，white/zinc 主色 |
| 有 border 的 surface 卡片 | borderless，靠 padding/gap 分区 |
| 自定义按钮/表格/Badge HTML | shadcn Button/Table/Badge/Tabs 统一组件 |
| 数字混用 sans/mono | 所有价格、指标、Ticker 统一 `font-mono` |

---

## 依赖图

```
S-UI-01 (安装 shadcn + 配置)
  └─ S-UI-02 (更新 design tokens / index.css)
       ├─ S-UI-03 (Layout 导航)
       ├─ S-UI-04 (Dashboard 看板)    ← 依赖 shadcn Table/Badge/Button/Tabs
       ├─ S-UI-05 (Backtest 回测)     ← 依赖 shadcn Card/Select/Input/Button
       ├─ S-UI-06 (Trade 交易)        ← 依赖 shadcn Card/Table/Tabs
       └─ S-UI-07 (StockDetail 详情)  ← 依赖 shadcn Tabs/Badge
            └─ S-UI-08 (构建验证)
```

---

## 任务详情

### S-UI-01 · 安装 shadcn/ui（Tailwind v4 兼容）

**前置：** 项目使用 Tailwind v4 (`@tailwindcss/vite: ^4.3.1`)，需用 shadcn 的 Tailwind v4 安装路径。

**步骤：**
1. 安装基础依赖：
   ```bash
   npm install class-variance-authority clsx tailwind-merge lucide-react
   npm install @radix-ui/react-tabs @radix-ui/react-select @radix-ui/react-slot @radix-ui/react-separator
   ```
2. 创建 `src/lib/utils.ts`：
   ```ts
   import { clsx, type ClassValue } from 'clsx'
   import { twMerge } from 'tailwind-merge'
   export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }
   ```
3. 手动添加 shadcn 组件到 `src/components/ui/`（不用 CLI，避免 Tailwind v4 兼容问题）：
   - `button.tsx`、`badge.tsx`、`table.tsx`、`tabs.tsx`、`card.tsx`、`select.tsx`、`input.tsx`、`separator.tsx`、`skeleton.tsx`、`alert.tsx`

**验收：** `npm run build` 通过，`src/components/ui/` 目录存在所有组件文件。

---

### S-UI-02 · 更新 Design Tokens（index.css）

**目标调色板：**
```css
/* 背景系 */
--background: #09090b;        /* zinc-950 */
--foreground: #fafafa;        /* zinc-50 */

/* 表面（borderless card） */
--card: #09090b;              /* 与背景同色，靠 spacing 分区 */
--card-foreground: #fafafa;

/* 交互 */
--muted: #18181b;             /* zinc-900，subtle hover */
--muted-foreground: #a1a1aa;  /* zinc-400 */
--border: #27272a;            /* zinc-800，极细 */
--primary: #fafafa;           /* white */
--primary-foreground: #09090b;

/* 信号色（保留） */
--color-buy: #22c55e;         /* emerald-500 */
--color-sell: #ef4444;        /* rose-500 */
--color-watch: #f59e0b;       /* amber-500 */
```

**字体：**
- `font-sans`：Inter（标签、说明文字）
- `font-mono`：所有数字、Ticker、价格、指标值

**验收：** 页面背景变为 `#09090b`，旧的 `#00d2ff` 青色消失。

---

### S-UI-03 · Layout 导航重构

**改动：**
- 侧边栏背景与页面背景一致（`bg-background`，无 surface 色）
- 导航链接：inactive = `text-muted-foreground`，active = `text-foreground` + 左边 2px 白色指示条
- Logo 文字：`text-foreground font-mono font-bold` 替代青色
- 去掉 `border-r`，改用右侧极细 `border-r border-border`

**验收：** 导航不再有独立背景色，与页面融为一体；active 状态靠左侧指示条区分。

---

### S-UI-04 · Dashboard 信号看板重构

**改动清单：**

| 元素 | 现状 | 目标 |
|------|------|------|
| 市场 Tab 按钮 | 自定义 style button | shadcn `Tabs` 组件 |
| 信号表格 | 手写 `<table>` + inline style | shadcn `Table`（TableHeader/TableRow/TableCell） |
| MarketBadge | 手写 span + inline style | shadcn `Badge` variant=outline |
| 信号类型颜色 | inline color | `data-[type=BUY]:text-emerald-500` 等 |
| 下单按钮 | 自定义 style button | shadcn `Button` size=sm |
| SkeletonTable | 自定义 pulse div | shadcn `Skeleton` 组件 |
| 数据陈旧 Banner | 手写 div + style | shadcn `Alert` variant=warning |
| 表头排序 | cursor-pointer + inline style | `Button` variant=ghost + `ArrowUpDown` icon（lucide） |
| RSI 颜色 | inline style | Tailwind 条件类 |

**验收：** Dashboard 无任何 `style={{` 剩余；`npm run build` 通过。

---

### S-UI-05 · Backtest 回测界面重构

**改动清单：**

| 元素 | 现状 | 目标 |
|------|------|------|
| 左侧配置面板 | 手写 div + flex col | 无 Card，靠 spacing 分区 |
| 策略下拉 | `<select>` + inline inputStyle | shadcn `Select` 组件 |
| 股票池 toggle 按钮 | 手写 button + inline style | shadcn `Badge` variant=outline，点击切换 selected 状态 |
| 日期输入 | `<input type="date">` + inputStyle | shadcn `Input` |
| 运行按钮 | 手写 button + inline style | shadcn `Button`（默认/loading 状态） |
| 统计卡片（6个） | 手写 div + inline style | shadcn `Card`（CardHeader/CardContent），borderless variant |
| 权益曲线容器 | 手写 div + inline border | 移除 border，加 `py-4` spacing |
| 交易记录表格 | 手写 `<table>` | shadcn `Table` |
| 加载 spinner | 手写 animate-spin div | lucide `Loader2` + `animate-spin` |

**验收：** Backtest 页无任何 `style={{` 剩余；运行回测流程完整可用。

---

### S-UI-06 · Trade 交易面板重构

**改动清单：**

| 元素 | 现状 | 目标 |
|------|------|------|
| 余额卡片（4个） | 手写 div + inline border/bg | shadcn `Card` borderless，数字 `font-mono text-2xl` |
| Tab 切换 | 手写 button + borderBottom style | shadcn `Tabs` 组件 |
| 持仓表格 | 手写 `<table>` + inline style | shadcn `Table` |
| 市场 Badge（CN/US） | 手写 span + inline bg/color | shadcn `Badge` variant=outline |
| 下单表单输入 | 手写 `<input>/<select>` + inputStyle | shadcn `Input`/`Select` |
| 买入/卖出切换 | 手写 button + inline bg | shadcn `Button` variant=outline/default |
| 风控检查按钮 | 手写 button + inline style | shadcn `Button` variant=outline |
| 风控通过/失败 alert | 手写 div + inline bg/border | shadcn `Alert` variant=default/destructive |
| 订单历史表格 | 手写 `<table>` | shadcn `Table` |
| 订单状态 Badge | 手写 span + inline color | shadcn `Badge` 颜色 variant |

**验收：** Trade 页无任何 `style={{` 剩余；完整下单流程（风控检查 → 确认 → 成功）可用。

---

### S-UI-07 · StockDetail 个股详情重构

**改动清单：**

| 元素 | 现状 | 目标 |
|------|------|------|
| 指标 Tab | 手写 button + borderBottom | shadcn `Tabs` |
| 市场/信号 Badge | 手写 span + inline | shadcn `Badge` |
| ECharts 容器 | 手写 div + border/bg | 移除 border，保留 padding |
| 信号历史列表 | 手写 div + border | `Separator` 分隔，无 border 卡片 |
| 价格涨跌幅 | inline color | Tailwind 条件类 |

**注意：** ECharts 组件本身不改，只改容器和 option 的 backgroundColor。

**验收：** StockDetail 页无任何 `style={{` 剩余（ECharts option 内的 style 除外）。

---

### S-UI-08 · 构建验证 & 全量检查

1. `npm run build` — 无 TypeScript 错误
2. `npm run lint` — 无 ESLint 错误
3. 手动验证：
   - Dashboard：信号列表渲染、市场筛选、排序、下单跳转
   - Backtest：运行回测 → 权益曲线显示
   - Trade：风控检查 → 下单成功
   - StockDetail：K 线图渲染、指标 Tab 切换

**验收：** 全部通过，0 inline `style={{` 残留（ECharts option 内部除外）。

---

## 并行机会

```
S-UI-01 → S-UI-02 → [S-UI-03 || S-UI-04 || S-UI-05 || S-UI-06 || S-UI-07] → S-UI-08
                      （S-UI-02 完成后，03-07 可全部并行）
```

---

## 关键风险

| 风险 | 缓解 |
|------|------|
| shadcn 手动组件与 Tailwind v4 不兼容 | 优先用 Tailwind v4 原生类，减少 `@apply` 使用 |
| ECharts `theme="dark"` 与新背景色不协调 | 把 ECharts option.backgroundColor 改为 `'transparent'` |
| shadcn Select 组件 portal z-index 问题 | 测试弹出层，必要时调整 `z-index` |

---

## 不做的事

- 不改 ECharts 内部逻辑
- 不添加动画/过渡效果
- 不做移动端响应式
- 不改任何后端代码
- 不改 tasks/plan.md 和 tasks/todo.md
