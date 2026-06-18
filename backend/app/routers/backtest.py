import uuid
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.models import BacktestRequest, BacktestResult, BacktestStatus, BacktestStrategy
from app.services.backtest_engine import get_strategies, run_backtest_async

router = APIRouter(prefix="/api/backtest", tags=["backtest"])

_jobs: dict[str, BacktestResult] = {}


@router.get("/strategies", response_model=list[BacktestStrategy])
async def list_strategies():
    return get_strategies()


@router.post("/run", response_model=BacktestResult, status_code=202)
async def start_backtest(req: BacktestRequest, background_tasks: BackgroundTasks):
    valid_ids = {strategy.id for strategy in get_strategies()}
    if req.strategy_id not in valid_ids:
        raise HTTPException(status_code=422, detail=f"Unknown strategy_id: {req.strategy_id!r}")
    if not req.tickers:
        raise HTTPException(status_code=422, detail="tickers must not be empty")

    job_id = str(uuid.uuid4())
    placeholder = BacktestResult(
        job_id=job_id,
        status=BacktestStatus.RUNNING,
        strategy_id=req.strategy_id,
        tickers=req.tickers,
        start_date=req.start_date,
        end_date=req.end_date,
        created_at=datetime.utcnow().isoformat(),
    )
    _jobs[job_id] = placeholder

    async def _run():
        result = await run_backtest_async(req, job_id)
        result.created_at = placeholder.created_at
        _jobs[job_id] = result

    background_tasks.add_task(_run)
    return placeholder


@router.get("/result/{job_id}", response_model=BacktestResult)
async def get_result(job_id: str):
    if job_id not in _jobs:
        raise HTTPException(status_code=404, detail=f"Job {job_id!r} not found")
    return _jobs[job_id]
