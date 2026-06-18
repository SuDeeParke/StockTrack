"""
Daily data refresh scheduler.
- A-shares (CN): weekdays 15:30 CST (07:30 UTC)
- US stocks:     weekdays 05:00 CST (21:00 UTC prev day)
Manual trigger: POST /api/admin/refresh?market=CN|US|ALL
"""

import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.services import data_cache

logger = logging.getLogger(__name__)
CST = ZoneInfo("Asia/Shanghai")

scheduler = AsyncIOScheduler(timezone=CST)


async def refresh_cn():
    """Refresh A-share signals (runs after CN market close 15:30 CST)."""
    logger.info("[scheduler] Starting CN market refresh...")
    try:
        # Placeholder: In production, call InStock engine here.
        data_cache.set_last_refresh(datetime.now(CST))
        logger.info("[scheduler] CN refresh complete (mock)")
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.error("[scheduler] CN refresh failed: %s", exc)


async def refresh_us():
    """Refresh US stock signals (runs after US market close ~05:00 CST)."""
    logger.info("[scheduler] Starting US market refresh...")
    try:
        from app.services.us_market import (
            US_WATCHLIST,
            compute_indicators,
            fetch_ohlcv,
            generate_signal,
            ticker_to_us,
        )

        refreshed = 0
        for symbol in US_WATCHLIST:
            ticker = ticker_to_us(symbol)
            bars = fetch_ohlcv(ticker, days=90)
            if not bars:
                continue
            data_cache.store_ohlcv(ticker, bars)
            snap = compute_indicators(bars, ticker)
            if snap:
                data_cache.store_indicator(ticker, snap)
                sig = generate_signal(ticker, snap)
                data_cache.store_signal(sig)
                refreshed += 1

        data_cache.set_last_refresh(datetime.now(CST))
        logger.info("[scheduler] US refresh complete: %s tickers updated", refreshed)
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.error("[scheduler] US refresh failed: %s", exc)


def start_scheduler():
    """Register cron jobs and start the scheduler."""
    if scheduler.running:
        return

    scheduler.add_job(
        refresh_cn,
        CronTrigger(day_of_week="mon-fri", hour=15, minute=30, timezone=CST),
        id="refresh_cn",
        replace_existing=True,
    )
    scheduler.add_job(
        refresh_us,
        CronTrigger(day_of_week="mon-fri", hour=5, minute=0, timezone=CST),
        id="refresh_us",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("[scheduler] APScheduler started (CN: 15:30 CST, US: 05:00 CST)")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
