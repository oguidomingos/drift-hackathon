"""
Entry point for running the genetic optimizer.
"""

import json
import sys
import os
from pathlib import Path

# Add backtest package to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'backtest'))

from src.data_fetcher import load_all_funding_data
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
        print("No funding data found. Run backtest/src/data_fetcher.py first.")
        sys.exit(1)

    print(f"Loaded {len(data)} markets")

    results = run_optimization(
        funding_data=data,
        population_size=args.pop,
        n_generations=args.gen,
        use_walk_forward=not args.no_wf,
    )

    # Save results
    output_path = args.output or str(
        Path(__file__).parent.parent.parent / "backtest" / "results" / "ga_results.json"
    )
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    # Serialize (logbook is not directly JSON-serializable)
    save_data = {
        'best_params': results['best_params'],
        'best_fitness': results['best_fitness'],
        'hall_of_fame': results['hall_of_fame'],
    }

    with open(output_path, 'w') as f:
        json.dump(save_data, f, indent=2, default=str)

    print(f"\nResults saved to {output_path}")

    # Print .env format for keeper-bot
    bp = results['best_params']
    print(f"\n# Paste into .env for keeper-bot:")
    print(f"MAX_LEVERAGE={bp['leverage']:.2f}")
    print(f"FUNDING_THRESHOLD={bp['funding_threshold']:.6f}")
    print(f"DELTA_THRESHOLD={bp['delta_threshold']:.4f}")
    print(f"MAX_DRAWDOWN={bp['max_drawdown']:.4f}")
    print(f"LIQUIDATION_BUFFER={bp['liquidation_buffer']:.4f}")


if __name__ == "__main__":
    main()
