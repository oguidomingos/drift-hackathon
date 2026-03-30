"""
Parameter space definition for genetic optimization.
Each gene maps to a StrategyParams field.
"""

# (min, max) bounds for each parameter
PARAM_BOUNDS = {
    'leverage':                    (1.5,  5.0),
    'funding_threshold':           (0.0,  0.00005),
    'delta_threshold':             (0.01, 0.05),
    'max_drawdown':                (0.05, 0.25),
    'liquidation_buffer':          (0.10, 0.35),
    'negative_funding_exit_hours': (24,   200),
    'min_hold_hours':              (12,   500),
    'taker_fee':                   (0.0003, 0.001),
    # Market weights (normalized to sum=1 in genome_to_params)
    'sol_weight':                  (0.0,  0.4),
    'btc_weight':                  (0.1,  0.7),
    'eth_weight':                  (0.0,  0.4),
    'doge_weight':                 (0.0,  0.3),
    'wif_weight':                  (0.0,  0.3),
    'jto_weight':                  (0.0,  0.3),
    # New: momentum window (hours of rolling avg for entry filter)
    'momentum_window':             (6,    72),
    # New: idle USDC lending APY
    'idle_lending_apy':            (0.03, 0.12),
}

PARAM_NAMES = list(PARAM_BOUNDS.keys())
N_PARAMS = len(PARAM_NAMES)

WEIGHT_PARAMS = ['sol_weight', 'btc_weight', 'eth_weight', 'doge_weight', 'wif_weight', 'jto_weight']
INT_PARAMS = ['negative_funding_exit_hours', 'min_hold_hours', 'momentum_window']


def genome_to_params(genome: list[float]) -> dict:
    """Convert a genome (list of floats in [0,1]) to strategy params dict."""
    params = {}
    for i, name in enumerate(PARAM_NAMES):
        lo, hi = PARAM_BOUNDS[name]
        val = lo + genome[i] * (hi - lo)
        if name in INT_PARAMS:
            val = int(round(val))
        params[name] = val

    # Normalize market weights to sum to 1
    total_w = sum(params[w] for w in WEIGHT_PARAMS)
    if total_w > 0:
        for w in WEIGHT_PARAMS:
            params[w] /= total_w

    return params


def params_to_genome(params: dict) -> list[float]:
    """Convert strategy params dict back to genome [0,1] space."""
    genome = []
    for name in PARAM_NAMES:
        lo, hi = PARAM_BOUNDS[name]
        val = params.get(name, (lo + hi) / 2)
        genome.append(max(0.0, min(1.0, (val - lo) / (hi - lo))))
    return genome
