import pytest
from datetime import date

from app.models import Signal, Stock, OHLCVBar, IndicatorSnapshot, SignalType


def test_signal_cn():
    s = Signal(
        ticker="600519.SH",
        market="CN",
        signal_type=SignalType.BUY,
        date=date.today(),
        price=1800.0,
    )
    assert s.market == "CN"
    assert s.signal_type == SignalType.BUY
    assert s.stale is False


def test_signal_us():
    s = Signal(
        ticker="AAPL.US",
        market="US",
        signal_type=SignalType.SELL,
        date=date.today(),
        price=195.5,
        indicators={"rsi": 70.1},
    )
    assert s.market == "US"
    assert s.indicators["rsi"] == 70.1


def test_stock():
    s = Stock(
        ticker="TSLA.US",
        market="US",
        name="Tesla",
        price=175.0,
        change_pct=-1.5,
    )
    assert s.market == "US"


def test_ohlcv():
    bar = OHLCVBar(
        date=date.today(),
        open=100.0,
        high=105.0,
        low=99.0,
        close=103.0,
        volume=1000000.0,
    )
    assert bar.close > bar.low


def test_indicator_snapshot():
    snap = IndicatorSnapshot(
        ticker="000001.SZ",
        market="CN",
        date=date.today(),
        macd=1.5,
        rsi=55.0,
    )
    assert snap.kdj_k is None
    assert snap.rsi == 55.0


def test_signal_json_schema():
    schema = Signal.model_json_schema()
    assert "ticker" in schema["properties"]
    assert "market" in schema["properties"]
