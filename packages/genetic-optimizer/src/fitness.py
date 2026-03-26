"""
Fitness function for genetic algorithm.
Uses Calmar ratio from walk-forward backtest.
"""

import sys
import os

# Add backtest package to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'backtest'))

from src.simulator import run_backtest, StrategyParams
from src.walk_forward import walk_forward_validation
from .genome import genome_to_params


def evaluate_fitness(
    genome: list[float],
    funding_data: dict,
    use_walk_forward: bool = True,
) -> tuple[float]:
    """
    Evaluate a genome's fitness using backtest.
    Returns (calmar_ratio,) as a tuple for DEAP compatibility.
    """
    params_dict = genome_to_params(genome)

    strategy = StrategyParams(
        leverage=params_dict['leverage'],
        funding_threshold=params_dict['funding_threshold'],
        delta_threshold=params_dict['delta_threshold'],
        max_drawdown=params_dict['max_drawdown'],
        liquidation_buffer=params_dict['liquidation_buffer'],
        negative_funding_exit_hours=params_dict['negative_funding_exit_hours'],
        taker_fee=params_dict['taker_fee'],
        sol_weight=params_dict['sol_weight'],
        btc_weight=params_dict['btc_weight'],
        eth_weight=params_dict['eth_weight'],
    )

    try:
        if use_walk_forward:
            wf = walk_forward_validation(funding_data, strategy, train_ratio=0.7)
            # Use test Calmar as fitness (out-of-sample performance)
            calmar = wf['test_metrics'].get('calmar_ratio', 0)
            # Penalize if not robust
            if not wf['is_robust']:
                calmar *= 0.5
        else:
            result = run_backtest(funding_data, strategy)
            calmar = result.metrics.get('calmar_ratio', 0)

        # Clamp extreme values
        calmar = max(-10, min(100, calmar))

        # Handle infinity
        if calmar == float('inf'):
            calmar = 100.0
        elif calmar == float('-inf'):
            calmar = -10.0

    except Exception as e:
        print(f"  Fitness eval error: {e}")
        calmar = -10.0

    return (calmar,)
