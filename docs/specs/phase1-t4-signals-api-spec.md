# Spec: Phase 1 T4 Signals API

## Objective
为 StockTrack 后端补齐 A 股信号查询 API 的 mock 版本，保持最终 InStock 接入时的接口形状不变。当前环境无 MySQL，因此只交付可测试的 mock 数据实现。

## Tech Stack
- Python 3.11
- FastAPI
- Pydantic v2
- pytest
- httpx / FastAPI TestClient

## Commands
- Install test dependency: `python -m pip install httpx`
- Run tests: `python -m pytest backend/tests/ -v`
- Run dev server: `uvicorn app.main:app --app-dir backend --reload`

## Project Structure
- `backend/app/main.py`: FastAPI 应用入口
- `backend/app/models.py`: API 响应模型
- `backend/app/routers/signals.py`: signals 与 stock 相关路由
- `backend/tests/test_signals_api.py`: API 行为测试

## Code Style
```python
@router.get("/api/signals", response_model=list[Signal])
async def get_signals(...):
    ...
```

约定：
- 继续复用 `app.models` 中现有模型，不新增临时响应结构
- mock 数据必须稳定可测，避免随机断言波动
- ticker 不存在时统一返回 404

## Testing Strategy
- 先新增 API 测试，再补实现
- 以 `fastapi.testclient.TestClient` 做接口级测试
- 覆盖 health、market 过滤、ohlcv 成功/404、indicators 成功/404

## Boundaries
- Always: 只修改 `backend/app/main.py`、`backend/app/routers/signals.py`、测试文件和新增文档
- Ask first: 修改模型字段定义、引入真实数据库连接、扩大接口范围
- Never: 修改 `tasks/todo.md`、`tasks/plan.md`、`docker-compose.yml`、`Dockerfile`、`vite.config.ts`

## Success Criteria
- `/api/signals` 支持 `market`、`date`、`limit`
- 非当天 `date` 返回的 `Signal` 带 `stale=True`
- `/api/stocks/{ticker}/ohlcv` 返回 `list[OHLCVBar]`，未知 ticker 返回 404
- `/api/stocks/{ticker}/indicators` 返回 `IndicatorSnapshot`，未知 ticker 返回 404
- `python -m pytest backend/tests/ -v` 通过

## Open Questions
- “date 超出范围” 当前按“不是今天的 mock 数据请求都视为 stale”实现，后续接入真实 DB 时可改成基于可用交易日判断。
