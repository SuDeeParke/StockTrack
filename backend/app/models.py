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
