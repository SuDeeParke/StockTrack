# ADR-001: 使用 FastAPI 替代 InStock 原有 Flask 层

## Status
Accepted

## Date
2026-06-18

## Context
InStock 原项目使用 Flask 作为 Web 层。StockTrack 需要在其基础上构建新的 API 层，支持：
- 异步处理（回测 job、数据刷新）
- 严格的类型安全（前后端契约对齐）
- 自动生成 API 文档（供前端开发参考）
- 与 Pydantic v2 数据模型深度集成

## Decision
使用 FastAPI + Pydantic v2 作为后端 Web 框架，不复用 InStock 的 Flask 层。

## Alternatives Considered

### 保留 Flask
- Pros: 与 InStock 代码路径一致，改动最少
- Cons: 无原生异步支持；类型注解需额外工具；文档生成繁琐
- Rejected: 异步需求（APScheduler lifespan、回测 job）使 Flask 改造成本过高

### Django REST Framework
- Pros: 生态成熟，ORM 集成完善
- Cons: 重量级，ORM 与已有 SQLAlchemy 冲突；启动速度慢
- Rejected: 项目规模不需要 Django 全功能

## Consequences
- FastAPI lifespan 事件管理 APScheduler 启动/停止
- Pydantic v2 模型作为 API 边界，前端 TypeScript 类型与之严格对齐
- Swagger UI 自动生成（`/docs`），无需手写 API 文档
- 异步端点支持回测 BackgroundTasks 模式
