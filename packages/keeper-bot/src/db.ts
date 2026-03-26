import Database from 'better-sqlite3';
import path from 'path';
import { TradeRecord } from './types';

let db: Database.Database;

export function initDb(): void {
  const dbPath = path.resolve(__dirname, '../../trades.sqlite');
  db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      action TEXT NOT NULL,
      market TEXT NOT NULL,
      perp_side TEXT NOT NULL,
      perp_size REAL NOT NULL,
      spot_size REAL NOT NULL,
      price REAL NOT NULL,
      funding_rate REAL NOT NULL,
      reason TEXT NOT NULL,
      tx_signature TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      total_collateral REAL,
      free_collateral REAL,
      leverage REAL,
      drawdown REAL,
      pnl REAL,
      funding_pnl REAL
    );

    CREATE TABLE IF NOT EXISTS funding_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      market TEXT NOT NULL,
      funding_rate REAL NOT NULL,
      annualized_rate REAL NOT NULL
    );
  `);

  console.log(`[DB] Initialized at ${dbPath}`);
}

export async function logTrade(trade: TradeRecord): Promise<void> {
  if (!db) initDb();

  db.prepare(
    `INSERT INTO trades (timestamp, action, market, perp_side, perp_size, spot_size, price, funding_rate, reason, tx_signature)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    trade.timestamp,
    trade.action,
    trade.market,
    trade.perpSide,
    trade.perpSize,
    trade.spotSize,
    trade.price,
    trade.fundingRate,
    trade.reason,
    trade.txSignature
  );
}

export function logMetrics(metrics: {
  totalCollateral: number;
  freeCollateral: number;
  leverage: number;
  drawdown: number;
  pnl: number;
  fundingPnl: number;
}): void {
  if (!db) initDb();

  db.prepare(
    `INSERT INTO metrics (timestamp, total_collateral, free_collateral, leverage, drawdown, pnl, funding_pnl)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    Date.now(),
    metrics.totalCollateral,
    metrics.freeCollateral,
    metrics.leverage,
    metrics.drawdown,
    metrics.pnl,
    metrics.fundingPnl
  );
}

export function logFundingHistory(
  market: string,
  fundingRate: number,
  annualizedRate: number
): void {
  if (!db) initDb();

  db.prepare(
    `INSERT INTO funding_history (timestamp, market, funding_rate, annualized_rate)
     VALUES (?, ?, ?, ?)`
  ).run(Date.now(), market, fundingRate, annualizedRate);
}

export function getRecentTrades(limit: number = 20): TradeRecord[] {
  if (!db) initDb();
  return db
    .prepare('SELECT * FROM trades ORDER BY timestamp DESC LIMIT ?')
    .all(limit) as TradeRecord[];
}

export function getDb(): Database.Database {
  if (!db) initDb();
  return db;
}
