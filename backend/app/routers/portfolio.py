from fastapi import APIRouter, HTTPException

from app.models import Order, OrderRequest, Position, AccountBalance, RiskCheckResult
from app.services import futu_mock as futu

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


@router.get("/positions", response_model=list[Position])
async def get_positions():
    return futu.get_positions()


@router.get("/balance", response_model=AccountBalance)
async def get_balance():
    return futu.get_balance()


@router.post("/risk-check", response_model=RiskCheckResult)
async def risk_check(req: OrderRequest):
    balance = futu.get_balance()
    positions = futu.get_positions()
    return futu.check_risk(req, balance, positions)


@router.post("/orders", response_model=Order, status_code=201)
async def place_order(req: OrderRequest):
    if not req.paper_trade:
        raise HTTPException(status_code=400, detail="实盘交易未启用，请设置 paper_trade=true")
    balance = futu.get_balance()
    positions = futu.get_positions()
    risk = futu.check_risk(req, balance, positions)
    if not risk.passed:
        raise HTTPException(status_code=400, detail=risk.reason)
    order = futu.place_order(req)
    return order


@router.get("/orders", response_model=list[Order])
async def get_orders():
    return futu.get_orders()
