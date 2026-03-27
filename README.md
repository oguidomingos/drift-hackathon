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
Income:   positive funding rate × notional size
Risk:     max drawdown 15.6% kill switch | neg funding 136h exit
```

**Backtest Results** (90-day bear market, Jan–Mar 2026, GA-optimized):
| Metric | Value |
|--------|-------|
| Total Return | +0.97% |
| Sharpe Ratio | **5.77** |
| Calmar Ratio | **7.88** |
| Max Drawdown | **0.73%** |
| Annualized (proj.) | ~15-40% (normal funding) |

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
│   │   ├── optimizer.py     # 50 pop × 30 gen, Calmar fitness
│   │   ├── fitness.py       # Walk-forward aware fitness function
│   │   └── genome.py        # 11-dimensional parameter space
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
# Download funding data (90 days)
cd packages/backtest
python -m src.data_fetcher

# Run backtest with GA-optimized params
python -m src.simulator

# Walk-forward validation
python -m src.walk_forward
```

### Optimize Parameters (Genetic Algorithm)
```bash
cd packages/genetic-optimizer
python -m src.run --pop 50 --gen 30
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
| 1 | Liquidation distance < 30% | **Immediate reduction** | `LIQUIDATION_BUFFER` |
| 2 | Max drawdown exceeded | **Full exit + kill switch** | `MAX_DRAWDOWN=15.6%` |
| 3 | Effective leverage > limit | Reduce position | `MAX_LEVERAGE=3.83×` |
| 4 | Delta drift | Rebalance legs | `DELTA_THRESHOLD=4%` |
| 5 | Negative funding > 136h | Exit market | `NEGATIVE_FUNDING_EXIT_HOURS` |

---

## GA Optimization

The genetic algorithm (DEAP) optimizes 11 parameters simultaneously:

- **Leverage** (1.5–5×)
- **Funding threshold** (entry minimum)
- **Market weights** (SOL/BTC/ETH allocation)
- **Hold time** (minimum hours before exit)
- **Risk thresholds** (drawdown, liquidation buffer)

Fitness function = **Calmar ratio** from walk-forward backtest (prevents overfitting).

Result: avoided SOL (negative funding in bear market), concentrated 70% in BTC.

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

1. **Genetic algorithm** for parameter optimization — rare in hackathon projects
2. **Walk-forward validation** — proves no overfitting
3. **Multi-market rotation** (SOL/BTC/ETH) with automatic reallocation
4. **5 documented risk triggers** with clear thresholds
5. **Quarter-Kelly position sizing** — sophisticated risk management
6. **Professional Remotion video** — animated charts, not a screencast
7. **Full documentation** — strategy.md, risk-management.md, backtest-report.md
8. **Real on-chain trades** — verifiable on Solscan
