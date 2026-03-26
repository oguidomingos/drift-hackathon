import { convertToNumber, QUOTE_PRECISION } from '@drift-labs/sdk';
import BN from 'bn.js';
import { getUser, getFreeCollateral, getTotalCollateral, getLeverage } from './drift-client';
import { getConsecutiveNegativeHours, getFundingRates } from './funding-monitor';
import { closeDeltaNeutralPosition, getPositionState, getAllPositions } from './position-manager';
import { config } from './config';
import { PositionState, RebalanceReason } from './types';
import { sendAlert } from './telegram';
import { logTrade } from './db';

let peakEquity = 0;

export function getRiskMetrics() {
  const totalCollateral = getTotalCollateral();
  const freeCollateral = getFreeCollateral();
  const leverage = getLeverage();

  if (totalCollateral > peakEquity) {
    peakEquity = totalCollateral;
  }

  const drawdown = peakEquity > 0 ? (peakEquity - totalCollateral) / peakEquity : 0;

  return {
    totalCollateral,
    freeCollateral,
    leverage,
    drawdown,
    peakEquity,
    currentEquity: totalCollateral,
  };
}

/**
 * Check all 5 risk triggers and take action.
 * Returns list of actions taken.
 */
export async function checkRiskTriggers(): Promise<RebalanceReason[]> {
  const actions: RebalanceReason[] = [];
  const params = config.strategy;
  const risk = getRiskMetrics();
  const positions = getAllPositions();

  if (positions.length === 0) return actions;

  // Trigger 5: Drawdown > maxDrawdown → exit everything (highest priority)
  if (risk.drawdown > params.maxDrawdown) {
    console.log(
      `[Risk] DRAWDOWN EXIT: ${(risk.drawdown * 100).toFixed(2)}% > ${(params.maxDrawdown * 100).toFixed(2)}%`
    );
    await sendAlert(
      `🚨 DRAWDOWN EXIT: ${(risk.drawdown * 100).toFixed(2)}% exceeds max ${(params.maxDrawdown * 100).toFixed(2)}%`
    );
    for (const pos of positions) {
      await closeDeltaNeutralPosition(pos.market, `Drawdown ${(risk.drawdown * 100).toFixed(2)}%`);
    }
    actions.push('DRAWDOWN_EXIT');
    return actions; // exit immediately, no further checks
  }

  // Trigger 3: Liquidation distance < buffer → urgent reduce
  if (risk.freeCollateral / risk.totalCollateral < params.liquidationBuffer) {
    console.log(
      `[Risk] LIQUIDATION WARNING: free/total = ${(risk.freeCollateral / risk.totalCollateral * 100).toFixed(2)}%`
    );
    await sendAlert(
      `🚨 LIQUIDATION WARNING: Free collateral ${risk.freeCollateral.toFixed(2)} / ${risk.totalCollateral.toFixed(2)}`
    );
    // Close the largest position
    const largest = positions.sort((a, b) => b.notionalValue - a.notionalValue)[0];
    await closeDeltaNeutralPosition(largest.market, 'Liquidation buffer too thin');
    actions.push('LIQUIDATION_CLOSE');
  }

  // Trigger 2: Leverage > max → reduce
  if (risk.leverage > params.maxLeverage * 1.5) {
    console.log(`[Risk] LEVERAGE HIGH: ${risk.leverage.toFixed(2)}x`);
    const largest = positions.sort((a, b) => b.notionalValue - a.notionalValue)[0];
    await closeDeltaNeutralPosition(largest.market, `Leverage ${risk.leverage.toFixed(2)}x`);
    actions.push('LEVERAGE_HIGH');
  }

  for (const pos of positions) {
    // Trigger 1: Delta drift > threshold → rebalance
    if (pos.deltaRatio > params.deltaThreshold) {
      console.log(
        `[Risk] DELTA DRIFT ${pos.market.symbol}: ${(pos.deltaRatio * 100).toFixed(2)}%`
      );
      // Close and re-open to re-align
      await closeDeltaNeutralPosition(pos.market, `Delta drift ${(pos.deltaRatio * 100).toFixed(2)}%`);
      actions.push('DELTA_DRIFT');
    }

    // Trigger 4: Negative funding > 24h → exit that market
    const negHours = getConsecutiveNegativeHours(pos.market.perpMarketIndex);
    if (negHours >= params.negativeFundingExitHours) {
      console.log(
        `[Risk] NEGATIVE FUNDING ${pos.market.symbol}: ${negHours}h consecutive`
      );
      await closeDeltaNeutralPosition(
        pos.market,
        `Negative funding ${negHours}h consecutive`
      );
      actions.push('NEGATIVE_FUNDING');
    }
  }

  return actions;
}

export function logRiskMetrics(): void {
  const risk = getRiskMetrics();
  console.log(
    `[Risk] Collateral: $${risk.totalCollateral.toFixed(2)} | ` +
      `Free: $${risk.freeCollateral.toFixed(2)} | ` +
      `Leverage: ${risk.leverage.toFixed(2)}x | ` +
      `Drawdown: ${(risk.drawdown * 100).toFixed(2)}%`
  );
}
