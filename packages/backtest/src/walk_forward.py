"""
Walk-forward validation to confirm strategy robustness (not overfitting).

Split data into train (70%) and test (30%) periods.
"""

import pandas as pd
from typing import Optional

try:
    from .simulator import run_backtest, StrategyParams, SimulationResult
    from .metrics import calculate_all_metrics
except ImportError:
    from simulator import run_backtest, StrategyParams, SimulationResult  # type: ignore
    from metrics import calculate_all_metrics  # type: ignore


def split_data(
    funding_data: dict[str, pd.DataFrame],
    train_ratio: float = 0.7,
) -> tuple[dict[str, pd.DataFrame], dict[str, pd.DataFrame]]:
    """Split funding data into train and test sets by time."""
    train_data = {}
    test_data = {}

    for symbol, df in funding_data.items():
        df = df.sort_values(df.columns[0]).reset_index(drop=True)
        split_idx = int(len(df) * train_ratio)
        train_data[symbol] = df.iloc[:split_idx].copy()
        test_data[symbol] = df.iloc[split_idx:].copy()

    return train_data, test_data


def walk_forward_validation(
    funding_data: dict[str, pd.DataFrame],
    params: StrategyParams,
    train_ratio: float = 0.7,
) -> dict:
    """
    Run walk-forward validation.
    Returns train metrics, test metrics, and robustness ratios.
    """
    train_data, test_data = split_data(funding_data, train_ratio)

    print(f"Train period: {sum(len(df) for df in train_data.values())} data points")
    print(f"Test period: {sum(len(df) for df in test_data.values())} data points")

    # Run on train
    train_result = run_backtest(train_data, params)
    print(f"\nTrain Sharpe: {train_result.metrics.get('sharpe_ratio', 0):.4f}")
    print(f"Train Return: {train_result.metrics.get('total_return_pct', 0):.2f}%")

    # Run on test (out-of-sample)
    test_result = run_backtest(test_data, params)
    print(f"\nTest Sharpe: {test_result.metrics.get('sharpe_ratio', 0):.4f}")
    print(f"Test Return: {test_result.metrics.get('total_return_pct', 0):.2f}%")

    # Robustness ratios
    train_sharpe = train_result.metrics.get('sharpe_ratio', 0)
    test_sharpe = test_result.metrics.get('sharpe_ratio', 0)

    sharpe_ratio_decay = (
        test_sharpe / train_sharpe if train_sharpe != 0 else 0
    )

    train_return = train_result.metrics.get('total_return', 0)
    test_return = test_result.metrics.get('total_return', 0)

    return_decay = (
        test_return / train_return if train_return != 0 else 0
    )

    return {
        'train_metrics': train_result.metrics,
        'test_metrics': test_result.metrics,
        'train_equity_curve': train_result.equity_curve,
        'test_equity_curve': test_result.equity_curve,
        'sharpe_ratio_decay': sharpe_ratio_decay,
        'return_decay': return_decay,
        'is_robust': sharpe_ratio_decay > 0.5 and test_sharpe > 0,
    }


if __name__ == "__main__":
    from .data_fetcher import load_all_funding_data

    print("Loading funding data...")
    data = load_all_funding_data()

    if not data:
        print("No data found. Run data_fetcher.py first.")
        exit(1)

    params = StrategyParams()
    results = walk_forward_validation(data, params)

    print(f"\n{'='*50}")
    print("WALK-FORWARD RESULTS")
    print(f"{'='*50}")
    print(f"Sharpe decay: {results['sharpe_ratio_decay']:.4f}")
    print(f"Return decay: {results['return_decay']:.4f}")
    print(f"Robust: {'YES' if results['is_robust'] else 'NO'}")
