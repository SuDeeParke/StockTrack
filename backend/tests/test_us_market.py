"""Unit tests for US market service (no network calls)."""
from datetime import date

from app.models import OHLCVBar
from app.services.us_market import compute_indicators, ticker_to_us, us_to_yf


def _make_bars(n=30, base=150.0):
    import random

    rng = random.Random(42)
    bars, price = [], base
    for i in range(n):
        open_ = price * (1 + rng.uniform(-0.01, 0.01))
        close = open_ * (1 + rng.uniform(-0.02, 0.02))
        bars.append(
            OHLCVBar(
                date=date(2024, 1, 1 + i % 28),
                open=round(open_, 2),
                high=round(close * 1.005, 2),
                low=round(open_ * 0.995, 2),
                close=round(close, 2),
                volume=1_000_000.0,
            )
        )
        price = close
    return bars


def test_ticker_conversion():
    assert ticker_to_us("AAPL") == "AAPL.US"
    assert ticker_to_us("AAPL.US") == "AAPL.US"
    assert us_to_yf("AAPL.US") == "AAPL"


def test_compute_indicators_enough_data():
    bars = _make_bars(50)
    snap = compute_indicators(bars, "AAPL.US")
    assert snap is not None
    assert snap.rsi is not None
    assert 0 < snap.rsi < 100
    assert snap.macd is not None


def test_compute_indicators_insufficient_data():
    bars = _make_bars(10)
    snap = compute_indicators(bars, "AAPL.US")
    assert snap is None


def test_data_cache():
    from app.models import Signal, SignalType
    from app.services import data_cache

    sig = Signal(
        ticker="MSFT.US",
        market="US",
        signal_type=SignalType.BUY,
        date=date.today(),
        price=400.0,
    )
    data_cache.store_signal(sig)
    results = data_cache.get_signals("US")
    assert any(s.ticker == "MSFT.US" for s in results)
