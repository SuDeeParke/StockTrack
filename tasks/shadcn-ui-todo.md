# shadcn UI 重构任务清单

> 详细说明见 `tasks/shadcn-ui-plan.md`
> 风格目标：极简数据可视化（Pitch + Apple Finance）
> 状态：`[ ]` 待开始 · `[~]` 进行中 · `[x]` 完成

---

- [ ] **S-UI-01** · 安装 shadcn/ui 依赖 + 创建 `src/lib/utils.ts` + 手写 shadcn 组件到 `src/components/ui/`
  - 组件：button / badge / table / tabs / card / select / input / separator / skeleton / alert
  - 验收：`npm run build` 通过，`src/components/ui/` 目录存在

- [ ] **S-UI-02** · 更新 `src/index.css` design tokens：黑底 + zinc 色阶 + mono 字体
  - 验收：背景变 `#09090b`，旧青色 `#00d2ff` 消失

- [ ] **S-UI-03** · 重构 `src/components/Layout.tsx`
  - 侧边栏与页背景同色；active 靠左侧指示条；移除独立 surface 背景
  - 验收：导航融入页面，无 `style={{` 残留

- [ ] **S-UI-04** · 重构 `src/pages/Dashboard.tsx`
  - 迁移：Table / Badge / Button / Tabs / Skeleton / Alert
  - 验收：无 `style={{` 残留；信号列表功能完整

- [ ] **S-UI-05** · 重构 `src/pages/Backtest.tsx`
  - 迁移：Select / Input / Button / Card / Table / Badge
  - 验收：无 `style={{` 残留；回测流程可用

- [ ] **S-UI-06** · 重构 `src/pages/Trade.tsx`
  - 迁移：Card / Tabs / Table / Input / Select / Button / Badge / Alert
  - 验收：无 `style={{` 残留；下单流程可用

- [ ] **S-UI-07** · 重构 `src/pages/StockDetail.tsx`
  - 迁移：Tabs / Badge；ECharts 容器去 border
  - 验收：无 `style={{` 残留；K 线图正常渲染

- [ ] **S-UI-08** · 构建验证 + 全量功能测试
  - `npm run build` 通过；`npm run lint` 通过
  - 验收：4 个页面功能完整，0 inline style 残留
