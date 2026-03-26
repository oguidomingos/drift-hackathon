import {
  PositionDirection,
  getMarketOrderParams,
  convertToNumber,
  BASE_PRECISION,
  QUOTE_PRECISION,
  PRICE_PRECISION,
} from '@drift-labs/sdk';
import BN from 'bn.js';
import { getDriftClient, getUser, getOraclePrice, getFreeCollateral } from './drift-client';
import { MarketConfig, PositionState } from './types';
import { config } from './config';
import { sendAlert } from './telegram';
import { logTrade } from './db';

/**
 * Opens a delta-neutral position:
 * - SHORT perp (to collect positive funding)
 * - LONG spot (to hedge delta)
 */
export async function openDeltaNeutralPosition(
  market: MarketConfig,
  fundingRate: number,
  allocFraction: number = 1.0
): Promise<string[]> {
  const client = getDriftClient();
  const freeCollateral = getFreeCollateral();
  const oraclePrice = getOraclePrice(market.perpMarketIndex);

  // Position size: (freeCollateral * leverage * allocFraction) / price
  const notional = freeCollateral * config.strategy.maxLeverage * allocFraction;
  const baseSize = notional / oraclePrice;

  if (baseSize <= 0) {
    console.log(`[PositionManager] Insufficient collateral for ${market.symbol}`);
    return [];
  }

  const baseBN = new BN(Math.floor(baseSize * 1e9)); // BASE_PRECISION

  console.log(
    `[PositionManager] Opening ${market.symbol}: SHORT perp ${baseSize.toFixed(4)} @ $${oraclePrice.toFixed(2)} | notional: $${notional.toFixed(2)}`
  );

  const txSigs: string[] = [];

  try {
    // 1. SHORT perp
    const perpTx = await client.placePerpOrder(
      getMarketOrderParams({
        marketIndex: market.perpMarketIndex,
        direction: PositionDirection.SHORT,
        baseAssetAmount: baseBN,
      })
    );
    txSigs.push(perpTx);
    console.log(`[PositionManager] Perp SHORT tx: ${perpTx}`);

    // 2. LONG spot (buy the underlying asset)
    const spotTx = await client.placeSpotOrder(
      getMarketOrderParams({
        marketIndex: market.spotMarketIndex,
        direction: PositionDirection.LONG,
        baseAssetAmount: baseBN,
      })
    );
    txSigs.push(spotTx);
    console.log(`[PositionManager] Spot LONG tx: ${spotTx}`);

    await logTrade({
      timestamp: Date.now(),
      action: 'OPEN',
      market: market.symbol,
      perpSide: 'SHORT',
      perpSize: baseSize,
      spotSize: baseSize,
      price: oraclePrice,
      fundingRate,
      reason: `Funding rate ${(fundingRate * 100).toFixed(6)}%/h`,
      txSignature: perpTx,
    });

    await sendAlert(
      `✅ OPENED ${market.symbol}\n` +
        `Short perp: ${baseSize.toFixed(4)}\n` +
        `Long spot: ${baseSize.toFixed(4)}\n` +
        `Price: $${oraclePrice.toFixed(2)}\n` +
        `Funding: ${(fundingRate * 100).toFixed(6)}%/h`
    );
  } catch (err) {
    console.error(`[PositionManager] Error opening ${market.symbol}:`, err);
    await sendAlert(`❌ ERROR opening ${market.symbol}: ${err}`);
    throw err;
  }

  return txSigs;
}

/**
 * Closes both legs of a delta-neutral position.
 */
export async function closeDeltaNeutralPosition(
  market: MarketConfig,
  reason: string
): Promise<string[]> {
  const client = getDriftClient();
  const user = getUser();
  const txSigs: string[] = [];

  const perpPosition = user.getPerpPosition(market.perpMarketIndex);
  const spotPosition = user.getSpotPosition(market.spotMarketIndex);

  try {
    // Close perp position
    if (perpPosition && !perpPosition.baseAssetAmount.isZero()) {
      const isShort = perpPosition.baseAssetAmount.isNeg();
      const absBase = perpPosition.baseAssetAmount.abs();
      const perpTx = await client.placePerpOrder(
        getMarketOrderParams({
          marketIndex: market.perpMarketIndex,
          direction: isShort ? PositionDirection.LONG : PositionDirection.SHORT,
          baseAssetAmount: absBase,
          reduceOnly: true,
        })
      );
      txSigs.push(perpTx);
      console.log(`[PositionManager] Close perp tx: ${perpTx}`);
    }

    // Close spot position
    if (spotPosition && !spotPosition.scaledBalance.isZero()) {
      const spotBalance = user.getTokenAmount(market.spotMarketIndex);
      if (!spotBalance.isZero() && spotBalance.gt(new BN(0))) {
        const spotTx = await client.placeSpotOrder(
          getMarketOrderParams({
            marketIndex: market.spotMarketIndex,
            direction: PositionDirection.SHORT, // sell spot
            baseAssetAmount: spotBalance,
            reduceOnly: true,
          })
        );
        txSigs.push(spotTx);
        console.log(`[PositionManager] Close spot tx: ${spotTx}`);
      }
    }

    const oraclePrice = getOraclePrice(market.perpMarketIndex);

    await logTrade({
      timestamp: Date.now(),
      action: 'CLOSE',
      market: market.symbol,
      perpSide: 'SHORT',
      perpSize: perpPosition
        ? Math.abs(convertToNumber(perpPosition.baseAssetAmount, BASE_PRECISION))
        : 0,
      spotSize: 0,
      price: oraclePrice,
      fundingRate: 0,
      reason,
      txSignature: txSigs[0] || '',
    });

    await sendAlert(`🔴 CLOSED ${market.symbol}\nReason: ${reason}`);
  } catch (err) {
    console.error(`[PositionManager] Error closing ${market.symbol}:`, err);
    await sendAlert(`❌ ERROR closing ${market.symbol}: ${err}`);
    throw err;
  }

  return txSigs;
}

/**
 * Returns the current state of a delta-neutral position.
 */
export function getPositionState(market: MarketConfig): PositionState | null {
  const user = getUser();
  const perpPosition = user.getPerpPosition(market.perpMarketIndex);

  if (!perpPosition || perpPosition.baseAssetAmount.isZero()) {
    return null;
  }

  const perpBase = convertToNumber(perpPosition.baseAssetAmount, BASE_PRECISION);
  const spotBalance = convertToNumber(user.getTokenAmount(market.spotMarketIndex), BASE_PRECISION);
  const oraclePrice = getOraclePrice(market.perpMarketIndex);

  const perpNotional = Math.abs(perpBase) * oraclePrice;
  const spotNotional = spotBalance * oraclePrice;
  const maxNotional = Math.max(perpNotional, spotNotional);

  const delta = perpBase + spotBalance; // should be ~0 for delta-neutral
  const deltaRatio = maxNotional > 0 ? Math.abs(delta * oraclePrice) / maxNotional : 0;

  const fundingPnl = convertToNumber(
    user.getUnrealizedFundingPNL(market.perpMarketIndex),
    QUOTE_PRECISION
  );

  const unrealizedPnl = convertToNumber(
    user.getUnrealizedPNL(true, market.perpMarketIndex),
    QUOTE_PRECISION
  );

  return {
    market,
    perpBaseAmount: perpBase,
    spotBaseAmount: spotBalance,
    notionalValue: perpNotional,
    deltaRatio,
    unrealizedPnl,
    fundingPnl,
  };
}

/**
 * Returns all active delta-neutral positions.
 */
export function getAllPositions(): PositionState[] {
  const { MARKETS } = require('./types');
  return MARKETS.map((m: MarketConfig) => getPositionState(m)).filter(
    (p: PositionState | null): p is PositionState => p !== null
  );
}
