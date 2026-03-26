"""
Parameter space definition for genetic optimization.
Each gene maps to a StrategyParams field.
"""

from dataclasses import dataclass

# (min, max) bounds for each parameter
PARAM_BOUNDS = {
    'leverage':                 (1.5, 5.0),
    'funding_threshold':       (0.0001, 0.01),
    'delta_threshold':         (0.01, 0.05),
    'max_drawdown':            (0.03, 0.15),
    'liquidation_buffer':      (0.10, 0.30),
    'negative_funding_exit_hours': (6, 48),
    'taker_fee':               (0.0005, 0.002),
    'sol_weight':              (0.1, 0.8),
    'btc_weight':              (0.1, 0.6),
    'eth_weight':              (0.1, 0.6),
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
        if name == 'negative_funding_exit_hours':
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
