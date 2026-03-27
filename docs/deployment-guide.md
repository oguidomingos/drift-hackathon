# Deployment Guide

## Prerequisites

- **Node.js** >= 18.x
- **Python** >= 3.10
- **pnpm** (`npm install -g pnpm`)
- A Solana wallet with:
  - SOL for gas (~0.1 SOL)
  - USDC for vault deposit ($50-100)
- **Helius API key** (free tier) for mainnet RPC

## 1. Initial Setup

```bash
# Clone repository
git clone <repo-url>
cd drift-hackathon

# Install Node.js dependencies (postinstall patches helius-laserstream for Windows)
pnpm install

# Install Python dependencies
pip install pandas numpy matplotlib requests scipy deap

# Copy environment template
cp .env.example .env
```

> **Windows note**: The `pnpm install` postinstall script automatically patches the `@drift-labs/sdk` gRPC module to work on Windows (the `helius-laserstream-win32-x64-msvc` binary is not published to npm, but we use HTTP polling — not gRPC — so this is safe).

### Test Connection

```bash
# Test devnet connection (no funds needed)
pnpm test:connection
# Expected: Oracle prices for SOL, BTC, ETH; ✅ Connection test passed
```

## 2. Environment Configuration

Edit `.env` with your values:

**Generate a new keypair** if you don't have one:
```bash
cd packages/keeper-bot
node -e "
const {Keypair}=require('@solana/web3.js');
const bs58=require('bs58');
const k=Keypair.generate();
const enc=typeof bs58.encode==='function'?bs58.encode:bs58.default.encode;
console.log('Public key:', k.publicKey.toBase58());
console.log('Private key (base58):', enc(k.secretKey));
"
```

Edit `.env` with your values:
```env
# Solana wallet (base58 private key)
SOLANA_PRIVATE_KEY=your_private_key_here

# For devnet testing
DRIFT_ENV=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com

# For mainnet deployment
# DRIFT_ENV=mainnet-beta
# HELIUS_API_KEY=your_helius_key (get free at helius.dev)

# Telegram alerts (optional but recommended for monitoring)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Strategy parameters (defaults work, or use GA-optimized values)
MAX_LEVERAGE=2.0
FUNDING_THRESHOLD=0.0005
DELTA_THRESHOLD=0.02
MAX_DRAWDOWN=0.05
LIQUIDATION_BUFFER=0.20
```

### Getting a Telegram Bot Token

1. Message @BotFather on Telegram
2. Send `/newbot` and follow instructions
3. Copy the bot token to `.env`
4. Start a chat with your bot, send any message
5. Get your chat ID: `curl https://api.telegram.org/bot<TOKEN>/getUpdates`

### Getting a Helius API Key

1. Go to https://dev.helius.xyz
2. Create a free account
3. Copy your API key to `.env`

## 3. Running the Backtest Pipeline

### Step 3.1: Download Historical Data

```bash
cd packages/backtest
python -m src.data_fetcher --days 90
```

This downloads hourly funding rates for SOL, BTC, and ETH perpetuals (90 days × 3 markets × 24h = ~6,480 data points).

### Step 3.2: Run Backtest with Default Parameters

```bash
python -m src.simulator
```

Expected output: equity curve, Sharpe ratio, max drawdown, etc.

### Step 3.3: Run Walk-Forward Validation

```bash
python -m src.walk_forward
```

Confirms the strategy is robust (not overfitted to historical data).

### Step 3.4: Run Genetic Optimization (Optional)

```bash
cd ../genetic-optimizer
python -m src.run --pop 50 --gen 30
```

Takes ~30 minutes. Outputs optimized parameters to paste into `.env`.

### Step 3.5: Generate Charts

```bash
cd ../backtest
python -c "
from src.data_fetcher import load_all_funding_data
from src.simulator import run_backtest, StrategyParams
from src.visualize import generate_all_charts, export_for_remotion

data = load_all_funding_data()
result = run_backtest(data, StrategyParams())
generate_all_charts(result)
export_for_remotion(result)
"
```

Charts saved to `packages/backtest/results/`.

## 4. Devnet Testing

### Step 4.1: Test Connection (No Funds Needed)

```bash
# Verify Drift SDK connects and reads oracle prices
pnpm test:connection
# Expected output:
# [DriftClient] Connected to devnet | Wallet: <pubkey>
# SOL-PERP: $xx.xx
# BTC-PERP: $xxxxx.xx
# ETH-PERP: $xxxx.xx
# ✅ Connection test passed!
```

### Step 4.2: Get Devnet SOL and USDC

```bash
# Option 1: Solana CLI (if installed)
solana airdrop 2 <YOUR_WALLET_ADDRESS> --url devnet

# Option 2: Web faucet
# Visit: https://faucet.solana.com — paste your wallet address

# Option 3: Drift devnet USDC faucet
# Visit: https://app.drift.trade (switch to devnet in settings, use faucet)
```

### Step 4.3: Initialize Drift Account and Run Bot

```bash
# Initialize Drift user account on-chain (run once per wallet)
cd packages/vault-sdk
npx ts-node src/vault-manager.ts init-account

# Return to repo root and run bot
cd ../..
pnpm bot:dev
```

**Expected behavior**:
- Connects to devnet
- Reads funding rates for SOL, BTC, ETH perps
- Opens delta-neutral positions if funding is above threshold
- Monitors risk triggers every 60 seconds
- Logs trades to SQLite database
- Sends Telegram alerts (if configured)

### Step 4.3: Verify

- Check console logs for funding rates and position updates
- Check `packages/keeper-bot/trades.sqlite` for logged trades
- Verify positions on https://app.drift.trade (devnet)

## 5. Mainnet Deployment

### Step 5.1: Fund Your Wallet

Transfer to your Solana wallet:
- ~0.1 SOL for transaction fees
- $50-100 USDC (SPL token on Solana)

### Step 5.2: Initialize the Vault

Edit `.env`:
```env
DRIFT_ENV=mainnet-beta
HELIUS_API_KEY=your_helius_key
```

Then run:
```bash
cd packages/vault-sdk

# 1. Create Drift user account (required first time)
npx ts-node src/vault-manager.ts init-account

# 2. Create the vault
npx ts-node src/vault-manager.ts init

# 3. Deposit USDC
npx ts-node src/vault-manager.ts deposit 50

# 4. Verify
npx ts-node src/vault-manager.ts info
```

Save the vault address — this is your on-chain proof for judges.

**Note**: Vault address is deterministic based on vault name + manager wallet. It's computed as:
`getVaultAddressSync(VAULT_PROGRAM_ID, encodeName("DeltaNeutralFundingVault"))`

### Step 5.3: Run Keeper Bot on Mainnet

```bash
# From repo root
pnpm bot
```

### Step 5.4: Verify on Solscan

1. Go to https://solscan.io
2. Search for your wallet address
3. Confirm transactions: vault init, USDC deposit, perp orders, spot orders
4. Confirm funding rate settlements in transaction history

## 6. Monitoring in Production

### Telegram Alerts

The bot sends alerts for:
- `✅ OPENED`: New position with details
- `🔴 CLOSED`: Position closed with reason
- `🚨 RISK`: Risk trigger activated
- `❌ ERROR`: Bot errors
- `📊 Daily Summary`: Daily PnL and metrics

### SQLite Database

Query trade history:
```bash
cd packages/keeper-bot
sqlite3 trades.sqlite "SELECT * FROM trades ORDER BY timestamp DESC LIMIT 10;"
sqlite3 trades.sqlite "SELECT * FROM metrics ORDER BY timestamp DESC LIMIT 5;"
```

### Manual Kill Switch

To stop the bot immediately:
- Press Ctrl+C in the terminal
- Or kill the process: `pkill -f keeper-bot`

To pause without killing:
- Set `FUNDING_THRESHOLD=999` in `.env` and restart
- Bot will not open new positions but will continue monitoring existing ones

## 7. Troubleshooting

| Issue | Solution |
|-------|----------|
| `Cannot find module 'helius-laserstream-win32-x64-msvc'` | Run `node scripts/patch-grpc.js` (or `pnpm install`) |
| `DriftClient has no user for user id 0_<pubkey>` | Run `npx ts-node src/vault-manager.ts init-account` first |
| `DriftClient not initialized` | Check RPC URL and private key in `.env` |
| `Insufficient collateral` | Deposit more USDC to Drift account |
| `Transaction simulation failed` | Usually RPC congestion; bot retries automatically |
| `Rate limit exceeded` | Increase `pollingIntervalMs` in config |
| `No funding data` | Run `cd packages/backtest && python -m src.data_fetcher` |
| TypeScript compilation errors | Run `pnpm install` to refresh dependencies |
| Vault init fails with `already in use` | Vault already exists — run `info` to check it |

## 8. Process Management (Production)

For long-running deployment, use a process manager:

```bash
# Using pm2
npm install -g pm2
cd packages/keeper-bot
pm2 start dist/index.js --name drift-bot
pm2 logs drift-bot
pm2 save
```

Or with systemd (Linux):
```ini
[Unit]
Description=Drift Delta-Neutral Bot
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/opt/drift-hackathon/packages/keeper-bot
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```
