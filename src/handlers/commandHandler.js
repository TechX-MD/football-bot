const { sendTelegramAlert } = require('../services/telegramService');
const { fetchRealFixturesForDate, fetchRealLiveMatchesBulletin, fetchRealLiveStandings } = require('../services/espnService');
const { fetchMatchLineup } = require('../services/lineupService');
const { getYYYYMMDD, getFormattedDateString, parseDateFromText } = require('../utils/timeUtils');
const { TABLE_MAP } = require('../config/leagues');

async function handleTelegramUpdate(update) {
  if (update.callback_query) {
    const cb = update.callback_query;
    const data = cb.data || '';
    const chatId = cb.message?.chat?.id;

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token) {
      fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: cb.id })
      }).catch(() => {});
    }

    if (data === 'cmd_live') {
      const res = await fetchRealLiveMatchesBulletin();
      await sendTelegramAlert(chatId, res.text, { reply_markup: res.reply_markup });
      return;
    }
    if (data === 'cmd_today') {
      const res = await fetchRealFixturesForDate(getYYYYMMDD(0), getFormattedDateString(0));
      await sendTelegramAlert(chatId, res.text, { reply_markup: res.reply_markup });
      return;
    }
    if (data === 'cmd_tomorrow') {
      const res = await fetchRealFixturesForDate(getYYYYMMDD(1), getFormattedDateString(1));
      await sendTelegramAlert(chatId, res.text, { reply_markup: res.reply_markup });
      return;
    }
    if (data === 'cmd_epl') {
      const text = await fetchRealLiveStandings('eng.1', 'Premier League', '🟣', '🟢');
      await sendTelegramAlert(chatId, text || "Table unavailable.");
      return;
    }
    if (data === 'cmd_cl') {
      const text = await fetchRealLiveStandings('uefa.champions', 'Champions League', '🔵', '⭐');
      await sendTelegramAlert(chatId, text || "Table unavailable.");
      return;
    }
    if (data === 'cmd_afcon') {
      const text = await fetchRealLiveStandings('caf.nations', 'Africa Cup of Nations', '🟢', '🔴');
      await sendTelegramAlert(chatId, text || "Table unavailable.");
      return;
    }
    if (data === 'cmd_laliga') {
      const text = await fetchRealLiveStandings('esp.1', 'La Liga', '🔴', '🟡');
      await sendTelegramAlert(chatId, text || "Table unavailable.");
      return;
    }

    if (data.startsWith('m_')) {
      const parts = data.split('_');
      if (parts.length >= 3) {
        const lineupText = await fetchMatchLineup(parts[1], parts[2]);
        await sendTelegramAlert(chatId, lineupText);
      }
      return;
    }
    return;
  }

  const msg = update.message || update.channel_post;
  if (!msg || !msg.text) return;

  const chatId = msg.chat?.id;
  const text = msg.text.trim().replace(/@\w+/g, '');
  const lower = text.toLowerCase();

  if (lower === '/start' || lower === '/menu') {
    const mainMenuButtons = {
      inline_keyboard: [
        [{ text: `🔴 ALL LIVE MATCHES 🔴`, callback_data: `cmd_live` }],
        [
          { text: `📅 TODAY'S FIXTURES`, callback_data: `cmd_today` },
          { text: `📅 TOMORROW`, callback_data: `cmd_tomorrow` }
        ],
        [
          { text: `🟣 PREMIER LEAGUE`, callback_data: `cmd_epl` },
          { text: `🔵 CHAMPIONS LEAGUE`, callback_data: `cmd_cl` }
        ],
        [
          { text: `🔴 LA LIGA`, callback_data: `cmd_laliga` },
          { text: `🌍 AFCON STANDINGS`, callback_data: `cmd_afcon` }
        ],
        // RED COLOR CHANNEL BUTTON
        [{ text: `🔴 📺 JOIN TECH SPORT TV CHANNEL 🔴`, url: `https://t.me/techsporttv` }]
      ]
    };

    await sendTelegramAlert(chatId,
      `⚽ <b>TECH SPORT TV — MAIN DASHBOARD</b>\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `Welcome to the official Tech Sport TV bot!\n` +
      `Tap any button in the boxes below to check fixtures, live scores & standings:`,
      { reply_markup: mainMenuButtons }
    );
    return;
  }

  if (lower === '/today') {
    const res = await fetchRealFixturesForDate(getYYYYMMDD(0), getFormattedDateString(0));
    await sendTelegramAlert(chatId, res.text, { reply_markup: res.reply_markup });
    return;
  }

  if (lower === '/tomorrow') {
    const res = await fetchRealFixturesForDate(getYYYYMMDD(1), getFormattedDateString(1));
    await sendTelegramAlert(chatId, res.text, { reply_markup: res.reply_markup });
    return;
  }

  if (lower === '/live') {
    const res = await fetchRealLiveMatchesBulletin();
    await sendTelegramAlert(chatId, res.text, { reply_markup: res.reply_markup });
    return;
  }

  if (lower.startsWith('/fixtures')) {
    const rawDate = text.replace(/^\/fixtures/i, '').trim();
    const parsed = rawDate ? parseDateFromText(rawDate) : { dateStr: getYYYYMMDD(0), label: getFormattedDateString(0) };
    const res = await fetchRealFixturesForDate(parsed.dateStr, parsed.label);
    await sendTelegramAlert(chatId, res.text, { reply_markup: res.reply_markup });
    return;
  }

  if (lower.startsWith('/lineup')) {
    const query = text.replace(/^\/lineup/i, '').trim();
    if (!query) {
      await sendTelegramAlert(chatId, "⚠️ Usage: <code>/lineup Arsenal</code> or <code>/lineup Real Madrid</code>");
      return;
    }
    const lineupMsg = await fetchMatchLineup(query);
    await sendTelegramAlert(chatId, lineupMsg);
    return;
  }

  if (lower.startsWith('/table')) {
    const key = lower.replace(/^\/table/i, '').trim() || 'epl';
    const leagueData = TABLE_MAP[key] || TABLE_MAP.epl;
    const [code, name, c1, c2] = leagueData;
    const res = await fetchRealLiveStandings(code, name, c1 || '🔵', c2 || '⚪');
    await sendTelegramAlert(chatId, res || `❌ Table unavailable for ${name}.`);
    return;
  }

  if (lower === '/testchannel') {
    const channel = process.env.TELEGRAM_CHANNEL_ID;
    if (!channel) {
      await sendTelegramAlert(chatId, "❌ <code>TELEGRAM_CHANNEL_ID</code> is missing!");
      return;
    }
    const res = await sendTelegramAlert(channel, "📢 <b>TECH SPORT TV — CHANNEL TEST</b>\n\n✅ Connected successfully!");
    await sendTelegramAlert(chatId, res && res.ok ? "✅ Test posted to channel!" : `❌ Failed: ${res?.description}`);
    return;
  }
}

module.exports = { handleTelegramUpdate };
