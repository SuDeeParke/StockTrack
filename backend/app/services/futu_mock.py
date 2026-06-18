"""
Mock Futu OpenAPI client.
Mimics futu-api SDK interface so the real client can be swapped in
by replacing this module and setting FUTU_OPEND_HOST in .env.
"""
import random
import uuid
from datetime import datetime

from app.models import (
    AccountBalance,
    Order,
    OrderRequest,
    OrderSide,
    OrderStatus,
    Position,
    RiskCheckResult,
)

# ── Mock data ────────────────────────────────────────────────────

_MOCK_POSITIONS: list[Position] = [
    Position(
        ticker="600519.SH",
        market="CN",
        name="贵州茅台",
        qty=10,
        avg_cost=1680.0,
        current_price=1750.0,
        market_value=17500.0,
        pnl=700.0,
        pnl_pct=4.17,
    ),
    Position(
        ticker="000858.SZ",
        market="CN",
        name="五粮液",
        qty=50,
        avg_cost=140.0,
        current_price=155.0,
        market_value=7750.0,
        pnl=750.0,
        pnl_pct=10.71,
    ),
    Position(
        ticker="AAPL.US",
        market="US",
        name="Apple Inc.",
        qty=20,
        avg_cost=165.0,
        current_price=178.5,
        market_value=3570.0,
        pnl=270.0,
        pnl_pct=8.18,
    ),
]

_MOCK_BALANCE = AccountBalance(
    total_assets=128820.0,
    cash=100000.0,
    market_value=28820.0,
    daily_pnl=1720.0,
    daily_pnl_pct=1.35,
)

_orders: list[Order] = []

# ── Risk control ─────────────────────────────────────────────────

RISK_MAX_POSITION_PCT = 0.10
RISK_MAX_DAILY_LOSS_PCT = 0.02
RISK_MAX_POSITIONS = 5


def check_risk(
    req: OrderRequest,
    balance: AccountBalance,
    positions: list[Position],
) -> RiskCheckResult:
    """Run risk checks. Returns (passed, reason)."""
    order_value = req.qty * req.price

    if order_value / balance.total_assets > RISK_MAX_POSITION_PCT:
        return RiskCheckResult(
            passed=False,
            reason=(
                f"超过单笔仓位限制 {RISK_MAX_POSITION_PCT * 100:.0f}%"
                f"（订单市值 {order_value:,.0f}，总资产 {balance.total_assets:,.0f}）"
            ),
        )

    if balance.daily_pnl < 0:
        loss_pct = abs(balance.daily_pnl) / balance.total_assets
        if loss_pct >= RISK_MAX_DAILY_LOSS_PCT:
            return RiskCheckResult(
                passed=False,
                reason=f"已达日最大亏损限制 {RISK_MAX_DAILY_LOSS_PCT * 100:.0f}%",
            )

    if req.side == OrderSide.BUY:
        existing_tickers = {p.ticker for p in positions}
        if req.ticker not in existing_tickers and len(existing_tickers) >= RISK_MAX_POSITIONS:
            return RiskCheckResult(
                passed=False,
                reason=f"同时持仓数已达上限 {RISK_MAX_POSITIONS} 只",
            )

    return RiskCheckResult(passed=True)


# ── Mock client methods ───────────────────────────────────────────

def get_positions() -> list[Position]:
    return list(_MOCK_POSITIONS)


def get_balance() -> AccountBalance:
    return _MOCK_BALANCE


def place_order(req: OrderRequest) -> Order:
    now = datetime.utcnow().isoformat()
    order = Order(
        order_id=str(uuid.uuid4()),
        ticker=req.ticker,
        market=req.market,
        side=req.side,
        qty=req.qty,
        price=req.price,
        status=OrderStatus.FILLED,
        filled_qty=req.qty,
        filled_price=req.price * random.uniform(0.999, 1.001),
        created_at=now,
        updated_at=now,
        paper_trade=req.paper_trade,
    )
    _orders.append(order)
    return order


def get_orders() -> list[Order]:
    return list(reversed(_orders))
