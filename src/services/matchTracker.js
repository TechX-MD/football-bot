const { ESPN_LEAGUES } = require('../config/leagues');
const { sendTelegramAlert } = require('./telegramService');

// State memory
const matchCache = new Map();
const processedEvents = new Set();
let isInitialized = false; // Cold start guard — hapana alert inobuda bot richangotanga

async function checkLiveMatches() {
  for (const league of ESPN_LEAGUES) {
    try {
      // Scoreboard endpoint rinopa state chaiyo yemutambo
      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.code}/scoreboard`;
      const res = await fetch(url);
      if (!res.ok) continue;

      const data = await res.json();
      const events = data.events || [];

      for (const ev of events) {
        await processMatch(league, ev);
      }
    } catch (e) {
      // Nyarara kana paine network blip
    }
  }

  // Kana mapedza kuverenga kekutanga, vhura alerts dze live
  if (!isInitialized) {
    isInitialized = true;
    console.log("⚡ [REAL-TIME ENGINE] Live tracker yagadzirira. Alerts dzichangopinda pazvibodzwa zvitsva chete!");
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

  // KEKUTANGA: Chengeta data remutambo pasina kutumira ma alerts enhema
  if (!matchCache.has(matchId)) {
    matchCache.set(matchId, {
      state,
      detail,
      homeScore: hScore,
      awayScore: aScore,
      period: ev.status?.period || 0,
      shootoutHome: home.shootoutScore || 0,
      shootoutAway: away.shootoutScore || 0
    });

    // Kana riri bhora riripo kare, isa zviitiko zvaro mu cache pasina ku alert
    if (!isInitialized) {
      return;
    }
  }

  const prev = matchCache.get(matchId);

  // ==========================================
  // 1. KICK OFF (MUTAMBO WACHANGA KUTANGA CHAIWO)
  // ==========================================
  if (prev.state === 'pre' && state === 'in' && isInitialized) {
    await sendTelegramAlert(null,
      `🟢 <b>KICK-OFF! MATCH STARTED</b>\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `🏆 <b>${league.name}</b>\n\n` +
      `⚽ <b>${homeName}</b> 0 - 0 <b>${awayName}</b>\n\n` +
      `Mutambo uri kutambwa zviri pamutemo!`
    );
  }

  // ==========================================
  // 2. REAL GOAL NOTIFICATION (PANO CHINWIRWA)
  // ==========================================
  if (state === 'in' && isInitialized) {
    if (hScore > prev.homeScore || aScore > prev.awayScore) {
      // Goal ranyatsopinda! Tsvaga scorer pakarepo
      const scorerInfo = await fetchLatestScorer(league.code, matchId, hScore, aScore, homeName, awayName);

      await sendTelegramAlert(null,
        `⚽ <b>GOOOOOOOAL!!!</b>\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `🏆 <b>${league.name}</b>\n\n` +
        `🔵 <b>${homeName}</b>  ${hScore} - ${aScore}  <b>${awayName}</b> 🔴\n\n` +
        `${scorerInfo}\n` +
        `⏱️ Nguva: <b>${ev.status?.type?.shortDetail || 'LIVE 🔴'}</b>`
      );
    }

    // ==========================================
    // 3. VAR DISALLOWED GOAL (SCORE ROLLBACK)
    // ==========================================
    if (hScore < prev.homeScore || aScore < prev.awayScore) {
      await sendTelegramAlert(null,
        `🚫 <b>GOAL DISALLOWED / VAR OVERTURN!</b>\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `🏆 <b>${league.name}</b>\n\n` +
        `❌ Chibodzwa charambwa zvichitevera kuongororwa ne VAR!\n\n` +
        `Score yadzokera pa: <b>${homeName} ${hScore} - ${aScore} ${awayName}</b>`
      );
    }
  }

  // ==========================================
  // 4. HALFTIME & 2ND HALF (START & END)
  // ==========================================
  if (isInitialized) {
    const isHTNow = detail.includes('half time') || shortDetail === 'ht' || detail === 'ht';
    const wasHT = prev.detail.includes('half time') || prev.shortDetail === 'ht' || prev.detail === 'ht';

    if (isHTNow && !wasHT) {
      await sendTelegramAlert(null,
        `⏸️ <b>HALF TIME WHISTLE</b>\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `🏆 <b>${league.name}</b>\n\n` +
        `🔵 <b>${homeName}</b>  ${hScore} - ${aScore}  <b>${awayName}</b> 🔴\n\n` +
        `Chikamu chekutanga chapera!`
      );
    } else if (!isHTNow && wasHT && state === 'in') {
      await sendTelegramAlert(null,
        `▶️ <b>SECOND HALF UNDERWAY</b>\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `🏆 <b>${league.name}</b>\n\n` +
        `🔵 <b>${homeName}</b>  ${hScore} - ${aScore}  <b>${awayName}</b> 🔴\n\n` +
        `Chikamu chechipiri chatanga!`
      );
    }
  }

  // ==========================================
  // 5. UEFA / CUP EXTRA TIME (15/30 MIN)
  // ==========================================
  if (isInitialized && (detail.includes('extra') || shortDetail.includes('et'))) {
    if (detail.includes('1st') && !prev.detail.includes('1st')) {
      await sendTelegramAlert(null,
        `⏳ <b>EXTRA TIME: 1ST HALF STARTED</b>\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `🏆 <b>${league.name}</b>\n` +
        `🔵 <b>${homeName}</b>  ${hScore} - ${aScore}  <b>${awayName}</b> 🔴`
      );
    } else if (detail.includes('2nd') && !prev.detail.includes('2nd')) {
      await sendTelegramAlert(null,
        `▶️ <b>EXTRA TIME: 2ND HALF STARTED</b>\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `🏆 <b>${league.name}</b>\n` +
        `🔵 <b>${homeName}</b>  ${hScore} - ${aScore}  <b>${awayName}</b> 🔴`
      );
    }
  }

  // ==========================================
  // 6. PENALTY SHOOTOUT TRACKING (✅ ❌)
  // ==========================================
  if (isInitialized && (comp.shootout || detail.includes('shootout') || detail.includes('penalties'))) {
    const curHomeShoot = home.shootoutScore || 0;
    const curAwayShoot = away.shootoutScore || 0;

    if (curHomeShoot !== prev.shootoutHome || curAwayShoot !== prev.shootoutAway) {
      await sendTelegramAlert(null,
        `🎯 <b>PENALTY SHOOTOUT UPDATE!</b>\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `🏆 <b>${league.name}</b>\n\n` +
        `🔵 <b>${homeName}</b>: [${curHomeShoot}] ✅/❌\n` +
        `🔴 <b>${awayName}</b>: [${curAwayShoot}] ✅/❌\n\n` +
        `Score pamapenalties iri kuchinja!`
      );
    }
  }

  // ==========================================
  // 7. IN-MATCH PENALTY SAVED / MISSED EVENTS
  // ==========================================
  if (state === 'in' && isInitialized) {
    await checkKeyMatchEvents(league, matchId, homeName, awayName);
  }

  // ==========================================
  // 8. FULL TIME (MATCH ENDED)
  // ==========================================
  if (prev.state === 'in' && state === 'post' && isInitialized) {
    await sendTelegramAlert(null,
      `🏁 <b>FULL TIME / MATCH ENDED</b>\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `🏆 <b>${league.name}</b>\n\n` +
      `🔵 <b>${homeName}</b>  ${hScore} - ${aScore}  <b>${awayName}</b> 🔴\n\n` +
      `Mutambo wapera zviri pamutemo!`
    );
  }

  // Gadziridza cache yedu
  matchCache.set(matchId, {
    state,
    detail,
    homeScore: hScore,
    awayScore: aScore,
    period: ev.status?.period || 0,
    shootoutHome: home.shootoutScore || 0,
    shootoutAway: away.shootoutScore || 0
  });
}

// Function inotsvaga munhu we goal pakarepo
async function fetchLatestScorer(leagueCode, matchId, hScore, aScore, homeName, awayName) {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueCode}/summary?event=${matchId}`;
    const res = await fetch(url);
    if (!res.ok) return "🎯 Chibodzwa chapinda!";
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
      return `🎯 Munhu we Goal: <b>${scorer}</b> ${clock ? `(⏱️ ${clock})` : ''}`;
    }
  } catch (e) {}

  return "🎯 Chibodzwa chapinda!";
}

// Function yekutarisa kana pane munhu atadza kurova Penalty (Saved / Missed)
async function checkKeyMatchEvents(league, matchId, homeName, awayName) {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.code}/summary?event=${matchId}`;
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();

    const keyEvents = data.keyEvents || [];
    for (const item of keyEvents) {
      const eventKey = `${matchId}_${item.id || item.text}`;
      if (processedEvents.has(eventKey)) continue;

      const raw = (item.text || '').toLowerCase();

      // Kana Penalty ikadzorwa kana kupotswa:
      if (raw.includes('penalty') && (raw.includes('missed') || raw.includes('saved') || raw.includes('blocked'))) {
        const taker = item.participants?.[0]?.athlete?.displayName || "Taker";
        await sendTelegramAlert(null,
          `❌ <b>PENALTY MISSED / SAVED!</b>\n` +
          `━━━━━━━━━━━━━━━━━━━\n` +
          `🏆 <b>${league.name}</b>\n` +
          `⚽ <b>${homeName} vs ${awayName}</b>\n\n` +
          `Player: <b>${taker}</b> haana kukwanisa kuisa penalty mumambure!\n` +
          `Hapana goal rapinda.`
        );
        processedEvents.add(eventKey);
        continue;
      }

      processedEvents.add(eventKey);
    }
  } catch (e) {}
}

module.exports = { checkLiveMatches };
