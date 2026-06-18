# NOTE: Using mock data; replace with InStock DB queries in production.
from datetime import date, timedelta
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Query

from app.models import IndicatorSnapshot, OHLCVBar, Signal, SignalType

router = APIRouter(tags=["signals"])

_MOCK_SIGNALS = [
    Signal(
        ticker="600519.SH",
        market="CN",
        signal_type=SignalType.BUY,
        date=date.today(),
        price=1800.0,
        indicators={"macd": 2.5, "rsi": 45.2, "kdj_k": 60.1},
    ),
    Signal(
        ticker="000858.SZ",
        market="CN",
        signal_type=SignalType.SELL,
        date=date.today(),
        price=145.3,
        indicators={"macd": -1.2, "rsi": 72.8, "kdj_k": 80.3},
    ),
    Signal(
        ticker="300750.SZ",
        market="CN",
        signal_type=SignalType.WATCH,
        date=date.today(),
        price=220.5,
        indicators={"macd": 0.3, "rsi": 55.0, "kdj_k": 55.5},
    ),
    Signal(
        ticker="601318.SH",
        market="CN",
        signal_type=SignalType.BUY,
        date=date.today(),
        price=45.6,
        indicators={"macd": 1.1, "rsi": 38.5, "kdj_k": 42.0},
    ),
    Signal(
        ticker="000001.SZ",
        market="CN",
        signal_type=SignalType.WATCH,
        date=date.today(),
        price=12.3,
        indicators={"macd": -0.2, "rsi": 50.0, "kdj_k": 48.0},
    ),
    Signal(
        ticker="AAPL.US",
        market="US",
        signal_type=SignalType.BUY,
        date=date.today(),
        price=195.5,
        indicators={"macd": 1.8, "rsi": 42.3, "kdj_k": 58.0},
    ),
    Signal(
        ticker="TSLA.US",
        market="US",
        signal_type=SignalType.WATCH,
        date=date.today(),
        price=175.2,
        indicators={"macd": -0.5, "rsi": 48.1, "kdj_k": 50.2},
    ),
]


def _gen_ohlcv(ticker: str, days: int) -> list[OHLCVBar]:
    """Generate deterministic fake OHLCV bars for mock purposes."""
    import hashlib
    import random

    seed = int(hashlib.md5(ticker.encode()).hexdigest()[:8], 16)
    rng = random.Random(seed)
    base = 100.0
    bars = []
    for i in range(days):
        d = date.today() - timedelta(days=days - i - 1)
        open_ = base * (1 + rng.uniform(-0.02, 0.02))
        close = open_ * (1 + rng.uniform(-0.03, 0.03))
        high = max(open_, close) * (1 + rng.uniform(0, 0.01))
        low = min(open_, close) * (1 - rng.uniform(0, 0.01))
        volume = rng.uniform(1_000_000, 50_000_000)
        bars.append(
            OHLCVBar(
                date=d,
                open=round(open_, 2),
                high=round(high, 2),
                low=round(low, 2),
                close=round(close, 2),
                volume=round(volume, 0),
            )
        )
        base = close
    return bars


_KNOWN_TICKERS = {signal.ticker for signal in _MOCK_SIGNALS}


@router.get("/api/signals", response_model=list[Signal])
async def get_signals(
    market: Literal["CN", "US", "ALL"] = Query("ALL"),
    date_: Optional[date] = Query(None, alias="date"),
    limit: int = Query(50, ge=1, le=200),
):
    results = (
        _MOCK_SIGNALS
        if market == "ALL"
        else [signal for signal in _MOCK_SIGNALS if signal.market == market]
    )
    if date_ and date_ != date.today():
        results = [signal.model_copy(update={"stale": True}) for signal in results]
    return results[:limit]


@router.get("/api/stocks/{ticker}/ohlcv", response_model=list[OHLCVBar])
async def get_ohlcv(ticker: str, days: int = Query(90, ge=1, le=365)):
    if ticker not in _KNOWN_TICKERS:
        raise HTTPException(status_code=404, detail=f"Ticker {ticker!r} not found")
    return _gen_ohlcv(ticker, days)


@router.get("/api/stocks/{ticker}/indicators", response_model=IndicatorSnapshot)
async def get_indicators(ticker: str):
    signal = next((item for item in _MOCK_SIGNALS if item.ticker == ticker), None)
    if signal is None:
        raise HTTPException(status_code=404, detail=f"Ticker {ticker!r} not found")
    indicators = signal.indicators
    return IndicatorSnapshot(
        ticker=ticker,
        market=signal.market,
        date=signal.date,
        macd=indicators.get("macd"),
        rsi=indicators.get("rsi"),
        kdj_k=indicators.get("kdj_k"),
    )
