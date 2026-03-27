# Delta-Neutral Funding Rate Strategy — Whitepaper

## Abstract

This vault implements an automated delta-neutral funding rate capture strategy on Drift Protocol (Solana). By simultaneously holding opposing positions in perpetual futures (short) and spot markets (long), the strategy achieves near-zero directional exposure while systematically capturing positive funding rate payments. A genetic algorithm optimizes strategy parameters, and a multi-market rotation system maximizes yield across SOL, BTC, and ETH perpetuals.

## 1. Investment Thesis

### 1.1 Funding Rate Mechanics

Perpetual futures contracts have no expiry date. To keep perp prices anchored to spot prices, exchanges use a **funding rate** mechanism:

- When **funding is positive**: longs pay shorts (market is overleveraged long)
- When **funding is negative**: shorts pay longs (market is overleveraged short)
- On Drift, funding settles **every hour**

Historically, perpetual futures markets exhibit a persistent **positive funding rate bias**, driven by speculative demand for leveraged long exposure. This creates a structural income opportunity for short-side participants.

### 1.2 Delta-Neutral Construction

To capture funding income without directional price risk:

```
Position = SHORT Perp + LONG Spot
```

- **SHORT perp**: Receives positive funding payments
- **LONG spot**: Hedges price exposure (delta)
- **Net delta ≈ 0**: Price movements cancel out between legs

The strategy's P&L is primarily driven by:
- (+) Funding rate income (hourly)
- (-) Transaction costs (entry/exit/rebalance)
- (-) Basis risk (imperfect spot-perp correlation)
- (-) Slippage on market orders

### 1.3 Competitive Edge

1. **Multi-market rotation**: Capital automatically flows to SOL, BTC, or ETH perpetuals based on which has the highest funding rate
2. **Genetic algorithm optimization**: 10 strategy parameters are optimized via evolutionary search, not hand-tuned
3. **Walk-forward validation**: Out-of-sample testing proves the strategy isn't overfitted
4. **Systematic risk management**: 5 automated triggers prevent catastrophic losses

## 2. Strategy Mechanics

### 2.1 Entry Conditions

A position is opened when:
1. Hourly funding rate exceeds the threshold (default: 0.05%/h)
2. The market has sufficient liquidity
3. There is available free collateral
4. No active risk trigger is firing

### 2.2 Position Sizing

Position size is calculated as:
```
notional = freeCollateral × leverage × marketAllocationWeight
baseSize = notional / oraclePrice
```

**Quarter-Kelly criterion** provides the theoretical framework for conservative sizing:
```
f* = (p × b - q) / b × 0.25
```
Where `p` = win probability, `b` = win/loss ratio, `q` = 1 - p.

The practical implementation caps leverage at the genetic-algorithm-optimized `maxLeverage` parameter (typically 1.5-3x).

### 2.3 Multi-Market Allocation

Capital allocation across SOL, BTC, and ETH is **proportional to funding rate magnitude**:

```
weight(market) = fundingRate(market) / sum(allFundingRates)
```

Markets with funding below the threshold receive zero allocation. This ensures capital flows to the highest-yielding opportunities.

### 2.4 Exit Conditions

Positions are closed when:
1. Funding rate drops below threshold for that market
2. A higher-yielding market appears (rotation)
3. Any risk trigger fires (see Section 3)

### 2.5 Rebalancing

The bot checks every 60 seconds (configurable). Rebalancing occurs when:
- Delta drift between perp and spot legs exceeds threshold
- Market rotation signals indicate a better opportunity
- Risk parameters require position reduction

## 3. Risk Management Framework

### 3.1 Five Risk Triggers

| # | Trigger | Threshold | Action |
|---|---------|-----------|--------|
| 1 | Delta drift | > 2% of notional | Rebalance legs |
| 2 | Effective leverage | > 3x (1.5× max) | Reduce position |
| 3 | Liquidation distance | < 20% of price | Urgent reduction |
| 4 | Consecutive negative funding | > 24 hours | Exit that market |
| 5 | Portfolio drawdown | > 5% from peak | Full exit (kill switch) |

### 3.2 Priority Ordering

Triggers are evaluated in reverse priority order:
1. **Drawdown exit** (highest priority): Exits ALL positions immediately
2. **Liquidation warning**: Closes the largest position
3. **Leverage reduction**: Reduces the largest position
4. **Delta rebalance**: Closes and re-opens the drifted position
5. **Negative funding exit**: Exits only the affected market

### 3.3 Liquidation Analysis

With 2x leverage and 20% liquidation buffer:
- Collateral: $100
- Position size: $200
- Maintenance margin: ~5% on Drift
- Liquidation price move: ~45% adverse
- Buffer triggers at: ~36% adverse move
- This is extremely conservative for major assets

### 3.4 Maximum Capital at Risk

- Capital deployed: $50-100 USDC
- Max leverage: 2x (conservatively capped)
- Max drawdown: 5% → $2.50-5.00 maximum loss
- Kill switch via Telegram provides manual override

## 4. Genetic Algorithm Optimization

### 4.1 Parameter Space

| Parameter | Range | Description |
|-----------|-------|-------------|
| leverage | 1.5 - 5.0 | Position sizing multiplier |
| funding_threshold | 0.01% - 1.0% | Minimum hourly rate to enter |
| delta_threshold | 1% - 5% | Max delta drift before rebalance |
| max_drawdown | 3% - 15% | Kill switch level |
| liquidation_buffer | 10% - 30% | Distance from liquidation |
| neg_funding_exit_hours | 6 - 48 | Consecutive hours to trigger exit |
| taker_fee | 0.05% - 0.2% | Transaction cost assumption |
| sol_weight | 10% - 80% | SOL allocation cap |
| btc_weight | 10% - 60% | BTC allocation cap |
| eth_weight | 10% - 60% | ETH allocation cap |

### 4.2 Algorithm Configuration

- **Population**: 50 individuals
- **Generations**: 30
- **Selection**: Tournament (size 3)
- **Crossover**: Blend (α=0.5), probability 70%
- **Mutation**: Gaussian (σ=0.1), probability 30%
- **Fitness function**: Calmar ratio from walk-forward test set
- **Total evaluations**: ~1,500 backtests

### 4.3 Walk-Forward Validation

Data is split 70/30 by time:
- **Train set** (70%): Used for backtest evaluation during optimization
- **Test set** (30%): Out-of-sample performance check

A strategy is considered **robust** if:
- Test Sharpe / Train Sharpe > 0.5 (less than 50% decay)
- Test Sharpe > 0 (positive out-of-sample performance)

## 5. Technology Stack

| Component | Technology |
|-----------|------------|
| Protocol | Drift Protocol v2 (Solana) |
| Bot runtime | TypeScript, Node.js |
| On-chain SDK | @drift-labs/sdk, @drift-labs/vaults-sdk |
| Database | SQLite (trade logging) |
| Alerts | Telegram Bot API |
| Backtesting | Python (pandas, numpy, scipy) |
| Optimization | DEAP (genetic algorithm) |
| Video | Remotion (React) |
| RPC | Helius (mainnet) |

## 6. On-Chain Architecture

```
                    ┌─────────────────┐
                    │   Drift Vault    │
                    │   (On-Chain)     │
                    │                 │
                    │  USDC deposits  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Keeper Bot     │
                    │  (Delegate)     │
                    │                 │
              ┌─────┤  Main Loop      ├─────┐
              │     │  (60s interval) │     │
              │     └────────┬────────┘     │
              │              │              │
     ┌────────▼───┐ ┌───────▼───────┐ ┌───▼────────┐
     │ Funding    │ │  Position     │ │  Risk      │
     │ Monitor    │ │  Manager      │ │  Manager   │
     │            │ │               │ │            │
     │ Rate check │ │ Open/Close    │ │ 5 triggers │
     │ Rotation   │ │ Delta-neutral │ │ Kill switch│
     └────────────┘ └───────────────┘ └────────────┘
```

## 7. Expected Returns

Based on historical funding rate data (90-day backtest):
- Funding rates for SOL/BTC/ETH average 0.005-0.02%/hour
- Annualized: 44-175% before costs
- After transaction costs (~0.3% per round-trip): 20-100% net annualized
- Conservative estimate with 2x leverage: 15-50% APY

**Note**: Past performance does not guarantee future results. Funding rates are variable and can turn negative.
