from datetime import date
from enum import Enum
from typing import Any, Literal, Optional

from pydantic import BaseModel


class SignalType(str, Enum):
    BUY = "BUY"
    SELL = "SELL"
    WATCH = "WATCH"


class Signal(BaseModel):
    ticker: str
    market: Literal["CN", "US"]
    signal_type: SignalType
    date: date
    price: float
    indicators: dict[str, Any] = {}
    stale: bool = False


class Stock(BaseModel):
    ticker: str
    market: Literal["CN", "US"]
    name: str
    price: float
    change_pct: float


class OHLCVBar(BaseModel):
    date: date
    open: float
    high: float
    low: float
    close: float
    volume: float


class IndicatorSnapshot(BaseModel):
    ticker: str
    market: Literal["CN", "US"]
    date: date
    macd: Optional[float] = None
    macd_signal: Optional[float] = None
    macd_hist: Optional[float] = None
    rsi: Optional[float] = None
    kdj_k: Optional[float] = None
    kdj_d: Optional[float] = None
    kdj_j: Optional[float] = None
    boll_upper: Optional[float] = None
    boll_mid: Optional[float] = None
    boll_lower: Optional[float] = None


# ── Backtest models ──────────────────────────────────────────────
import uuid
from enum import Enum as _Enum


class BacktestStatus(str, _Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    DONE = "DONE"
    FAILED = "FAILED"


class BacktestStrategy(BaseModel):
    id: str
    name: str
    description: str
    markets: list[Literal["CN", "US"]]


class BacktestRequest(BaseModel):
    strategy_id: str
    tickers: list[str]
    start_date: date
    end_date: date
    initial_capital: float = 100_000.0


class Trade(BaseModel):
    ticker: str
    action: Literal["BUY", "SELL"]
    date: date
    price: float
    shares: float
    pnl: float = 0.0


class BacktestStats(BaseModel):
    total_return_pct: float
    annualized_return_pct: float
    sharpe_ratio: float
    max_drawdown_pct: float
    win_rate_pct: float
    total_trades: int


class EquityPoint(BaseModel):
    date: date
    equity: float
    benchmark: float


class BacktestResult(BaseModel):
    job_id: str
    status: BacktestStatus
    strategy_id: str
    tickers: list[str]
    start_date: date
    end_date: date
    equity_curve: list[EquityPoint] = []
    trades: list[Trade] = []
    stats: Optional[BacktestStats] = None
    error: Optional[str] = None
    created_at: str = ""
