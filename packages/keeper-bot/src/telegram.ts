import TelegramBot from 'node-telegram-bot-api';
import { config } from './config';

let bot: TelegramBot | null = null;

function getBot(): TelegramBot | null {
  if (!config.telegramBotToken || !config.telegramChatId) return null;

  if (!bot) {
    bot = new TelegramBot(config.telegramBotToken, { polling: false });
  }
  return bot;
}

export async function sendAlert(message: string): Promise<void> {
  const b = getBot();
  if (!b) {
    // Telegram not configured, just log
    console.log(`[Telegram] ${message}`);
    return;
  }

  try {
    await b.sendMessage(config.telegramChatId, message, {
      parse_mode: 'HTML',
    });
  } catch (err) {
    console.error('[Telegram] Failed to send:', err);
  }
}

export async function sendDailySummary(summary: {
  totalPnl: number;
  fundingPnl: number;
  tradesCount: number;
  rebalances: number;
  currentLeverage: number;
  markets: string[];
}): Promise<void> {
  const msg =
    `📊 <b>Daily Summary</b>\n\n` +
    `💰 Total PnL: $${summary.totalPnl.toFixed(2)}\n` +
    `📈 Funding PnL: $${summary.fundingPnl.toFixed(2)}\n` +
    `🔄 Trades: ${summary.tradesCount}\n` +
    `⚖️ Rebalances: ${summary.rebalances}\n` +
    `📐 Leverage: ${summary.currentLeverage.toFixed(2)}x\n` +
    `🏪 Markets: ${summary.markets.join(', ')}`;

  await sendAlert(msg);
}
