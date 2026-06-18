from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_get_positions():
    r = client.get("/api/portfolio/positions")
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 1
    assert all("ticker" in p and "market" in p and "pnl" in p for p in data)


def test_get_balance():
    r = client.get("/api/portfolio/balance")
    assert r.status_code == 200
    data = r.json()
    assert "total_assets" in data and "cash" in data


def test_risk_check_pass():
    r = client.post(
        "/api/portfolio/risk-check",
        json={
            "ticker": "600519.SH",
            "market": "CN",
            "side": "BUY",
            "qty": 1,
            "price": 1750.0,
            "paper_trade": True,
        },
    )
    assert r.status_code == 200
    assert r.json()["passed"] is True


def test_risk_check_fail_position_limit():
    r = client.post(
        "/api/portfolio/risk-check",
        json={
            "ticker": "600519.SH",
            "market": "CN",
            "side": "BUY",
            "qty": 1000,
            "price": 1750.0,
            "paper_trade": True,
        },
    )
    assert r.status_code == 200
    assert r.json()["passed"] is False
    assert "仓位" in r.json()["reason"]


def test_place_order_paper_trade():
    r = client.post(
        "/api/portfolio/orders",
        json={
            "ticker": "AAPL.US",
            "market": "US",
            "side": "BUY",
            "qty": 5,
            "price": 178.5,
            "paper_trade": True,
        },
    )
    assert r.status_code == 201
    data = r.json()
    assert data["status"] == "FILLED"
    assert data["ticker"] == "AAPL.US"


def test_place_order_real_trade_blocked():
    r = client.post(
        "/api/portfolio/orders",
        json={
            "ticker": "AAPL.US",
            "market": "US",
            "side": "BUY",
            "qty": 5,
            "price": 178.5,
            "paper_trade": False,
        },
    )
    assert r.status_code == 400


def test_place_order_risk_rejected():
    r = client.post(
        "/api/portfolio/orders",
        json={
            "ticker": "600519.SH",
            "market": "CN",
            "side": "BUY",
            "qty": 10000,
            "price": 1750.0,
            "paper_trade": True,
        },
    )
    assert r.status_code == 400
    assert "仓位" in r.json()["detail"]


def test_get_orders():
    client.post(
        "/api/portfolio/orders",
        json={
            "ticker": "000858.SZ",
            "market": "CN",
            "side": "SELL",
            "qty": 10,
            "price": 155.0,
            "paper_trade": True,
        },
    )
    r = client.get("/api/portfolio/orders")
    assert r.status_code == 200
    assert len(r.json()) >= 1
