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

try:
    from .metrics import calculate_all_metrics
except ImportError:
    from metrics import calculate_all_metrics  # type: ignore


@dataclass
class StrategyParams:
    """Strategy parameters (optimizable by GA)."""
    initial_capital: float = 100.0        # USDC
    leverage: float = 2.0
    funding_threshold: float = 0.000003   # min hourly rate to enter (~2.6% ann)
    delta_threshold: float = 0.02         # max delta drift before rebalance
    max_drawdown: float = 0.10            # 10% max drawdown → exit
    liquidation_buffer: float = 0.20      # 20% buffer from liquidation
    negative_funding_exit_hours: int = 72  # 3 days consecutive
    taker_fee: float = 0.0005             # 0.05% taker fee per leg (Drift)
    slippage: float = 0.0003              # 0.03% slippage per trade
    # Multi-market allocation weights (SOL, BTC, ETH)
    sol_weight: float = 0.2
    btc_weight: float = 0.5
    eth_weight: float = 0.3
    # Minimum hours to hold a position before allowing exit (reduces churn)
    min_hold_hours: int = 168             # 1 week minimum hold


@dataclass
class Position:
    symbol: str
    entry_price: float
    base_size: float
    notional: float
    entry_time: int
    funding_pnl: float = 0.0
    weight: float = 1.0
    entry_cost: float = 0.0


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
        - ts: unix timestamp
        - fundingRate: hourly funding rate (absolute USDC terms)
        - oraclePriceTwap: oracle price for normalization
    """
    result = SimulationResult()
    equity = params.initial_capital
    peak_equity = equity
    positions: dict[str, Position] = {}
    negative_funding_counter: dict[str, int] = {}
    total_costs = 0.0
    total_funding = 0.0
    is_killed = False  # drawdown kill switch

    # Normalize funding data
    normalized = {}
    for symbol, df in funding_data.items():
        df = df.copy()
        # Find rate column
        rate_col = None
        for col in ['fundingRate', 'funding_rate', 'rate']:
            if col in df.columns:
                rate_col = col
                break
        if rate_col is None:
            continue

        ts_col = 'ts' if 'ts' in df.columns else df.columns[0]

        df = df.rename(columns={rate_col: 'raw_rate', ts_col: 'ts'})
        df = df.sort_values('ts').reset_index(drop=True)
        df['raw_rate'] = pd.to_numeric(df['raw_rate'], errors='coerce')

        # Normalize by oracle price to get per-unit hourly rate
        if 'oraclePriceTwap' in df.columns:
            df['rate'] = df['raw_rate'] / pd.to_numeric(df['oraclePriceTwap'], errors='coerce')
        else:
            df['rate'] = df['raw_rate']

        normalized[symbol] = df

    if not normalized:
        return result

    max_len = max(len(df) for df in normalized.values())

    # Market weight mapping
    weight_map = {
        'SOL-PERP': params.sol_weight,
        'BTC-PERP': params.btc_weight,
        'ETH-PERP': params.eth_weight,
    }

    # Transaction cost for one round-trip (open + close, both legs)
    round_trip_cost_pct = (params.taker_fee + params.slippage) * 2 * 2  # 2 legs × 2 trades

    for i in range(max_len):
        hour_funding = 0.0
        hour_costs = 0.0

        if is_killed:
            # Stay idle after kill switch
            result.equity_curve.append(equity)
            result.funding_income.append(0.0)
            result.costs.append(0.0)
            continue

        # Check global drawdown
        drawdown = (peak_equity - equity) / peak_equity if peak_equity > 0 else 0
        if drawdown > params.max_drawdown and len(positions) > 0:
            # Kill switch — close everything
            for sym, pos in list(positions.items()):
                close_cost = pos.notional * (params.taker_fee + params.slippage) * 2
                equity -= close_cost
                hour_costs += close_cost
                result.trades.append({
                    'index': i, 'symbol': sym, 'action': 'CLOSE',
                    'reason': 'max_drawdown', 'pnl': pos.funding_pnl - pos.entry_cost - close_cost,
                })
            positions.clear()
            is_killed = True
            total_costs += hour_costs
            result.equity_curve.append(equity)
            result.funding_income.append(0.0)
            result.costs.append(hour_costs)
            continue

        for symbol, df in normalized.items():
            if i >= len(df):
                continue

            rate = df.iloc[i]['rate']
            weight = weight_map.get(symbol, 1.0 / len(normalized))

            # Track negative funding
            if rate < 0:
                negative_funding_counter[symbol] = negative_funding_counter.get(symbol, 0) + 1
            else:
                negative_funding_counter[symbol] = 0

            if symbol in positions:
                pos = positions[symbol]
                hold_hours = i - pos.entry_time

                # Collect funding (short perp: positive rate = income)
                funding_income = pos.notional * rate
                pos.funding_pnl += funding_income
                equity += funding_income
                hour_funding += funding_income

                # Exit conditions (only after min hold period)
                should_exit = False
                exit_reason = ""

                if hold_hours >= params.min_hold_hours:
                    # Negative funding too long
                    neg_hours = negative_funding_counter.get(symbol, 0)
                    if neg_hours >= params.negative_funding_exit_hours:
                        should_exit = True
                        exit_reason = f"negative_funding_{neg_hours}h"

                if should_exit:
                    close_cost = pos.notional * (params.taker_fee + params.slippage) * 2
                    equity -= close_cost
                    hour_costs += close_cost
                    result.trades.append({
                        'index': i, 'symbol': symbol, 'action': 'CLOSE',
                        'reason': exit_reason, 'pnl': pos.funding_pnl - pos.entry_cost - close_cost,
                    })
                    del positions[symbol]

            else:
                # Entry condition: positive funding above threshold
                if rate > params.funding_threshold:
                    # Only open if we're not already overallocated
                    current_exposure = sum(p.notional for p in positions.values())
                    max_exposure = equity * params.leverage
                    available = max_exposure - current_exposure

                    notional = min(equity * params.leverage * weight, available)
                    if notional < 5.0:  # minimum $5 position
                        continue

                    entry_cost = notional * (params.taker_fee + params.slippage) * 2
                    equity -= entry_cost
                    hour_costs += entry_cost

                    positions[symbol] = Position(
                        symbol=symbol,
                        entry_price=0,
                        base_size=notional,
                        notional=notional,
                        entry_time=i,
                        weight=weight,
                        entry_cost=entry_cost,
                    )

                    result.trades.append({
                        'index': i, 'symbol': symbol, 'action': 'OPEN',
                        'reason': f'rate={rate:.8f}', 'pnl': -entry_cost,
                    })

        total_funding += hour_funding
        total_costs += hour_costs

        if equity > peak_equity:
            peak_equity = equity

        result.equity_curve.append(equity)
        result.funding_income.append(hour_funding)
        result.costs.append(hour_costs)

    # Close any remaining positions
    for sym, pos in positions.items():
        close_cost = pos.notional * (params.taker_fee + params.slippage) * 2
        equity -= close_cost
        total_costs += close_cost
        result.trades.append({
            'index': max_len, 'symbol': sym, 'action': 'CLOSE',
            'reason': 'end_of_backtest', 'pnl': pos.funding_pnl - pos.entry_cost - close_cost,
        })

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
