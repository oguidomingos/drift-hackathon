import {
  DriftClient,
  BulkAccountLoader,
  initialize,
  Wallet,
  convertToNumber,
  QUOTE_PRECISION,
  BASE_PRECISION,
  PRICE_PRECISION,
  FUNDING_RATE_PRECISION,
  PerpMarketAccount,
  User,
} from '@drift-labs/sdk';
import { Connection, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { config, getRpcUrl } from './config';

let driftClient: DriftClient;
let bulkAccountLoader: BulkAccountLoader;
let user: User;

export async function initDriftClient(): Promise<DriftClient> {
  const sdkConfig = initialize({ env: config.driftEnv });

  const connection = new Connection(getRpcUrl(), {
    commitment: 'confirmed',
  }) as any;

  const keypair = Keypair.fromSecretKey(bs58.decode(config.privateKey));
  const wallet = new Wallet(keypair as any);

  bulkAccountLoader = new BulkAccountLoader(
    connection,
    'confirmed',
    config.pollingIntervalMs
  );

  driftClient = new DriftClient({
    connection,
    wallet,
    env: config.driftEnv,
    accountSubscription: {
      type: 'polling',
      accountLoader: bulkAccountLoader,
    },
    perpMarketIndexes: [0, 1, 2],     // SOL, BTC, ETH
    spotMarketIndexes: [0, 1, 3, 4],  // USDC, SOL, BTC, ETH
  });

  await driftClient.subscribe();

  console.log(
    `[DriftClient] Connected to ${config.driftEnv} | Wallet: ${wallet.publicKey.toBase58()}`
  );

  // Only subscribe user if account exists on-chain
  try {
    user = driftClient.getUser();
    await user.subscribe();
    console.log('[DriftClient] User account found and subscribed');
  } catch {
    console.log('[DriftClient] No user account on-chain (run vault-sdk init first)');
  }

  return driftClient;
}

export function getDriftClient(): DriftClient {
  if (!driftClient) throw new Error('DriftClient not initialized');
  return driftClient;
}

export function getUser(): User {
  if (!user) throw new Error('User not initialized. Run: npx ts-node src/vault-manager.ts init');
  return user;
}

export function hasUser(): boolean {
  return !!user;
}

export function getConnection(): any {
  return getDriftClient().connection;
}

export function getFreeCollateral(): number {
  if (!user) return 0;
  return convertToNumber(getUser().getFreeCollateral(), QUOTE_PRECISION);
}

export function getLeverage(): number {
  if (!user) return 0;
  return convertToNumber(getUser().getLeverage(), new (QUOTE_PRECISION.constructor as any)(10_000));
}

export function getTotalCollateral(): number {
  if (!user) return 0;
  return convertToNumber(getUser().getTotalCollateral(), QUOTE_PRECISION);
}

export function getPerpMarket(marketIndex: number): PerpMarketAccount {
  return getDriftClient().getPerpMarketAccount(marketIndex)!;
}

export function getOraclePrice(marketIndex: number): number {
  const oracle = getDriftClient().getOracleDataForPerpMarket(marketIndex);
  return convertToNumber(oracle.price, PRICE_PRECISION);
}

export async function shutdown(): Promise<void> {
  if (user) await user.unsubscribe();
  if (driftClient) await driftClient.unsubscribe();
  if (bulkAccountLoader) bulkAccountLoader.stopPolling();
  console.log('[DriftClient] Shutdown complete');
}
