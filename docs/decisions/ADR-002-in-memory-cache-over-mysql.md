# ADR-002: 使用内存缓存替代 MySQL（开发阶段）

## Status
Accepted — 生产环境需替换为 MySQL

## Date
2026-06-18

## Context
项目依赖 MySQL 5.7 存储信号、OHLCV 和指标数据。但在初始开发阶段：
- 本机未安装 Docker，无法一键启动 MySQL
- 真实 A 股数据需要 akshare/tushare token，尚未配置
- 开发和测试需要确定性数据，而非依赖外部服务

## Decision
在 `backend/app/services/data_cache.py` 实现内存 KV 缓存层，接口与 MySQL 仓储层相同。所有业务逻辑通过此接口访问数据，不直接依赖数据库。

接口：
```python
get_signals() / store_signal()
get_ohlcv() / store_ohlcv()
get_indicator() / store_indicator()
get_last_refresh() / set_last_refresh()
```

## Alternatives Considered

### SQLite（文件数据库）
- Pros: 持久化，接近真实 SQL
- Cons: 需要 schema 迁移；测试数据清理麻烦；与 MySQL 仍有方言差异
- Rejected: 内存缓存更轻量，测试隔离更简单

### 直接使用 MySQL
- Pros: 与生产环境一致
- Cons: 依赖 Docker 或本地 MySQL 实例；CI 环境需额外配置
- Rejected: 增加本地开发门槛；开发阶段使用 mock 数据更高效

## Consequences
- 所有 36 个后端测试无需数据库依赖，运行速度 < 2s
- 服务重启后数据丢失（开发期间可接受）
- 切换真实 MySQL 只需替换 `data_cache.py` 实现，业务逻辑零改动
- 需在生产部署前实现 SQLAlchemy 仓储层
