"""
Generate charts and export data as JSON for Remotion video.
"""

import json
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from pathlib import Path
from typing import Optional

from .simulator import SimulationResult

RESULTS_DIR = Path(__file__).parent.parent / "results"


def plot_equity_curve(
    result: SimulationResult,
    title: str = "Equity Curve",
    save_path: Optional[Path] = None,
) -> None:
    """Plot equity curve."""
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    path = save_path or RESULTS_DIR / "equity_curve.png"

    fig, ax = plt.subplots(figsize=(12, 6))
    ax.plot(result.equity_curve, linewidth=1.5, color='#00D4AA')
    ax.set_title(title, fontsize=16, fontweight='bold')
    ax.set_xlabel("Hours")
    ax.set_ylabel("Equity (USDC)")
    ax.grid(True, alpha=0.3)
    ax.fill_between(
        range(len(result.equity_curve)),
        result.equity_curve[0],
        result.equity_curve,
        alpha=0.1,
        color='#00D4AA',
    )
    fig.tight_layout()
    fig.savefig(path, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f"Saved equity curve to {path}")


def plot_funding_income(
    result: SimulationResult,
    save_path: Optional[Path] = None,
) -> None:
    """Plot cumulative funding income."""
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    path = save_path or RESULTS_DIR / "funding_income.png"

    cumulative = np.cumsum(result.funding_income)

    fig, ax = plt.subplots(figsize=(12, 6))
    ax.plot(cumulative, linewidth=1.5, color='#7B61FF')
    ax.set_title("Cumulative Funding Income", fontsize=16, fontweight='bold')
    ax.set_xlabel("Hours")
    ax.set_ylabel("Funding Income (USDC)")
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(path, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f"Saved funding income chart to {path}")


def plot_drawdown(
    result: SimulationResult,
    save_path: Optional[Path] = None,
) -> None:
    """Plot drawdown over time."""
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    path = save_path or RESULTS_DIR / "drawdown.png"

    eq = np.array(result.equity_curve)
    peak = np.maximum.accumulate(eq)
    drawdown = (peak - eq) / peak * 100

    fig, ax = plt.subplots(figsize=(12, 4))
    ax.fill_between(range(len(drawdown)), 0, -drawdown, alpha=0.5, color='#FF6B6B')
    ax.set_title("Drawdown", fontsize=16, fontweight='bold')
    ax.set_xlabel("Hours")
    ax.set_ylabel("Drawdown (%)")
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(path, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f"Saved drawdown chart to {path}")


def export_for_remotion(
    result: SimulationResult,
    walk_forward_results: Optional[dict] = None,
    save_path: Optional[Path] = None,
) -> None:
    """Export backtest results as JSON for Remotion video."""
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    path = save_path or RESULTS_DIR / "backtest_data.json"

    data = {
        'equity_curve': result.equity_curve,
        'funding_income': list(np.cumsum(result.funding_income).tolist()),
        'metrics': result.metrics,
        'trades_summary': {
            'total': len(result.trades),
            'opens': sum(1 for t in result.trades if t['action'] == 'OPEN'),
            'closes': sum(1 for t in result.trades if t['action'] == 'CLOSE'),
        },
    }

    if walk_forward_results:
        data['walk_forward'] = {
            'train_metrics': walk_forward_results['train_metrics'],
            'test_metrics': walk_forward_results['test_metrics'],
            'sharpe_decay': walk_forward_results['sharpe_ratio_decay'],
            'is_robust': walk_forward_results['is_robust'],
        }

    with open(path, 'w') as f:
        json.dump(data, f, indent=2, default=str)

    print(f"Exported Remotion data to {path}")


def generate_all_charts(result: SimulationResult) -> None:
    """Generate all charts."""
    plot_equity_curve(result)
    plot_funding_income(result)
    plot_drawdown(result)
    print("\nAll charts generated in", RESULTS_DIR)
