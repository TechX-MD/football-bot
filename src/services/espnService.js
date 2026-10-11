const { ESPN_LEAGUES } = require('../config/leagues');
const { adjustLiveMinute, formatMatchTimes } = require('../utils/timeUtils');

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

// FIXTURES: Dzinobudisa mameseji pamwe chete ne ma BUTTON BOXES sepa screenshot
async function fetchRealFixturesForDate(dateStr, dateLabel, leagueFilter = null) {
  let fixturesText = `📅 <b>TECH SPORT TV — FIXTURES</b>\n`;
  fixturesText += `🗓️ <i>${dateLabel}</i>\n`;
  fixturesText += `━━━━━━━━━━━━━━━━━━━\n\n`;
  fixturesText += `Tap any match button below to view lineups & live details:\n`;

  let hasMatches = false;
  let seenIds = new Set();
  let inlineKeyboard = [];

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

        const c1 = league.c1 || '🔵';
        const c2 = league.c2 || '⚪';

        // Header Button re League (Box guru repamusoro)
        inlineKeyboard.push([
          { text: `${c1} 🏆 ${league.name.toUpperCase()} ${c2}`, callback_data: `lg_${league.key}` }
        ]);

        matches.forEach(ev => {
          seenIds.add(ev.id);
          const comp = ev.competitions?.[0];
          if (!comp) return;

          const homeComp = comp.competitors.find(c => c.homeAway === 'home');
          const awayComp = comp.competitors.find(c => c.homeAway === 'away');

          const home = homeComp?.team?.shortDisplayName || homeComp?.team?.name || 'Home';
          const away = awayComp?.team?.shortDisplayName || awayComp?.team?.name || 'Away';
          const homeScore = homeComp?.score ?? '0';
          const awayScore = awayComp?.score ?? '0';

          const state = ev.status?.type?.state || '';
          const statusDetail = ev.status?.type?.shortDetail || ev.status?.type?.detail || '';
          const timeFormatted = formatMatchTimes(ev.date);

          let buttonLabel = '';

          // 1. Mutambo Wapera (FT)
          if (state === 'post') {
            buttonLabel = `🏁 ${home}  ${homeScore} - ${awayScore}  ${away} (FT)`;
          } 
          // 2. Mutambo Uri Kutambwa (LIVE)
          else if (state === 'in') {
            const displayMin = adjustLiveMinute(statusDetail);
            buttonLabel = `🔴 ${home}  ${homeScore} - ${awayScore}  ${away} (${displayMin})`;
          } 
          // 3. Mutambo Usati Watanga (Upcoming)
          else {
            buttonLabel = `⚔️ ${home} vs ${away} ⏰ ${timeFormatted}`;
          }

          // BOX BHATANI REMUTAMBO WEGA WEGA (sepa screenshot)
          inlineKeyboard.push([
            { text: buttonLabel, callback_data: `m_${league.code}_${ev.id}` }
          ]);
        });
      }
    } catch (e) {}
  }

  // Bhatani rekupedzisira repasi
  inlineKeyboard.push([
    { text: `📺 TECH SPORT TV — OFFICIAL CHANNEL`, url: `https://t.me/techsporttv` }
  ]);

  if (!hasMatches) {
    return {
      text: `📅 <b>FIXTURES — ${dateLabel}</b>\n━━━━━━━━━━━━━━━━━━━\nNo matches scheduled for this date.`,
      reply_markup: {
        inline_keyboard: [
          [{ text: `📅 VIEW TODAY'S FIXTURES`, callback_data: `cmd_today` }],
          [{ text: `📺 TECH SPORT TV CHANNEL`, url: `https://t.me/techsporttv` }]
        ]
      }
    };
  }

  return {
    text: fixturesText,
    reply_markup: { inline_keyboard: inlineKeyboard }
  };
}

// LIVE BULLETIN INE MA BUTTONS
async function fetchRealLiveMatchesBulletin() {
  let text = `🔴 <b>LIVE FOOTBALL BULLETIN</b>\n━━━━━━━━━━━━━━━━━━━\n\n`;
  let liveFound = false;
  let inlineKeyboard = [];

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

        inlineKeyboard.push([
          { text: `${c1} 🏆 ${league.name.toUpperCase()} ${c2}`, callback_data: `lg_${league.key}` }
        ]);

        liveEvents.forEach(ev => {
          const comp = ev.competitions?.[0];
          const home = comp.competitors.find(c => c.homeAway === 'home');
          const away = comp.competitors.find(c => c.homeAway === 'away');
          const clock = adjustLiveMinute(ev.status?.type?.shortDetail || ev.status?.type?.detail);
          const hName = home.team?.shortDisplayName || home.team?.name || 'Home';
          const aName = away.team?.shortDisplayName || away.team?.name || 'Away';

          inlineKeyboard.push([
            { text: `⚽ ${hName}  ${home.score} - ${away.score}  ${aName} (${clock})`, callback_data: `m_${league.code}_${ev.id}` }
          ]);
        });
      }
    } catch (e) {}
  }

  inlineKeyboard.push([
    { text: `🔄 REFRESH LIVE SCORES`, callback_data: `cmd_live` }
  ]);

  return {
    text: liveFound ? text + `Tap any match to view real-time events & lineups:` : `🔴 <b>LIVE SCORES</b>\n\nNo matches currently live right now.`,
    reply_markup: { inline_keyboard: inlineKeyboard }
  };
}

// STANDINGS ENGINE
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
