# ADR-004: SQLite + AES-256-GCM 列加密 + JWT 多用户认证

## Status

Accepted

## Date

2026-06-18

## Context

StockTrack 需要将持仓/订单/资金数据从 git 仓库中移除，并支持多用户各自独立的投资组合。核心约束：

- 部署环境是单台 Alibaba Cloud ECS，root 权限，无 DBA 支持
- 后端是 Hono/Node.js TypeScript，用 esbuild 打包
- 数据量极小（家庭/朋友使用），不需要分布式
- 团队无运维资源，不希望维护独立数据库服务进程

## Decision

### 数据存储: SQLite via `better-sqlite3`

使用嵌入式 SQLite，同步 API，无需额外进程。

### 加密: AES-256-GCM 列加密

对 `positions`、`balance`、`orders` 表的 JSON 列做应用层加密，而非 SQLCipher（需编译）。格式：`hex(iv):hex(authTag):hex(ciphertext)`，密钥从 `SQLITE_KEY` 环境变量读取（64 hex chars = 32 bytes）。

### 认证: JWT (hono/jwt) + bcryptjs

- `bcryptjs` 纯 JS 实现，无 native addon，esbuild 友好
- JWT stateless，24h 过期，密钥从 `JWT_SECRET` env 读取
- Frontend 存 `localStorage`，axios 拦截器注入 Bearer，401 自动跳转登录

### Admin 自举

首次启动时若 `users` 表为空，从 `ADMIN_USER`/`ADMIN_PASS` env 自动创建管理员。

## Alternatives Considered

### PostgreSQL / MySQL
- Pros: 功能完整，生产级并发
- Cons: 需要独立进程，需要 DBA 维护，对家庭使用规模严重过度
- Rejected

### SQLCipher（数据库级加密）
- Pros: 更彻底的加密，透明
- Cons: 需要从源码编译 native addon，在 ECS 上构建不稳定
- Rejected

### 文件存储（原方案）
- Cons: 数据在 git 仓库中，无访问控制，无多用户隔离
- Rejected（原始问题）

### Redis + Session
- Cons: 增加基础设施复杂度，需要 session store
- Rejected: JWT stateless 更简单

## Consequences

**正面:**
- 零外部依赖，单文件数据库，备份简单（`cp data/stocktrack.db`）
- 数据库文件在 ECS 磁盘上，列数据加密，即使文件泄露数据不可读
- esbuild 打包无障碍（`--external:better-sqlite3 --external:bcryptjs`）

**负面/注意事项:**
- `SQLITE_KEY` 丢失 = 所有数据永久不可读，必须备份到密码管理器
- SQLite 写并发有限（单写者），对当前规模足够
- `better-sqlite3` 需要将 native `.node` 文件 `cp -r` 到 `server/dist/node_modules/`（在 `deploy.sh` 中处理）

## References

- Implementation: `docs/plans/auth-encrypted-storage.md`
- Key files: `server/services/db.ts`, `server/middleware/auth.ts`, `server/services/portfolio-db.ts`
