const { ESPN_LEAGUES } = require('../config/leagues');
const { adjustLiveMinute, formatMatchTimes } = require('../utils/timeUtils');

// Helper function inoburitsa ma groups ese kunyangwe akaunganidzwa mu sub-folders e ESPN
function extractAllGroups(childrenList) {
  let groups = [];
  if (!Array.isArray(childrenList)) return groups;

  for (const item of childrenList) {
    if (item.standings?.entries && item.standings.entries.length > 0) {
      groups.push({
        title: item.name || item.abbreviation || 'Group',
        entries: item.standings.entries
      });
    } else if (item.children && Array.isArray(item.children)) {
      const nested = extractAllGroups(item.children);
      groups.push(...nested);
    }
  }
  return groups;
}

async function fetchRealFixturesForDate(dateStr, dateLabel, leagueFilter = null) {
  let fixturesText = `📅 <b>FIXTURES — ${dateLabel}</b>\n━━━━━━━━━━━━━━━━━━━\n\n`;
  let hasMatches = false;
  let seenIds = new Set();

  const leaguesToFetch = leagueFilter
    ? ESPN_LEAGUES.filter(l => l.key === leagueFilter)
    : ESPN_LEAGUES;

  for (const league of leaguesToFetch) {
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.code}/scoreboard?dates=${dateStr}&_ts=${Date.now()}`;
      const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
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

          fixturesText += `• 🔵 <b>${home}</b> ${scoreDisplay}\n`;
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
      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.code}/scoreboard?_ts=${Date.now()}`;
      const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
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
          text += `⏱️ Clock: <b>${clock}</b>\n\n`;
        });
      }
    } catch (e) {}
  }

  return liveFound ? text : "🔴 <b>LIVE SCORES</b>\n\nNo matches currently underway.";
}

// REAL LIVE STANDINGS (Supports EPL, AFCON Tournament, AFCON Qualifiers & UEFA Groups)
async function fetchRealLiveStandings(leagueCode, leagueName) {
  let activeCode = leagueCode;
  let activeName = leagueName;

  try {
    let url = `https://site.api.espn.com/apis/v2/sports/soccer/${activeCode}/standings`;
    let res = await fetch(url);
    let data = await res.json();

    let groups = extractAllGroups(data.children);

    // KANA IRI AFCON ASINA TABLE RE FINALS: Tora AFCON Qualifiers pakarepo!
    if (activeCode === 'caf.nations' && groups.length === 0) {
      activeCode = 'caf.nations_qual';
      activeName = 'AFCON Qualifiers';
      url = `https://site.api.espn.com/apis/v2/sports/soccer/${activeCode}/standings`;
      res = await fetch(url);
      data = await res.json();
      groups = extractAllGroups(data.children);
    }

    // 1. KANA IRI TOURNAMENT INE MA GROUPS (Senge AFCON, UEFA Nations League)
    if (groups.length > 0) {
      let text = `🏆 <b>${activeName.toUpperCase()} STANDINGS</b>\n━━━━━━━━━━━━━━━━━━━\n\n`;

      for (const group of groups) {
        text += `📍 <b>${group.title}</b>\n`;
        group.entries.forEach((item, index) => {
          const rank = index + 1;
          const team = item.team?.shortDisplayName || item.team?.name || 'Team';
          const pts = item.stats?.find(s => s.name === 'points')?.value ?? '0';
          const played = item.stats?.find(s => s.name === 'gamesPlayed')?.value ?? '0';
          const diff = item.stats?.find(s => s.name === 'pointDifferential')?.displayValue ?? '0';

          text += `${rank}. <b>${team}</b> — ${played}P | ${diff} GD | <b>${pts} pts</b>\n`;
        });
        text += `\n`;
      }
      return text;
    }

    // 2. KANA IRI LEAGUE YEMAZUVA OSE (Senge EPL 1 to 20, La Liga)
    const entries = data.children?.[0]?.standings?.entries || [];
    if (entries.length > 0) {
      let text = `🏆 <b>${activeName.toUpperCase()} TABLE (1-20)</b>\n━━━━━━━━━━━━━━━━━━━\n\n`;
      entries.slice(0, 20).forEach((item, index) => {
        const rank = index + 1;
        const team = item.team?.shortDisplayName || item.team?.name || 'Team';
        const pts = item.stats?.find(s => s.name === 'points')?.value ?? '0';
        const played = item.stats?.find(s => s.name === 'gamesPlayed')?.value ?? '0';
        const diff = item.stats?.find(s => s.name === 'pointDifferential')?.displayValue ?? '0';

        let prefix = `${rank}.`;
        if (rank <= 4) prefix = `${rank}. 🔵`;
        else if (rank === 5) prefix = `${rank}. 🟠`;
        else if (rank >= 18) prefix = `${rank}. 🔴`;

        text += `${prefix} <b>${team}</b> — ${played}P | ${diff} GD | <b>${pts} pts</b>\n`;
      });
      return text;
    }

    return null;
  } catch (err) {
    console.error("Standings error:", err.message);
    return null;
  }
}

module.exports = {
  fetchRealFixturesForDate,
  fetchRealLiveMatchesBulletin,
  fetchRealLiveStandings
};
