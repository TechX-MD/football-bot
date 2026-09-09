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

  if (lower === '/start') {
    await sendTelegramAlert(chatId,
      `⚽ <b>WELCOME TO TECH SPORT TV</b>\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `🔥 Live football alerts, official lineups, instant goals, VAR checks, standings & calendars!\n\n` +
      `Type <b>/help</b> to view available commands.`
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
      `📋 /lineup &lt;league&gt; &lt;match_id&gt; — Starting lineups (e.g. /lineup eng.1 700123)\n` +
      `🏆 /table epl — Standings (e.g. epl, laliga, bundesliga, seriea, cl)\n\n` +
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
      await sendTelegramAlert(chatId, "⚠️ Usage format:\n<code>/lineup eng.1 700123</code>\n(Find Match IDs via /today or /live)");
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
