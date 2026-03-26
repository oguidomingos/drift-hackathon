import {
  getVaultAddressSync,
  getVaultDepositorAddressSync,
  encodeName,
  VAULT_PROGRAM_ID,
  VaultClient,
} from '@drift-labs/vaults-sdk';
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';

const USDC_DECIMALS = 6;

/**
 * Helper to get vault address from name
 */
export function getVaultAddress(vaultName: string): PublicKey {
  return getVaultAddressSync(VAULT_PROGRAM_ID, encodeName(vaultName));
}

/**
 * Helper to get depositor PDA
 */
export function getDepositorAddress(
  vaultName: string,
  authority: PublicKey
): PublicKey {
  const vaultAddress = getVaultAddress(vaultName);
  return getVaultDepositorAddressSync(VAULT_PROGRAM_ID, vaultAddress, authority);
}

/**
 * Deposit USDC into vault.
 * Initializes VaultDepositor if needed (permissionless vault).
 */
export async function depositToVault(
  vaultClient: VaultClient,
  vaultName: string,
  authority: PublicKey,
  amountUSDC: number
): Promise<string> {
  const vaultAddress = getVaultAddress(vaultName);
  const depositorPDA = getDepositorAddress(vaultName, authority);
  const amountBN = new BN(Math.floor(amountUSDC * 10 ** USDC_DECIMALS));

  return vaultClient.deposit(depositorPDA, amountBN, {
    authority,
    vault: vaultAddress,
  });
}

/**
 * Request withdrawal from vault (subject to redeem period).
 */
export async function requestWithdrawal(
  vaultClient: VaultClient,
  vaultName: string,
  authority: PublicKey,
  sharesBN: BN
): Promise<string> {
  const vaultAddress = getVaultAddress(vaultName);
  const depositorPDA = getDepositorAddress(vaultName, authority);

  return vaultClient.requestWithdraw(depositorPDA, sharesBN, vaultAddress);
}

/**
 * Get vault info.
 */
export async function getVaultInfo(
  vaultClient: VaultClient,
  vaultName: string
) {
  const vaultAddress = getVaultAddress(vaultName);
  const vault = await vaultClient.getVault(vaultAddress);
  return {
    address: vaultAddress.toBase58(),
    manager: vault.manager.toBase58(),
    delegate: vault.delegate.toBase58(),
    totalShares: vault.totalShares.toString(),
    netDepositsUSDC: vault.netDeposits.div(new BN(10 ** USDC_DECIMALS)).toNumber(),
    permissioned: vault.permissioned,
  };
}
