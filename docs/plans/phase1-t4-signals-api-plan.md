# Implementation Plan: Phase 1 T4 Signals API

## Overview
本任务只补后端 mock API，不接 MySQL，不改模型定义。目标是把最终需要的三个端点和错误语义先固定下来，并用测试保护。

## Architecture Decisions
- 维持单个 router 承载 `/api/signals` 与 `/api/stocks/*` 路径，避免后续拆分前出现重复前缀
- 使用稳定 mock 数据和基于 ticker 的确定性 OHLCV 生成，保证测试可重复
- `stale` 直接挂在 `Signal` 模型上返回，不新增包装层，保持与现有模型兼容

## Task List

### Phase 1: Contract
- [ ] Task 1: 新增 signals API 测试
  - Acceptance: 覆盖 8 个接口场景
  - Verify: `python -m pytest backend/tests/test_signals_api.py -v`
  - Files: `backend/tests/test_signals_api.py`

### Phase 2: Implementation
- [ ] Task 2: 扩展 `signals.py` 为 3 个端点
  - Acceptance: 参数、返回模型、404 语义与任务要求一致
  - Verify: 运行 signals API 测试
  - Files: `backend/app/routers/signals.py`

- [ ] Task 3: 调整 `main.py` 路由注册
  - Acceptance: 新路由无重复前缀，现有 `/api/health` 保持可用
  - Verify: health 与 signals 测试通过
  - Files: `backend/app/main.py`

### Phase 3: Verification
- [ ] Task 4: 安装测试依赖并跑全量后端测试
  - Acceptance: `httpx` 可用，`backend/tests/` 全通过
  - Verify: `python -m pip install httpx`、`python -m pytest backend/tests/ -v`
  - Files: 无

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| TestClient 依赖未安装 | Medium | 显式执行 `python -m pip install httpx` |
| router 路径重复导致 404/错路由 | Medium | 明确让路由内部声明完整路径，`main.py` 不再加前缀 |
| mock 日期语义与未来真实数据不同 | Low | 在 spec 中记录为临时规则，后续接 DB 替换 |

## Open Questions
- 无，按任务给定规格直接实现。
