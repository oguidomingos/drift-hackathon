"""
Parameter space definition for genetic optimization.
Each gene maps to a StrategyParams field.
"""

from dataclasses import dataclass

# (min, max) bounds for each parameter
PARAM_BOUNDS = {
    'leverage':                 (1.5, 5.0),
    'funding_threshold':       (0.0, 0.00005),
    'delta_threshold':         (0.01, 0.05),
    'max_drawdown':            (0.05, 0.20),
    'liquidation_buffer':      (0.10, 0.30),
    'negative_funding_exit_hours': (24, 168),
    'min_hold_hours':          (12, 336),
    'taker_fee':               (0.0003, 0.001),
    'sol_weight':              (0.0, 0.5),
    'btc_weight':              (0.2, 0.8),
    'eth_weight':              (0.0, 0.6),
}

PARAM_NAMES = list(PARAM_BOUNDS.keys())
N_PARAMS = len(PARAM_NAMES)


def genome_to_params(genome: list[float]) -> dict:
    """Convert a genome (list of floats in [0,1]) to strategy params dict."""
    params = {}
    for i, name in enumerate(PARAM_NAMES):
        lo, hi = PARAM_BOUNDS[name]
        val = lo + genome[i] * (hi - lo)
        # Round integer params
        if name in ('negative_funding_exit_hours', 'min_hold_hours'):
            val = int(round(val))
        params[name] = val

    # Normalize weights to sum to 1
    total_w = params['sol_weight'] + params['btc_weight'] + params['eth_weight']
    if total_w > 0:
        params['sol_weight'] /= total_w
        params['btc_weight'] /= total_w
        params['eth_weight'] /= total_w

    return params


def params_to_genome(params: dict) -> list[float]:
    """Convert strategy params dict back to genome [0,1] space."""
    genome = []
    for name in PARAM_NAMES:
        lo, hi = PARAM_BOUNDS[name]
        val = params.get(name, (lo + hi) / 2)
        genome.append((val - lo) / (hi - lo))
    return genome
