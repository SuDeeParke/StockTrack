# StockTrack 实施计划

> 来源：`docs/ideas/stocktrack-quant-app.md`
> 生成日期：2026-06-18

---

## 架构总览

```
┌─────────────────────────────────────────────────────┐
│                    Monorepo                         │
│                                                     │
│  frontend/  (React 19 + TS + Vite + Tailwind)       │
│  backend/   (Python + FastAPI + InStock fork)       │
│  docker-compose.yml                                 │
└─────────────────────────────────────────────────────┘

数据流：
akshare/tushare → InStock Engine → MySQL
yfinance        → US Pipeline   → MySQL
                                    ↓
                               FastAPI
                                    ↓
                           TanStack Query
                                    ↓
                           React 前端页面
```

---

## 依赖关系图

```
T1 (Spike)
  └─ T2 (项目骨架)
       ├─ T3 (数据模型)
       │    ├─ T4 (A 股 API)
       │    └─ T5 (美股管道)  ← 可与 T4 并行
       └─ T6 (前端基础)
            ├─ T7 (信号看板)  ← 依赖 T4 + T5 + T6
            └─ T8 (个股详情)  ← 依赖 T4 + T6

T4 + T5 → T9 (定时刷新)      ← Phase 1 任意时间

─── Checkpoint: Phase 1 ──────────────────────────────

T10 (回测 API)  ← 依赖 Phase 1 后端
T11 (回测 UI)   ← 依赖 T10 + T6

─── Checkpoint: Phase 2 ──────────────────────────────

T12 (Futu 集成) ← 依赖 Phase 1 后端
T13 (交易面板)  ← 依赖 T12 + T6

─── Checkpoint: Phase 3 ──────────────────────────────
```

---

## Phase 0 — 可行性验证（第 0 周，≈1-2 天）

### T1 · Spike：InStock + FastAPI 可行性验证

**目标**：在提交任何架构之前，证明 InStock 的信号引擎可以从 FastAPI handler 中直接调用。

**任务内容**：
1. Fork `myhhub/stock` 到 `backend/` 目录
2. 安装 Python 依赖（TA-Lib、akshare、SQLAlchemy 等）
3. 连接本地 MySQL，导入少量 A 股历史数据
4. 编写一个最小 FastAPI 应用，import InStock 的信号计算函数，暴露一个端点

**验收标准**：
- `GET /api/signals/today?market=CN` 返回至少一条信号对象，包含字段：`ticker`, `signal_type`, `date`, `indicators`
- 无需重写 InStock 的任何业务逻辑

**如果失败**：说明 InStock 耦合过重，需要调整为通过数据库读取信号（InStock 写 DB → FastAPI 读 DB），而非直接 import，方案仍然可行。

---

## Phase 1 — 信号看板 MVP（第 1-4 周）

### T2 · 项目骨架：Monorepo + Docker Compose

**依赖**：T1

**任务内容**：
1. 将现有 Vite 脚手架移至 `frontend/`（或保持根目录，backend 放 `backend/`）
2. 创建 `backend/` Python 项目（pyproject.toml / requirements.txt）
3. 编写 `docker-compose.yml`：MySQL 5.7 + FastAPI + Vite dev（带热重载）
4. 配置 Vite 反向代理：`/api/*` → `http://backend:8000`
5. 创建 `.env.example`，列出所有环境变量

**验收标准**：
- `docker-compose up` 启动后，浏览器访问 `localhost:5173` 可见前端页面
- 前端 `fetch('/api/health')` 返回 200
- `docker-compose down && docker-compose up` 幂等

---

### T3 · 后端：统一股票数据模型

**依赖**：T2

**任务内容**：
1. 定义 Pydantic v2 模型：`Stock`、`Signal`、`OHLCVBar`、`IndicatorSnapshot`
2. 所有模型包含 `market: Literal['CN', 'US']` 字段
3. Ticker 统一格式：A 股为 `600519.SH` / `000001.SZ`，美股为 `AAPL.US`
4. 定义信号类型枚举：`SignalType`（买入 / 卖出 / 观察）

**验收标准**：
- Pydantic 模型通过 `pytest` 单元测试，覆盖 CN + US 两种 market 值
- 模型导出为 JSON Schema，可供前端 TypeScript 类型生成使用

---

### T4 · 后端：A 股信号 API（InStock 封装）

**依赖**：T3

**任务内容**：
1. 封装 InStock 信号引擎，输出标准 `Signal` Pydantic 模型
2. 实现以下 API 端点：
   - `GET /api/signals?market=CN&date=today&limit=50`
   - `GET /api/stocks/{ticker}/ohlcv?days=90`
   - `GET /api/stocks/{ticker}/indicators`
3. 错误处理：ticker 不存在 → 404，数据未刷新 → 返回最后已知数据 + `stale: true` 标志

**验收标准**：
- 三个端点均返回符合 Pydantic 模型的 JSON
- 至少 5 只 A 股有完整数据（OHLCV + 指标 + 信号）
- Swagger UI（`/docs`）可查看并手动测试所有端点

---

### T5 · 后端：美股数据管道（yfinance）

**依赖**：T3（可与 T4 并行）

**任务内容**：
1. 编写美股数据抓取器（yfinance），抓取成交量前 50 的标的（纳斯达克 100 成分股子集）
2. 复用 InStock 的 TA-Lib 指标函数（MACD、RSI、KDJ、布林带），应用于美股日线数据
3. 信号存入 MySQL 同一张表，`market='US'`
4. `GET /api/signals?market=US` 返回美股信号

**验收标准**：
- 至少 20 只美股标的有完整日线 + 信号数据
- 美股信号与 A 股信号在同一 API 响应中结构完全一致
- `market=ALL` 参数同时返回两市信号

---

### T6 · 前端：基础设施搭建

**依赖**：T2（可与 T4/T5 并行）

**任务内容**：
1. 安装依赖：Tailwind CSS v4、TanStack Query v5、React Router v7、ECharts + echarts-for-react、axios
2. 配置暗色主题 Tailwind（背景 `#0f1117`，主色 `#00d2ff`）
3. 搭建布局 Shell：左侧导航栏（固定）+ 主内容区
4. 创建 API 客户端层（`src/api/client.ts`），从 `VITE_API_BASE_URL` 读取基础 URL
5. 配置 TanStack Query Provider，设置 `staleTime: 5min`

**验收标准**：
- 应用以暗色主题加载，无控制台错误
- 导航栏有三个占位链接：信号看板 / 个股详情 / 回测（灰色禁用）
- `src/api/client.ts` 导出类型安全的请求函数

---

### T7 · 前端：信号看板页（主页）

**依赖**：T4 + T5 + T6

**任务内容**：
1. 路由：`/`
2. 信号列表表格，列：Ticker、市场徽章（CN / US）、信号类型（买入 / 卖出）、日期、MACD 值、RSI 值
3. 顶部 Tab 筛选：全部 / 沪深 / 美股
4. 表头点击排序：日期、RSI
5. 点击行 → 跳转至 `/stock/:ticker`
6. 数据加载中显示骨架屏，数据陈旧（`stale: true`）时显示 Banner 提示

**验收标准**：
- 今日信号全部展示，Tab 筛选正常切换
- 排序功能正常
- 点击行可导航（即使 T8 页面尚未实现，至少路由跳转不报错）
- Lighthouse 性能分数 ≥ 70（本地构建后测试）

---

### T8 · 前端：个股详情页

**依赖**：T4 + T6

**任务内容**：
1. 路由：`/stock/:ticker`
2. 顶部：股票名称、市场徽章、当日收盘价、涨跌幅
3. K 线蜡烛图（ECharts），展示 90 天数据，底部附成交量柱
4. 指标面板（Tab 切换）：MACD 图、KDJ 图、RSI 线
5. 右侧：该股最近 10 条信号历史列表

**验收标准**：
- K 线图正确渲染蜡烛（阳线红色，阴线绿色，符合 A 股习惯）
- 指标 Tab 切换流畅，无抖动
- 美股 Ticker 同样可用此页面（切换颜色习惯为阳线绿/阴线红）
- 页面刷新后数据自动从 TanStack Query 缓存恢复

---

### T9 · 后端：每日数据自动刷新

**依赖**：T4 + T5（Phase 1 任意时间完成即可）

**任务内容**：
1. 集成 APScheduler，注册两个定时任务：
   - A 股刷新：工作日 15:30 CST（收盘后）
   - 美股刷新：工作日 05:00 CST（美东 16:00 收盘后）
2. 刷新失败时记录错误日志，不影响 API 正常提供旧数据
3. 提供手动触发端点：`POST /api/admin/refresh?market=CN|US`

**验收标准**：
- APScheduler 任务在 Docker 启动后自动注册
- `POST /api/admin/refresh?market=CN` 触发后，信号数据在 5 分钟内更新
- 日志可通过 `docker-compose logs backend` 观察到刷新状态

---

### ✅ Checkpoint：Phase 1 验收

**全部满足后才能进入 Phase 2：**
- [ ] T1 ~ T9 全部完成
- [ ] `docker-compose up` 一键启动，无需手动步骤
- [ ] A 股 + 美股信号均在看板中可见
- [ ] 个股 K 线 + 指标页面正常渲染
- [ ] 定时刷新已验证至少一次成功运行

---

## Phase 2 — 可视化回测界面（第 5-7 周）

### T10 · 后端：回测 API

**依赖**：Phase 1 后端完成

**任务内容**：
1. 封装 InStock 回测引擎，暴露端点：
   - `GET /api/backtest/strategies` — 返回可用策略列表（InStock 内置 11 条）
   - `POST /api/backtest/run` — 输入：`strategy_id`, `tickers[]`, `start_date`, `end_date`
   - `GET /api/backtest/result/{job_id}` — 轮询结果（大回测异步执行）
2. 返回结构：权益曲线数据点、交易记录列表、统计指标（夏普率、最大回撤、胜率、年化收益）

**验收标准**：
- 对 10 只 A 股运行 1 年回测，30 秒内返回结果
- 返回 JSON 包含 `equity_curve[]`、`trades[]`、`stats{}` 三个字段
- 无效策略 ID 返回 422

---

### T11 · 前端：回测界面

**依赖**：T10 + T6

**任务内容**：
1. 路由：`/backtest`
2. 左侧配置面板：策略下拉选择、股票池多选（支持搜索）、日期范围选择器
3. 右侧结果区域：
   - 权益曲线折线图（ECharts）
   - 统计卡片：总收益率、夏普率、最大回撤、胜率
   - 交易记录表格（可排序）
4. "运行回测"按钮，执行中显示进度动画

**验收标准**：
- 完整走通一次回测：选择策略 → 选股票 → 选日期 → 点击运行 → 看到权益曲线
- 权益曲线与基准（沪深 300）对比线同时显示
- 交易记录表格可按收益排序

---

### ✅ Checkpoint：Phase 2 验收

- [ ] T10 + T11 完成
- [ ] 至少运行一次完整回测并截图保存
- [ ] 回测结果与 InStock 命令行工具输出数值一致（误差 < 0.1%）

---

## Phase 3 — 交易执行（第 8-10 周）

> **前置条件**：在开始此阶段前，先完成 Futu OpenAPI 环境验证（见 T1 假设条目）。

### T12 · 后端：Futu OpenAPI 集成

**依赖**：Phase 1 后端完成

**任务内容**：
1. 集成 `futu-api` Python SDK，连接本地 OpenD 进程
2. 实现端点：
   - `GET /api/portfolio/positions` — 当前持仓
   - `GET /api/portfolio/balance` — 账户余额
   - `POST /api/orders` — 下单（含风控校验）
   - `GET /api/orders` — 历史订单
3. 风控规则（硬编码配置）：单笔最大仓位 10%、日最大亏损 2%、最多同时持仓 5 只

**验收标准**：
- 连接 Futu 模拟账户，`GET /api/portfolio/positions` 返回持仓列表
- 风控规则拦截超限下单，返回 400 + 明确错误信息
- 真实下单前必须通过 `paper_trade: true` 参数明确指定

---

### T13 · 前端：交易执行面板

**依赖**：T12 + T6

**任务内容**：
1. 导航栏新增"交易"入口
2. 持仓总览：持仓列表、账户余额、今日盈亏
3. 信号 → 下单流程：看板中的信号行新增"下单"按钮 → 弹出预填订单窗口（股票、方向、数量、价格）→ 确认弹窗（显示风控检查结果）→ 提交
4. 订单历史页面

**验收标准**：
- 完整走通一次模拟下单流程：从信号看板点击"下单"→ 确认 → 在订单历史中看到记录
- 风控拦截时，UI 显示具体拒绝原因（如"超过单笔仓位限制 10%"）
- 所有下单操作需要二次确认，无法误触

---

### ✅ Checkpoint：Phase 3 验收

- [ ] T12 + T13 完成
- [ ] 在 Futu 模拟账户完成 3 笔完整的"信号 → 下单 → 成交"流程
- [ ] 风控规则在所有边界情况下正确拦截

---

## 并行工作机会

```
Week 1:  T1 (spike) → T2 (骨架)
Week 2:  T3 (模型) → [T4 || T6]  ← 后端 + 前端可同时开始
Week 3:  T5 (美股) || T7 (看板) || T8 (详情)
Week 4:  T9 (定时) + Phase 1 集成测试
Week 5-6: T10 (回测 API) + T11 (回测 UI)
Week 7:  Phase 2 验收
Week 8-9: T12 (Futu) + T13 (交易面板)
Week 10: Phase 3 验收
```

---

## 关键决策记录

| 决策 | 选择 | 原因 |
|---|---|---|
| Flask vs FastAPI | FastAPI | 异步、类型安全、自动文档 |
| 复用 vs 重写 InStock | 复用封装 | 降低风险，指标逻辑已验证 |
| 实时 vs 日线 | 日线（Phase 1） | 降低复杂度，先验证信号价值 |
| ECharts vs TradingView | ECharts | 无 License 限制，K 线定制灵活 |
| Monorepo | 是（同一仓库） | 简化开发体验，减少跨仓库协调 |
