# Hono 后端迁移计划

> 状态：草稿 · 日期：2026-06-18
> 目标：将 Python FastAPI 后端完整迁移为 Hono (Node.js/TypeScript)，前端代码零修改

---

## 一、技术架构

| 维度 | 当前 (Python) | 目标 (Node.js) |
|------|--------------|----------------|
| 框架 | FastAPI + uvicorn | Hono + @hono/node-server |
| 类型校验 | Pydantic v2 | zod |
| 调度器 | APScheduler | node-cron |
| 美股数据 | yfinance | yahoo-finance2 |
| 测试 | pytest + httpx | vitest |
| 打包(开发) | uvicorn --reload | tsx watch |
| 打包(生产) | uvicorn | esbuild → node dist/index.js |
| 静态文件 | 独立进程 | Hono serveStatic（单进程） |

### 端口约定

| 环境 | 前端 | 后端 |
|------|------|------|
| 开发 | :5173 (Vite) | :3000 (Hono) — Vite 代理 /api → :3000 |
| 生产 | — | :3000 — Hono 同时 serve 静态文件 + API |

---

## 二、目标目录结构

```
StockTrack/
├── src/                          # 前端，完全不动
├── server/                       # 新 Hono 后端（替换 backend/）
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── index.ts                  # 入口：创建 app，挂载路由，启动 server
│   ├── types/
│   │   └── index.ts              # 共享类型（镜像 models.py）
│   ├── lib/
│   │   ├── data-cache.ts         # 内存缓存（镜像 data_cache.py）
│   │   └── scheduler.ts          # node-cron 封装
│   ├── routes/
│   │   ├── signals.ts            # GET /api/signals, /api/stocks/:ticker/*
│   │   ├── backtest.ts           # GET/POST /api/backtest/*
│   │   ├── portfolio.ts          # GET/POST /api/portfolio/*
│   │   └── admin.ts              # GET /api/health, POST /api/admin/refresh
│   ├── services/
│   │   ├── signals-mock.ts       # mock 数据 + OHLCV 生成
│   │   ├── backtest-engine.ts    # 仿真引擎
│   │   ├── futu-mock.ts          # 持仓/下单 mock
│   │   └── us-market.ts          # yahoo-finance2 封装
│   └── tests/
│       ├── signals.test.ts
│       ├── backtest.test.ts
│       ├── portfolio.test.ts
│       └── admin.test.ts
├── tasks/
│   ├── hono-migration-plan.md    # 本文件
│   └── hono-migration-todo.md
├── package.json                  # 根：添加 server:* scripts
└── vite.config.ts                # 代理目标 :8000 → :3000
```

---

## 三、模块依赖图

```
types/index.ts                         ← 无依赖，最先建立
       │
       ├──► lib/data-cache.ts
       ├──► services/signals-mock.ts
       ├──► services/backtest-engine.ts
       ├──► services/futu-mock.ts
       └──► services/us-market.ts
                    │
       ┌────────────┴─────────────────────────┐
       ▼                                      ▼
routes/signals.ts              routes/admin.ts
routes/backtest.ts             lib/scheduler.ts
routes/portfolio.ts
       │
       ▼
index.ts  ← 组装所有路由，启动 @hono/node-server
```

**迁移顺序：** 自底向上，每个切片独立可测。

---

## 四、API 契约映射（13 个端点，路径和行为 100% 兼容）

| Method | Path | Python 来源 |
|--------|------|------------|
| GET | /api/health | main.py |
| POST | /api/admin/refresh?market=CN\|US\|ALL | main.py |
| GET | /api/signals?market=ALL\|CN\|US&limit=50 | routers/signals.py |
| GET | /api/stocks/:ticker/ohlcv?days=90 | routers/signals.py |
| GET | /api/stocks/:ticker/indicators | routers/signals.py |
| GET | /api/backtest/strategies | routers/backtest.py |
| POST | /api/backtest/run | routers/backtest.py |
| GET | /api/backtest/result/:jobId | routers/backtest.py |
| GET | /api/portfolio/positions | routers/portfolio.py |
| GET | /api/portfolio/balance | routers/portfolio.py |
| POST | /api/portfolio/risk-check | routers/portfolio.py |
| POST | /api/portfolio/orders | routers/portfolio.py |
| GET | /api/portfolio/orders | routers/portfolio.py |

---

## 五、逐任务详细说明

### H-01 · 项目骨架

**目标：** server/ 目录，工具链就绪，`npm run server:dev` 启动返回 `{"ok":true}` 的最小 Hono server。

**涉及文件：**
- `server/package.json`（hono、@hono/node-server、tsx、vitest、zod、esbuild）
- `server/tsconfig.json`（target ES2022、moduleResolution NodeNext）
- `server/index.ts`（最小骨架）
- 根 `package.json` 新增 scripts：`server:dev`、`server:build`、`server:test`
- `vite.config.ts` 代理目标 `:8000` → `:3000`

**关键依赖：**
```json
{
  "dependencies": {
    "hono": "^4",
    "@hono/node-server": "^1",
    "node-cron": "^3",
    "yahoo-finance2": "^2",
    "zod": "^3"
  },
  "devDependencies": {
    "tsx": "^4",
    "esbuild": "^0.25",
    "vitest": "^2",
    "@types/node": "^20",
    "typescript": "~5"
  }
}
```

**验收：**
1. `cd server && npm install` 无报错
2. `npm run server:dev` → `curl http://localhost:3000/api/health` 有响应
3. `npm run server:test` exit 0（0 个测试）
4. `tsc --noEmit` 无错误

---

### H-02 · 共享类型层

**目标：** `server/types/index.ts` 定义所有接口，与 `src/api/client.ts` 完全对齐。

**类型清单（对应 models.py）：**

| Python 类 | TypeScript 接口 | 注意 |
|-----------|----------------|------|
| Signal | Signal | date → string |
| OHLCVBar | OHLCVBar | — |
| IndicatorSnapshot | IndicatorSnapshot | Optional → \| undefined |
| BacktestStrategy | BacktestStrategy | — |
| BacktestRequest | BacktestRequest | — |
| BacktestResult | BacktestResult | — |
| BacktestStats | BacktestStats | — |
| EquityPoint | EquityPoint | — |
| Trade | Trade | — |
| Position | Position | — |
| AccountBalance | AccountBalance | — |
| OrderRequest | OrderRequest | — |
| Order | Order | — |
| RiskCheckResult | RiskCheckResult | — |

**验收：**
1. `tsc --noEmit` 通过
2. 每个接口字段与 `src/api/client.ts` 人工比对一致

---

### H-03 · Signals 切片

**垂直路径：** mock 数据 → OHLCV 生成 → 路由 → Zod 校验 → 测试

**services/signals-mock.ts：**
- `MOCK_SIGNALS: Signal[]` — 7 条与 Python 相同的记录
- `genOHLCV(ticker, days)` — 用 `crypto.createHash('md5')` 复现 Python seed 逻辑
- `getIndicatorSnapshot(ticker)`

**routes/signals.ts：**
- `GET /api/signals?market&limit`
- `GET /api/stocks/:ticker/ohlcv?days` — 不存在返回 404 JSON
- `GET /api/stocks/:ticker/indicators` — 不存在返回 404 JSON

**tests/signals.test.ts（7 个测试用例）：**
- `/api/signals` → 200，≥5 条
- `?market=CN` → 全部 CN；`?market=US` → 全部 US
- `/ohlcv?days=30` → 30 条，含 open 字段
- `/ohlcv` 不存在 ticker → 404
- `/indicators` → 200，含 rsi；不存在 → 404

**验收：**
1. `npm run server:test -- signals` 全部通过
2. 前端信号看板正常加载

---

### H-04 · Backtest 切片

**垂直路径：** 策略数据 → 仿真引擎 → 异步 job → 路由 → 测试

**services/backtest-engine.ts：**
- `STRATEGIES: BacktestStrategy[]` — 5 条策略
- `buildSeed(req)` — `crypto.createHash('sha256')` 复现 Python 逻辑
- `simulateBacktest(req)` — 确定性仿真
- `runBacktestAsync(req, jobId)` — `Promise.resolve().then(...)` 异步执行
- `Map<string, BacktestResult>` 存储 job 状态

**routes/backtest.ts：**
- `GET /api/backtest/strategies`
- `POST /api/backtest/run` → 202；Zod 校验 strategy_id 存在、tickers 非空
- `GET /api/backtest/result/:jobId` → 200/404

**tests/backtest.test.ts（6 个测试用例）：**
- strategies → ≥3 条，含 id/name
- run valid → 202；run invalid strategy → 422；run empty tickers → 422
- result nonexistent → 404
- run + poll → status=DONE，stats.total_trades>0，equity_curve.length>0

**验收：**
1. `npm run server:test -- backtest` 全部通过
2. 前端回测页跑通策略 → 提交 → 轮询 → 权益曲线显示

---

### H-05 · Portfolio 切片

**垂直路径：** mock 持仓/余额 → 风控逻辑 → 下单 → 路由 → 测试

**services/futu-mock.ts：**
- `MOCK_POSITIONS: Position[]` — 3 条（茅台/五粮液/AAPL）
- `MOCK_BALANCE: AccountBalance`
- 风控常量：`RISK_MAX_POSITION_PCT=0.10`、`RISK_MAX_DAILY_LOSS_PCT=0.02`、`RISK_MAX_POSITIONS=5`
- `checkRisk(req, balance, positions)` — 三条规则与 Python 完全一致
- `placeOrder(req)` — `crypto.randomUUID()`，成交价 `price * rand(0.999~1.001)`
- `getOrders()` — 内存 `Order[]`

**routes/portfolio.ts：**
- `GET /api/portfolio/positions|balance|orders`
- `POST /api/portfolio/risk-check`
- `POST /api/portfolio/orders` → 201/400；`paper_trade=false` → 400

**tests/portfolio.test.ts（8 个测试用例）：**
- positions ≥1 条；balance 含 total_assets
- risk-check pass（小额 BUY）→ passed=true
- risk-check fail（超 10%）→ passed=false，reason 含 "仓位"
- place order paper_trade=true → 201，status=FILLED
- place order paper_trade=false → 400
- place order risk rejected → 400
- get orders after placing → ≥1 条

**验收：**
1. `npm run server:test -- portfolio` 全部通过
2. 交易面板：持仓/余额展示，下单风控流程走通

---

### H-06 · Health + Admin + Scheduler

**目标：** data-cache 内存层 + node-cron 调度 + admin 路由

**lib/data-cache.ts：** Map 存储 signals/ohlcv/indicators，接口与 Python data_cache.py 对等

**lib/scheduler.ts：**
- `refreshCN()` — 占位实现
- `refreshUS()` — 调用 us-market.ts
- `startScheduler()` — node-cron：CN `'30 15 * * 1-5'`，US `'0 5 * * 1-5'`（Asia/Shanghai）
- `stopScheduler()`

**routes/admin.ts：**
- `GET /api/health` → `{status, version, last_refresh}`
- `POST /api/admin/refresh?market` → `{status:'triggered', market, started_at}`

**tests/admin.test.ts（4 个测试用例）：**
- health → 200，status=ok
- refresh CN/US/ALL → 200，status=triggered

**验收：**
1. `npm run server:test -- admin` 全部通过
2. 启动日志显示两个 cron job 已注册

---

### H-07 · 生产构建 + 静态文件服务

**目标：** `npm run build:full && npm start` 单进程服务前端 + API

**index.ts 生产逻辑：**
```typescript
if (process.env.NODE_ENV !== 'development') {
  app.use('/*', serveStatic({ root: './dist' }))
  app.get('*', serveStatic({ path: './dist/index.html' }))
}
```

**根 package.json 新增：**
```json
"build:server": "esbuild server/index.ts --bundle --platform=node --target=node20 --outfile=server/dist/index.js --external:yahoo-finance2",
"build:full": "npm run build && npm run build:server",
"start": "NODE_ENV=production node server/dist/index.js"
```

**验收：**
1. `npm run build:full` 无错误
2. `npm start` → `http://localhost:3000/` 返回前端 HTML
3. `http://localhost:3000/api/health` 返回 JSON
4. 浏览器打开，前端完整加载，无 CORS 错误

---

### H-08 · 开发体验对齐

**目标：** `vite.config.ts` 代理目标改为 :3000，热重载验证

**vite.config.ts：**
```typescript
proxy: {
  '/api': {
    target: process.env.VITE_API_BASE_URL || 'http://localhost:3000',
    changeOrigin: true,
  },
},
```

**验收：**
1. 双进程启动：`npm run dev` + `npm run server:dev`
2. 前端 `http://localhost:5173`，网络请求 `/api/*` 全部 200
3. 修改 mock 数据，Hono 热重载后前端即时反映

---

### H-09 · 清理旧后端 + docker-compose 更新

**目标：** 移除 `backend/`，更新/新建容器化配置

**新增 Dockerfile.server：**
```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json server/package*.json ./
RUN npm ci
COPY . .
RUN npm run build:full
EXPOSE 3000
CMD ["node", "server/dist/index.js"]
```

**验收：**
1. `docker-compose up --build` 启动成功
2. 13 个端点逐一 curl 验证
3. `backend/` 安全删除后，`npm run build:full` 仍通过

---

## 六、阶段检查点

### Phase A（H-01 ~ H-02）
- [ ] `npm run server:dev` 启动无报错
- [ ] `tsc --noEmit` 通过
- [ ] 类型与 src/api/client.ts 对齐

### Phase B（H-03 ~ H-05）
- [ ] `npm run server:test` ≥20 个测试全部通过
- [ ] 信号/回测/交易三页面视觉验证通过
- [ ] 逐端点对比 FastAPI 响应结构

### Phase C（H-06 ~ H-07）
- [ ] `npm run build:full` 成功
- [ ] 生产单进程 :3000 前端 + API 均可访问
- [ ] Scheduler 日志显示两个 cron job

### Phase D（H-08 ~ H-09）
- [ ] docker-compose 一键启动
- [ ] 13 个端点全部验证
- [ ] backend/ 安全删除确认

---

## 七、风险与缓解

| 风险 | 概率 | 缓解 |
|------|------|------|
| OHLCV 伪随机种子不一致（MD5 实现差异）| 中 | H-03 验收时逐条对比 Python 输出 |
| Backtest 仿真结果不一致 | 中 | 使用 `seedrandom` 确保 PRNG 一致 |
| yahoo-finance2 API 变动 | 低 | try-catch 降级，返回空数组 |
| esbuild 打包 yahoo-finance2 失败 | 中 | 加入 `--external`，容器保留 node_modules |

---

## 八、不在本次范围内

- 数据库集成（MySQL / InStock）— 仍为 mock
- 真实 QMT 交易接入
- 前端 src/ 任何修改
- 认证 / JWT
