from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_list_strategies():
    r = client.get("/api/backtest/strategies")
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 3
    assert all("id" in s and "name" in s for s in data)


def test_run_backtest_valid():
    r = client.post(
        "/api/backtest/run",
        json={
            "strategy_id": "macd_cross",
            "tickers": ["600519.SH", "000858.SZ"],
            "start_date": "2023-01-01",
            "end_date": "2024-01-01",
        },
    )
    assert r.status_code == 202
    data = r.json()
    assert data["status"] in ("RUNNING", "DONE")
    assert "job_id" in data


def test_run_backtest_invalid_strategy():
    r = client.post(
        "/api/backtest/run",
        json={
            "strategy_id": "NONEXISTENT",
            "tickers": ["600519.SH"],
            "start_date": "2023-01-01",
            "end_date": "2024-01-01",
        },
    )
    assert r.status_code == 422


def test_run_backtest_empty_tickers():
    r = client.post(
        "/api/backtest/run",
        json={
            "strategy_id": "macd_cross",
            "tickers": [],
            "start_date": "2023-01-01",
            "end_date": "2024-01-01",
        },
    )
    assert r.status_code == 422


def test_get_result_not_found():
    r = client.get("/api/backtest/result/nonexistent-job-id")
    assert r.status_code == 404


def test_run_and_poll_result():
    import time

    r = client.post(
        "/api/backtest/run",
        json={
            "strategy_id": "rsi_reversal",
            "tickers": ["AAPL.US", "TSLA.US", "MSFT.US"],
            "start_date": "2022-01-01",
            "end_date": "2023-01-01",
        },
    )
    assert r.status_code == 202
    job_id = r.json()["job_id"]

    for _ in range(10):
        time.sleep(0.3)
        r2 = client.get(f"/api/backtest/result/{job_id}")
        if r2.json()["status"] == "DONE":
            break

    result = r2.json()
    assert result["status"] == "DONE"
    assert "stats" in result and result["stats"] is not None
    assert result["stats"]["total_trades"] > 0
    assert len(result["equity_curve"]) > 0
    assert len(result["trades"]) > 0
