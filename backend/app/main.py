import logging
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Literal

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from app.routers import backtest, portfolio, signals
from app.scheduler import refresh_cn, refresh_us, start_scheduler, stop_scheduler
from app.services import data_cache

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title="StockTrack API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(signals.router)
app.include_router(backtest.router)
app.include_router(portfolio.router)


@app.get("/api/health")
async def health():
    last = data_cache.get_last_refresh()
    return {
        "status": "ok",
        "version": "0.1.0",
        "last_refresh": last.isoformat() if last else None,
    }


@app.post("/api/admin/refresh")
async def manual_refresh(market: Literal["CN", "US", "ALL"] = Query("ALL")):
    """Manually trigger data refresh."""
    started_at = datetime.utcnow().isoformat()
    if market in ("CN", "ALL"):
        await refresh_cn()
    if market in ("US", "ALL"):
        await refresh_us()
    return {"status": "triggered", "market": market, "started_at": started_at}
