async function sendTelegramAlert(chatId, text, options = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  const channelId = process.env.TELEGRAM_CHANNEL_ID || "";
  const targetChat = chatId || channelId;

  if (!token || !targetChat) return { ok: false };

  const photoUrl = options.photo;
  const replyMarkup = options.reply_markup;

  // 1. KANA PANE PHOTO/LOGO: Yedza kutumira Photo Banner ine Caption
  if (photoUrl) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: targetChat,
          photo: photoUrl,
          caption: text,
          parse_mode: 'HTML',
          reply_markup: replyMarkup
        })
      });
      const data = await res.json();
      if (data.ok) return data;
      // Kana photo ikatadza (panoita pasingaiti), ichaenderera mberi ku text pasi
    } catch (e) {}
  }

  // 2. KANA PASINA PHOTO KANA IKATADZA: Tumira se Message ine Banner Buttons
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChat,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
        reply_markup: replyMarkup
      })
    });
    return await res.json();
  } catch (e) {
    return { ok: false, description: e.message };
  }
}

module.exports = { sendTelegramAlert };
