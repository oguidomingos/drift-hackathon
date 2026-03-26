"""
Backtesting simulator for delta-neutral funding rate strategy.

Simulates hour-by-hour:
  - Funding income from short perp positions
  - Transaction costs (taker fees, slippage)
  - Basis risk between perp/spot legs
"""

import numpy as np
import pandas as pd
from dataclasses import dataclass, field
from typing import Optional

from .metrics import calculate_all_metrics


@dataclass
class StrategyParams:
    """Strategy parameters (optimizable by GA)."""
    initial_capital: float = 100.0        # USDC
    leverage: float = 2.0
    funding_threshold: float = 0.0005     # min hourly rate to enter (0.05%)
    delta_threshold: float = 0.02         # max delta drift before rebalance
    max_drawdown: float = 0.05            # 5% max drawdown → exit
    liquidation_buffer: float = 0.20      # 20% buffer from liquidation
    negative_funding_exit_hours: int = 24
    taker_fee: float = 0.001              # 0.1% taker fee per leg
    slippage: float = 0.0005              # 0.05% slippage per trade
    # Multi-market allocation weights (SOL, BTC, ETH)
    sol_weight: float = 0.5
    btc_weight: float = 0.3
    eth_weight: float = 0.2


@dataclass
class Position:
    symbol: str
    entry_price: float
    base_size: float            # positive = amount of asset
    notional: float
    entry_time: int             # row index
    funding_pnl: float = 0.0
    weight: float = 1.0


@dataclass
class SimulationResult:
    equity_curve: list[float] = field(default_factory=list)
    timestamps: list = field(default_factory=list)
    trades: list[dict] = field(default_factory=list)
    funding_income: list[float] = field(default_factory=list)
    costs: list[float] = field(default_factory=list)
    metrics: dict = field(default_factory=dict)


def run_backtest(
    funding_data: dict[str, pd.DataFrame],
    params: StrategyParams,
) -> SimulationResult:
    """
    Run the delta-neutral funding rate backtest.

    funding_data: dict of symbol -> DataFrame with columns:
        - ts (or timestamp): unix timestamp
        - fundingRate (or funding_rate): hourly funding rate as decimal
    """
    result = SimulationResult()
    equity = params.initial_capital
    peak_equity = equity
    positions: dict[str, Position] = {}
    negative_funding_counter: dict[str, int] = {}
    total_costs = 0.0
    total_funding = 0.0

    # Normalize funding data
    normalized = {}
    for symbol, df in funding_data.items():
        df = df.copy()
        # Try common column names
        if 'fundingRate' in df.columns:
            rate_col = 'fundingRate'
        elif 'funding_rate' in df.columns:
            rate_col = 'funding_rate'
        elif 'rate' in df.columns:
            rate_col = 'rate'
        else:
            print(f"Warning: no funding rate column found for {symbol}")
            continue

        if 'ts' in df.columns:
            ts_col = 'ts'
        elif 'timestamp' in df.columns:
            ts_col = 'timestamp'
        else:
            ts_col = df.columns[0]

        df = df.rename(columns={rate_col: 'rate', ts_col: 'ts'})
        df = df.sort_values('ts').reset_index(drop=True)
        df['rate'] = pd.to_numeric(df['rate'], errors='coerce')
        normalized[symbol] = df

    if not normalized:
        return result

    # Use the longest series to determine iteration count
    max_len = max(len(df) for df in normalized.values())

    # Market weight mapping
    weight_map = {
        'SOL-PERP': params.sol_weight,
        'BTC-PERP': params.btc_weight,
        'ETH-PERP': params.eth_weight,
    }

    for i in range(max_len):
        hour_funding = 0.0
        hour_costs = 0.0

        for symbol, df in normalized.items():
            if i >= len(df):
                continue

            row = df.iloc[i]
            rate = row['rate']
            weight = weight_map.get(symbol, 1.0 / len(normalized))

            # Track negative funding
            if rate < 0:
                negative_funding_counter[symbol] = negative_funding_counter.get(symbol, 0) + 1
            else:
                negative_funding_counter[symbol] = 0

            # Position management
            if symbol in positions:
                pos = positions[symbol]

                # Exit conditions
                should_exit = False
                exit_reason = ""

                # Negative funding too long
                if negative_funding_counter.get(symbol, 0) >= params.negative_funding_exit_hours:
                    should_exit = True
                    exit_reason = "negative_funding"

                # Drawdown check
                drawdown = (peak_equity - equity) / peak_equity if peak_equity > 0 else 0
                if drawdown > params.max_drawdown:
                    should_exit = True
                    exit_reason = "max_drawdown"

                if should_exit:
                    # Close position — pay taker fee + slippage
                    close_cost = pos.notional * (params.taker_fee + params.slippage) * 2
                    equity -= close_cost
                    hour_costs += close_cost
                    result.trades.append({
                        'index': i,
                        'symbol': symbol,
                        'action': 'CLOSE',
                        'reason': exit_reason,
                        'pnl': pos.funding_pnl - close_cost,
                    })
                    del positions[symbol]
                    continue

                # Collect funding (short perp in positive funding = income)
                funding_income = pos.notional * rate  # rate > 0 means shorts receive
                pos.funding_pnl += funding_income
                equity += funding_income
                hour_funding += funding_income

            else:
                # Entry condition: positive funding above threshold
                if rate > params.funding_threshold:
                    notional = equity * params.leverage * weight
                    if notional < 1.0:
                        continue

                    # Pay entry costs (taker fee + slippage on both legs)
                    entry_cost = notional * (params.taker_fee + params.slippage) * 2
                    equity -= entry_cost
                    hour_costs += entry_cost

                    positions[symbol] = Position(
                        symbol=symbol,
                        entry_price=0,  # not tracking price, only funding
                        base_size=notional,
                        notional=notional,
                        entry_time=i,
                        weight=weight,
                    )

                    result.trades.append({
                        'index': i,
                        'symbol': symbol,
                        'action': 'OPEN',
                        'reason': f'rate={rate:.6f}',
                        'pnl': -entry_cost,
                    })

        total_funding += hour_funding
        total_costs += hour_costs

        # Update peak
        if equity > peak_equity:
            peak_equity = equity

        result.equity_curve.append(equity)
        result.funding_income.append(hour_funding)
        result.costs.append(hour_costs)

        if i < len(list(normalized.values())[0]):
            result.timestamps.append(list(normalized.values())[0].iloc[i].get('ts', i))

    # Close any remaining positions
    for symbol, pos in positions.items():
        close_cost = pos.notional * (params.taker_fee + params.slippage) * 2
        equity -= close_cost

    result.equity_curve.append(equity)

    # Calculate metrics
    result.metrics = calculate_all_metrics(
        equity_curve=result.equity_curve,
        initial_capital=params.initial_capital,
        total_funding=total_funding,
        total_costs=total_costs,
        trades=result.trades,
    )

    return result


if __name__ == "__main__":
    from .data_fetcher import load_all_funding_data

    print("Loading funding data...")
    data = load_all_funding_data()

    if not data:
        print("No data found. Run data_fetcher.py first.")
        exit(1)

    print(f"Loaded {len(data)} markets")
    params = StrategyParams()

    print(f"\nRunning backtest with default params:")
    print(f"  Capital: ${params.initial_capital}")
    print(f"  Leverage: {params.leverage}x")
    print(f"  Funding threshold: {params.funding_threshold}")

    result = run_backtest(data, params)

    print(f"\n{'='*50}")
    print("BACKTEST RESULTS")
    print(f"{'='*50}")
    for key, val in result.metrics.items():
        if isinstance(val, float):
            print(f"  {key}: {val:.4f}")
        else:
            print(f"  {key}: {val}")
