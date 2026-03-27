# Risk Management Framework

## Overview

The delta-neutral funding rate vault employs a layered risk management system with 5 automated triggers, conservative position sizing, and manual override capabilities. The system prioritizes capital preservation over yield maximization.

## 1. The Five Risk Triggers

### Trigger 1: Delta Drift Rebalancing

**Problem**: Over time, the perp and spot legs can drift apart due to price movements, partial fills, or basis changes.

**Detection**:
```
deltaRatio = |perpNotional + spotNotional| / max(perpNotional, spotNotional)
```

**Threshold**: deltaRatio > 2% (configurable, GA-optimized)

**Action**: Close the drifting position and re-open with balanced legs.

**Rationale**: Small delta drifts compound into meaningful directional exposure. A 2% threshold catches drift early while avoiding excessive rebalancing costs.

---

### Trigger 2: Leverage Control

**Problem**: Market movements can cause effective leverage to increase beyond safe levels, even without new positions being opened.

**Detection**:
```
effectiveLeverage = totalNotional / totalCollateral
```

**Threshold**: effectiveLeverage > 1.5 × maxLeverage (e.g., > 3x when max is 2x)

**Action**: Close the largest position to reduce leverage.

**Rationale**: Provides a safety buffer above the target leverage. The 1.5x multiplier allows for normal market fluctuation while catching dangerous leverage spikes.

---

### Trigger 3: Liquidation Distance Buffer

**Problem**: If collateral falls close to maintenance margin, the account risks liquidation — complete loss of the position plus fees.

**Detection**:
```
collateralRatio = freeCollateral / totalCollateral
```

**Threshold**: collateralRatio < 20% (configurable)

**Action**: Urgently close the largest position. This trigger has higher priority than leverage control.

**Rationale**: Liquidation on Drift incurs a liquidation fee (up to 1% of position). The 20% buffer ensures we exit before the protocol's liquidation engine takes over.

---

### Trigger 4: Persistent Negative Funding

**Problem**: When funding turns negative, shorts pay longs — our position bleeds money instead of generating income.

**Detection**: Track consecutive hours of negative funding rate per market.

**Threshold**: > 24 consecutive hours of negative funding (configurable)

**Action**: Exit only the affected market. Other markets continue if their funding is positive.

**Rationale**: Brief negative funding episodes (1-12 hours) are common during market dislocations and typically revert. But 24+ hours suggests a structural shift in market sentiment (bear market rally, high short interest). The threshold balances avoiding whipsaws against cutting losses.

---

### Trigger 5: Drawdown Kill Switch

**Problem**: Multiple simultaneous adverse events could cause cascading losses across all markets.

**Detection**:
```
drawdown = (peakEquity - currentEquity) / peakEquity
```

**Threshold**: drawdown > 5% (configurable, GA-optimized)

**Action**: **Exit ALL positions immediately.** This is the nuclear option.

**Rationale**: For a delta-neutral strategy targeting 15-50% APY, a 5% drawdown indicates something fundamentally wrong — either a protocol issue, extreme basis risk event, or oracle failure. Better to stop and reassess than risk further losses.

---

## 2. Priority Ordering

Triggers are checked in this order (highest priority first):

```
1. Drawdown > 5%        → FULL EXIT (all markets)
2. Liquidation < 20%    → Close largest position
3. Leverage > 3x        → Reduce largest position
4. Delta drift > 2%     → Rebalance specific market
5. Negative funding 24h → Exit specific market
```

If trigger #1 fires, no further checks are performed — all positions close immediately.

## 3. Position Sizing: Quarter-Kelly

The Kelly criterion determines the mathematically optimal bet size:

```
f* = (p × b - q) / b
```

Where:
- `p` = probability of winning trade
- `q` = 1 - p
- `b` = ratio of win size to loss size

**Quarter-Kelly** uses f*/4 for several reasons:
1. Kelly assumes known probabilities — ours are estimated
2. Kelly optimizes for log-utility — most investors are more risk-averse
3. Quarter-Kelly achieves ~75% of full-Kelly returns with ~50% of the variance

In practice, the bot uses a simpler implementation:
```
positionSize = freeCollateral × leverage × allocationWeight
```

Where `leverage` is capped at the GA-optimized value (typically 1.5-3x), which effectively implements a conservative sizing approach consistent with fractional Kelly.

## 4. Liquidation Analysis

### Drift Protocol Margin System

- **Initial margin**: 5-10% depending on market tier
- **Maintenance margin**: 2.5-5%
- **Liquidation fee**: up to 1% of position notional

### Example Scenario (Conservative)

| Parameter | Value |
|-----------|-------|
| Collateral | $100 USDC |
| Leverage | 2x |
| Total position | $200 notional |
| Maintenance margin | 5% = $10 |
| Free collateral at open | $100 - $10 = $90 |
| Adverse move to trigger buffer | ~36% |
| Adverse move to liquidation | ~45% |

A 45% adverse move in SOL in an hour is extremely unlikely. With the 20% buffer trigger, we'd exit at around a 36% adverse move — still extremely unlikely for hourly monitoring.

### Delta-Neutral Protection

Because positions are hedged (short perp + long spot), adverse price moves affect both legs:
- Price up 10%: perp loses ~$20, spot gains ~$20 → net ≈ $0
- Price down 10%: perp gains ~$20, spot loses ~$20 → net ≈ $0

The only scenarios where delta-neutral breaks down:
1. **Extreme basis divergence**: Perp price moves differently from spot
2. **Partial fills**: One leg fills but the other doesn't
3. **Oracle failure**: Incorrect pricing leading to unfair liquidation

## 5. Circuit Breakers & Manual Override

### Telegram Kill Switch

The bot sends alerts for every action:
- Position opens/closes
- Rebalance events
- Risk trigger activations
- Errors and exceptions

The operator can respond by:
1. Stopping the bot process (SIGINT/SIGTERM)
2. Setting `FUNDING_THRESHOLD=999` in .env to prevent new positions
3. Manually closing positions via the Drift UI

### Automatic Shutdown

The bot gracefully shuts down on:
- SIGINT (Ctrl+C)
- SIGTERM (process manager)
- Unhandled exceptions (after alerting via Telegram)

### Recovery

After a shutdown:
1. Bot re-reads current positions from on-chain state
2. Resumes monitoring and risk management
3. Does not attempt to re-open positions immediately (waits for next favorable signal)

## 6. Monitoring & Logging

### SQLite Database

Three tables track everything:
- `trades`: Every open/close/rebalance with timestamps, sizes, prices, reasons
- `metrics`: Hourly snapshots of collateral, leverage, drawdown, PnL
- `funding_history`: Per-market funding rates over time

### Telegram Alerts

Real-time notifications for:
- Position lifecycle events
- Risk trigger activations
- Error conditions
- Daily performance summaries

## 7. Stress Scenarios

| Scenario | Impact | Mitigation |
|----------|--------|------------|
| Flash crash (-30% in 1 hour) | Perp gains ≈ spot losses; small basis risk | Delta-neutral hedge; low leverage |
| Funding goes negative for 48h | ~0.5% bleed on 2x position | Exit after 24h negative |
| Drift protocol exploit | Total loss possible | Only $50-100 deployed |
| RPC downtime | Missed rebalances | Helius as primary; conservative leverage handles drift |
| Oracle manipulation | Incorrect position valuations | Drift's multi-oracle system; conservative buffers |
| All markets negative simultaneously | No positions to take | Bot goes idle; no loss of capital |
