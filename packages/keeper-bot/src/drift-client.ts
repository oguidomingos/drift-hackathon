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
  });

  const keypair = Keypair.fromSecretKey(bs58.decode(config.privateKey));
  const wallet = new Wallet(keypair);

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

  user = driftClient.getUser();
  await user.subscribe();

  console.log(
    `[DriftClient] Connected to ${config.driftEnv} | Wallet: ${wallet.publicKey.toBase58()}`
  );

  return driftClient;
}

export function getDriftClient(): DriftClient {
  if (!driftClient) throw new Error('DriftClient not initialized');
  return driftClient;
}

export function getUser(): User {
  if (!user) throw new Error('User not initialized');
  return user;
}

export function getConnection(): Connection {
  return getDriftClient().connection;
}

export function getFreeCollateral(): number {
  return convertToNumber(getUser().getFreeCollateral(), QUOTE_PRECISION);
}

export function getLeverage(): number {
  return convertToNumber(getUser().getLeverage(), new (QUOTE_PRECISION.constructor as any)(10_000));
}

export function getTotalCollateral(): number {
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
