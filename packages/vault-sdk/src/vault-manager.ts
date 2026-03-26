import {
  DriftClient,
  BulkAccountLoader,
  initialize,
  Wallet,
} from '@drift-labs/sdk';
import {
  VaultClient,
  getVaultClient,
  getVaultAddressSync,
  getVaultDepositorAddressSync,
  encodeName,
  VAULT_PROGRAM_ID,
} from '@drift-labs/vaults-sdk';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import bs58 from 'bs58';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

const USDC_SPOT_MARKET_INDEX = 0;
const USDC_DECIMALS = 6;

async function main() {
  const env = (process.env.DRIFT_ENV || 'devnet') as 'devnet' | 'mainnet-beta';
  const rpcUrl = process.env.HELIUS_API_KEY && env === 'mainnet-beta'
    ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
    : process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';

  const connection = new Connection(rpcUrl, 'confirmed');
  const keypair = Keypair.fromSecretKey(bs58.decode(requireEnv('SOLANA_PRIVATE_KEY')));
  const wallet = new Wallet(keypair);

  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);
  console.log(`Environment: ${env}`);

  // Init Drift SDK
  const sdkConfig = initialize({ env });

  const bulkAccountLoader = new BulkAccountLoader(connection, 'confirmed', 10_000);

  const driftClient = new DriftClient({
    connection,
    wallet,
    env,
    accountSubscription: {
      type: 'polling',
      accountLoader: bulkAccountLoader,
    },
    perpMarketIndexes: [0, 1, 2],
    spotMarketIndexes: [0, 1, 3, 4],
  });

  await driftClient.subscribe();

  // Init Vault Client
  const vaultClient = getVaultClient(connection, wallet, driftClient);
  const vaultName = process.env.VAULT_NAME || 'DeltaNeutralFundingVault';
  const encodedName = encodeName(vaultName);

  const action = process.argv[2] || 'info';

  switch (action) {
    case 'init': {
      console.log(`\nInitializing vault: ${vaultName}`);

      // Delegate = bot keypair (same wallet for now, can be changed)
      const delegateKey = process.argv[3]
        ? new PublicKey(process.argv[3])
        : wallet.publicKey;

      const sig = await vaultClient.initializeVault({
        name: encodedName,
        spotMarketIndex: USDC_SPOT_MARKET_INDEX,
        redeemPeriod: new BN(90 * 24 * 60 * 60), // 90 days
        maxTokens: new BN(0), // unlimited
        minDepositAmount: new BN(1 * 10 ** USDC_DECIMALS), // 1 USDC min
        managementFee: new BN(20_000),    // 2% annual
        profitShare: 200_000,              // 20% profit share
        hurdleRate: 0,
        permissioned: false,
      });

      const vaultAddress = getVaultAddressSync(VAULT_PROGRAM_ID, encodedName);
      console.log(`Vault initialized!`);
      console.log(`Tx: ${sig}`);
      console.log(`Vault address: ${vaultAddress.toBase58()}`);

      // Set delegate if different from manager
      if (!delegateKey.equals(wallet.publicKey)) {
        const delegateSig = await vaultClient.updateDelegate(vaultAddress, delegateKey);
        console.log(`Delegate set to ${delegateKey.toBase58()}: ${delegateSig}`);
      }

      break;
    }

    case 'deposit': {
      const amountUSDC = parseFloat(process.argv[3] || '50');
      const amountBN = new BN(amountUSDC * 10 ** USDC_DECIMALS);
      const vaultAddress = getVaultAddressSync(VAULT_PROGRAM_ID, encodedName);
      const depositorPDA = getVaultDepositorAddressSync(
        VAULT_PROGRAM_ID,
        vaultAddress,
        wallet.publicKey
      );

      console.log(`\nDepositing ${amountUSDC} USDC into vault ${vaultAddress.toBase58()}`);

      const sig = await vaultClient.deposit(depositorPDA, amountBN, {
        authority: wallet.publicKey,
        vault: vaultAddress,
      });

      console.log(`Deposit tx: ${sig}`);
      break;
    }

    case 'delegate': {
      const delegateKey = new PublicKey(requireEnv('DELEGATE_PUBKEY') || process.argv[3]);
      const vaultAddress = getVaultAddressSync(VAULT_PROGRAM_ID, encodedName);

      console.log(`\nSetting delegate to ${delegateKey.toBase58()}`);
      const sig = await vaultClient.updateDelegate(vaultAddress, delegateKey);
      console.log(`Delegate tx: ${sig}`);
      break;
    }

    case 'info': {
      const vaultAddress = getVaultAddressSync(VAULT_PROGRAM_ID, encodedName);
      console.log(`\nVault: ${vaultName}`);
      console.log(`Address: ${vaultAddress.toBase58()}`);

      try {
        const vault = await vaultClient.getVault(vaultAddress);
        console.log(`Manager: ${vault.manager.toBase58()}`);
        console.log(`Delegate: ${vault.delegate.toBase58()}`);
        console.log(`Total shares: ${vault.totalShares.toString()}`);
        console.log(`Net deposits: ${vault.netDeposits.div(new BN(10 ** USDC_DECIMALS)).toString()} USDC`);
        console.log(`Permissioned: ${vault.permissioned}`);
      } catch {
        console.log('Vault not yet initialized');
      }
      break;
    }

    default:
      console.log('Usage: ts-node vault-manager.ts [init|deposit|delegate|info] [args]');
  }

  await driftClient.unsubscribe();
  bulkAccountLoader.stopPolling();
}

main().catch(console.error);
