"""
Backtesting simulator for delta-neutral funding rate strategy.

Simulates hour-by-hour:
  - Funding income from short perp positions
  - Idle USDC lending yield (on capital not deployed as margin)
  - Transaction costs (taker fees, slippage)
  - 24h momentum filter (only enter when trend is positive)
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
    initial_capital: float = 100.0
    leverage: float = 3.83
    funding_threshold: float = 0.0
    delta_threshold: float = 0.04
    max_drawdown: float = 0.1557
    liquidation_buffer: float = 0.30
    negative_funding_exit_hours: int = 136
    taker_fee: float = 0.0003
    slippage: float = 0.0003
    # Market allocation weights (normalized to sum 1.0)
    sol_weight: float = 0.0
    btc_weight: float = 0.50
    eth_weight: float = 0.20
    doge_weight: float = 0.10
    wif_weight: float = 0.10
    jto_weight: float = 0.10
    # Hold time controls
    min_hold_hours: int = 291
    # Momentum filter: only enter if rolling avg over last N hours > threshold
    momentum_window: int = 24
    # USDC idle lending yield (APY) — earned on undeployed capital
    idle_lending_apy: float = 0.06   # 6% APY (conservative Drift Spot rate)


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
    rate_history: list = field(default_factory=list)


@dataclass
class SimulationResult:
    equity_curve: list[float] = field(default_factory=list)
    timestamps: list = field(default_factory=list)
    trades: list[dict] = field(default_factory=list)
    funding_income: list[float] = field(default_factory=list)
    lending_income: list[float] = field(default_factory=list)
    costs: list[float] = field(default_factory=list)
    metrics: dict = field(default_factory=dict)


WEIGHT_KEYS = {
    'SOL-PERP':  'sol_weight',
    'BTC-PERP':  'btc_weight',
    'ETH-PERP':  'eth_weight',
    'DOGE-PERP': 'doge_weight',
    'WIF-PERP':  'wif_weight',
    'JTO-PERP':  'jto_weight',
    'JUP-PERP':  'jto_weight',   # share JTO weight if both present
    'APT-PERP':  'eth_weight',
    'SUI-PERP':  'eth_weight',
    'LINK-PERP': 'btc_weight',
    'AVAX-PERP': 'eth_weight',
}


def _get_weight(symbol: str, params: StrategyParams) -> float:
    key = WEIGHT_KEYS.get(symbol)
    return getattr(params, key, 0.0) if key else 0.0


def _normalize_weights(symbols: list[str], params: StrategyParams) -> dict[str, float]:
    """Get normalized allocation weights for active symbols."""
    raw = {s: _get_weight(s, params) for s in symbols}
    total = sum(raw.values())
    if total <= 0:
        equal = 1.0 / len(symbols)
        return {s: equal for s in symbols}
    return {s: w / total for s, w in raw.items()}


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
    neg_funding_counter: dict[str, int] = {}
    rate_history: dict[str, list] = {s: [] for s in funding_data}
    total_costs = 0.0
    total_funding = 0.0
    total_lending = 0.0
    is_killed = False

    # Normalize funding data
    normalized = {}
    for symbol, df in funding_data.items():
        df = df.copy()
        rate_col = next((c for c in ['fundingRate', 'funding_rate', 'rate'] if c in df.columns), None)
        if rate_col is None:
            continue
        ts_col = 'ts' if 'ts' in df.columns else df.columns[0]
        df = df.rename(columns={rate_col: 'raw_rate', ts_col: 'ts'})
        df = df.sort_values('ts').reset_index(drop=True)
        df['raw_rate'] = pd.to_numeric(df['raw_rate'], errors='coerce')
        if 'oraclePriceTwap' in df.columns:
            df['rate'] = df['raw_rate'] / pd.to_numeric(df['oraclePriceTwap'], errors='coerce')
        else:
            df['rate'] = df['raw_rate']
        normalized[symbol] = df

    if not normalized:
        return result

    max_len = max(len(df) for df in normalized.values())
    weight_map = _normalize_weights(list(normalized.keys()), params)

    # Idle lending yield per hour
    idle_yield_per_hour = params.idle_lending_apy / 8760.0

    for i in range(max_len):
        hour_funding = 0.0
        hour_costs = 0.0
        hour_lending = 0.0

        if is_killed:
            # Still earn lending on idle capital after kill
            lending = equity * idle_yield_per_hour
            equity += lending
            hour_lending = lending
            total_lending += lending
            result.equity_curve.append(equity)
            result.funding_income.append(0.0)
            result.lending_income.append(hour_lending)
            result.costs.append(0.0)
            continue

        # Check global drawdown
        drawdown = (peak_equity - equity) / peak_equity if peak_equity > 0 else 0
        if drawdown > params.max_drawdown and len(positions) > 0:
            for sym, pos in list(positions.items()):
                close_cost = pos.notional * (params.taker_fee + params.slippage) * 2
                equity -= close_cost
                hour_costs += close_cost
                result.trades.append({
                    'index': i, 'symbol': sym, 'action': 'CLOSE',
                    'reason': 'max_drawdown',
                    'pnl': pos.funding_pnl - pos.entry_cost - close_cost,
                })
            positions.clear()
            is_killed = True
            total_costs += hour_costs
            result.equity_curve.append(equity)
            result.funding_income.append(0.0)
            result.lending_income.append(0.0)
            result.costs.append(hour_costs)
            continue

        # --- Per-market logic ---
        for symbol, df in normalized.items():
            if i >= len(df):
                continue

            rate = float(df.iloc[i]['rate'])
            if np.isnan(rate):
                continue

            weight = weight_map.get(symbol, 0.0)
            if weight <= 0:
                continue

            # Update rate history for momentum filter
            hist = rate_history.setdefault(symbol, [])
            hist.append(rate)
            if len(hist) > max(params.momentum_window, params.negative_funding_exit_hours + 1):
                hist.pop(0)

            # Update negative funding counter
            if rate < 0:
                neg_funding_counter[symbol] = neg_funding_counter.get(symbol, 0) + 1
            else:
                neg_funding_counter[symbol] = 0

            if symbol in positions:
                pos = positions[symbol]
                hold_hours = i - pos.entry_time

                # Collect funding (SHORT perp: positive rate = income)
                funding_income = pos.notional * rate
                pos.funding_pnl += funding_income
                equity += funding_income
                hour_funding += funding_income

                # Exit conditions (only after min hold period)
                if hold_hours >= params.min_hold_hours:
                    neg_hours = neg_funding_counter.get(symbol, 0)
                    if neg_hours >= params.negative_funding_exit_hours:
                        close_cost = pos.notional * (params.taker_fee + params.slippage) * 2
                        equity -= close_cost
                        hour_costs += close_cost
                        result.trades.append({
                            'index': i, 'symbol': symbol, 'action': 'CLOSE',
                            'reason': f'neg_funding_{neg_hours}h',
                            'pnl': pos.funding_pnl - pos.entry_cost - close_cost,
                        })
                        del positions[symbol]

            else:
                # Momentum filter: rolling avg over last momentum_window hours
                window = min(params.momentum_window, len(hist))
                avg_rate = float(np.mean(hist[-window:])) if window > 0 else rate

                # Entry condition: momentum AND current rate both above threshold
                if avg_rate > params.funding_threshold and rate > params.funding_threshold:
                    current_exposure = sum(p.notional for p in positions.values())
                    max_exposure = equity * params.leverage
                    available = max_exposure - current_exposure
                    notional = min(equity * params.leverage * weight, available)

                    if notional < 5.0:
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
                        'reason': f'rate={rate:.8f} avg={avg_rate:.8f}',
                        'pnl': -entry_cost,
                    })

        # --- Idle USDC lending yield ---
        # Deployed margin = total_notional / leverage; rest is idle earning yield
        total_notional = sum(p.notional for p in positions.values())
        deployed_margin = total_notional / params.leverage if params.leverage > 0 else 0
        idle_fraction = max(0.0, 1.0 - deployed_margin / equity) if equity > 0 else 1.0
        lending = equity * idle_fraction * idle_yield_per_hour
        equity += lending
        hour_lending = lending
        total_lending += lending

        total_funding += hour_funding
        total_costs += hour_costs

        if equity > peak_equity:
            peak_equity = equity

        result.equity_curve.append(equity)
        result.funding_income.append(hour_funding)
        result.lending_income.append(hour_lending)
        result.costs.append(hour_costs)

    # Close remaining positions at end
    for sym, pos in positions.items():
        close_cost = pos.notional * (params.taker_fee + params.slippage) * 2
        equity -= close_cost
        total_costs += close_cost
        result.trades.append({
            'index': max_len, 'symbol': sym, 'action': 'CLOSE',
            'reason': 'end_of_backtest',
            'pnl': pos.funding_pnl - pos.entry_cost - close_cost,
        })
    result.equity_curve.append(equity)

    result.metrics = calculate_all_metrics(
        equity_curve=result.equity_curve,
        initial_capital=params.initial_capital,
        total_funding=total_funding,
        total_costs=total_costs,
        trades=result.trades,
    )
    result.metrics['total_lending_income'] = round(total_lending, 4)
    result.metrics['lending_apy'] = round(params.idle_lending_apy * 100, 1)

    return result


if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(Path(__file__).parent))
    from data_fetcher import load_all_funding_data
    from pathlib import Path

    print("Loading funding data...")
    data = load_all_funding_data()
    if not data:
        print("No data found. Run: python -m src.data_fetcher")
        exit(1)
    print(f"Loaded {len(data)} markets: {list(data.keys())}")

    params = StrategyParams()
    result = run_backtest(data, params)

    print(f"\n{'='*50}")
    print("BACKTEST RESULTS")
    print(f"{'='*50}")
    for key, val in result.metrics.items():
        if isinstance(val, float):
            print(f"  {key}: {val:.4f}")
        else:
            print(f"  {key}: {val}")
