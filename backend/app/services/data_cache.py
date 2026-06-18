"""In-memory data cache; replace with MySQL queries in production."""
from datetime import datetime
from typing import Optional

from app.models import IndicatorSnapshot, OHLCVBar, Signal

_signals: dict[str, Signal] = {}
_ohlcv: dict[str, list[OHLCVBar]] = {}
_indicators: dict[str, IndicatorSnapshot] = {}
_last_refresh: Optional[datetime] = None


def get_signals(market: str = "ALL") -> list[Signal]:
    sigs = list(_signals.values())
    if market != "ALL":
        sigs = [s for s in sigs if s.market == market]
    return sorted(sigs, key=lambda s: s.date, reverse=True)


def get_ohlcv(ticker: str) -> list[OHLCVBar]:
    return _ohlcv.get(ticker, [])


def get_indicator(ticker: str) -> Optional[IndicatorSnapshot]:
    return _indicators.get(ticker)


def store_signal(sig: Signal) -> None:
    _signals[sig.ticker] = sig


def store_ohlcv(ticker: str, bars: list[OHLCVBar]) -> None:
    _ohlcv[ticker] = bars


def store_indicator(ticker: str, snap: IndicatorSnapshot) -> None:
    _indicators[ticker] = snap


def set_last_refresh(dt: datetime) -> None:
    global _last_refresh
    _last_refresh = dt


def get_last_refresh() -> Optional[datetime]:
    return _last_refresh


def all_tickers() -> set[str]:
    return set(_signals.keys()) | set(_ohlcv.keys())

