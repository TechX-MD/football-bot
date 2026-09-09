const { sendTelegramAlert } = require('../services/telegramService');
const { fetchRealFixturesForDate, fetchRealLiveMatchesBulletin, fetchRealLiveStandings } = require('../services/espnService');
const { fetchMatchLineup } = require('../services/lineupService');
const { getYYYYMMDD, getFormattedDateString, parseDateFromText } = require('../utils/timeUtils');
const { TABLE_MAP } = require('../config/leagues');

async function handleTelegramUpdate(update) {
  const msg = update.message || update.channel_post;
  if (!msg || !msg.text) return;

  const chatId = msg.chat?.id;
  const text = msg.text.trim().replace(/@\w+/g, '');
  const lower = text.toLowerCase();

  // COMMAND YEKUTARISA KANA CHANNEL IRI KUSHANDA
  if (lower === '/testchannel') {
    const channel = process.env.TELEGRAM_CHANNEL_ID;
    if (!channel) {
      await sendTelegramAlert(chatId, "❌ <b>ERROR:</b> <code>TELEGRAM_CHANNEL_ID</code> is not set in Environment Variables!");
      return;
    }

    const res = await sendTelegramAlert(channel,
      `📢 <b>TECH SPORT TV — CHANNEL TEST</b>\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `✅ <b>Connected Successfully!</b>\n` +
      `Live football goal alerts & match updates will be posted directly to this channel.`
    );

    if (res && res.ok) {
      await sendTelegramAlert(chatId, `✅ <b>SUCCESS!</b> Test message was posted to your channel: <code>${channel}</code>`);
    } else {
      await sendTelegramAlert(chatId,
        `❌ <b>FAILED TO POST TO CHANNEL!</b>\n\n` +
        `<b>Telegram Error:</b> <code>${res?.description || 'Unknown error'}</code>\n\n` +
        `<b>Zvekuita (Fix):</b>\n` +
        `1. Iva nechokwadi chekuti watoita bot rako <b>Admin</b> mu channel.\n` +
        `2. Iva nechokwadi chekuti wabatidza mvumo ye <b>Post Messages</b>.\n` +
        `3. Tarisa Channel ID yako (kana riri zita rinosungirwa kutanga na <code>@</code>, kana iri ID inotanga na <code>-100...</code>).`
      );
    }
    return;
  }

  if (lower === '/start') {
    await sendTelegramAlert(chatId,
      `⚽ <b>WELCOME TO TECH SPORT TV</b>\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `🔥 Live football alerts, official lineups, instant goals, VAR checks, standings & calendars!\n\n` +
      `Type <b>/help</b> to view available commands.\n` +
      `Type <b>/testchannel</b> to test channel notifications.`
    );
    return;
  }

  if (lower === '/help') {
    await sendTelegramAlert(chatId,
      `⚽ <b>TECH SPORT TV — COMMANDS</b>\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `🔴 /live — All current live matches\n` +
      `📅 /today — Today's fixtures\n` +
      `📅 /tomorrow — Tomorrow's fixtures\n` +
      `📅 /fixtures 2026-10-15 — Matches by specific date (Calendar)\n` +
      `📋 /lineup &lt;league&gt; &lt;match_id&gt; — Starting lineups\n` +
      `🏆 /table epl — Standings (1-20)\n` +
      `📢 /testchannel — Test channel alert\n\n` +
      `📺 <b>TECH SPORT TV</b>`
    );
    return;
  }

  if (lower === '/live') {
    await sendTelegramAlert(chatId, await fetchRealLiveMatchesBulletin());
    return;
  }

  if (lower === '/today') {
    await sendTelegramAlert(chatId, await fetchRealFixturesForDate(getYYYYMMDD(0), getFormattedDateString(0)));
    return;
  }

  if (lower === '/tomorrow') {
    await sendTelegramAlert(chatId, await fetchRealFixturesForDate(getYYYYMMDD(1), getFormattedDateString(1)));
    return;
  }

  if (lower.startsWith('/fixtures')) {
    const rawDate = text.replace(/^\/fixtures/i, '').trim();
    const parsed = rawDate ? parseDateFromText(rawDate) : { dateStr: getYYYYMMDD(0), label: getFormattedDateString(0) };
    await sendTelegramAlert(chatId, await fetchRealFixturesForDate(parsed.dateStr, parsed.label));
    return;
  }

  if (lower.startsWith('/lineup')) {
    const parts = lower.split(' ').slice(1);
    if (parts.length < 2) {
      await sendTelegramAlert(chatId, "⚠️ Usage format:\n<code>/lineup eng.1 700123</code>");
      return;
    }
    await sendTelegramAlert(chatId, await fetchMatchLineup(parts[0], parts[1]));
    return;
  }

  if (lower.startsWith('/table')) {
    const key = lower.replace(/^\/table/i, '').trim() || 'epl';
    const [code, name] = TABLE_MAP[key] || TABLE_MAP.epl;
    const res = await fetchRealLiveStandings(code, name);
    await sendTelegramAlert(chatId, res || `❌ Table unavailable for ${name}.`);
    return;
  }
}

module.exports = { handleTelegramUpdate };
