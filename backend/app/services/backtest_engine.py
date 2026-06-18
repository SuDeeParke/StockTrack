"""
Simple backtest engine.
Strategies are rule-based; replace with InStock engine calls in production.
"""

import asyncio
import hashlib
import math
import random
from datetime import timedelta

from app.models import (
    BacktestRequest,
    BacktestResult,
    BacktestStats,
    BacktestStatus,
    BacktestStrategy,
    EquityPoint,
    Trade,
)

STRATEGIES: list[BacktestStrategy] = [
    BacktestStrategy(
        id="macd_cross",
        name="MACD 金叉",
        description="MACD DIF 上穿 DEA 买入，下穿卖出",
        markets=["CN", "US"],
    ),
    BacktestStrategy(
        id="rsi_reversal",
        name="RSI 超卖反弹",
        description="RSI<30 买入，RSI>70 卖出",
        markets=["CN", "US"],
    ),
    BacktestStrategy(
        id="boll_breakout",
        name="布林带突破",
        description="收盘价突破上轨买入，跌破下轨卖出",
        markets=["CN", "US"],
    ),
    BacktestStrategy(
        id="kdj_signal",
        name="KDJ 信号",
        description="KDJ J线超卖回升买入",
        markets=["CN"],
    ),
    BacktestStrategy(
        id="volume_surge",
        name="放量突破",
        description="成交量放大 2 倍且价格创新高买入",
        markets=["CN", "US"],
    ),
]


def _build_seed(req: BacktestRequest) -> int:
    payload = "|".join(
        [
            req.strategy_id,
            ",".join(sorted(req.tickers)),
            req.start_date.isoformat(),
            req.end_date.isoformat(),
            f"{req.initial_capital:.2f}",
        ]
    )
    return int(hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16], 16)


def _simulate_backtest(req: BacktestRequest) -> BacktestResult:
    """Deterministic simulation based on strategy + tickers + dates."""
    rng = random.Random(_build_seed(req))
    days = (req.end_date - req.start_date).days
    if days < 10:
        raise ValueError("回测区间至少需要 10 天")

    capital = req.initial_capital
    benchmark_capital = req.initial_capital
    equity_curve: list[EquityPoint] = []
    trades: list[Trade] = []

    for i in range(0, days, max(1, days // 100)):
        point_date = req.start_date + timedelta(days=i)
        daily_ret = rng.uniform(-0.015, 0.02)
        bench_ret = rng.uniform(-0.01, 0.015)
        capital *= 1 + daily_ret
        benchmark_capital *= 1 + bench_ret
        equity_curve.append(
            EquityPoint(
                date=point_date,
                equity=round(capital, 2),
                benchmark=round(benchmark_capital, 2),
            )
        )

    for ticker in req.tickers:
        n_trades = rng.randint(3, 8)
        for _ in range(n_trades):
            trade_date = req.start_date + timedelta(days=rng.randint(1, days - 1))
            price = rng.uniform(10, 500)
            shares = round(rng.uniform(100, 1000), 0)
            pnl = round(price * shares * rng.uniform(-0.1, 0.2), 2)
            trades.append(
                Trade(
                    ticker=ticker,
                    action=rng.choice(["BUY", "SELL"]),
                    date=trade_date,
                    price=round(price, 2),
                    shares=shares,
                    pnl=pnl,
                )
            )

    trades.sort(key=lambda trade: trade.date)

    final_equity = equity_curve[-1].equity if equity_curve else capital
    total_return = (final_equity - req.initial_capital) / req.initial_capital * 100
    years = max(days / 365, 0.01)
    ann_return = ((final_equity / req.initial_capital) ** (1 / years) - 1) * 100

    returns = []
    for i in range(1, len(equity_curve)):
        prev = equity_curve[i - 1].equity
        curr = equity_curve[i].equity
        returns.append((curr - prev) / prev)
    avg_r = sum(returns) / len(returns) if returns else 0
    std_r = math.sqrt(sum((ret - avg_r) ** 2 for ret in returns) / len(returns)) if returns else 1
    sharpe = avg_r / std_r * math.sqrt(252) if std_r > 0 else 0

    peak = req.initial_capital
    max_dd = 0.0
    for point in equity_curve:
        if point.equity > peak:
            peak = point.equity
        drawdown = (peak - point.equity) / peak * 100
        if drawdown > max_dd:
            max_dd = drawdown

    win_trades = [trade for trade in trades if trade.pnl > 0]
    win_rate = len(win_trades) / len(trades) * 100 if trades else 0

    stats = BacktestStats(
        total_return_pct=round(total_return, 2),
        annualized_return_pct=round(ann_return, 2),
        sharpe_ratio=round(sharpe, 3),
        max_drawdown_pct=round(max_dd, 2),
        win_rate_pct=round(win_rate, 1),
        total_trades=len(trades),
    )

    return BacktestResult(
        job_id="",
        status=BacktestStatus.DONE,
        strategy_id=req.strategy_id,
        tickers=req.tickers,
        start_date=req.start_date,
        end_date=req.end_date,
        equity_curve=equity_curve,
        trades=trades,
        stats=stats,
    )


async def run_backtest_async(req: BacktestRequest, job_id: str) -> BacktestResult:
    await asyncio.sleep(0.1)
    try:
        result = _simulate_backtest(req)
        result.job_id = job_id
        return result
    except Exception as exc:
        return BacktestResult(
            job_id=job_id,
            status=BacktestStatus.FAILED,
            strategy_id=req.strategy_id,
            tickers=req.tickers,
            start_date=req.start_date,
            end_date=req.end_date,
            error=str(exc),
        )


def get_strategies() -> list[BacktestStrategy]:
    return STRATEGIES
