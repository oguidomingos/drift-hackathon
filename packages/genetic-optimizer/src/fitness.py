"""
Fitness function for genetic algorithm.
Uses Calmar ratio from walk-forward backtest.
"""

import sys
from pathlib import Path

# Add backtest/src to path so bare imports (metrics, simulator) work
_BACKTEST_SRC = Path(__file__).parent.parent.parent / "backtest" / "src"
_BACKTEST_SRC_STR = str(_BACKTEST_SRC)
if _BACKTEST_SRC_STR not in sys.path:
    sys.path.insert(0, _BACKTEST_SRC_STR)

# Import directly (now they'll be found as top-level modules)
from simulator import run_backtest, StrategyParams  # type: ignore
from walk_forward import walk_forward_validation    # type: ignore

from .genome import genome_to_params


def evaluate_fitness(
    genome: list[float],
    funding_data: dict,
    use_walk_forward: bool = True,
) -> tuple:
    """
    Evaluate a genome's fitness. Returns (calmar_ratio,) for DEAP.
    """
    params_dict = genome_to_params(genome)

    strategy = StrategyParams(
        leverage=params_dict['leverage'],
        funding_threshold=params_dict['funding_threshold'],
        delta_threshold=params_dict['delta_threshold'],
        max_drawdown=params_dict['max_drawdown'],
        liquidation_buffer=params_dict['liquidation_buffer'],
        negative_funding_exit_hours=params_dict['negative_funding_exit_hours'],
        min_hold_hours=params_dict['min_hold_hours'],
        taker_fee=params_dict['taker_fee'],
        sol_weight=params_dict['sol_weight'],
        btc_weight=params_dict['btc_weight'],
        eth_weight=params_dict['eth_weight'],
    )

    try:
        if use_walk_forward:
            wf = walk_forward_validation(funding_data, strategy, train_ratio=0.7)
            calmar = wf['test_metrics'].get('calmar_ratio', 0)
            if not wf['is_robust']:
                calmar *= 0.5
        else:
            result = run_backtest(funding_data, strategy)
            calmar = result.metrics.get('calmar_ratio', 0)

        if calmar == float('inf'):
            calmar = 5.0
        elif calmar == float('-inf') or calmar != calmar:
            calmar = -5.0
        calmar = max(-5.0, min(5.0, calmar))

    except Exception:
        calmar = -5.0

    return (calmar,)
