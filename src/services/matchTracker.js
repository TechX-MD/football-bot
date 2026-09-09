const fs = require('fs');
const path = require('path');
const { ESPN_LEAGUES } = require('../config/leagues');
const { sendTelegramAlert } = require('./telegramService');
const { getOfficialLineupForAlert } = require('./lineupService');

// Faira re Cache riri mu /tmp storage ye Vercel
const CACHE_FILE = path.join('/tmp', 'football_bot_cache.json');

function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    }
  } catch (e) {
    console.error("Cache read error:", e.message);
  }
  return { matches: {}, postedLineups: [] };
}

function saveCache(cache) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache), 'utf8');
  } catch (e) {
    console.error("Cache write error:", e.message);
  }
}

async function checkLiveMatches() {
  const cache = loadCache();
  let liveCount = 0;
  let alertsSent = 0;

  for (const league of ESPN_LEAGUES) {
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.code}/scoreboard`;
      const res = await fetch(url);
      if (!res.ok) continue;

      const data = await res.json();
      const events = data.events || [];

      for (const ev of events) {
        const sent = await processMatch(league, ev, cache);
        if (sent) alertsSent++;
        if (ev.status?.type?.state === 'in') liveCount++;
      }
    } catch (e) {}
  }

  // Chengetedza mascores matsva mu /tmp
  saveCache(cache);
  return { liveMatches: liveCount, alertsSent };
}

async function processMatch(league, ev, cache) {
  const matchId = ev.id;
  const comp = ev.competitions?.[0];
  if (!comp) return false;

  const home = comp.competitors.find(c => c.homeAway === 'home');
  const away = comp.competitors.find(c => c.homeAway === 'away');
  if (!home || !away) return false;

  const homeName = home.team?.name || 'Home';
  const awayName = away.team?.name || 'Away';
  const hScore = parseInt(home.score || '0', 10);
  const aScore = parseInt(away.score || '0', 10);

  const state = ev.status?.type?.state; // 'pre', 'in', 'post'
  const detail = (ev.status?.type?.detail || '').toLowerCase();
  const shortDetail = (ev.status?.type?.shortDetail || '').toLowerCase();

  // ====================================================
  // 1. AUTO-LINEUP ALERT (30-40 MINS TO KICKOFF)
  // ====================================================
  if (state === 'pre' && !cache.postedLineups.includes(matchId)) {
    try {
      const kickoffTime = new Date(ev.date).getTime();
      const diffMins = (kickoffTime - Date.now()) / (1000 * 60);

      if (diffMins <= 45 && diffMins >= 10) {
        const lineupText = await getOfficialLineupForAlert(league.code, matchId);
        if (lineupText) {
          await sendTelegramAlert(null, lineupText);
          cache.postedLineups.push(matchId);
          return true;
        }
      }
    } catch (err) {}
  }

  // KEKUTANGA MUTAMBO KUONEKWA (FIRST DISCOVERY)
  if (!cache.matches[matchId]) {
    cache.matches[matchId] = {
      state,
      detail,
      shortDetail,
      homeScore: hScore,
      awayScore: aScore
    };
    return false; // Chengeta pasina kutumira ma alerts enhema
  }

  const prev = cache.matches[matchId];
  let sentAlert = false;

  // ====================================================
  // 2. KICK-OFF ALERT
  // ====================================================
  if (prev.state === 'pre' && state === 'in') {
    await sendTelegramAlert(null,
      `🟢 <b>KICK-OFF! MATCH STARTED</b>\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `🏆 <b>${league.name}</b>\n\n` +
      `⚽ <b>${homeName}</b> 0 - 0 <b>${awayName}</b>\n\n` +
      `The match is officially underway!`
    );
    sentAlert = true;
  }

  // ====================================================
  // 3. REAL GOAL ALERT
  // ====================================================
  if (state === 'in') {
    if (hScore > prev.homeScore || aScore > prev.awayScore) {
      const scorerInfo = await fetchLatestScorer(league.code, matchId);
      await sendTelegramAlert(null,
        `⚽ <b>GOOOOOOOAL!</b>\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `🏆 <b>${league.name}</b>\n\n` +
        `🔵 <b>${homeName}</b>  ${hScore} - ${aScore}  <b>${awayName}</b> 🔴\n\n` +
        `${scorerInfo}\n` +
        `⏱️ Clock: <b>${ev.status?.type?.shortDetail || 'LIVE 🔴'}</b>`
      );
      sentAlert = true;
    }

    // 4. VAR DISALLOWED GOAL (ROLLBACK)
    if (hScore < prev.homeScore || aScore < prev.awayScore) {
      await sendTelegramAlert(null,
        `🚫 <b>GOAL DISALLOWED / VAR OVERTURNED!</b>\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `🏆 <b>${league.name}</b>\n\n` +
        `❌ Goal ruled out following a VAR check!\n\n` +
        `Score returned to: <b>${homeName} ${hScore} - ${aScore} ${awayName}</b>`
      );
      sentAlert = true;
    }
  }

  // ====================================================
  // 5. HALF TIME & SECOND HALF
  // ====================================================
  const isHTNow = detail.includes('half time') || shortDetail === 'ht' || detail === 'ht';
  const wasHT = (prev.detail || '').includes('half time') || prev.shortDetail === 'ht';

  if (isHTNow && !wasHT) {
    await sendTelegramAlert(null,
      `⏸️ <b>HALF TIME WHISTLE</b>\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `🏆 <b>${league.name}</b>\n\n` +
      `🔵 <b>${homeName}</b>  ${hScore} - ${aScore}  <b>${awayName}</b> 🔴\n\n` +
      `The first half has ended!`
    );
    sentAlert = true;
  } else if (!isHTNow && wasHT && state === 'in') {
    await sendTelegramAlert(null,
      `▶️ <b>SECOND HALF UNDERWAY</b>\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `🏆 <b>${league.name}</b>\n\n` +
      `🔵 <b>${homeName}</b>  ${hScore} - ${aScore}  <b>${awayName}</b> 🔴\n\n` +
      `Second half action has resumed!`
    );
    sentAlert = true;
  }

  // ====================================================
  // 6. FULL TIME / MATCH ENDED
  // ====================================================
  if (prev.state === 'in' && state === 'post') {
    await sendTelegramAlert(null,
      `🏁 <b>FULL TIME / MATCH ENDED</b>\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `🏆 <b>${league.name}</b>\n\n` +
      `🔵 <b>${homeName}</b>  ${hScore} - ${aScore}  <b>${awayName}</b> 🔴\n\n` +
      `The match has concluded!`
    );
    sentAlert = true;
  }

  // Gadziridza cache yacho
  cache.matches[matchId] = {
    state,
    detail,
    shortDetail,
    homeScore: hScore,
    awayScore: aScore
  };

  return sentAlert;
}

async function fetchLatestScorer(leagueCode, matchId) {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueCode}/summary?event=${matchId}`;
    const res = await fetch(url);
    if (!res.ok) return "🎯 Goal scored!";
    const data = await res.json();
    const keyEvents = data.keyEvents || [];
    const goalEvents = keyEvents.filter(e => {
      const t = (e.type?.text || '').toLowerCase();
      const txt = (e.text || '').toLowerCase();
      return t.includes('goal') || txt.includes('goal');
    });

    if (goalEvents.length > 0) {
      const lastGoal = goalEvents[goalEvents.length - 1];
      const scorer = lastGoal.participants?.[0]?.athlete?.displayName || 'Scorer';
      const clock = lastGoal.clock?.displayValue || '';
      return `🎯 Goalscorer: <b>${scorer}</b> ${clock ? `(⏱️ ${clock})` : ''}`;
    }
  } catch (e) {}
  return "🎯 Goal scored!";
}

module.exports = { checkLiveMatches };
