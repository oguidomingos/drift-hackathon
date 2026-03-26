# Risk Management Framework

## 5 Rebalance Triggers

1. **Delta Drift > 2%** — Rebalance perp/spot legs to restore delta neutrality
2. **Effective Leverage > 3x** — Reduce position size
3. **Liquidation Distance < 20%** — Urgent position reduction
4. **Negative Funding > 24h** — Exit that market
5. **Drawdown > 5%** — Full exit (kill switch)

## Position Sizing

Quarter-Kelly criterion for conservative position sizing.

## Liquidation Analysis

TODO: Add detailed analysis.
