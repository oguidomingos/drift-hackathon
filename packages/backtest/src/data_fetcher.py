"""
Fetch historical funding rate data from Drift Data API.

API: GET https://data.api.drift.trade/market/{symbol}/fundingRates/{year}/{month}/{day}?format=csv
"""

import os
import time
import requests
import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_URL = "https://data.api.drift.trade"
DATA_DIR = Path(__file__).parent.parent / "data"

# Core markets (SOL, BTC, ETH always included)
CORE_MARKETS = ["SOL-PERP", "BTC-PERP", "ETH-PERP"]

# Extended markets — high funding in bull cycles
EXTENDED_MARKETS = [
    "DOGE-PERP", "WIF-PERP", "JTO-PERP", "JUP-PERP",
    "APT-PERP", "SUI-PERP", "LINK-PERP", "AVAX-PERP",
]

ALL_MARKETS = CORE_MARKETS + EXTENDED_MARKETS

# Default: core + highest-funding extras
DEFAULT_MARKETS = ["SOL-PERP", "BTC-PERP", "ETH-PERP", "DOGE-PERP", "WIF-PERP", "JTO-PERP"]


def fetch_funding_rates_day(symbol: str, date: datetime) -> pd.DataFrame | None:
    """Fetch funding rates for a single day."""
    url = (
        f"{BASE_URL}/market/{symbol}/fundingRates"
        f"/{date.year}/{date.month}/{date.day}?format=csv"
    )

    try:
        resp = requests.get(url, timeout=15)
        if resp.status_code in (404, 400):
            return None
        resp.raise_for_status()

        from io import StringIO
        df = pd.read_csv(StringIO(resp.text))

        if df.empty:
            return None

        df["symbol"] = symbol
        return df

    except requests.RequestException:
        return None


def fetch_funding_rates(
    symbol: str,
    start_date: datetime,
    end_date: datetime,
    delay: float = 0.15,
) -> pd.DataFrame:
    """Fetch funding rates for a date range with parallel day fetches."""
    dates = []
    current = start_date
    while current <= end_date:
        dates.append(current)
        current += timedelta(days=1)

    all_dfs = []
    total = len(dates)

    # Fetch in small parallel batches (3 at a time to be nice to the API)
    for batch_start in range(0, total, 3):
        batch = dates[batch_start:batch_start + 3]
        with ThreadPoolExecutor(max_workers=3) as ex:
            futures = {ex.submit(fetch_funding_rates_day, symbol, d): d for d in batch}
            for fut in as_completed(futures):
                df = fut.result()
                if df is not None:
                    all_dfs.append(df)
        time.sleep(delay)

        if (batch_start // 3) % 20 == 0:
            done = min(batch_start + 3, total)
            print(f"  {symbol}: {done}/{total} days fetched...", end="\r")

    print(f"  {symbol}: {total}/{total} days fetched — {sum(len(d) for d in all_dfs)} records")

    if not all_dfs:
        return pd.DataFrame()

    result = pd.concat(all_dfs, ignore_index=True)
    return result.sort_values('ts').reset_index(drop=True) if 'ts' in result.columns else result


def fetch_all_markets(
    days_back: int = 500,
    markets: list[str] | None = None,
) -> dict[str, pd.DataFrame]:
    """Fetch funding rates for all markets."""
    if markets is None:
        markets = DEFAULT_MARKETS

    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days_back)

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Fetching {days_back} days ({start_date.date()} to {end_date.date()})")
    print(f"Markets: {markets}\n")

    results = {}
    for symbol in markets:
        print(f"--- {symbol} ---")
        df = fetch_funding_rates(symbol, start_date, end_date)

        if not df.empty:
            csv_path = DATA_DIR / f"{symbol.lower().replace('-', '_')}_funding.csv"
            df.to_csv(csv_path, index=False)
            results[symbol] = df
        else:
            print(f"  No data for {symbol} — skipping")

    return results


def load_funding_data(symbol: str) -> pd.DataFrame:
    """Load previously fetched funding data from CSV."""
    csv_path = DATA_DIR / f"{symbol.lower().replace('-', '_')}_funding.csv"
    if not csv_path.exists():
        raise FileNotFoundError(f"No data file for {symbol}. Run fetch first.")
    return pd.read_csv(csv_path)


def load_all_funding_data(markets: list[str] | None = None) -> dict[str, pd.DataFrame]:
    """Load all available funding data."""
    if markets is None:
        # Auto-discover all CSVs in data dir
        markets_to_try = ALL_MARKETS
    else:
        markets_to_try = markets

    results = {}
    for symbol in markets_to_try:
        try:
            results[symbol] = load_funding_data(symbol)
        except FileNotFoundError:
            pass
    return results


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Fetch Drift funding rate data")
    parser.add_argument("--days", type=int, default=500, help="Days of history (default: 500)")
    parser.add_argument("--markets", nargs="*", default=None, help="Markets (default: core + top extras)")
    parser.add_argument("--all", action="store_true", help="Fetch all available markets")
    args = parser.parse_args()

    markets = ALL_MARKETS if args.all else args.markets
    results = fetch_all_markets(days_back=args.days, markets=markets)

    print(f"\nSummary:")
    for symbol, df in results.items():
        print(f"  {symbol}: {len(df)} records")
