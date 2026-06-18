"""
US market data pipeline using yfinance.
Fetches OHLCV data and computes technical indicators.
Signals are stored in-memory for now; replace with MySQL in T9/production.
"""
from datetime import date, timedelta
from typing import Optional

try:
    import pandas as pd
except ImportError:  # pragma: no cover - exercised only when dependency is missing
    pd = None

try:
    import yfinance as yf
except ImportError:  # pragma: no cover - exercised only when dependency is missing
    yf = None

from app.models import IndicatorSnapshot, OHLCVBar, Signal, SignalType

# Top 20 Nasdaq-100 components for demo
US_WATCHLIST = [
    "AAPL",
    "MSFT",
    "NVDA",
    "AMZN",
    "META",
    "GOOGL",
    "TSLA",
    "AVGO",
    "COST",
    "NFLX",
    "AMD",
    "ADBE",
    "QCOM",
    "INTC",
    "TXN",
    "PYPL",
    "SBUX",
    "GILD",
    "MDLZ",
    "ISRG",
]


def ticker_to_us(symbol: str) -> str:
    """Convert bare symbol to .US format."""
    return f"{symbol}.US" if not symbol.endswith(".US") else symbol


def us_to_yf(ticker: str) -> str:
    """Convert .US format to yfinance symbol."""
    return ticker.replace(".US", "")


def fetch_ohlcv(ticker: str, days: int = 90) -> list[OHLCVBar]:
    """Fetch OHLCV bars from yfinance."""
    if yf is None:
        return []

    symbol = us_to_yf(ticker)
    end = date.today()
    start = end - timedelta(days=days + 10)
    try:
        df = yf.download(
            symbol,
            start=start.isoformat(),
            end=end.isoformat(),
            auto_adjust=True,
            progress=False,
        )
        if df.empty:
            return []

        df = df.tail(days)
        bars = []
        for idx, row in df.iterrows():
            bars.append(
                OHLCVBar(
                    date=idx.date(),
                    open=round(float(row["Open"]), 4),
                    high=round(float(row["High"]), 4),
                    low=round(float(row["Low"]), 4),
                    close=round(float(row["Close"]), 4),
                    volume=float(row["Volume"]),
                )
            )
        return bars
    except Exception:
        return []


def compute_indicators(
    bars: list[OHLCVBar], ticker: str
) -> Optional[IndicatorSnapshot]:
    """Compute MACD, RSI, Bollinger Bands from OHLCV bars using pandas."""
    if len(bars) < 26:
        return None

    closes = [float(b.close) for b in bars]

    if pd is not None:
        close_series = pd.Series(closes, dtype="float64")

        ema12 = close_series.ewm(span=12, adjust=False).mean().tolist()
        ema26 = close_series.ewm(span=26, adjust=False).mean().tolist()
        macd_line = [a - b for a, b in zip(ema12, ema26)]
        signal_line = (
            pd.Series(macd_line, dtype="float64").ewm(span=9, adjust=False).mean().tolist()
        )
        macd_hist = [a - b for a, b in zip(macd_line, signal_line)]

        delta = close_series.diff()
        gain = delta.clip(lower=0).rolling(14).mean().tolist()
        loss = (-delta.clip(upper=0)).rolling(14).mean().tolist()
        rsi_series = 100 - (100 / (1 + (gain / pd.Series(loss).replace(0, float("nan")))))
        rsi_values = rsi_series.tolist()

        sma20 = close_series.rolling(20).mean().tolist()
        std20 = close_series.rolling(20).std().tolist()
        boll_upper = [
            mid + 2 * std if mid is not None and std is not None else None
            for mid, std in zip(sma20, std20)
        ]
        boll_lower = [
            mid - 2 * std if mid is not None and std is not None else None
            for mid, std in zip(sma20, std20)
        ]
    else:
        ema12 = _ema(closes, 12)
        ema26 = _ema(closes, 26)
        macd_line = [a - b for a, b in zip(ema12, ema26)]
        signal_line = _ema(macd_line, 9)
        macd_hist = [a - b for a, b in zip(macd_line, signal_line)]
        rsi_values = _rsi(closes, 14)
        sma20, std20 = _rolling_mean_std(closes, 20)
        boll_upper = [
            mid + 2 * std if mid is not None and std is not None else None
            for mid, std in zip(sma20, std20)
        ]
        boll_lower = [
            mid - 2 * std if mid is not None and std is not None else None
            for mid, std in zip(sma20, std20)
        ]

    market_part = ticker.split(".")[-1] if "." in ticker else "US"
    market = "US" if market_part == "US" else "CN"

    return IndicatorSnapshot(
        ticker=ticker,
        market=market,
        date=bars[-1].date,
        macd=round(float(macd_line[-1]), 4),
        macd_signal=round(float(signal_line[-1]), 4),
        macd_hist=round(float(macd_hist[-1]), 4),
        rsi=round(float(rsi_values[-1]), 2) if rsi_values[-1] is not None else None,
        boll_upper=round(float(boll_upper[-1]), 4) if boll_upper[-1] is not None else None,
        boll_mid=round(float(sma20[-1]), 4) if sma20[-1] is not None else None,
        boll_lower=round(float(boll_lower[-1]), 4) if boll_lower[-1] is not None else None,
    )


def generate_signal(ticker: str, snap: IndicatorSnapshot) -> Signal:
    """Simple rule-based signal from indicators."""
    signal_type = SignalType.WATCH
    if snap.rsi is not None and snap.macd is not None:
        if snap.rsi < 40 and snap.macd > 0:
            signal_type = SignalType.BUY
        elif snap.rsi > 65 and snap.macd < 0:
            signal_type = SignalType.SELL

    bars = fetch_ohlcv(ticker, days=1)
    price = bars[-1].close if bars else 0.0
    return Signal(
        ticker=ticker,
        market="US",
        signal_type=signal_type,
        date=snap.date,
        price=price,
        indicators={
            "macd": snap.macd,
            "rsi": snap.rsi,
            "boll_upper": snap.boll_upper,
            "boll_lower": snap.boll_lower,
        },
    )


def _ema(values: list[float], span: int) -> list[float]:
    alpha = 2 / (span + 1)
    result: list[float] = []
    prev: Optional[float] = None
    for value in values:
        prev = value if prev is None else (value * alpha) + (prev * (1 - alpha))
        result.append(prev)
    return result


def _rsi(values: list[float], period: int) -> list[Optional[float]]:
    result: list[Optional[float]] = [None]
    deltas = [curr - prev for prev, curr in zip(values, values[1:])]
    for idx in range(1, len(values)):
        if idx < period:
            result.append(None)
            continue
        window = deltas[idx - period : idx]
        gains = [delta for delta in window if delta > 0]
        losses = [-delta for delta in window if delta < 0]
        avg_gain = sum(gains) / period if gains else 0.0
        avg_loss = sum(losses) / period if losses else 0.0
        if avg_loss == 0:
            result.append(100.0 if avg_gain > 0 else 50.0)
            continue
        rs = avg_gain / avg_loss
        result.append(100 - (100 / (1 + rs)))
    return result


def _rolling_mean_std(
    values: list[float], period: int
) -> tuple[list[Optional[float]], list[Optional[float]]]:
    means: list[Optional[float]] = []
    stds: list[Optional[float]] = []
    for idx in range(len(values)):
        if idx + 1 < period:
            means.append(None)
            stds.append(None)
            continue
        window = values[idx + 1 - period : idx + 1]
        mean = sum(window) / period
        variance = sum((value - mean) ** 2 for value in window) / (period - 1)
        means.append(mean)
        stds.append(variance**0.5)
    return means, stds
