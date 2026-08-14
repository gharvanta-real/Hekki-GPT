"""MARIANO Core Skill — Live & Comprehensive Stock, Index, Forex & Crypto Market Data Engine."""
from __future__ import annotations

import asyncio
import json
import re
import urllib.request
from typing import Any, Dict, List, Optional, Tuple
from mariano.skills._base import BaseSkill, SkillResult


class StockDataSkill(BaseSkill):
    name = "stock_data"
    description = (
        "Get real-time stock prices, indices, crypto rates, company financials, valuation metrics "
        "(P/E, Market Cap, 52W High/Low), analyst recommendations, and historical trend data."
    )
    version = "2.0.0"
    tags = ["finance", "stocks", "market", "investment", "crypto", "forex"]

    # Nicknames & Index Mappings
    NICKNAMES: Dict[str, str] = {
        "NIFTY": "^NSEI",
        "NIFTY50": "^NSEI",
        "NIFTY 50": "^NSEI",
        "SENSEX": "^BSESN",
        "BSE": "^BSESN",
        "BANKNIFTY": "^NSEBANK",
        "BANK NIFTY": "^NSEBANK",
        "NASDAQ": "^IXIC",
        "S&P500": "^GSPC",
        "S&P 500": "^GSPC",
        "SP500": "^GSPC",
        "DOW": "^DJI",
        "DOW JONES": "^DJI",
        "GOLD": "GC=F",
        "SILVER": "SI=F",
        "CRUDE": "CL=F",
        "CRUDE OIL": "CL=F",
        "BTC": "BTC-USD",
        "BITCOIN": "BTC-USD",
        "ETH": "ETH-USD",
        "ETHEREUM": "ETH-USD",
        "SOL": "SOL-USD",
        "SOLANA": "SOL-USD",
        "USDINR": "USDINR=X",
        "USD/INR": "USDINR=X",
    }

    def get_parameters_schema(self) -> dict:
        return {
            "ticker": {
                "type": "string",
                "description": "Stock ticker or company name e.g. RELIANCE, AAPL, NIFTY, BTC, TSLA, TATA MOTORS",
                "required": True,
            },
            "period": {
                "type": "string",
                "description": "Data period: 1d, 5d, 1mo, 3mo, 6mo, 1y",
                "default": "5d",
            },
        }

    async def execute(self, ticker: str, period: str = "5d") -> SkillResult:
        try:
            resolved_ticker = self._resolve_ticker(ticker)
            data_dict, formatted_text = await asyncio.to_thread(self._fetch_market_data, resolved_ticker, period)
            return SkillResult(success=True, data=formatted_text, metadata={"ticker": resolved_ticker, "raw": data_dict})
        except Exception as exc:
            return SkillResult(success=False, data=None, error=f"Market Data Error for '{ticker}': {str(exc)}")

    def _resolve_ticker(self, symbol: str) -> str:
        sym_clean = symbol.strip().upper()
        if sym_clean in self.NICKNAMES:
            return self.NICKNAMES[sym_clean]
        
        # If user passed plain Indian stock name without extension (e.g. RELIANCE, TATAMOTORS, INFY, TCS)
        if not re.search(r"[\.\=\^]", sym_clean):
            # If standard 2-6 letter uppercase word
            return f"{sym_clean}.NS"
        return sym_clean

    def _fetch_market_data(self, ticker: str, period: str) -> Tuple[Dict[str, Any], str]:
        # 1. Primary: yfinance
        try:
            return self._fetch_yfinance(ticker, period)
        except Exception:
            pass

        # If ticker ends with .NS and failed, try plain ticker or .BO
        if ticker.endswith(".NS"):
            base_sym = ticker[:-3]
            try:
                return self._fetch_yfinance(base_sym, period)
            except Exception:
                pass
            try:
                return self._fetch_yfinance(f"{base_sym}.BO", period)
            except Exception:
                pass

        # 2. Fallback: Direct Yahoo Finance v8 HTTP API
        try:
            return self._fetch_yahoo_http(ticker, period)
        except Exception as err:
            # 3. Tertiary Crypto Fallback if crypto symbol
            if "USD" in ticker or ticker in ["BTC", "ETH", "SOL"]:
                try:
                    return self._fetch_coingecko(ticker)
                except Exception:
                    pass
            raise RuntimeError(f"Unable to fetch quote for '{ticker}' across all data providers. ({err})")

    def _fetch_yfinance(self, ticker: str, period: str) -> Tuple[Dict[str, Any], str]:
        import yfinance as yf

        stock = yf.Ticker(ticker)
        info = stock.info or {}
        hist = stock.history(period=period)

        if hist.empty and not info.get("regularMarketPrice") and not info.get("currentPrice"):
            raise ValueError(f"No yfinance data for {ticker}")

        name = info.get("longName") or info.get("shortName") or ticker
        price = info.get("currentPrice") or info.get("regularMarketPrice")
        if price is None and not hist.empty:
            price = float(hist["Close"].iloc[-1])

        prev_close = info.get("previousClose") or info.get("regularMarketPreviousClose")
        if prev_close is None and len(hist) >= 2:
            prev_close = float(hist["Close"].iloc[-2])

        currency = info.get("currency", "USD").upper()
        curr_sym = self._get_currency_symbol(currency)

        change = info.get("regularMarketChangePercent")
        if change is None and price and prev_close:
            change = ((price - prev_close) / prev_close) * 100

        market_cap = info.get("marketCap")
        pe_ratio = info.get("trailingPE")
        fwd_pe = info.get("forwardPE")
        eps = info.get("trailingEps")
        high_52w = info.get("fiftyTwoWeekHigh") or (float(hist["High"].max()) if not hist.empty else "N/A")
        low_52w = info.get("fiftyTwoWeekLow") or (float(hist["Low"].min()) if not hist.empty else "N/A")
        day_high = info.get("dayHigh") or (float(hist["High"].iloc[-1]) if not hist.empty else "N/A")
        day_low = info.get("dayLow") or (float(hist["Low"].iloc[-1]) if not hist.empty else "N/A")
        rec = info.get("recommendationKey", "").upper().replace("_", " ")
        target = info.get("targetMeanPrice")
        sector = info.get("sector")
        industry = info.get("industry")

        # Format Data Dict
        data_dict = {
            "name": name,
            "ticker": ticker,
            "price": price,
            "change_pct": change,
            "currency": currency,
            "market_cap": market_cap,
            "pe_ratio": pe_ratio,
            "fwd_pe": fwd_pe,
            "eps": eps,
            "52w_high": high_52w,
            "52w_low": low_52w,
            "day_high": day_high,
            "day_low": day_low,
            "recommendation": rec,
            "target_price": target,
            "sector": sector,
            "industry": industry,
        }

        # Build Markdown Text
        lines = []
        change_str = f"{change:+.2f}%" if isinstance(change, (int, float)) else "N/A"
        trend_emoji = "📈" if isinstance(change, (int, float)) and change >= 0 else "📉"
        
        lines.append(f"📊 **{name}** (`{ticker}`)")
        if sector and industry:
            lines.append(f"🏷️ *{sector} | {industry}*")

        price_fmt = f"{curr_sym}{price:,.2f}" if isinstance(price, (int, float)) else f"{price}"
        lines.append(f"\n💰 **Price**: {price_fmt} ({change_str} {trend_emoji})")

        # Key Metrics Grid
        metrics = []
        if market_cap:
            metrics.append(f"🏛️ **Market Cap**: {self._format_big_number(market_cap, currency)}")
        if pe_ratio:
            metrics.append(f"📊 **P/E (TTM)**: {pe_ratio:.2f}")
        if fwd_pe:
            metrics.append(f"🔮 **Fwd P/E**: {fwd_pe:.2f}")
        if eps:
            metrics.append(f"💵 **EPS**: {curr_sym}{eps:.2f}")
        if metrics:
            lines.append(" | ".join(metrics))

        # Ranges
        range_lines = []
        if isinstance(day_low, (int, float)) and isinstance(day_high, (int, float)):
            range_lines.append(f"📅 **Day Range**: {curr_sym}{day_low:,.2f} — {curr_sym}{day_high:,.2f}")
        if isinstance(low_52w, (int, float)) and isinstance(high_52w, (int, float)):
            range_lines.append(f"📈 **52W Range**: {curr_sym}{low_52w:,.2f} — {curr_sym}{high_52w:,.2f}")
        if range_lines:
            lines.append("\n" + " | ".join(range_lines))

        # Recommendation & Target
        if rec or target:
            rec_pill = f"🎯 **Analyst Rating**: `{rec}`" if rec else ""
            target_pill = f"🎯 **Target Price**: {curr_sym}{target:,.2f}" if target else ""
            lines.append(" | ".join(filter(None, [rec_pill, target_pill])))

        # History Table
        if not hist.empty:
            lines.append(f"\n🗓️ **Recent Closing History ({period}):**")
            lines.append("| Date | Close Price | Day Change | Volume |")
            lines.append("| :--- | :--- | :--- | :--- |")
            recent_rows = hist.tail(5)
            prev = None
            for date, row in recent_rows.iterrows():
                dt_str = str(date)[:10]
                c_price = float(row["Close"])
                vol = int(row["Volume"]) if "Volume" in row else 0
                if prev is not None and prev > 0:
                    d_chg = ((c_price - prev) / prev) * 100
                    chg_text = f"{d_chg:+.2f}%"
                else:
                    chg_text = "—"
                prev = c_price
                vol_text = f"{vol:,}" if vol > 0 else "—"
                lines.append(f"| `{dt_str}` | {curr_sym}{c_price:,.2f} | {chg_text} | {vol_text} |")

        return data_dict, "\n".join(lines)

    def _fetch_yahoo_http(self, ticker: str, period: str) -> Tuple[Dict[str, Any], str]:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range={period}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        res = urllib.request.urlopen(req, timeout=8)
        data = json.loads(res.read().decode("utf-8"))
        chart_result = data.get("chart", {}).get("result", [])
        if not chart_result:
            raise ValueError(f"Empty HTTP chart result for {ticker}")

        meta = chart_result[0].get("meta", {})
        price = meta.get("regularMarketPrice")
        prev_close = meta.get("chartPreviousClose") or meta.get("previousClose")
        currency = meta.get("currency", "USD").upper()
        curr_sym = self._get_currency_symbol(currency)
        symbol = meta.get("symbol", ticker)

        change = 0.0
        if price and prev_close:
            change = ((price - prev_close) / prev_close) * 100

        trend_emoji = "📈" if change >= 0 else "📉"
        lines = [
            f"📊 **{symbol}** (Yahoo Market Engine)",
            f"\n💰 **Price**: {curr_sym}{price:,.2f} ({change:+.2f}% {trend_emoji})",
        ]
        if meta.get("fiftyTwoWeekHigh") and meta.get("fiftyTwoWeekLow"):
            lines.append(f"📈 **52W Range**: {curr_sym}{meta['fiftyTwoWeekLow']:,.2f} — {curr_sym}{meta['fiftyTwoWeekHigh']:,.2f}")

        data_dict = {
            "name": symbol,
            "ticker": symbol,
            "price": price,
            "change_pct": change,
            "currency": currency,
            "52w_high": meta.get("fiftyTwoWeekHigh"),
            "52w_low": meta.get("fiftyTwoWeekLow"),
        }
        return data_dict, "\n".join(lines)

    def _fetch_coingecko(self, ticker: str) -> Tuple[Dict[str, Any], str]:
        coin_map = {"BTC": "bitcoin", "ETH": "ethereum", "SOL": "solana", "DOGE": "dogecoin", "XRP": "ripple"}
        clean = ticker.split("-")[0].upper()
        coin_id = coin_map.get(clean, clean.lower())

        url = f"https://api.coingecko.com/api/v3/simple/price?ids={coin_id}&vs_currencies=usd,inr&include_24hr_change=true"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        res = urllib.request.urlopen(req, timeout=6)
        data = json.loads(res.read().decode("utf-8"))
        coin_data = data.get(coin_id)
        if not coin_data:
            raise ValueError(f"CoinGecko missing symbol {coin_id}")

        usd_price = coin_data.get("usd", 0)
        usd_change = coin_data.get("usd_24h_change", 0)
        inr_price = coin_data.get("inr", 0)

        trend_emoji = "📈" if usd_change >= 0 else "📉"
        lines = [
            f"🪙 **{clean} Crypto Quote** (CoinGecko Live)",
            f"\n💵 **USD Price**: ${usd_price:,.2f} ({usd_change:+.2f}% {trend_emoji})",
            f"🇮🇳 **INR Price**: ₹{inr_price:,.2f}",
        ]
        data_dict = {"name": clean, "usd_price": usd_price, "usd_change_pct": usd_change, "inr_price": inr_price}
        return data_dict, "\n".join(lines)

    def _get_currency_symbol(self, curr: str) -> str:
        curr_upper = curr.upper()
        if curr_upper == "INR":
            return "₹"
        elif curr_upper == "USD":
            return "$"
        elif curr_upper == "EUR":
            return "€"
        elif curr_upper == "GBP":
            return "£"
        elif curr_upper == "JPY":
            return "¥"
        return f"{curr_upper} "

    def _format_big_number(self, val: float, currency: str) -> str:
        curr_sym = self._get_currency_symbol(currency)
        if currency.upper() == "INR":
            if val >= 1e12:  # >= 100,000 Cr / 1 Lakh Cr
                return f"{curr_sym}{val / 1e12:.2f} Lakh Cr"
            elif val >= 1e7:  # >= 1 Cr
                return f"{curr_sym}{val / 1e7:,.2f} Cr"
            elif val >= 1e5:  # >= 1 Lakh
                return f"{curr_sym}{val / 1e5:,.2f} Lakh"
        else:
            if val >= 1e12:
                return f"{curr_sym}{val / 1e12:.2f} Trillion"
            elif val >= 1e9:
                return f"{curr_sym}{val / 1e9:.2f} Billion"
            elif val >= 1e6:
                return f"{curr_sym}{val / 1e6:.2f} Million"
        return f"{curr_sym}{val:,.0f}"
