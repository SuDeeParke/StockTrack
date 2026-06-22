# StockTrack

量化交易指挥台 — A-share ETF & US stock signal dashboard with paper trading, backtesting, and per-user encrypted portfolio. Mobile-friendly PWA-ready.

## Features

| Module | Description |
|--------|-------------|
| **信号看板** | BaoStock buy/sell/watch signals with MACD, RSI; mobile card view |
| **个股详情** | 90-day candlestick chart + MACD/RSI indicator tabs |
| **策略回测** | 5 built-in strategies, async job, equity curve + trade log |
| **交易面板** | Per-user positions, simulated orders with risk check, order history |
| **Multi-user auth** | JWT login, per-user isolated portfolio data |
| **Encrypted storage** | SQLite with AES-256-GCM column encryption |

---

## Quick Start (Local Dev)

**Prerequisites:** Node.js 20+, Python 3.10+

```bash
# 1. Install dependencies
npm install
npm install --prefix server

# 2. Configure environment
cp .env.example .env
# Edit .env: set SQLITE_KEY (64 hex), JWT_SECRET (64 hex), ADMIN_USER, ADMIN_PASS

# 3. Start BaoStock microservice (A-share data, port 8888)
cd baostock-api && pip install -r requirements.txt
uvicorn main:app --port 8888

# 4. Start backend (new terminal, port 3000)
npm run server:dev

# 5. Start frontend (new terminal, port 5173)
npm run dev
```

Open http://localhost:5173, login with `ADMIN_USER` / `ADMIN_PASS`.

---

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Frontend dev server (Vite, port 5173) |
| `npm run server:dev` | Backend dev server (Hono, port 3000, tsx watch) |
| `npm run build` | Frontend production build → `dist/` |
| `npm run server:build` | Backend bundle → `server/dist/index.js` (esbuild) |
| `npm run build:full` | Full build: frontend + backend + copy static files |
| `npm run start` | Run production server |
| `npm run lint` | ESLint |
| `npm run server:test` | Backend unit tests (Vitest) |

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  Browser (React 19 + Vite + Tailwind v4 + ECharts)  │
│  React Router v7 · TanStack Query v5 · shadcn/ui    │
│  Responsive: md breakpoint (768px) desktop/mobile   │
└───────────────────────┬──────────────────────────────┘
                        │ HTTP (Axios + Bearer JWT)
┌───────────────────────▼──────────────────────────────┐
│  Hono / Node.js 20 (port 3000)                      │
│  Routes: /api/auth, /api/signals, /api/portfolio,   │
│          /api/backtest — + serves static frontend   │
│  Auth: hono/jwt · bcryptjs                          │
└──────────┬───────────────────────┬───────────────────┘
           │ HTTP                  │ file
┌──────────▼──────────┐  ┌─────────▼───────────────────┐
│ BaoStock FastAPI    │  │ data/stocktrack.db           │
│ Python (port 8888)  │  │ SQLite + AES-256-GCM columns │
│ A-share T+1 data    │  └──────────────────────────────┘
└─────────────────────┘
```

**Directory layout:**

```
src/                    React frontend
  pages/                Dashboard · Backtest · Trade · StockDetail · Login
  components/           Layout (responsive sidebar/bottom-nav) · shadcn/ui
  api/client.ts         Axios instance + auth interceptors

server/                 Hono backend (TypeScript)
  index.ts              Entry, route wiring, auth middleware
  routes/               auth · portfolio · signals · backtest
  services/             db.ts (crypto) · db-schema.ts · portfolio-db.ts
  middleware/auth.ts    JWT verification, ContextVariableMap

baostock-api/           Python FastAPI microservice
  main.py               BaoStock data fetch + signal computation + cron

docs/
  decisions/            ADRs (001–005)
  plans/                Completed implementation records
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SQLITE_KEY` | Yes | AES-256 key — 64 hex chars (`openssl rand -hex 32`) |
| `JWT_SECRET` | Yes | JWT signing secret — 64 hex chars |
| `ADMIN_USER` | Yes | Bootstrap admin username |
| `ADMIN_PASS` | Yes | Bootstrap admin password |
| `BAOSTOCK_URL` | Yes | BaoStock service URL (e.g. `http://localhost:8888`) |
| `DATABASE_PATH` | No | SQLite path (default: `data/stocktrack.db`) |

> **Critical:** `SQLITE_KEY` loss = all portfolio data permanently unreadable. Store it in a password manager.

---

## API Endpoints

All endpoints except `POST /api/auth/login` require `Authorization: Bearer <token>`.

```
POST /api/auth/login              Login → { token, username }
GET  /api/auth/me                 Current user info

GET  /api/health                  Health check
GET  /api/signals                 Signal list (?market=ALL|CN|US&limit=50)
GET  /api/stocks/:ticker/ohlcv    Candlestick data (?days=90)
GET  /api/stocks/:ticker/indicators  Latest indicator snapshot

GET  /api/backtest/strategies     Available strategy list
POST /api/backtest/run            Start async backtest job
GET  /api/backtest/result/:jobId  Poll job result

GET  /api/portfolio/positions     Current positions (per-user)
GET  /api/portfolio/balance       Account balance (per-user)
POST /api/portfolio/risk-check    Pre-trade risk validation
POST /api/portfolio/orders        Place simulated order
GET  /api/portfolio/orders        Order history (per-user)
```

---

## Deployment

```bash
ssh root@<server-ip>
/root/deploy.sh
```

Script: `git pull` → `npm install` → `npm run build:full` → copy native addons → `systemctl restart stocktrack` → health check.

**First-time systemd setup** (`/etc/systemd/system/stocktrack.service`):

```ini
Environment=SQLITE_KEY=<64-hex>
Environment=JWT_SECRET=<64-hex>
Environment=ADMIN_USER=admin
Environment=ADMIN_PASS=<password>
Environment=BAOSTOCK_URL=http://localhost:8888
```

> The BaoStock Python service must run separately on port 8888. The Node.js server serves both the API and the built frontend from `server/dist/`.

---

## Architecture Decisions

| ADR | Decision |
|-----|----------|
| [ADR-001](docs/decisions/ADR-001-fastapi-over-flask.md) | BaoStock microservice: FastAPI over Flask |
| [ADR-002](docs/decisions/ADR-002-in-memory-cache-over-mysql.md) | In-memory cache over MySQL for signals |
| [ADR-003](docs/decisions/ADR-003-futu-mock-layer.md) | Futu mock layer for paper trading |
| [ADR-004](docs/decisions/ADR-004-sqlite-aes256-jwt-auth.md) | SQLite + AES-256-GCM + JWT multi-user auth |
| [ADR-005](docs/decisions/ADR-005-mobile-responsive-breakpoint-isolation.md) | Mobile responsive: Tailwind breakpoint isolation |
