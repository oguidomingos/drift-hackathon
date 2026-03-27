/**
 * Devnet connection test — verifies SDK connects and reads funding rates.
 * Run: npx ts-node src/test-connection.ts
 * Does NOT require funded account — just reads public market data.
 */

import { initDriftClient, getPerpMarket, getOraclePrice, shutdown } from './drift-client';
import { MARKETS } from './types';
import {
  convertToNumber,
  PRICE_PRECISION,
  FUNDING_RATE_PRECISION,
} from '@drift-labs/sdk';

const FUNDING_PRECISION = PRICE_PRECISION.mul(FUNDING_RATE_PRECISION);

async function testConnection(): Promise<void> {
  console.log('Testing Drift devnet connection...\n');

  await initDriftClient();

  // Wait a moment for account data to load
  await new Promise((r) => setTimeout(r, 3000));

  console.log('\n--- Oracle Prices ---');
  for (const market of MARKETS) {
    try {
      const price = getOraclePrice(market.perpMarketIndex);
      console.log(`${market.symbol}-PERP: $${price.toFixed(2)}`);
    } catch (e) {
      console.log(`${market.symbol}-PERP: N/A (${e})`);
    }
  }

  console.log('\n--- Funding Rates ---');
  for (const market of MARKETS) {
    try {
      const perpMarket = getPerpMarket(market.perpMarketIndex);
      const amm = perpMarket.amm;
      const rawRate = convertToNumber(amm.lastFundingRate, FUNDING_PRECISION);
      const price = getOraclePrice(market.perpMarketIndex);
      const normalizedRate = price > 0 ? rawRate / price : rawRate;
      const annualized = normalizedRate * 8760 * 100;

      const sign = normalizedRate >= 0 ? '+' : '';
      console.log(
        `${market.symbol}-PERP: ${sign}${(normalizedRate * 100).toFixed(6)}%/h ` +
        `| annualized: ${sign}${annualized.toFixed(2)}%`
      );
    } catch (e) {
      console.log(`${market.symbol}-PERP: N/A (${e})`);
    }
  }

  console.log('\n✅ Connection test passed!');

  await shutdown();
}

testConnection().catch((err) => {
  console.error('❌ Connection test failed:', err);
  process.exit(1);
});
