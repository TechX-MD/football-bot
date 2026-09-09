const { ESPN_LEAGUES } = require('../config/leagues');
const { adjustLiveMinute, formatMatchTimes } = require('../utils/timeUtils');

async function fetchRealFixturesForDate(dateStr, dateLabel, leagueFilter = null) {
  let fixturesText = `📅 <b>FIXTURES — ${dateLabel}</b>\n━━━━━━━━━━━━━━━━━━━\n\n`;
  let hasMatches = false;
  let seenIds = new Set();

  const leaguesToFetch = leagueFilter
    ? ESPN_LEAGUES.filter(l => l.key === leagueFilter)
    : ESPN_LEAGUES;

  for (const league of leaguesToFetch) {
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.code}/scoreboard?dates=${dateStr}`;
      const res = await fetch(url);
      const data = await res.json();
      const events = data.events || [];

      const matches = events.filter(ev => !seenIds.has(ev.id));
      if (matches.length > 0) {
        hasMatches = true;
        fixturesText += `🏆 <b>${league.name}</b>\n`;

        matches.forEach(ev => {
          seenIds.add(ev.id);
          const comp = ev.competitions?.[0];
          if (!comp) return;

          const homeComp = comp.competitors.find(c => c.homeAway === 'home');
          const awayComp = comp.competitors.find(c => c.homeAway === 'away');

          const home = homeComp?.team?.name || 'Home';
          const away = awayComp?.team?.name || 'Away';
          const homeScore = homeComp?.score ?? '0';
          const awayScore = awayComp?.score ?? '0';

          const state = ev.status?.type?.state || '';
          const statusDetail = ev.status?.type?.shortDetail || ev.status?.type?.detail || '';
          const timeFormatted = formatMatchTimes(ev.date);

          let scoreDisplay;
          if (state === 'post') {
            scoreDisplay = `<b>${homeScore} - ${awayScore}</b> 🏁 <b>${away}</b> (FT)`;
          } else if (state === 'in') {
            const displayMin = adjustLiveMinute(statusDetail);
            scoreDisplay = `<b>${homeScore} - ${awayScore}</b> 🔴 <b>${away}</b> (⏱️ ${displayMin})`;
          } else {
            scoreDisplay = `vs 🔴 <b>${away}</b> (${timeFormatted})`;
          }

          fixturesText += `• 🔵 <b>${home}</b> ${scoreDisplay} <code>[ID: ${ev.id}]</code>\n`;
        });
        fixturesText += `\n`;
      }
    } catch (e) {}
  }

  return hasMatches ? fixturesText : `📅 <b>FIXTURES — ${dateLabel}</b>\n━━━━━━━━━━━━━━━━━━━\nNo fixtures found for this date.`;
}

async function fetchRealLiveMatchesBulletin() {
  let text = `🔴 <b>LIVE FOOTBALL SCORES</b>\n━━━━━━━━━━━━━━━━━━━\n\n`;
  let liveFound = false;

  for (const league of ESPN_LEAGUES) {
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.code}/scoreboard`;
      const res = await fetch(url);
      const data = await res.json();

      const liveEvents = (data.events || []).filter(e => e.status?.type?.state === 'in');

      if (liveEvents.length > 0) {
        liveFound = true;
        text += `🏆 <b>${league.name}</b>\n`;
        liveEvents.forEach(ev => {
          const comp = ev.competitions?.[0];
          const home = comp.competitors.find(c => c.homeAway === 'home');
          const away = comp.competitors.find(c => c.homeAway === 'away');
          const clock = adjustLiveMinute(ev.status?.type?.shortDetail || ev.status?.type?.detail);

          text += `⚽ <b>${home.team.name}</b> ${home.score} - ${away.score} <b>${away.team.name}</b>\n`;
          text += `⏱️ Clock: <b>${clock}</b> | <code>ID: ${ev.id}</code>\n\n`;
        });
      }
    } catch (e) {}
  }

  return liveFound ? text : "🔴 <b>LIVE SCORES</b>\n\nNo matches currently underway.";
}

// FULL TABLE 1 TO 20
async function fetchRealLiveStandings(leagueCode, leagueName) {
  try {
    const url = `https://site.api.espn.com/apis/v2/sports/soccer/${leagueCode}/standings`;
    const res = await fetch(url);
    const data = await res.json();
    const entries = data.children?.[0]?.standings?.entries || [];

    if (!entries.length) return null;

    let text = `🏆 <b>${leagueName.toUpperCase()} TABLE (1-20)</b>\n━━━━━━━━━━━━━━━━━━━\n\n`;

    // Inotora zvikwata zvose kusvika pa 20
    const fullTable = entries.slice(0, 20);

    fullTable.forEach((item, index) => {
      const rank = index + 1;
      const team = item.team?.shortDisplayName || item.team?.name || 'Team';
      const pts = item.stats?.find(s => s.name === 'points')?.value ?? '-';
      const played = item.stats?.find(s => s.name === 'gamesPlayed')?.value ?? '-';
      const diff = item.stats?.find(s => s.name === 'pointDifferential')?.displayValue ?? '0';

      let prefix = `${rank}.`;
      if (rank <= 4) prefix = `${rank}. 🔵`; // Champions League
      else if (rank === 5) prefix = `${rank}. 🟠`; // Europa League
      else if (rank >= 18) prefix = `${rank}. 🔴`; // Relegation

      text += `${prefix} <b>${team}</b> — ${played}P | ${diff} GD | <b>${pts} pts</b>\n`;
    });

    return text;
  } catch (err) {
    return null;
  }
}

module.exports = {
  fetchRealFixturesForDate,
  fetchRealLiveMatchesBulletin,
  fetchRealLiveStandings
};
