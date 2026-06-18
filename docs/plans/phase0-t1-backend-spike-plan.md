# Implementation Plan: Phase 0 T1 FastAPI Backend Spike

## Overview
本次 Spike 只交付最小后端骨架，不接数据库、不接真实行情源，先保证依赖、目录、模型、路由、应用入口完整可运行。

## Architecture Decisions
- 使用 `backend/app/main.py` 作为应用入口，便于后续扩展更多 routers
- `signals` 接口先返回 mock `Signal` 列表，后续 T4 再替换真实引擎调用
- 采用 Pydantic 模型统一接口结构，避免后续路由先写死 dict

## Task List

### Phase 1: Foundation
- [ ] Task 1: 建立文档和目录基础
  - Acceptance: `docs/specs`、`docs/plans`、`backend/app/routers` 已就位
  - Verify: 目录存在

- [ ] Task 2: 写入后端骨架文件
  - Acceptance: 目标文件全部创建，内容与任务要求一致
  - Verify: 文件内容检查

### Checkpoint: Foundation
- [ ] 文件存在且路径正确

### Phase 2: Verification
- [ ] Task 3: 安装依赖并做导入验证
  - Acceptance: `pip install -r backend/requirements.txt` 成功
  - Verify: 执行安装命令；执行 Python 导入校验

### Checkpoint: Complete
- [ ] 依赖安装完成
- [ ] 应用骨架可导入

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| `pandas-ta` 在当前索引不可安装 | High | 如失败，保留错误输出并明确未完成项 |
| 本机 Python 未配置到 PATH | Medium | 改用 `py -m pip` / `python -m pip` 兜底 |

## Open Questions
- 无
