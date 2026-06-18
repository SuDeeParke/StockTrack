# StockTrack 任务清单

> 详细说明见 `tasks/plan.md`
> 状态：`[ ]` 待开始 · `[~]` 进行中 · `[x]` 完成 · `[!]` 阻塞

---

## Phase 0 · 可行性验证

- [x] **T1** · Spike：Fork InStock，验证 FastAPI 可直接调用其信号引擎
  - 输出：`GET /api/signals/today?market=CN` 返回真实信号数据

---

## Phase 1 · 信号看板 MVP（目标：4 周）

- [x] **T2** · 项目骨架：Monorepo 目录结构 + docker-compose.yml
  - 依赖：T1
- [x] **T3** · 后端：定义统一 Pydantic 数据模型（Stock / Signal / OHLCVBar）
  - 依赖：T2
- [x] **T4** · 后端：A 股信号 API（封装 InStock，3 个端点）
  - 依赖：T3
- [x] **T5** · 后端：美股数据管道（yfinance + TA-Lib，存入同一 MySQL）
  - 依赖：T3（可与 T4 并行）
- [x] **T6** · 前端：基础设施（Tailwind 暗色主题 + TanStack Query + 布局 Shell）
  - 依赖：T2（可与 T4/T5 并行）
- [x] **T7** · 前端：信号看板主页（表格 + 市场筛选 + 排序）
  - 依赖：T4 + T5 + T6
- [x] **T8** · 前端：个股详情页（K 线图 + 指标 Tab + 信号历史）
  - 依赖：T4 + T6
- [x] **T9** · 后端：APScheduler 定时刷新（A 股 15:30 + 美股 05:00 CST）
  - 依赖：T4 + T5

### ✅ Phase 1 Checkpoint
- [x] docker-compose 一键启动验证
- [x] A 股 + 美股信号双市场可见
- [x] K 线图渲染正常
- [x] 定时刷新至少成功一次

---

## Phase 2 · 可视化回测（目标：第 5-7 周）

- [ ] **T10** · 后端：回测 API（封装 InStock 回测引擎，异步 job）
  - 依赖：Phase 1 完成
- [ ] **T11** · 前端：回测界面（策略选择 + 权益曲线 + 统计卡片）
  - 依赖：T10 + T6

### ✅ Phase 2 Checkpoint
- [ ] 完整回测流程走通截图
- [ ] 回测数值与 InStock 命令行一致

---

## Phase 3 · 交易执行（目标：第 8-10 周）

> 前置：先验证 Futu OpenD 在本机可用

- [ ] **T12** · 后端：Futu OpenAPI 集成（持仓 / 下单 / 风控）
  - 依赖：Phase 1 完成
- [ ] **T13** · 前端：交易执行面板（持仓总览 + 信号下单流程）
  - 依赖：T12 + T6

### ✅ Phase 3 Checkpoint
- [ ] Futu 模拟账户完成 3 笔完整下单流程
- [ ] 风控拦截所有边界情况

---

## 开放问题（影响计划）

- [ ] 确认券商选型（富途 / 长桥 / 老虎 / IBKR）→ 影响 T12
- [ ] 确认 tushare Token 是否可用 → 影响 T4 数据质量
- [ ] 确认 Futu OpenD 在本机可正常运行 → Phase 3 前置条件
