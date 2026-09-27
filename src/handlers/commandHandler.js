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

  if (lower === '/testchannel') {
    const channel = process.env.TELEGRAM_CHANNEL_ID;
    if (!channel) {
      await sendTelegramAlert(chatId, "❌ <b>ERROR:</b> <code>TELEGRAM_CHANNEL_ID</code> is not configured!");
      return;
    }

    const res = await sendTelegramAlert(channel,
      `📢 <b>TECH SPORT TV — CHANNEL TEST</b>\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `✅ <b>Connected Successfully!</b>\n` +
      `EPL, Champions League, Europa League, Carabao Cup & AFCON alerts are active.`
    );

    if (res && res.ok) {
      await sendTelegramAlert(chatId, `✅ <b>SUCCESS!</b> Test message was posted to your channel: <code>${channel}</code>`);
    } else {
      await sendTelegramAlert(chatId, `❌ <b>FAILED TO POST:</b> <code>${res?.description || 'Unknown error'}</code>`);
    }
    return;
  }

  if (lower === '/start') {
    await sendTelegramAlert(chatId,
      `⚽ <b>WELCOME TO TECH SPORT TV</b>\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `🔥 Premier League, Champions League, Europa League, Carabao Cup, AFCON & UEFA Nations League!\n` +
      `⚡ Live goals, 30-min confirmed Starting XIs, VAR alerts & standings.\n\n` +
      `Type <b>/help</b> to see all commands.`
    );
    return;
  }

  if (lower === '/help') {
    await sendTelegramAlert(chatId,
      `⚽ <b>TECH SPORT TV — COMMANDS</b>\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `🔴 /live — All matches currently live\n` +
      `📅 /today — Today's fixtures with Central Africa Time (CAT)\n` +
      `📅 /tomorrow — Tomorrow's fixtures (CAT)\n` +
      `📅 /fixtures 2026-10-15 — Matches by specific date (Calendar)\n` +
      `📋 /lineup Arsenal — Official Starting XI & Bench\n\n` +
      `🏆 <b>LEAGUE TABLES & STANDINGS:</b>\n` +
      `• /table epl — Premier League (1-20)\n` +
      `• /table cl — Champions League\n` +
      `• /table uel — Europa League\n` +
      `• /table afcon — Africa Cup of Nations\n` +
      `• /table nations — UEFA Nations League\n` +
      `• /table laliga, /table bundesliga, /table seriea\n\n` +
      `📢 /testchannel — Test channel alert\n\n` +
      `📺 <b>TECH SPORT TV</b>`
    );
    return;
  }

  if (lower.startsWith('/lineup')) {
    const query = text.replace(/^\/lineup/i, '').trim();
    if (!query) {
      await sendTelegramAlert(chatId, "⚠️ Usage: <code>/lineup Arsenal</code> or <code>/lineup Nigeria</code>");
      return;
    }
    const lineupMsg = await fetchMatchLineup(query);
    await sendTelegramAlert(chatId, lineupMsg);
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

  if (lower.startsWith('/table')) {
    const key = lower.replace(/^\/table/i, '').trim() || 'epl';
    const [code, name] = TABLE_MAP[key] || TABLE_MAP.epl;
    const res = await fetchRealLiveStandings(code, name);
    await sendTelegramAlert(
      chatId,
      res || `❌ <b>TABLE UNAVAILABLE</b>\n\nCould not retrieve standings for ${name} (some knockout cups do not have group tables).`
    );
    return;
  }
}

module.exports = { handleTelegramUpdate };
