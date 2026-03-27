import {
  convertToNumber,
  PRICE_PRECISION,
  FUNDING_RATE_PRECISION,
  QUOTE_PRECISION,
} from '@drift-labs/sdk';
import BN from 'bn.js';
import { getPerpMarket, getDriftClient, getOraclePrice } from './drift-client';
import { MARKETS, FundingRateInfo } from './types';

// Drift SDK: lastFundingRate is in QUOTE_PRECISION * FUNDING_RATE_PRECISION (1e15)
// Per the SDK source, it represents the USDC amount per BASE unit per funding period
// To convert to per-unit hourly rate: divide by oracle price
const FUNDING_PRECISION = PRICE_PRECISION.mul(FUNDING_RATE_PRECISION);
const HOURS_PER_YEAR = 8760;

export function getFundingRates(): FundingRateInfo[] {
  return MARKETS.map((market) => {
    const perpMarket = getPerpMarket(market.perpMarketIndex);
    const amm = perpMarket.amm;

    // Raw funding rate (USDC per BASE unit per funding period)
    const rawFundingRate = convertToNumber(amm.lastFundingRate, FUNDING_PRECISION);
    const raw24hAvg = convertToNumber(amm.last24HAvgFundingRate, FUNDING_PRECISION);

    // Oracle price for normalization
    const oraclePrice = getOraclePrice(market.perpMarketIndex);

    // Normalized per-unit rate (fraction per hour)
    // Short perp: positive rate means shorts RECEIVE funding
    const lastFundingRate = oraclePrice > 0 ? rawFundingRate / oraclePrice : rawFundingRate;
    const last24hAvg = oraclePrice > 0 ? raw24hAvg / oraclePrice : raw24hAvg;
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
    const sign = r.lastFundingRate >= 0 ? '+' : '';
    console.log(
      `${r.symbol}: ${sign}${(r.lastFundingRate * 100).toFixed(6)}%/h | ` +
        `24h avg: ${sign}${(r.last24hAvgFundingRate * 100).toFixed(6)}%/h | ` +
        `annualized: ${sign}${r.annualizedRate.toFixed(2)}%`
    );
  }
}
