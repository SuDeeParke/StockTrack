# ADR-003: Futu OpenAPI 使用 Mock 层隔离

## Status
Accepted — 连接真实 OpenD 时替换 futu_mock.py

## Date
2026-06-18

## Context
Phase 3 需要接入 Futu OpenAPI 实现持仓查询、下单和风控。但：
- Futu OpenD 桌面客户端本机未安装
- 真实下单涉及资金风险，开发阶段不应直接连接券商
- 需要确定性测试数据验证风控规则

## Decision
在 `backend/app/services/futu_mock.py` 实现与真实 futu-api SDK 相同函数签名的 mock 层：
```python
get_positions() → list[Position]
get_balance() → AccountBalance
check_risk(req, balance, positions) → RiskCheckResult
place_order(req) → Order
get_orders() → list[Order]
```

router 层只依赖此接口，不直接 import futu SDK。

## Alternatives Considered

### 直接集成 futu-api SDK
- Pros: 真实行为，端到端验证
- Cons: 依赖 OpenD 进程；下单操作有资金风险；CI 无法运行
- Rejected: 开发阶段风险过高

### 使用 unittest.mock patch
- Pros: 标准 Python mock 方式
- Cons: mock 分散在测试文件中；生产代码中无清晰替换边界
- Rejected: 显式 mock 模块比 patch 更清晰，替换时只需改一个文件

## Consequences
- 8 个 portfolio 测试全部通过，无需任何外部进程
- 替换真实 OpenD 只需：安装 `futu-api`，实现相同接口的真实版本，修改 `portfolio.py` 的 import
- paper_trade=true 强制校验，防止误触真实下单
- 风控规则（单笔≤10%、日亏损≤2%、持仓≤5只）在 mock 层验证，对真实 SDK 同样生效
