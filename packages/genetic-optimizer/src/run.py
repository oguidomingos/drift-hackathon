"""
Entry point for running the genetic optimizer.
"""

import json
import sys
from pathlib import Path

# Add backtest/src to path so bare imports work (simulator, walk_forward, etc.)
_BACKTEST_SRC = Path(__file__).parent.parent.parent / "backtest" / "src"
_BACKTEST_SRC_STR = str(_BACKTEST_SRC)
if _BACKTEST_SRC_STR not in sys.path:
    sys.path.insert(0, _BACKTEST_SRC_STR)

from data_fetcher import load_all_funding_data  # type: ignore
from .optimizer import run_optimization


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Genetic optimizer for strategy params")
    parser.add_argument("--pop", type=int, default=50, help="Population size")
    parser.add_argument("--gen", type=int, default=30, help="Number of generations")
    parser.add_argument("--no-wf", action="store_true", help="Disable walk-forward validation")
    parser.add_argument("--output", type=str, default=None, help="Output JSON path")
    args = parser.parse_args()

    print("Loading funding data...")
    data = load_all_funding_data()
    if not data:
        print("No funding data found. Run: cd packages/backtest && python -m src.data_fetcher")
        sys.exit(1)

    print(f"Loaded {len(data)} markets: {list(data.keys())}")

    results = run_optimization(
        funding_data=data,
        population_size=args.pop,
        n_generations=args.gen,
        use_walk_forward=not args.no_wf,
    )

    output_path = args.output or str(_BACKTEST_SRC.parent / "results" / "ga_results.json")
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w') as f:
        json.dump({
            'best_params': results['best_params'],
            'best_fitness': results['best_fitness'],
            'hall_of_fame': results['hall_of_fame'],
        }, f, indent=2, default=str)

    print(f"\nResults saved to {output_path}")

    bp = results['best_params']
    print(f"\n# Optimal params for .env:")
    print(f"MAX_LEVERAGE={bp['leverage']:.2f}")
    print(f"FUNDING_THRESHOLD={bp['funding_threshold']:.10f}")
    print(f"DELTA_THRESHOLD={bp['delta_threshold']:.4f}")
    print(f"MAX_DRAWDOWN={bp['max_drawdown']:.4f}")
    print(f"LIQUIDATION_BUFFER={bp['liquidation_buffer']:.4f}")


if __name__ == "__main__":
    main()
