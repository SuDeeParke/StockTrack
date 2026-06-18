from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200


def test_signals_all():
    r = client.get("/api/signals")
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 5
    assert all("ticker" in s and "market" in s for s in data)


def test_signals_cn_filter():
    r = client.get("/api/signals?market=CN")
    assert r.status_code == 200
    assert all(s["market"] == "CN" for s in r.json())


def test_signals_us_filter():
    r = client.get("/api/signals?market=US")
    assert r.status_code == 200
    assert all(s["market"] == "US" for s in r.json())


def test_ohlcv_known():
    r = client.get("/api/stocks/600519.SH/ohlcv?days=30")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 30
    assert "open" in data[0]


def test_ohlcv_unknown():
    r = client.get("/api/stocks/NOTEXIST.XX/ohlcv")
    assert r.status_code == 404


def test_indicators_known():
    r = client.get("/api/stocks/AAPL.US/indicators")
    assert r.status_code == 200
    data = r.json()
    assert data["ticker"] == "AAPL.US"
    assert "rsi" in data


def test_indicators_unknown():
    r = client.get("/api/stocks/FAKE.XX/indicators")
    assert r.status_code == 404
