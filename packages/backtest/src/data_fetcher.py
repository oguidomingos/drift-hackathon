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

BASE_URL = "https://data.api.drift.trade"
DATA_DIR = Path(__file__).parent.parent / "data"

MARKETS = ["SOL-PERP", "BTC-PERP", "ETH-PERP"]


def fetch_funding_rates_day(symbol: str, date: datetime) -> pd.DataFrame | None:
    """Fetch funding rates for a single day."""
    url = (
        f"{BASE_URL}/market/{symbol}/fundingRates"
        f"/{date.year}/{date.month}/{date.day}?format=csv"
    )

    try:
        resp = requests.get(url, timeout=30)
        if resp.status_code == 404:
            return None
        resp.raise_for_status()

        # Parse CSV from response text
        from io import StringIO
        df = pd.read_csv(StringIO(resp.text))

        if df.empty:
            return None

        df["symbol"] = symbol
        return df

    except requests.RequestException as e:
        print(f"  Error fetching {symbol} {date.date()}: {e}")
        return None


def fetch_funding_rates(
    symbol: str,
    start_date: datetime,
    end_date: datetime,
    delay: float = 0.5,
) -> pd.DataFrame:
    """Fetch funding rates for a date range."""
    all_dfs = []
    current = start_date

    while current <= end_date:
        print(f"  Fetching {symbol} {current.date()}...", end=" ")
        df = fetch_funding_rates_day(symbol, current)

        if df is not None:
            all_dfs.append(df)
            print(f"{len(df)} records")
        else:
            print("no data")

        current += timedelta(days=1)
        time.sleep(delay)  # rate limit

    if not all_dfs:
        return pd.DataFrame()

    return pd.concat(all_dfs, ignore_index=True)


def fetch_all_markets(
    days_back: int = 90,
    markets: list[str] | None = None,
) -> dict[str, pd.DataFrame]:
    """Fetch funding rates for all markets."""
    if markets is None:
        markets = MARKETS

    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days_back)

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    results = {}
    for symbol in markets:
        print(f"\n{'='*50}")
        print(f"Fetching {symbol} ({days_back} days)")
        print(f"{'='*50}")

        df = fetch_funding_rates(symbol, start_date, end_date)

        if not df.empty:
            # Save to CSV
            csv_path = DATA_DIR / f"{symbol.lower().replace('-', '_')}_funding.csv"
            df.to_csv(csv_path, index=False)
            print(f"Saved {len(df)} records to {csv_path}")
            results[symbol] = df
        else:
            print(f"No data for {symbol}")

    return results


def load_funding_data(symbol: str) -> pd.DataFrame:
    """Load previously fetched funding data from CSV."""
    csv_path = DATA_DIR / f"{symbol.lower().replace('-', '_')}_funding.csv"
    if not csv_path.exists():
        raise FileNotFoundError(f"No data file for {symbol}. Run fetch first.")
    return pd.read_csv(csv_path)


def load_all_funding_data() -> dict[str, pd.DataFrame]:
    """Load all available funding data."""
    results = {}
    for symbol in MARKETS:
        try:
            results[symbol] = load_funding_data(symbol)
        except FileNotFoundError:
            pass
    return results


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Fetch Drift funding rate data")
    parser.add_argument("--days", type=int, default=90, help="Days of history")
    parser.add_argument("--markets", nargs="*", default=None, help="Markets to fetch")
    args = parser.parse_args()

    results = fetch_all_markets(days_back=args.days, markets=args.markets)

    print(f"\n{'='*50}")
    print("Summary:")
    for symbol, df in results.items():
        print(f"  {symbol}: {len(df)} records, {df['symbol'].iloc[0] if len(df) > 0 else 'N/A'}")
