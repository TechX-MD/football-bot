async function sendTelegramAlert(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  const channelId = process.env.TELEGRAM_CHANNEL_ID || "";
  const targetChat = chatId || channelId;

  if (!token) {
    console.error("❌ Telegram Token is missing in environment variables!");
    return { ok: false, description: "TELEGRAM_BOT_TOKEN is missing" };
  }

  if (!targetChat) {
    console.error("❌ Target Chat/Channel ID is missing!");
    return { ok: false, description: "TELEGRAM_CHANNEL_ID is missing" };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChat,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });
    const data = await res.json();
    if (!data.ok) {
      console.error(`❌ Telegram Send Error (${targetChat}):`, data.description);
    }
    return data;
  } catch (e) {
    console.error("❌ Telegram send network error:", e.message);
    return { ok: false, description: e.message };
  }
}

module.exports = { sendTelegramAlert };
