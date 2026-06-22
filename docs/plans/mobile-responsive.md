# Implementation Plan: 移动端响应式适配（PWA-ready）

> Status: **Completed** — All 6 tasks shipped, deployed to production.
> See ADR-005 for architectural rationale.

## Overview

将前端改造为完整响应式布局，在手机浏览器上支持全功能操作。策略：`md`（768px）断点隔离，桌面体验不退化。不引入独立移动路由，不添加 PWA manifest（留待后续）。

## Architecture Decisions

- **断点策略**: `md` 以下移动布局，`md` 以上桌面布局，Tailwind 断点隔离
- **导航**: 移动端底部固定导航栏，桌面端左侧 `w-52` 侧边栏
- **Dashboard 双模式**: 同一数据驱动，`md` 以下卡片列表，`md` 以上宽表格
- **图表**: ECharts 原生支持 resize，只需调整容器高度

---

## Phase 1 — 导航基础

- [x] **Task 1** — `Layout.tsx`: 侧边栏 `hidden md:flex`，底部 nav `flex md:hidden`，`main` 加 `pb-20 md:pb-6`
- [x] **Task 6** — `index.html`: 确认 viewport meta，移除重复标签

## Phase 2 — 信号看板

- [x] **Task 2** — `Dashboard.tsx`: 桌面表格 `hidden md:block`，移动卡片 `md:hidden`，卡片含名称/信号/价格/RSI/下单按钮

## Phase 3 — 回测与交易

- [x] **Task 3** — `Backtest.tsx`: `flex-col md:flex-row`，`w-full md:w-64`，`grid-cols-2 md:grid-cols-3`，图表高度 `h-[200px] md:h-[280px]`
- [x] **Task 4** — `Trade.tsx`: 持仓/订单表格包裹 `overflow-x-auto`

## Phase 4 — 收尾

- [x] **Task 5** — `StockDetail.tsx`: K 线图 `h-[220px] md:h-[340px]`

---

## Key Files

| File | 改动 |
|------|------|
| `src/components/Layout.tsx` | 双导航（侧边栏/底部栏）响应式切换 |
| `src/pages/Dashboard.tsx` | 表格/卡片双模式 |
| `src/pages/Backtest.tsx` | 堆叠布局 + 响应式列数 |
| `src/pages/Trade.tsx` | 表格横向滚动 |
| `src/pages/StockDetail.tsx` | 图表高度适配 |
| `index.html` | viewport meta |

## Not Done (by design)

- PWA manifest / service worker — 留待后续
- 独立移动路由 — 维护成本太高，断点隔离足够
- 触摸手势（滑动切换 Tab）— 过度工程
- React Native — 重写成本不合算
