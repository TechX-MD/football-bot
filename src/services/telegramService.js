const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || "";

async function sendTelegramAlert(chatId, text) {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    const targetChat = chatId || TELEGRAM_CHANNEL_ID;
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChat,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });
    return await res.json();
  } catch (e) {
    console.error("❌ Telegram send error:", e.message);
  }
}

async function startTelegramPolling(commandHandler) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error("❌ TELEGRAM_BOT_TOKEN is missing in .env");
    return;
  }

  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook?drop_pending_updates=false`);
  console.log("✅ Telegram polling active...");

  let offset = 0;
  while (true) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?timeout=25&offset=${offset}`);
      const data = await res.json();
      if (!data.ok) {
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }

      for (const update of data.result || []) {
        offset = update.update_id + 1;
        try {
          await commandHandler(update);
        } catch (err) {
          console.error("Handler error:", err.message);
        }
      }
    } catch (e) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

module.exports = { sendTelegramAlert, startTelegramPolling };
