"""
Fitness function for genetic algorithm.
Optimizes for: high APY (≥10%) + high Sharpe + low drawdown.
Penalizes strategies below 10% APY (hackathon requirement).
"""

import sys
from pathlib import Path

_BACKTEST_SRC = Path(__file__).parent.parent.parent / "backtest" / "src"
_BACKTEST_SRC_STR = str(_BACKTEST_SRC)
if _BACKTEST_SRC_STR not in sys.path:
    sys.path.insert(0, _BACKTEST_SRC_STR)

from simulator import run_backtest, StrategyParams  # type: ignore
from walk_forward import walk_forward_validation    # type: ignore

from .genome import genome_to_params, WEIGHT_PARAMS

MIN_APY_REQUIRED = 0.10   # 10% APY — hackathon gating requirement
HOURS_PER_YEAR = 8760.0


def evaluate_fitness(
    genome: list[float],
    funding_data: dict,
    use_walk_forward: bool = False,
) -> tuple:
    """
    Evaluate a genome's fitness. Returns (score,) for DEAP.

    Score = Sharpe * annualized_return_bonus
    Penalizes annualized return < 10% APY by 0.3x multiplier.
    Capped at [-5, 10].
    """
    params_dict = genome_to_params(genome)

    # Only pass params that StrategyParams accepts
    known = {f.name for f in StrategyParams.__dataclass_fields__.values()} if hasattr(StrategyParams, '__dataclass_fields__') else set(vars(StrategyParams()).keys())

    strategy = StrategyParams(**{k: v for k, v in params_dict.items() if k in known})

    try:
        if use_walk_forward:
            wf = walk_forward_validation(funding_data, strategy, train_ratio=0.7)
            metrics = wf['test_metrics']
        else:
            result = run_backtest(funding_data, strategy)
            metrics = result.metrics

        sharpe = metrics.get('sharpe_ratio', 0)
        calmar = metrics.get('calmar_ratio', 0)
        total_return = metrics.get('total_return', 0)
        hours = metrics.get('hours_simulated', len(next(iter(funding_data.values()))))
        max_dd = metrics.get('max_drawdown', 1.0)

        # Annualized return
        ann_return = (1 + total_return) ** (HOURS_PER_YEAR / max(hours, 1)) - 1

        # Base score: blend of Sharpe + Calmar (rewards both return and risk-adjusted)
        score = 0.6 * sharpe + 0.4 * calmar

        # APY bonus: reward strategies meeting the 10% requirement
        if ann_return >= MIN_APY_REQUIRED:
            apy_bonus = 1.0 + min(ann_return - MIN_APY_REQUIRED, 0.5) * 2.0  # up to 2x bonus
        else:
            # Heavy penalty below 10% APY — but not zero (allow GA to find the direction)
            apy_bonus = 0.3 * max(ann_return / MIN_APY_REQUIRED, 0.0)

        score = score * apy_bonus

        # Sanitize
        if score != score or score == float('inf'):
            score = -5.0
        elif score == float('-inf'):
            score = -5.0
        score = max(-5.0, min(10.0, score))

    except Exception:
        score = -5.0

    return (score,)
