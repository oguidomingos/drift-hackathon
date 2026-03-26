# Deployment Guide

## Prerequisites

- Node.js >= 18
- Python >= 3.10
- pnpm
- Solana CLI (optional)

## Setup

```bash
# Clone repo
git clone <repo-url>
cd drift-hackathon

# Install Node dependencies
pnpm install

# Install Python dependencies
cd packages/backtest && pip install -e . && cd ../..
cd packages/genetic-optimizer && pip install -e . && cd ../..

# Configure environment
cp .env.example .env
# Edit .env with your Solana private key, RPC URL, etc.
```

## Running

### Backtest
```bash
cd packages/backtest
python -m src.data_fetcher --days 90
python -m src.simulator
```

### Genetic Optimizer
```bash
cd packages/genetic-optimizer
python -m src.run --pop 50 --gen 30
```

### Keeper Bot (devnet)
```bash
DRIFT_ENV=devnet pnpm bot:dev
```

### Keeper Bot (mainnet)
```bash
DRIFT_ENV=mainnet-beta pnpm bot
```

### Initialize Vault
```bash
pnpm vault -- init [delegate-pubkey]
pnpm vault -- deposit 50
```
