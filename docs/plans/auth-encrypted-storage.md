# Implementation Plan: Multi-User Auth + Encrypted Storage

> Status: **Completed** — All 13 tasks shipped, deployed to production.
> See ADR-004 for architectural rationale.

## Overview

Replace plain-JSON file storage with SQLite + AES-256-GCM column encryption. Add JWT-based account management so multiple users each have independent positions/orders/balance. Data files never enter git.

## Architecture Decisions

- **SQLite via `better-sqlite3`** — sync API fits Hono handlers; no native compilation on server
- **AES-256-GCM column encryption** — encrypt sensitive JSON columns with `SQLITE_KEY` env var
- **`bcryptjs`** — pure-JS bcrypt, no native dep, esbuild-external
- **`hono/jwt`** — stateless JWT middleware, 24h tokens
- **Admin bootstrap** — auto-create admin from `ADMIN_USER`/`ADMIN_PASS` env if `users` table empty

---

## Phase 1 — Foundation (Database + Schema)

- [x] **T1** — `data/` gitignore, `better-sqlite3` + `bcryptjs` deps, esbuild `--external:better-sqlite3`
- [x] **T2** — `server/services/db.ts`: DB init, WAL mode, `encryptJSON`/`decryptJSON` (AES-256-GCM)
- [x] **T3** — `server/services/db-schema.ts`: `initSchema()` creates tables, auto-seeds admin

## Phase 2 — Auth API

- [x] **T4** — `server/routes/auth.ts`: `POST /api/auth/login` + `GET /api/auth/me`
- [x] **T5** — `server/middleware/auth.ts`: Bearer token extraction, `c.set('userId', ...)`
- [x] **T6** — `server/index.ts`: wire auth middleware, skip `/api/auth/login`

## Phase 3 — Per-User Portfolio

- [x] **T7** — `server/services/portfolio-db.ts`: all ops take `userId`, UPSERT pattern
- [x] **T8** — `server/routes/portfolio.ts`: extract `userId` from context, pass to service

## Phase 4 — Frontend Auth

- [x] **T9** — `src/pages/Login.tsx`: dark theme login form, stores token in `localStorage`
- [x] **T10** — `src/api/client.ts`: Bearer interceptor, 401 → redirect to `/login`
- [x] **T11** — `src/App.tsx`: `ProtectedRoute` wrapping all non-login routes

## Phase 5 — Server Env + Deploy

- [x] **T12** — `.env.example` with all required env vars
- [x] **T13** — `deploy.sh` updated, `bcryptjs` copied alongside bundle, systemd env vars documented

---

## Production Config

```
/etc/systemd/system/stocktrack.service:
  Environment=SQLITE_KEY=<64-hex>   # openssl rand -hex 32
  Environment=JWT_SECRET=<64-hex>   # openssl rand -hex 32
  Environment=ADMIN_USER=admin
  Environment=ADMIN_PASS=stocktrack2024
  Environment=BAOSTOCK_URL=http://localhost:8888
```

## Key Files

| File | Role |
|------|------|
| `server/services/db.ts` | SQLite init, AES-256-GCM helpers |
| `server/services/db-schema.ts` | Table creation, admin seeding |
| `server/services/portfolio-db.ts` | Per-user portfolio CRUD |
| `server/middleware/auth.ts` | JWT verification, `ContextVariableMap` augmentation |
| `server/routes/auth.ts` | Login endpoint |
| `src/pages/Login.tsx` | Frontend login form |
| `src/api/client.ts` | Axios interceptors |

## Risks

| Risk | Mitigation |
|------|------------|
| `SQLITE_KEY` lost = data unreadable | Store in password manager / cloud KMS |
| `better-sqlite3` binary mismatch | Pin Node 20, verify after deploy |
| JWT secret rotation | Users re-login; 24h TTL limits blast radius |
