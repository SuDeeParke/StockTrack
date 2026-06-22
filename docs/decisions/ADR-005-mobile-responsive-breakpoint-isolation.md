# ADR-005: 移动端响应式 — Tailwind 断点隔离方案

## Status

Accepted

## Date

2026-06-22

## Context

StockTrack 前端原为桌面端专用（固定 `w-52` 侧边栏、宽表格、双栏布局），需要在手机浏览器上实现完整功能（包括看信号、下单、查持仓、跑回测）。

目标用户：个人/家庭，通过手机浏览器直接访问，不需要专属 App Store 应用。

## Decision

采用 **Tailwind 断点隔离**（单代码库，`md:` 前缀控制桌面样式），不引入独立移动路由或独立组件文件。

核心改动：

| 组件 | 移动端 | 桌面端 |
|------|--------|--------|
| `Layout` | 底部固定导航栏 (`flex md:hidden`) | 左侧 `w-52` 侧边栏 (`hidden md:flex`) |
| `Dashboard` | 信号卡片列表 (`md:hidden`) | 宽表格 (`hidden md:block`) |
| `Backtest` | 参数区在上，结果区在下 (`flex-col`) | 左右双栏 (`md:flex-row`) |
| `Trade` | 表格横向滚动 (`overflow-x-auto`) | 同上 |
| `StockDetail` | K 线图 220px 高 | K 线图 340px 高 (`md:h-[340px]`) |

## Alternatives Considered

### 独立移动路由 (`/m/*`)
- Pros: 移动端完全定制，互不影响
- Cons: 等于维护两套 UI，长期是负担，代码量 2x
- Rejected

### React Native
- Pros: 原生体验最好
- Cons: 重写成本远超收益，现有用户量不需要 App Store
- Rejected

### PWA (manifest + service worker)
- 这是正交方案：manifest 让用户"添加到主屏"，不解决 UI 适配问题
- 当前方案完成后可叠加，不互斥
- 留待后续

### 单独维护移动端组件文件
- Cons: 导入/条件渲染更复杂，不如 Tailwind 断点直观
- Rejected

## Consequences

**正面:**
- 一份代码，断点 class 清晰可读
- 桌面端体验完全不受影响
- 可渐进式迭代（每个页面独立改造）

**负面/注意事项:**
- Dashboard 双模式（表格+卡片）在同一文件中维护，代码量增加
- ECharts 图表在窄屏下可读性有限，暂用缩小高度处理，未来可考虑折叠
- 尚未添加 PWA manifest，用户无法"添加到主屏幕"（计划后续添加）

## References

- Implementation: `docs/plans/mobile-responsive.md`
- Commits: `007bebb` (Phase 1), `ea041eb` (Phase 2-4)
