const { ESPN_LEAGUES } = require('../config/leagues');
const { adjustLiveMinute, formatMatchTimes } = require('../utils/timeUtils');

// Helper function: Inovaka Table riri mu BHOKISI (sepa screenshot yako)
function renderBoxTable(entries) {
  let lines = [];
  lines.push("┌───┬─────────────┬───┬───┬──┐");
  lines.push("│ # │ TEAM        │ P │GD │PT│");
  lines.push("├───┼─────────────┼───┼───┼──┤");

  entries.forEach((item, index) => {
    const rank = String(index + 1).padStart(2, ' ');
    let name = item.team?.shortDisplayName || item.team?.name || 'Team';
    if (name.length > 11) name = name.substring(0, 10) + '.';
    name = name.padEnd(11, ' ');

    const played = String(item.stats?.find(s => s.name === 'gamesPlayed')?.value ?? '0').padStart(2, ' ');
    
    let gd = String(item.stats?.find(s => s.name === 'pointDifferential')?.displayValue ?? '0');
    if (!gd.startsWith('+') && !gd.startsWith('-') && gd !== '0') gd = '+' + gd;
    gd = gd.padStart(3, ' ');
    if (gd.length > 3) gd = gd.substring(0, 3);

    const pts = String(item.stats?.find(s => s.name === 'points')?.value ?? '0').padStart(2, ' ');

    lines.push(`│${rank} │ ${name} │${played} │${gd}│${pts}│`);
  });

  lines.push("└───┴─────────────┴───┴───┴──┘");
  return `<pre>${lines.join("\n")}</pre>`;
}

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

// FIXTURES INE MA LEAGUE BANNERS ANE MA COLOURS AWO
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

        // Custom League Color Banner
        const c1 = league.c1 || '🔵';
        const c2 = league.c2 || '⚪';
        fixturesText += `${c1}${c2}━━━━━━━━━━━━━━━━━━━━${c2}${c1}\n`;
        fixturesText += `🏆 <b>${league.name.toUpperCase()}</b>\n`;
        fixturesText += `${c1}${c2}━━━━━━━━━━━━━━━━━━━━${c2}${c1}\n\n`;

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

          if (state === 'post') {
            fixturesText += `┌ 🏁 <b>${home}</b>  ${homeScore} - ${awayScore}  <b>${away}</b>\n`;
            fixturesText += `└ ⏱️ Full Time (FT)\n\n`;
          } else if (state === 'in') {
            const displayMin = adjustLiveMinute(statusDetail);
            fixturesText += `┌ 🔴 <b>${home}</b>  ${homeScore} - ${awayScore}  <b>${away}</b>\n`;
            fixturesText += `└ ⏱️ LIVE (${displayMin})\n\n`;
          } else {
            fixturesText += `┌ ⚔️ <b>${home}</b> vs <b>${away}</b>\n`;
            fixturesText += `└ ⏰ <b>${timeFormatted}</b>\n\n`;
          }
        });
      }
    } catch (e) {}
  }

  return hasMatches ? fixturesText : `📅 <b>FIXTURES — ${dateLabel}</b>\n━━━━━━━━━━━━━━━━━━━\nNo fixtures found for this date.`;
}

async function fetchRealLiveMatchesBulletin() {
  let text = `🔴 <b>LIVE FOOTBALL BULLETIN</b>\n━━━━━━━━━━━━━━━━━━━\n\n`;
  let liveFound = false;

  for (const league of ESPN_LEAGUES) {
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.code}/scoreboard?_ts=${Date.now()}`;
      const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
      const data = await res.json();
      const liveEvents = (data.events || []).filter(e => e.status?.type?.state === 'in');

      if (liveEvents.length > 0) {
        liveFound = true;
        const c1 = league.c1 || '🔵';
        const c2 = league.c2 || '⚪';

        text += `${c1}${c2}━━━━━━━━━━━━━━━━━━━━${c2}${c1}\n`;
        text += `🏆 <b>${league.name.toUpperCase()}</b>\n\n`;

        liveEvents.forEach(ev => {
          const comp = ev.competitions?.[0];
          const home = comp.competitors.find(c => c.homeAway === 'home');
          const away = comp.competitors.find(c => c.homeAway === 'away');
          const clock = adjustLiveMinute(ev.status?.type?.shortDetail || ev.status?.type?.detail);

          text += `┌ ⚽ <b>${home.team.name}</b>  ${home.score} - ${away.score}  <b>${away.team.name}</b>\n`;
          text += `└ ⏱️ Status: <b>${clock}</b> | LIVE 🔴\n\n`;
        });
      }
    } catch (e) {}
  }

  return liveFound ? text : "🔴 <b>LIVE SCORES</b>\n\nNo matches currently underway.";
}

// BOXED TABLE ENGINE WITH LEAGUE COLORED BANNERS
async function fetchRealLiveStandings(leagueCode, leagueName, c1 = '🔵', c2 = '⚪') {
  let activeCode = leagueCode;
  let activeName = leagueName;

  try {
    let url = `https://site.api.espn.com/apis/v2/sports/soccer/${activeCode}/standings`;
    let res = await fetch(url);
    let data = await res.json();

    let groups = extractAllGroups(data.children);

    if (activeCode === 'caf.nations' && groups.length === 0) {
      activeCode = 'caf.nations_qual';
      activeName = 'AFCON Qualifiers';
      c1 = '🟢';
      c2 = '🟡';
      url = `https://site.api.espn.com/apis/v2/sports/soccer/${activeCode}/standings`;
      res = await fetch(url);
      data = await res.json();
      groups = extractAllGroups(data.children);
    }

    const bannerLine = `${c1}${c2}━━━━━━━━━━━━━━━━━━━━${c2}${c1}`;

    // 1. KANA IRI TOURNAMENT INE MA GROUPS (AFCON, NATIONS LEAGUE)
    if (groups.length > 0) {
      let text = `${bannerLine}\n`;
      text += `🏆 <b>${activeName.toUpperCase()} STANDINGS</b>\n`;
      text += `${bannerLine}\n\n`;

      for (const group of groups) {
        text += `📍 <b>${group.title.toUpperCase()}</b>\n`;
        text += renderBoxTable(group.entries);
        text += `\n`;
      }
      return text;
    }

    // 2. KANA IRI LEAGUE YAKAZARA (EPL 1-20, LALIGA, BUNDESLIGA)
    const entries = data.children?.[0]?.standings?.entries || [];
    if (entries.length > 0) {
      let text = `${bannerLine}\n`;
      text += `🏆 <b>${activeName.toUpperCase()} STANDINGS (1-20)</b>\n`;
      text += `${bannerLine}\n\n`;

      text += renderBoxTable(entries.slice(0, 20));
      text += `\n<i>Legend: P = Played | GD = Goal Diff | PT = Points</i>\n`;
      return text;
    }

    return null;
  } catch (err) {
    return null;
  }
}

module.exports = {
  fetchRealFixturesForDate,
  fetchRealLiveMatchesBulletin,
  fetchRealLiveStandings
};
