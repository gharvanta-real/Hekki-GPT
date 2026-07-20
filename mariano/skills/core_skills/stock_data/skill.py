"""MARIANO Core Skill — Live stock data via yfinance."""
from __future__ import annotations
import asyncio
from typing import Any
from mariano.skills._base import BaseSkill, SkillResult


class StockDataSkill(BaseSkill):
    name = "stock_data"
    description = "Get live stock price, info, and recent history. Supports NSE (add .NS), BSE (.BO), and global tickers."
    version = "1.0.0"
    tags = ["finance", "stocks", "market", "investment"]

    def get_parameters_schema(self) -> dict:
        return {
            "ticker": {"type": "string", "description": "Stock ticker e.g. RELIANCE.NS, AAPL, BTC-USD", "required": True},
            "period": {"type": "string", "description": "Data period: 1d, 5d, 1mo, 3mo, 1y", "default": "5d"},
        }

    async def execute(self, ticker: str, period: str = "5d") -> SkillResult:
        try:
            import yfinance as yf
            data = await asyncio.to_thread(self._fetch, ticker, period)
            return SkillResult(success=True, data=data, metadata={"ticker": ticker})
        except Exception as exc:
            return SkillResult(success=False, data=None, error=str(exc))

    def _fetch(self, ticker: str, period: str) -> str:
        import yfinance as yf
        stock = yf.Ticker(ticker)
        info = stock.info
        hist = stock.history(period=period)
        name = info.get("longName") or info.get("shortName") or ticker
        price = info.get("currentPrice") or info.get("regularMarketPrice", "N/A")
        currency = info.get("currency", "")
        change = info.get("regularMarketChangePercent", 0)
        market_cap = info.get("marketCap", "N/A")
        lines = [
            f"**{name}** ({ticker})",
            f"Price: {price} {currency} ({change:+.2f}%)",
            f"Market Cap: {market_cap:,}" if isinstance(market_cap, int) else f"Market Cap: {market_cap}",
            f"52W High: {info.get('fiftyTwoWeekHigh', 'N/A')} | 52W Low: {info.get('fiftyTwoWeekLow', 'N/A')}",
        ]
        if not hist.empty:
            lines.append(f"\nRecent closes ({period}):")
            for date, row in hist.tail(5).iterrows():
                lines.append(f"  {str(date)[:10]}: {row['Close']:.2f}")
        return "\n".join(lines)
