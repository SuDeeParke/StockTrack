# Spec: Phase 0 T1 FastAPI Backend Spike

## Objective
为 StockTrack 创建一个可启动的 Python FastAPI 后端骨架，提供健康检查接口与 mock signals 接口，作为后续数据接入和策略引擎替换的基础。

## Tech Stack
- Python
- FastAPI
- Pydantic v2
- Uvicorn

## Commands
- Install: `pip install -r backend/requirements.txt`
- Run dev server: `uvicorn app.main:app --app-dir backend --reload`

## Project Structure
- `backend/requirements.txt`：后端依赖清单
- `backend/.env.example`：环境变量示例
- `backend/app/main.py`：FastAPI 应用入口
- `backend/app/models.py`：Pydantic 数据模型
- `backend/app/routers/signals.py`：signals mock 路由

## Code Style
```python
from fastapi import FastAPI

app = FastAPI(title="StockTrack API", version="0.1.0")
```

约定：
- 复用 `app.*` 作为后端包路径
- 先保持最小可运行骨架，不提前接入真实数据源
- 路由返回值使用 Pydantic 模型约束

## Testing Strategy
- 本任务以安装验证和 import 级运行验证为主
- 至少执行依赖安装命令
- 至少执行一次应用导入或路由导入验证，确认骨架无语法错误

## Boundaries
- Always: 只改 `backend` 和新增文档；目录先创建再写文件；保持 mock 实现
- Ask first: 修改前端、任务清单、引入额外未要求的后端模块
- Never: 修改 `tasks/todo.md`、`tasks/plan.md`，或改动根目录前端文件

## Success Criteria
- `backend/requirements.txt` 内容与要求一致
- `backend/.env.example` 创建完成
- `backend/app/main.py`、`models.py`、`routers/signals.py` 可导入
- FastAPI 应用已注册 `/api/health` 和 `/api/signals`
- `pip install -r backend/requirements.txt` 执行完成

## Open Questions
- 无。本次 Spike 按用户给定内容直接落地。
