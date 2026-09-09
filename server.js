require('dotenv').config();
const express = require('express');
const { handleTelegramUpdate } = require('./src/handlers/commandHandler');
const { startTelegramPolling } = require('./src/services/telegramService');
const { checkLiveMatches } = require('./src/services/matchTracker');

const app = express();
app.use(express.json());

// 1. Health check endpoint
app.get('/', (req, res) => {
  res.send('⚽ Tech Sport TV Bot is running live on Vercel!');
});

// 2. Telegram Webhook Endpoint (Ye Vercel)
app.post('/api/telegram-webhook', async (req, res) => {
  try {
    if (req.body) {
      await handleTelegramUpdate(req.body);
    }
  } catch (err) {
    console.error('Webhook error:', err.message);
  }
  return res.status(200).send('OK');
});

// 3. Cron Endpoint yekutarisa ma Live Matches pa Vercel
app.get('/api/cron', async (req, res) => {
  try {
    await checkLiveMatches();
    res.status(200).json({ status: 'Live check complete' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;

// KANA ASIRI VERCEL (Pa Termux / VPS): Mhanyisa local polling ne 10s loop
if (!process.env.VERCEL) {
  app.listen(PORT, async () => {
    console.log(`🚀 Bot server listening on port ${PORT}`);
    startTelegramPolling(handleTelegramUpdate);

    console.log('🔄 Initializing live match tracker...');
    await checkLiveMatches();

    setInterval(async () => {
      try {
        await checkLiveMatches();
      } catch (err) {
        console.error('Tracker error:', err.message);
      }
    }, 10000);
  });
}

// Ye Vercel Serverless
module.exports = app;
