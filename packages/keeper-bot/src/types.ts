import { BN } from 'bn.js';

export interface MarketConfig {
  symbol: string;
  perpMarketIndex: number;
  spotMarketIndex: number;
}

export const MARKETS: MarketConfig[] = [
  { symbol: 'SOL', perpMarketIndex: 0, spotMarketIndex: 1 },
  { symbol: 'BTC', perpMarketIndex: 1, spotMarketIndex: 3 },
  { symbol: 'ETH', perpMarketIndex: 2, spotMarketIndex: 4 },
];

export interface FundingRateInfo {
  symbol: string;
  perpMarketIndex: number;
  spotMarketIndex: number;
  lastFundingRate: number;       // hourly rate as decimal
  last24hAvgFundingRate: number;  // 24h avg as decimal
  annualizedRate: number;         // annualized %
  timestamp: number;
}

export interface PositionState {
  market: MarketConfig;
  perpBaseAmount: number;   // negative = short
  spotBaseAmount: number;   // positive = long
  notionalValue: number;
  deltaRatio: number;       // |perp + spot| / max(|perp|, |spot|)
  unrealizedPnl: number;
  fundingPnl: number;
}

export interface RiskMetrics {
  totalCollateral: number;
  freeCollateral: number;
  leverage: number;
  drawdown: number;
  peakEquity: number;
  currentEquity: number;
}

export interface StrategyParams {
  maxLeverage: number;
  fundingThreshold: number;
  deltaThreshold: number;
  maxDrawdown: number;
  liquidationBuffer: number;
  rebalanceIntervalMs: number;
  negativeFundingExitHours: number;
}

export interface TradeRecord {
  id?: number;
  timestamp: number;
  action: 'OPEN' | 'CLOSE' | 'REBALANCE';
  market: string;
  perpSide: 'LONG' | 'SHORT';
  perpSize: number;
  spotSize: number;
  price: number;
  fundingRate: number;
  reason: string;
  txSignature: string;
}

export type RebalanceReason =
  | 'DELTA_DRIFT'
  | 'LEVERAGE_HIGH'
  | 'LIQUIDATION_CLOSE'
  | 'NEGATIVE_FUNDING'
  | 'DRAWDOWN_EXIT';
