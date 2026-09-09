const { ESPN_LEAGUES } = require('../config/leagues');
const { sendTelegramAlert } = require('./telegramService');
const { getOfficialLineupForAlert } = require('./lineupService');

const matchCache = new Map();
const processedEvents = new Set();
const postedLineups = new Set(); // Inochengeta mitambo yatoiswa lineup mu Channel
let isInitialized = false;

async function checkLiveMatches() {
  for (const league of ESPN_LEAGUES) {
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.code}/scoreboard`;
      const res = await fetch(url);
      if (!res.ok) continue;

      const data = await res.json();
      const events = data.events || [];

      for (const ev of events) {
        await processMatch(league, ev);
      }
    } catch (e) {}
  }

  if (!isInitialized) {
    isInitialized = true;
    console.log("⚡ [REAL-TIME ENGINE] Live tracker & 30-min Auto Lineup engine active.");
  }
}

async function processMatch(league, ev) {
  const matchId = ev.id;
  const comp = ev.competitions?.[0];
  if (!comp) return;

  const home = comp.competitors.find(c => c.homeAway === 'home');
  const away = comp.competitors.find(c => c.homeAway === 'away');
  if (!home || !away) return;

  const homeName = home.team?.name || 'Home';
  const awayName = away.team?.name || 'Away';
  const hScore = parseInt(home.score || '0', 10);
  const aScore = parseInt(away.score || '0', 10);

  const state = ev.status?.type?.state; // 'pre', 'in', 'post'
  const detail = (ev.status?.type?.detail || '').toLowerCase();
  const shortDetail = (ev.status?.type?.shortDetail || '').toLowerCase();

  // ==========================================
  // AUTO-LINEUP ALERT: PASARA 30-40 MINS BHORA RISATI RATANGA
  // ==========================================
  if (state === 'pre' && !postedLineups.has(matchId)) {
    try {
      const kickoffTime = new Date(ev.date).getTime();
      const now = Date.now();
      const diffMins = (kickoffTime - now) / (1000 * 60);

      // Kana pasara pakati pe 10 kusvika 45 minutes bhora risati ratanga
      if (diffMins <= 45 && diffMins >= 10) {
        const lineupText = await getOfficialLineupForAlert(league.code, matchId);
        if (lineupText) {
          await sendTelegramAlert(null, lineupText);
          postedLineups.add(matchId);
          console.log(`✅ [AUTO-LINEUP POSTED]: ${homeName} vs ${awayName} (${Math.round(diffMins)} mins to kickoff)`);
        }
      }
    } catch (err) {}
  }

  if (!matchCache.has(matchId)) {
    matchCache.set(matchId, {
      state,
      detail,
      shortDetail,
      homeScore: hScore,
      awayScore: aScore,
      shootoutHome: home.shootoutScore || 0,
      shootoutAway: away.shootoutScore || 0
    });
    if (!isInitialized) return;
  }

  const prev = matchCache.get(matchId);

  // 1. KICK-OFF ALERT
  if (prev.state === 'pre' && state === 'in' && isInitialized) {
    await sendTelegramAlert(null,
      `🟢 <b>KICK-OFF! MATCH STARTED</b>\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `🏆 <b>${league.name}</b>\n\n` +
      `⚽ <b>${homeName}</b> 0 - 0 <b>${awayName}</b>\n\n` +
      `The match is officially underway!`
    );
  }

  // 2. REAL GOAL ALERT
  if (state === 'in' && isInitialized) {
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
    }

    // 3. VAR DISALLOWED GOAL
    if (hScore < prev.homeScore || aScore < prev.awayScore) {
      await sendTelegramAlert(null,
        `🚫 <b>GOAL DISALLOWED / VAR OVERTURNED!</b>\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `🏆 <b>${league.name}</b>\n\n` +
        `❌ Goal ruled out following a VAR check!\n\n` +
        `Score returned to: <b>${homeName} ${hScore} - ${aScore} ${awayName}</b>`
      );
    }
  }

  // 4. HALF TIME & SECOND HALF
  if (isInitialized) {
    const isHTNow = detail.includes('half time') || shortDetail === 'ht' || detail === 'ht';
    const wasHT = prev.detail.includes('half time') || prev.shortDetail === 'ht' || prev.detail === 'ht';

    if (isHTNow && !wasHT) {
      await sendTelegramAlert(null,
        `⏸️ <b>HALF TIME WHISTLE</b>\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `🏆 <b>${league.name}</b>\n\n` +
        `🔵 <b>${homeName}</b>  ${hScore} - ${aScore}  <b>${awayName}</b> 🔴\n\n` +
        `The first half has ended!`
      );
    } else if (!isHTNow && wasHT && state === 'in') {
      await sendTelegramAlert(null,
        `▶️ <b>SECOND HALF UNDERWAY</b>\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `🏆 <b>${league.name}</b>\n\n` +
        `🔵 <b>${homeName}</b>  ${hScore} - ${aScore}  <b>${awayName}</b> 🔴\n\n` +
        `Second half action has resumed!`
      );
    }
  }

  // 5. FULL TIME / MATCH ENDED
  if (prev.state === 'in' && state === 'post' && isInitialized) {
    await sendTelegramAlert(null,
      `🏁 <b>FULL TIME / MATCH ENDED</b>\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `🏆 <b>${league.name}</b>\n\n` +
      `🔵 <b>${homeName}</b>  ${hScore} - ${aScore}  <b>${awayName}</b> 🔴\n\n` +
      `The match has concluded!`
    );
  }

  matchCache.set(matchId, {
    state,
    detail,
    shortDetail,
    homeScore: hScore,
    awayScore: aScore,
    shootoutHome: home.shootoutScore || 0,
    shootoutAway: away.shootoutScore || 0
  });
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
