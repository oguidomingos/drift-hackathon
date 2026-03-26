import {
  convertToNumber,
  PRICE_PRECISION,
  FUNDING_RATE_PRECISION,
} from '@drift-labs/sdk';
import BN from 'bn.js';
import { getPerpMarket, getDriftClient } from './drift-client';
import { MARKETS, FundingRateInfo } from './types';

const FUNDING_PRECISION = PRICE_PRECISION.mul(FUNDING_RATE_PRECISION);
const HOURS_PER_YEAR = 8760;

export function getFundingRates(): FundingRateInfo[] {
  return MARKETS.map((market) => {
    const perpMarket = getPerpMarket(market.perpMarketIndex);
    const amm = perpMarket.amm;

    const lastFundingRate = convertToNumber(amm.lastFundingRate, FUNDING_PRECISION);
    const last24hAvg = convertToNumber(amm.last24HAvgFundingRate, FUNDING_PRECISION);
    const annualized = lastFundingRate * HOURS_PER_YEAR * 100;

    return {
      symbol: market.symbol,
      perpMarketIndex: market.perpMarketIndex,
      spotMarketIndex: market.spotMarketIndex,
      lastFundingRate,
      last24hAvgFundingRate: last24hAvg,
      annualizedRate: annualized,
      timestamp: amm.lastFundingRateTs.toNumber(),
    };
  });
}

export function getBestFundingMarket(): FundingRateInfo | null {
  const rates = getFundingRates();

  // Sort by funding rate descending (positive = longs pay shorts = we want to short)
  const positive = rates
    .filter((r) => r.lastFundingRate > 0)
    .sort((a, b) => b.lastFundingRate - a.lastFundingRate);

  return positive.length > 0 ? positive[0] : null;
}

export function getTopFundingMarkets(minRate: number): FundingRateInfo[] {
  return getFundingRates()
    .filter((r) => r.lastFundingRate > minRate)
    .sort((a, b) => b.lastFundingRate - a.lastFundingRate);
}

// Track consecutive negative funding periods per market
const negativeFundingCounters: Map<number, number> = new Map();

export function updateNegativeFundingTracking(): Map<number, number> {
  const rates = getFundingRates();

  for (const rate of rates) {
    const prev = negativeFundingCounters.get(rate.perpMarketIndex) || 0;
    if (rate.lastFundingRate < 0) {
      negativeFundingCounters.set(rate.perpMarketIndex, prev + 1);
    } else {
      negativeFundingCounters.set(rate.perpMarketIndex, 0);
    }
  }

  return negativeFundingCounters;
}

export function getConsecutiveNegativeHours(perpMarketIndex: number): number {
  return negativeFundingCounters.get(perpMarketIndex) || 0;
}

export function logFundingRates(): void {
  const rates = getFundingRates();
  console.log('\n--- Funding Rates ---');
  for (const r of rates) {
    console.log(
      `${r.symbol}: ${(r.lastFundingRate * 100).toFixed(6)}%/h | ` +
        `24h avg: ${(r.last24hAvgFundingRate * 100).toFixed(6)}%/h | ` +
        `annualized: ${r.annualizedRate.toFixed(2)}%`
    );
  }
}
