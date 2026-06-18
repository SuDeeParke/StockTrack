from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient


@pytest.mark.asyncio
async def test_refresh_cn_no_crash():
    from app.scheduler import refresh_cn

    await refresh_cn()


@pytest.mark.asyncio
async def test_refresh_us_no_crash():
    from app.scheduler import refresh_us

    with patch("app.services.us_market.fetch_ohlcv", return_value=[]):
        await refresh_us()


def test_manual_refresh_endpoint():
    from app.main import app

    client = TestClient(app)
    response = client.post("/api/admin/refresh?market=CN")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "triggered"
    assert data["market"] == "CN"


def test_health_has_last_refresh():
    from app.main import app

    client = TestClient(app)
    response = client.get("/api/health")

    assert response.status_code == 200
    assert "last_refresh" in response.json()
