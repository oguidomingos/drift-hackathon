import { initDriftClient, shutdown, getTotalCollateral } from './drift-client';
import {
  logFundingRates,
  updateNegativeFundingTracking,
  getFundingRates,
} from './funding-monitor';
import {
  openDeltaNeutralPosition,
  closeDeltaNeutralPosition,
  getAllPositions,
} from './position-manager';
import { checkRiskTriggers, logRiskMetrics, getRiskMetrics } from './risk-manager';
import { getMarketActions } from './market-selector';
import { initDb, logMetrics, logFundingHistory } from './db';
import { sendAlert } from './telegram';
import { config } from './config';
import { convertToNumber, QUOTE_PRECISION } from '@drift-labs/sdk';
import { getUser } from './drift-client';

let running = true;

async function mainLoop(): Promise<void> {
  console.log(`\n========== Tick ${new Date().toISOString()} ==========`);

  try {
    // 1. Log current funding rates
    logFundingRates();
    updateNegativeFundingTracking();

    // Log funding to DB
    const rates = getFundingRates();
    for (const r of rates) {
      logFundingHistory(r.symbol, r.lastFundingRate, r.annualizedRate);
    }

    // 2. Check risk triggers (may close positions)
    const riskActions = await checkRiskTriggers();
    if (riskActions.length > 0) {
      console.log(`[Main] Risk actions taken: ${riskActions.join(', ')}`);
    }

    // 3. Log risk metrics
    logRiskMetrics();

    // 4. Check for market rotation opportunities
    const { toOpen, toClose } = getMarketActions();

    // Close positions in markets that no longer qualify
    for (const market of toClose) {
      console.log(`[Main] Closing ${market.symbol} — funding below threshold`);
      await closeDeltaNeutralPosition(market, 'Funding below threshold');
    }

    // Open new positions
    for (const alloc of toOpen) {
      console.log(
        `[Main] Opening ${alloc.market.symbol} — funding ${(alloc.fundingRate * 100).toFixed(6)}%/h, alloc ${(alloc.allocationFraction * 100).toFixed(1)}%`
      );
      await openDeltaNeutralPosition(
        alloc.market,
        alloc.fundingRate,
        alloc.allocationFraction
      );
    }

    // 5. Log metrics to DB
    const risk = getRiskMetrics();
    const user = getUser();
    const fundingPnl = convertToNumber(
      user.getUnrealizedFundingPNL(),
      QUOTE_PRECISION
    );
    const totalPnl = convertToNumber(
      user.getUnrealizedPNL(true),
      QUOTE_PRECISION
    );

    logMetrics({
      totalCollateral: risk.totalCollateral,
      freeCollateral: risk.freeCollateral,
      leverage: risk.leverage,
      drawdown: risk.drawdown,
      pnl: totalPnl,
      fundingPnl,
    });

    // 6. Log active positions
    const positions = getAllPositions();
    if (positions.length > 0) {
      console.log(`\n--- Active Positions (${positions.length}) ---`);
      for (const pos of positions) {
        console.log(
          `${pos.market.symbol}: perp=${pos.perpBaseAmount.toFixed(4)} spot=${pos.spotBaseAmount.toFixed(4)} delta=${(pos.deltaRatio * 100).toFixed(2)}% fundPnL=$${pos.fundingPnl.toFixed(2)}`
        );
      }
    } else {
      console.log('[Main] No active positions');
    }
  } catch (err) {
    console.error('[Main] Error in main loop:', err);
    await sendAlert(`❌ Bot error: ${err}`);
  }
}

async function start(): Promise<void> {
  console.log('🚀 Delta-Neutral Funding Rate Bot');
  console.log(`Environment: ${config.driftEnv}`);
  console.log(`Polling interval: ${config.strategy.rebalanceIntervalMs}ms`);

  // Init
  initDb();
  await initDriftClient();
  await sendAlert('🚀 Bot started');

  // Main loop
  while (running) {
    await mainLoop();
    await sleep(config.strategy.rebalanceIntervalMs);
  }

  await shutdown();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[Main] Shutting down...');
  running = false;
  await sendAlert('🛑 Bot stopped (SIGINT)');
  await shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  running = false;
  await sendAlert('🛑 Bot stopped (SIGTERM)');
  await shutdown();
  process.exit(0);
});

start().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
