#!/usr/bin/env python3
"""BaoStock data microservice for StockTrack."""
import logging
from datetime import datetime, timedelta
import pandas as pd
import baostock as bs
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

app = FastAPI(title="BaoStock API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

WATCH_LIST = {
    "600519.SH": ("sh.600519", "贵州茅台", "CN"),
    "000858.SZ": ("sz.000858", "五粮液",   "CN"),
    "300750.SZ": ("sz.300750", "宁德时代", "CN"),
    "601318.SH": ("sh.601318", "中国平安", "CN"),
    "000001.SZ": ("sz.000001", "平安银行", "CN"),
    "600036.SH": ("sh.600036", "招商银行", "CN"),
}


def bs_fetch_ohlcv(bs_code: str, days: int = 120) -> pd.DataFrame:
    end = datetime.today().strftime("%Y-%m-%d")
    start = (datetime.today() - timedelta(days=days + 60)).strftime("%Y-%m-%d")
    lg = bs.login()
    if lg.error_code != "0":
        raise RuntimeError(f"BaoStock login failed: {lg.error_msg}")
    rs = bs.query_history_k_data_plus(
        bs_code,
        "date,open,high,low,close,volume",
        start_date=start,
        end_date=end,
        frequency="d",
        adjustflag="3",
    )
    rows = []
    while rs.next():
        rows.append(rs.get_row_data())
    bs.logout()
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows, columns=["date", "open", "high", "low", "close", "volume"])
    for col in ["open", "high", "low", "close", "volume"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df.dropna(subset=["close"], inplace=True)
    df.sort_values("date", inplace=True)
    df.reset_index(drop=True, inplace=True)
    return df.tail(days)


def calc_indicators(df: pd.DataFrame) -> dict:
    if len(df) < 30:
        return {}
    close = df["close"]

    # MACD (12, 26, 9)
    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    dif = ema12 - ema26
    dea = dif.ewm(span=9, adjust=False).mean()
    macd = (dif - dea) * 2

    # RSI (14)
    delta = close.diff()
    gain = delta.clip(lower=0).ewm(com=13, adjust=False).mean()
    loss = (-delta.clip(upper=0)).ewm(com=13, adjust=False).mean()
    rsi = 100 - 100 / (1 + gain / loss.replace(0, 1e-9))

    # KDJ (9, 3, 3)
    low9 = df["low"].rolling(9).min()
    high9 = df["high"].rolling(9).max()
    rsv = (close - low9) / (high9 - low9 + 1e-9) * 100
    K = rsv.ewm(com=2, adjust=False).mean()
    D = K.ewm(com=2, adjust=False).mean()
    J = 3 * K - 2 * D

    return {
        "macd":       round(float(macd.iloc[-1]), 4),
        "macd_dif":   round(float(dif.iloc[-1]),  4),
        "macd_dea":   round(float(dea.iloc[-1]),  4),
        "rsi":        round(float(rsi.iloc[-1]),   2),
        "kdj_k":      round(float(K.iloc[-1]),     2),
        "kdj_d":      round(float(D.iloc[-1]),     2),
        "kdj_j":      round(float(J.iloc[-1]),     2),
        "_dif_prev":  round(float(dif.iloc[-2]),   4) if len(dif) >= 2 else 0,
        "_dea_prev":  round(float(dea.iloc[-2]),   4) if len(dea) >= 2 else 0,
    }


def derive_signal(ind: dict) -> str:
    if not ind:
        return "WATCH"
    macd = ind["macd"]
    rsi = ind["rsi"]
    kdj_j = ind["kdj_j"]
    dif = ind["macd_dif"]
    dea = ind["macd_dea"]
    dif_prev = ind["_dif_prev"]
    dea_prev = ind["_dea_prev"]

    golden_cross = dif_prev < dea_prev and dif >= dea
    death_cross  = dif_prev > dea_prev and dif <= dea

    if golden_cross or (rsi < 35 and macd > 0) or kdj_j < 10:
        return "BUY"
    if death_cross or (rsi > 70 and macd < 0) or kdj_j > 90:
        return "SELL"
    return "WATCH"


@app.get("/api/health")
def health():
    return {"status": "ok", "source": "baostock"}


@app.get("/api/signals")
def get_signals(market: str = "ALL", limit: int = 50):
    results = []
    for ticker, (bs_code, name, mkt) in WATCH_LIST.items():
        if market not in ("ALL", mkt):
            continue
        try:
            df = bs_fetch_ohlcv(bs_code, days=90)
            if df.empty:
                continue
            ind = calc_indicators(df)
            signal_type = derive_signal(ind)
            price = float(df["close"].iloc[-1])
            ind_clean = {k: v for k, v in ind.items() if not k.startswith("_")}
            results.append({
                "ticker":      ticker,
                "name":        name,
                "market":      mkt,
                "signal_type": signal_type,
                "date":        df["date"].iloc[-1],
                "price":       round(price, 2),
                "indicators":  ind_clean,
                "stale":       False,
            })
        except Exception as e:
            log.warning(f"Failed {ticker}: {e}")
    return results[:limit]


@app.get("/api/stocks/{ticker}/ohlcv")
def get_ohlcv(ticker: str, days: int = 90):
    entry = WATCH_LIST.get(ticker)
    if not entry:
        raise HTTPException(404, detail=f"Ticker '{ticker}' not found")
    bs_code, _, _ = entry
    try:
        df = bs_fetch_ohlcv(bs_code, days=days)
    except Exception as e:
        raise HTTPException(500, detail=str(e))
    if df.empty:
        raise HTTPException(404, detail="No data available")
    return [
        {
            "date":   row.date,
            "open":   round(row.open,  2),
            "high":   round(row.high,  2),
            "low":    round(row.low,   2),
            "close":  round(row.close, 2),
            "volume": int(row.volume),
        }
        for row in df.itertuples()
    ]


@app.get("/api/stocks/{ticker}/indicators")
def get_indicators(ticker: str):
    entry = WATCH_LIST.get(ticker)
    if not entry:
        raise HTTPException(404, detail=f"Ticker '{ticker}' not found")
    bs_code, _, mkt = entry
    try:
        df = bs_fetch_ohlcv(bs_code, days=120)
        ind = calc_indicators(df)
    except Exception as e:
        raise HTTPException(500, detail=str(e))
    if not ind:
        raise HTTPException(404, detail="Insufficient data")
    ind_clean = {k: v for k, v in ind.items() if not k.startswith("_")}
    return {
        "ticker": ticker,
        "market": mkt,
        "date":   datetime.today().strftime("%Y-%m-%d"),
        **ind_clean,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8888)
