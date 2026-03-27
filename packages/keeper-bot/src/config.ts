import dotenv from 'dotenv';
import { StrategyParams } from './types';

dotenv.config({ path: '../../.env' });

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const config = {
  // Solana
  rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  privateKey: requireEnv('SOLANA_PRIVATE_KEY'),
  driftEnv: (process.env.DRIFT_ENV || 'devnet') as 'devnet' | 'mainnet-beta',

  // Helius
  heliusApiKey: process.env.HELIUS_API_KEY || '',

  // Telegram
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',

  // Strategy — GA-optimized (50pop × 30gen, Calmar=7.88, Sharpe=5.77)
  strategy: {
    maxLeverage: parseFloat(process.env.MAX_LEVERAGE || '3.83'),
    fundingThreshold: parseFloat(process.env.FUNDING_THRESHOLD || '0.0'),
    deltaThreshold: parseFloat(process.env.DELTA_THRESHOLD || '0.04'),
    maxDrawdown: parseFloat(process.env.MAX_DRAWDOWN || '0.1557'),
    liquidationBuffer: parseFloat(process.env.LIQUIDATION_BUFFER || '0.30'),
    rebalanceIntervalMs: parseInt(process.env.REBALANCE_INTERVAL_MS || '60000'),
    negativeFundingExitHours: parseInt(process.env.NEGATIVE_FUNDING_EXIT_HOURS || '136'),
  } satisfies StrategyParams,

  // Vault
  vaultName: process.env.VAULT_NAME || 'DeltaNeutralFundingVault',

  // Polling
  pollingIntervalMs: 10_000,  // BulkAccountLoader frequency
};

export function getRpcUrl(): string {
  if (config.driftEnv === 'mainnet-beta' && config.heliusApiKey) {
    return `https://mainnet.helius-rpc.com/?api-key=${config.heliusApiKey}`;
  }
  return config.rpcUrl;
}
