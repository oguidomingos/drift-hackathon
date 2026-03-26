"""
Performance metrics: Sharpe, Sortino, Calmar, MaxDD, Win Rate.
"""

import numpy as np
from typing import Optional


def calculate_returns(equity_curve: list[float]) -> np.ndarray:
    """Calculate period returns from equity curve."""
    eq = np.array(equity_curve)
    returns = np.diff(eq) / eq[:-1]
    return returns


def sharpe_ratio(
    returns: np.ndarray,
    risk_free_rate: float = 0.0,
    periods_per_year: float = 8760,  # hourly data
) -> float:
    """Annualized Sharpe ratio."""
    if len(returns) < 2 or np.std(returns) == 0:
        return 0.0
    excess = returns - risk_free_rate / periods_per_year
    return float(np.mean(excess) / np.std(excess) * np.sqrt(periods_per_year))


def sortino_ratio(
    returns: np.ndarray,
    risk_free_rate: float = 0.0,
    periods_per_year: float = 8760,
) -> float:
    """Annualized Sortino ratio (downside deviation only)."""
    if len(returns) < 2:
        return 0.0
    excess = returns - risk_free_rate / periods_per_year
    downside = returns[returns < 0]
    if len(downside) == 0 or np.std(downside) == 0:
        return float('inf') if np.mean(excess) > 0 else 0.0
    return float(np.mean(excess) / np.std(downside) * np.sqrt(periods_per_year))


def max_drawdown(equity_curve: list[float]) -> float:
    """Maximum drawdown as a fraction."""
    eq = np.array(equity_curve)
    peak = np.maximum.accumulate(eq)
    drawdowns = (peak - eq) / peak
    return float(np.max(drawdowns)) if len(drawdowns) > 0 else 0.0


def calmar_ratio(
    equity_curve: list[float],
    periods_per_year: float = 8760,
) -> float:
    """Calmar ratio = annualized return / max drawdown."""
    if len(equity_curve) < 2:
        return 0.0
    total_return = (equity_curve[-1] - equity_curve[0]) / equity_curve[0]
    n_periods = len(equity_curve) - 1
    annualized_return = total_return * (periods_per_year / n_periods)
    mdd = max_drawdown(equity_curve)
    if mdd == 0:
        return float('inf') if annualized_return > 0 else 0.0
    return annualized_return / mdd


def win_rate(trades: list[dict]) -> float:
    """Fraction of profitable trades."""
    if not trades:
        return 0.0
    winners = sum(1 for t in trades if t.get('pnl', 0) > 0)
    return winners / len(trades)


def profit_factor(trades: list[dict]) -> float:
    """Gross profits / gross losses."""
    gross_profit = sum(t['pnl'] for t in trades if t.get('pnl', 0) > 0)
    gross_loss = abs(sum(t['pnl'] for t in trades if t.get('pnl', 0) < 0))
    if gross_loss == 0:
        return float('inf') if gross_profit > 0 else 0.0
    return gross_profit / gross_loss


def calculate_all_metrics(
    equity_curve: list[float],
    initial_capital: float,
    total_funding: float,
    total_costs: float,
    trades: list[dict],
) -> dict:
    """Calculate all performance metrics."""
    returns = calculate_returns(equity_curve)
    final_equity = equity_curve[-1] if equity_curve else initial_capital
    total_return = (final_equity - initial_capital) / initial_capital

    return {
        'initial_capital': initial_capital,
        'final_equity': final_equity,
        'total_return': total_return,
        'total_return_pct': total_return * 100,
        'total_funding_income': total_funding,
        'total_costs': total_costs,
        'net_pnl': final_equity - initial_capital,
        'sharpe_ratio': sharpe_ratio(returns),
        'sortino_ratio': sortino_ratio(returns),
        'calmar_ratio': calmar_ratio(equity_curve),
        'max_drawdown': max_drawdown(equity_curve),
        'max_drawdown_pct': max_drawdown(equity_curve) * 100,
        'win_rate': win_rate(trades),
        'profit_factor': profit_factor(trades),
        'total_trades': len(trades),
        'open_trades': sum(1 for t in trades if t.get('action') == 'OPEN'),
        'close_trades': sum(1 for t in trades if t.get('action') == 'CLOSE'),
        'hours_simulated': len(equity_curve) - 1,
    }
