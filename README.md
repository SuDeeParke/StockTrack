# StockTrack

个人股票量化分析与交易 Web App — 支持 A 股（沪深）+ 美股双市场。

基于 [InStock](https://github.com/myhhub/stock) 信号引擎封装，提供信号看板、K 线图、可视化回测和模拟下单一体化体验。

---

## 功能概览

| 模块 | 说明 |
|------|------|
| **信号看板** | 展示 A 股 / 美股 BUY/SELL/WATCH 信号，支持市场筛选和排序 |
| **个股详情** | 90 天 K 线蜡烛图 + MACD/RSI/KDJ 指标 Tab |
| **策略回测** | 5 种内置策略，异步 job 模式，权益曲线 + 统计卡片 + 交易记录 |
| **交易面板** | 持仓总览、模拟下单（含风控检查二步确认）、历史订单 |

---

## 快速启动

### 前置依赖

- Python 3.11+
- Node.js 20+
- （可选）Docker + Docker Compose

### 本地开发

```bash
# 1. 安装后端依赖
cd backend
pip install -r requirements.txt

# 2. 启动后端（port 8000）
python -m uvicorn app.main:app --reload --port 8000

# 3. 安装前端依赖（新终端）
cd ..
npm install

# 4. 启动前端（port 5173）
npm run dev
```

浏览器访问 `http://localhost:5173`

### Docker Compose（可选）

```bash
docker-compose up
```

> 注意：本机需安装 Docker Desktop，首次启动会拉取 MySQL 5.7 镜像。

---

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run build` | 生产构建 |
| `npm run lint` | ESLint 检查 |
| `pytest backend/tests/ -v` | 运行全部后端测试（当前 36 个） |
| `curl http://localhost:8000/docs` | 查看 Swagger API 文档 |
| `POST /api/admin/refresh?market=ALL` | 手动触发数据刷新 |

---

## 项目结构

```
StockTrack/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI 入口 + lifespan scheduler
│   │   ├── models.py            # 所有 Pydantic 数据模型
│   │   ├── routers/
│   │   │   ├── signals.py       # /api/signals, /api/stocks/*
│   │   │   ├── backtest.py      # /api/backtest/*
│   │   │   └── portfolio.py     # /api/portfolio/*
│   │   ├── services/
│   │   │   ├── data_cache.py    # 内存数据缓存（替代 MySQL）
│   │   │   ├── us_market.py     # yfinance 美股管道
│   │   │   ├── backtest_engine.py # 回测引擎（5 种策略）
│   │   │   └── futu_mock.py     # Futu OpenAPI mock 层
│   │   └── scheduler.py         # APScheduler 定时刷新
│   ├── tests/                   # pytest 测试套件
│   └── requirements.txt
├── src/
│   ├── api/client.ts            # 类型安全 API 客户端
│   ├── components/Layout.tsx    # 侧边栏导航 Shell
│   └── pages/
│       ├── Dashboard.tsx        # 信号看板
│       ├── StockDetail.tsx      # 个股详情
│       ├── Backtest.tsx         # 策略回测
│       └── Trade.tsx            # 交易面板
├── tasks/
│   ├── todo.md                  # 任务清单（T1–T13 全部完成）
│   └── plan.md                  # 详细实施计划
├── docs/
│   ├── ideas/stocktrack-quant-app.md  # 原始需求文档
│   └── decisions/               # 架构决策记录（ADR）
├── docker-compose.yml
└── vite.config.ts               # /api 代理 → localhost:8000
```

---

## 技术栈

### 后端

| 依赖 | 版本 | 用途 |
|------|------|------|
| FastAPI | ≥0.111 | Web 框架 |
| Pydantic v2 | ≥2.0 | 数据模型与验证 |
| APScheduler | ≥3.10 | 定时刷新任务 |
| yfinance | ≥0.2.40 | 美股 OHLCV 数据 |
| ta | ≥0.11 | MACD/RSI/布林带指标 |
| akshare | ≥1.12 | A 股数据（预留） |
| pytest + pytest-asyncio | — | 测试框架 |

### 前端

| 依赖 | 版本 | 用途 |
|------|------|------|
| React 19 + TypeScript | — | UI 框架 |
| Vite | — | 构建工具 |
| Tailwind CSS v4 | — | 暗色主题样式 |
| TanStack Query v5 | — | 服务端状态缓存 |
| React Router v7 | — | 客户端路由 |
| ECharts + echarts-for-react | — | K 线图 / 权益曲线 |
| axios | — | HTTP 客户端 |

---

## API 端点

```
GET  /api/health                          健康检查
GET  /api/signals                         信号列表（market/date/limit）
GET  /api/stocks/{ticker}/ohlcv           K 线数据
GET  /api/stocks/{ticker}/indicators      技术指标快照
POST /api/admin/refresh                   手动触发数据刷新

GET  /api/backtest/strategies             可用策略列表
POST /api/backtest/run                    启动异步回测 job
GET  /api/backtest/result/{job_id}        轮询回测结果

GET  /api/portfolio/positions             当前持仓
GET  /api/portfolio/balance               账户余额
POST /api/portfolio/risk-check            风控预检
POST /api/portfolio/orders                模拟下单
GET  /api/portfolio/orders                历史订单
```

完整文档见 `http://localhost:8000/docs`（Swagger UI）。

---

## 风控规则

模拟交易内置三条硬编码风控：

| 规则 | 限制 |
|------|------|
| 单笔仓位 | ≤ 总资产 10% |
| 日最大亏损 | ≤ 总资产 2% |
| 同时持仓数 | ≤ 5 只 |

> 实盘交易需替换 `backend/app/services/futu_mock.py` 并连接真实 Futu OpenD 进程。

---

## 数据刷新调度

| 市场 | 触发时间 | 说明 |
|------|----------|------|
| A 股 | 工作日 15:30 CST | A 股收盘后 |
| 美股 | 工作日 05:00 CST | 美东 16:00 收盘后 |

---

## 开发进度

所有 13 个任务（T1–T13）已完成，详见 [`tasks/todo.md`](tasks/todo.md)。

```
Phase 0  T1   ✅ FastAPI + InStock 可行性验证
Phase 1  T2   ✅ Monorepo 骨架 + docker-compose
         T3   ✅ Pydantic 数据模型
         T4   ✅ A 股信号 API
         T5   ✅ 美股 yfinance 管道
         T6   ✅ 前端基础设施（Tailwind + TanStack Query）
         T7   ✅ 信号看板主页
         T8   ✅ 个股详情页（K 线 + 指标）
         T9   ✅ APScheduler 定时刷新
Phase 2  T10  ✅ 回测 API（异步 job）
         T11  ✅ 回测 UI（权益曲线 + 统计卡片）
Phase 3  T12  ✅ Futu OpenAPI mock 集成
         T13  ✅ 交易执行面板
```

---

## 架构决策

见 [`docs/decisions/`](docs/decisions/) 目录中的 ADR 文档。
