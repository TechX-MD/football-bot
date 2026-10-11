const fs = require('fs');
const path = require('path');
const { ESPN_LEAGUES } = require('../config/leagues');
const { sendTelegramAlert } = require('./telegramService');
const { getOfficialLineupForAlert } = require('./lineupService');

const CACHE_FILE = path.join('/tmp', 'football_bot_cache.json');

function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    }
  } catch (e) {}
  return { matches: {}, postedLineups: [] };
}

function saveCache(cache) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache), 'utf8');
  } catch (e) {}
}

async function checkLiveMatches() {
  const cache = loadCache();
  let liveCount = 0;
  let alertsSent = 0;

  const leaguePromises = ESPN_LEAGUES.map(async (league) => {
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.code}/scoreboard?_ts=${Date.now()}`;
      const res = await fetch(url, {
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
      });
      if (!res.ok) return;

      const data = await res.json();
      const events = data.events || [];

      for (const ev of events) {
        const sent = await processMatch(league, ev, cache);
        if (sent) alertsSent++;
        if (ev.status?.type?.state === 'in') liveCount++;
      }
    } catch (e) {}
  });

  await Promise.allSettled(leaguePromises);
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

  // Logos kubva pa ESPN
  const homeLogo = home.team?.logo || null;
  const awayLogo = away.team?.logo || null;

  const state = ev.status?.type?.state;
  const detail = (ev.status?.type?.detail || '').toLowerCase();
  const shortDetail = (ev.status?.type?.shortDetail || '').toLowerCase();

  // 1. AUTO-LINEUP ALERT (30 MINS TO KICKOFF)
  if (state === 'pre' && !cache.postedLineups.includes(matchId)) {
    try {
      const kickoffTime = new Date(ev.date).getTime();
      const diffMins = (kickoffTime - Date.now()) / (1000 * 60);

      if (diffMins <= 45 && diffMins >= 10) {
        const lineupText = await getOfficialLineupForAlert(league.code, matchId);
        if (lineupText) {
          const bannerButtons = {
            inline_keyboard: [
              [{ text: `📋 ${homeName.toUpperCase()} vs ${awayName.toUpperCase()}`, callback_data: `lineup_${matchId}` }],
              [{ text: `📺 TECH SPORT TV — OFFICIAL`, url: `https://t.me/techsporttv` }]
            ]
          };
          await sendTelegramAlert(null, lineupText, { photo: homeLogo || awayLogo, reply_markup: bannerButtons });
          cache.postedLineups.push(matchId);
          return true;
        }
      }
    } catch (err) {}
  }

  // FIRST SEEN: Chengeta mascores aripo
  if (!cache.matches[matchId]) {
    cache.matches[matchId] = { state, detail, shortDetail, homeScore: hScore, awayScore: aScore };
    return false;
  }

  const prev = cache.matches[matchId];
  let sentAlert = false;

  // 2. KICK-OFF ALERT
  if (prev.state === 'pre' && state === 'in') {
    const text = 
      `🟣━━━━━━━━━━━━━━━━━━━━🟣\n` +
      `🏆 <b>${league.name.toUpperCase()}</b>\n` +
      `🟣━━━━━━━━━━━━━━━━━━━━🟣\n\n` +
      `🟢 <b>KICK-OFF! MATCH IS LIVE</b>\n\n` +
      `🛡️ <b>${homeName}</b> vs <b>${awayName}</b>\n` +
      `⏱️ Clock: <b>1'</b> | The match is officially underway!`;

    const bannerButtons = {
      inline_keyboard: [
        [{ text: `🟣 ${homeName.toUpperCase()}  0 - 0  ${awayName.toUpperCase()} 🟢`, callback_data: `match_${matchId}` }]
      ]
    };

    await sendTelegramAlert(null, text, { photo: homeLogo || awayLogo, reply_markup: bannerButtons });
    sentAlert = true;
  }

  // 3. REAL GOAL ALERT (EPL STYLED BANNER)
  if (state === 'in') {
    if (hScore > prev.homeScore || aScore > prev.awayScore) {
      const scorerInfo = await fetchLatestScorerFast(league.code, matchId);
      const isHomeScored = hScore > prev.homeScore;
      const scoringLogo = isHomeScored ? homeLogo : awayLogo;
      const clock = ev.status?.type?.shortDetail || 'LIVE 🔴';

      const text =
        `🟣━━━━━━━━━━━━━━━━━━━━🟣\n` +
        `🏆 <b>${league.name.toUpperCase()}</b>\n` +
        `🟣━━━━━━━━━━━━━━━━━━━━🟣\n\n` +
        `⚽ <b>GOOOOOOOAL!</b>\n\n` +
        `🔵 <b>${homeName}</b>  ${hScore} - ${aScore}  <b>${awayName}</b> 🔴\n\n` +
        `${scorerInfo}\n` +
        `⏱️ Clock: <b>${clock}</b>`;

      // BANNERS SEZVIYA ZVIRI PAMUFANANIDZO WAKO:
      const bannerButtons = {
        inline_keyboard: [
          // Banner 1: Scoreline rine ma colour e EPL (Purple 🟣 & Neon Green 🟢)
          [
            { 
              text: `🟣 ${homeName.toUpperCase()}  ${hScore} - ${aScore}  ${awayName.toUpperCase()} 🟢`, 
              callback_data: `score_${matchId}` 
            }
          ],
          // Banner 2: Scorer ne Nguva
          [
            { text: `⚽ ${isHomeScored ? homeName : awayName} GOAL`, callback_data: `team_${matchId}` },
            { text: `⏱️ ${clock}`, callback_data: `time_${matchId}` }
          ],
          // Banner 3: Official Channel Banner
          [
            { text: `📺 TECH SPORT TV LIVE`, url: `https://t.me/techsporttv` }
          ]
        ]
      };

      await sendTelegramAlert(null, text, { photo: scoringLogo, reply_markup: bannerButtons });
      sentAlert = true;
    }

    // 4. VAR DISALLOWED GOAL
    if (hScore < prev.homeScore || aScore < prev.awayScore) {
      const text =
        `🚫 <b>GOAL DISALLOWED / VAR OVERTURNED!</b>\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `🏆 <b>${league.name}</b>\n\n` +
        `❌ Goal ruled out following a VAR review!\n` +
        `Score returned to: <b>${homeName} ${hScore} - ${aScore} ${awayName}</b>`;

      const bannerButtons = {
        inline_keyboard: [
          [{ text: `🚫 VAR: ${homeName.toUpperCase()} ${hScore} - ${aScore} ${awayName.toUpperCase()}`, callback_data: `var_${matchId}` }]
        ]
      };

      await sendTelegramAlert(null, text, { reply_markup: bannerButtons });
      sentAlert = true;
    }
  }

  // 5. HALF TIME
  const isHTNow = detail.includes('half time') || shortDetail === 'ht' || detail === 'ht';
  const wasHT = (prev.detail || '').includes('half time') || prev.shortDetail === 'ht';

  if (isHTNow && !wasHT) {
    const text =
      `⏸️ <b>HALF TIME WHISTLE</b>\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `🏆 <b>${league.name}</b>\n\n` +
      `🔵 <b>${homeName}</b>  ${hScore} - ${aScore}  <b>${awayName}</b> 🔴\n\n` +
      `The first half has ended!`;

    const bannerButtons = {
      inline_keyboard: [
        [{ text: `⏸️ HT: ${homeName.toUpperCase()} ${hScore} - ${aScore} ${awayName.toUpperCase()}`, callback_data: `ht_${matchId}` }]
      ]
    };

    await sendTelegramAlert(null, text, { photo: homeLogo || awayLogo, reply_markup: bannerButtons });
    sentAlert = true;
  } else if (!isHTNow && wasHT && state === 'in') {
    const text =
      `▶️ <b>SECOND HALF UNDERWAY</b>\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `🔵 <b>${homeName}</b>  ${hScore} - ${aScore}  <b>${awayName}</b> 🔴`;

    await sendTelegramAlert(null, text);
    sentAlert = true;
  }

  // 6. FULL TIME
  if (prev.state === 'in' && state === 'post') {
    const text =
      `🏁 <b>FULL TIME / MATCH ENDED</b>\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `🏆 <b>${league.name}</b>\n\n` +
      `🔵 <b>${homeName}</b>  ${hScore} - ${aScore}  <b>${awayName}</b> 🔴\n\n` +
      `The match has concluded!`;

    const bannerButtons = {
      inline_keyboard: [
        [{ text: `🏁 FT: ${homeName.toUpperCase()} ${hScore} - ${aScore} ${awayName.toUpperCase()}`, callback_data: `ft_${matchId}` }]
      ]
    };

    await sendTelegramAlert(null, text, { photo: homeLogo || awayLogo, reply_markup: bannerButtons });
    sentAlert = true;
  }

  cache.matches[matchId] = { state, detail, shortDetail, homeScore: hScore, awayScore: aScore };
  return sentAlert;
}

async function fetchLatestScorerFast(leagueCode, matchId) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1800);

    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueCode}/summary?event=${matchId}&_ts=${Date.now()}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

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
