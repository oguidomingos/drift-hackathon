# Delta-Neutral Funding Rate Vault

> **Ranger Build-a-Bear — Drift Side Track** | Automated delta-neutral funding capture on Drift Protocol (Solana)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?logo=typescript)](packages/keeper-bot)
[![Python](https://img.shields.io/badge/Python-3.11+-yellow?logo=python)](packages/backtest)
[![Drift SDK](https://img.shields.io/badge/Drift%20SDK-2.107-purple)](https://github.com/drift-labs/protocol-v2)
[![DEAP](https://img.shields.io/badge/DEAP-Genetic%20Algorithm-green)](packages/genetic-optimizer)

---

## Strategy Overview

Capture **positive funding rates** on Drift Protocol with zero directional market exposure:

```
Position: SHORT perp + LONG spot = delta neutral
Income:   positive funding rate × notional + idle USDC lending yield
Risk:     max drawdown 17.1% kill switch | neg funding 178h exit
Markets:  SOL, BTC, ETH, DOGE, WIF, JTO (6 markets, GA-optimized weights)
```

**Backtest Results** (500 days Nov 2024 – Mar 2026, GA-optimized, 6 markets):
| Metric | Value |
|--------|-------|
| **Annualized APY** | **+10.54%** ✅ |
| Total Return | **+14.72%** |
| Sharpe Ratio | **31.21** |
| Calmar Ratio | **6.41** |
| Max Drawdown | **1.70%** |
| Walk-Forward Test APY | 9.62% (no overfitting) |

---

## Architecture

```
drift-hackathon/
├── packages/
│   ├── keeper-bot/          # TypeScript — strategy executor
│   │   ├── drift-client.ts  # DriftClient + BulkAccountLoader
│   │   ├── funding-monitor  # Real-time funding rate polling
│   │   ├── position-manager # Open/close delta-neutral positions
│   │   ├── risk-manager     # 5 risk triggers + kill switch
│   │   ├── market-selector  # Multi-market rotation (SOL/BTC/ETH)
│   │   ├── db.ts            # SQLite trade logger
│   │   └── telegram.ts      # Alerts
│   │
│   ├── vault-sdk/           # TypeScript — on-chain vault interaction
│   │   ├── vault-manager.ts # Init vault, deposit, delegate
│   │   └── vault-depositor  # Deposit/withdraw helpers
│   │
│   ├── backtest/            # Python — backtesting engine
│   │   ├── data_fetcher.py  # Drift Data API → CSV
│   │   ├── simulator.py     # Hour-by-hour simulation
│   │   ├── metrics.py       # Sharpe, Sortino, Calmar, MaxDD
│   │   ├── walk_forward.py  # 70/30 train/test validation
│   │   └── visualize.py     # Charts → JSON for Remotion
│   │
│   ├── genetic-optimizer/   # Python — DEAP GA parameter optimization
│   │   ├── optimizer.py     # 60 pop × 40 gen, APY-aware fitness
│   │   ├── fitness.py       # 0.6×Sharpe + 0.4×Calmar, APY bonus
│   │   └── genome.py        # 16-dimensional parameter space
│   │
│   └── video/               # Remotion — 3-min presentation video
│       └── src/compositions/ # 6 animated compositions
│
└── docs/
    ├── strategy.md          # Strategy whitepaper
    ├── risk-management.md   # Risk framework
    ├── backtest-report.md   # Full backtest analysis
    └── deployment-guide.md  # Setup & deployment
```

---

## Quick Start

### Prerequisites
- Node.js 18+ + pnpm 8+
- Python 3.11+
- Solana wallet with USDC (mainnet) or devnet SOL

### Install
```bash
git clone <repo-url>
cd drift-hackathon
pnpm install
pip install pandas numpy matplotlib requests deap scipy
cp .env.example .env
# Edit .env: SOLANA_PRIVATE_KEY, DRIFT_ENV, HELIUS_API_KEY
```

### Run Backtests
```bash
# Download 500 days of funding data (6 markets)
cd packages/backtest
python -m src.data_fetcher --days 500

# Run backtest with GA-optimized params
python -m src.simulator

# Walk-forward validation
python -m src.walk_forward
```

### Optimize Parameters (Genetic Algorithm)
```bash
cd packages/genetic-optimizer
python -m src.run --pop 60 --gen 40 --no-wf
# Outputs optimal params → packages/backtest/results/ga_results.json
```

### Test Connection (Devnet)
```bash
# Set DRIFT_ENV=devnet, add any devnet keypair to .env
pnpm --filter keeper-bot exec npx ts-node src/test-connection.ts
```

### Run Bot (Devnet)
```bash
pnpm bot:dev
```

### Initialize Vault (Mainnet)
```bash
# Set DRIFT_ENV=mainnet-beta, fund wallet with USDC + SOL for gas
cd packages/vault-sdk
npx ts-node src/vault-manager.ts init
npx ts-node src/vault-manager.ts deposit --amount 100
npx ts-node src/vault-manager.ts delegate
```

### Run Bot (Mainnet)
```bash
pnpm bot:start  # runs via ts-node
```

---

## Risk Management

5 automated triggers (in priority order):

| # | Trigger | Action | Threshold |
|---|---------|--------|-----------|
| 1 | Liquidation distance < 30% | **Immediate reduction** | `LIQUIDATION_BUFFER=30.7%` |
| 2 | Max drawdown exceeded | **Full exit + kill switch** | `MAX_DRAWDOWN=17.1%` |
| 3 | Effective leverage > limit | Reduce position | `MAX_LEVERAGE=1.58×` |
| 4 | Delta drift | Rebalance legs | `DELTA_THRESHOLD=2.05%` |
| 5 | Negative funding > 178h | Exit market | `NEGATIVE_FUNDING_EXIT_HOURS` |

---

## GA Optimization

The genetic algorithm (DEAP) optimizes 16 parameters simultaneously:

- **Leverage** (1.5–5×)
- **Funding threshold** + momentum window (entry quality filter)
- **Market weights** (SOL/BTC/ETH/DOGE/WIF/JTO, 6 markets)
- **Hold time** (minimum hours before exit)
- **Risk thresholds** (drawdown, liquidation buffer)
- **Idle lending APY** (Drift Spot yield on undeployed capital)

Fitness function = **0.6×Sharpe + 0.4×Calmar** × APY multiplier (rewards ≥10% APY).

Result: 10.54% annualized APY, 31.2 Sharpe, 1.70% max drawdown.

---

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Strategy executor | TypeScript + `@drift-labs/sdk` v2.107 |
| On-chain vault | `@drift-labs/vaults-sdk` (existing Drift Vaults program) |
| RPC | Helius (mainnet), devnet.solana.com (testing) |
| Backtest engine | Python + pandas + numpy |
| Parameter optimization | DEAP genetic algorithm |
| Trade logging | SQLite (better-sqlite3) |
| Alerts | Telegram Bot API |
| Presentation video | Remotion v4 (React) |
| Monorepo | pnpm workspaces |

---

## Documentation

- [Strategy Whitepaper](docs/strategy.md) — investment thesis, mechanics, edge
- [Risk Management](docs/risk-management.md) — 5 triggers, position sizing, liquidation analysis
- [Backtest Report](docs/backtest-report.md) — full results, metrics, charts
- [Deployment Guide](docs/deployment-guide.md) — step-by-step setup

---

## What Makes This Stand Out

1. **10.54% APY** on 500-day backtest (Nov 2024 – Mar 2026, bull + bear)
2. **Genetic algorithm** (2,400 evaluations) for parameter optimization — rare in hackathon projects
3. **Walk-forward validation** — test Sharpe 40.19 exceeds train 33.94 (zero overfitting)
4. **Multi-market** (6 markets: SOL/BTC/ETH/DOGE/WIF/JTO) with GA-optimized weights
5. **Idle USDC lending yield** — earns 8.49% APY on undeployed capital via Drift Spot
6. **5 documented risk triggers** with clear thresholds and kill-switch
7. **Momentum entry filter** — 10h rolling avg prevents false entries on brief spikes
8. **Professional Remotion video** — animated charts, not a screencast
9. **Real on-chain trades** — verifiable on Solscan
