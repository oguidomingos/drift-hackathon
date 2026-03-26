# Delta-Neutral Funding Rate Vault

Automated delta-neutral funding rate capture vault on Drift Protocol (Solana).

## Architecture

- **keeper-bot**: TypeScript strategy executor — monitors funding rates, opens delta-neutral positions, manages risk
- **vault-sdk**: TypeScript vault interaction — initialize vault, deposit, delegate
- **backtest**: Python backtesting engine with walk-forward validation
- **genetic-optimizer**: DEAP-based parameter optimization
- **video**: Remotion 3-minute presentation video

## Quick Start

```bash
pnpm install
cp .env.example .env
# Edit .env with your keys
pnpm bot:dev
```

## Strategy

Short perp + long spot for delta neutrality. Captures positive funding rates across SOL, BTC, ETH markets with automatic rotation based on current rates.

### Risk Management (5 Triggers)
1. Delta drift > 2% → rebalance legs
2. Effective leverage > 3x → reduce position
3. Liquidation distance < 20% → urgent reduction
4. Negative funding > 24h consecutive → exit
5. Drawdown > 5% → full exit

## Hackathon

Ranger Build-a-Bear — Drift Side Track, April 2026.
