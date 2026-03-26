import { FundingRateInfo, MarketConfig, MARKETS } from './types';
import { getTopFundingMarkets } from './funding-monitor';
import { getPositionState } from './position-manager';
import { config } from './config';

export interface MarketAllocation {
  market: MarketConfig;
  fundingRate: number;
  allocationFraction: number;
}

/**
 * Select markets and allocate capital based on current funding rates.
 * Uses proportional allocation weighted by funding rate magnitude.
 */
export function selectMarkets(): MarketAllocation[] {
  const topMarkets = getTopFundingMarkets(config.strategy.fundingThreshold);

  if (topMarkets.length === 0) {
    return [];
  }

  // Calculate total funding rate for proportional allocation
  const totalRate = topMarkets.reduce((sum, m) => sum + m.lastFundingRate, 0);

  return topMarkets.map((fr) => {
    const marketConfig = MARKETS.find(
      (m) => m.perpMarketIndex === fr.perpMarketIndex
    )!;

    return {
      market: marketConfig,
      fundingRate: fr.lastFundingRate,
      allocationFraction: fr.lastFundingRate / totalRate,
    };
  });
}

/**
 * Determine which markets need new positions opened and which should be closed.
 */
export function getMarketActions(): {
  toOpen: MarketAllocation[];
  toClose: MarketConfig[];
} {
  const allocations = selectMarkets();
  const activeMarketIndices = new Set(
    allocations.map((a) => a.market.perpMarketIndex)
  );

  // Markets with positions that no longer qualify
  const toClose: MarketConfig[] = [];
  for (const market of MARKETS) {
    const pos = getPositionState(market);
    if (pos && !activeMarketIndices.has(market.perpMarketIndex)) {
      toClose.push(market);
    }
  }

  // Markets that qualify but don't have positions yet
  const toOpen = allocations.filter((a) => {
    const pos = getPositionState(a.market);
    return pos === null;
  });

  return { toOpen, toClose };
}
