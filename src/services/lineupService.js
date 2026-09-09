const { ESPN_LEAGUES } = require('../config/leagues');
const { getYYYYMMDD, formatMatchTimes } = require('../utils/timeUtils');

async function findMatchByTeamName(query) {
  const q = query.toLowerCase().trim();
  const dateStr = getYYYYMMDD(0);

  for (const league of ESPN_LEAGUES) {
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.code}/scoreboard?dates=${dateStr}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();

      for (const ev of data.events || []) {
        const comp = ev.competitions?.[0];
        if (!comp) continue;
        const names = comp.competitors.map(c => (c.team?.name || '').toLowerCase());
        if (names.some(n => n.includes(q))) {
          return { leagueCode: league.code, eventId: ev.id, leagueName: league.name };
        }
      }
    } catch (e) {}
  }
  return null;
}

// Function yekutarisa kana lineups dzatobuda (ye Auto-post mu Channel)
async function getOfficialLineupForAlert(leagueCode, eventId) {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueCode}/summary?event=${eventId}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();

    const rosters = data.rosters;
    if (!rosters || rosters.length === 0) return null;

    // Tarisa kana starters varimo zvechokwadi
    const hasStarters = rosters.some(r => r.roster?.some(p => p.starter));
    if (!hasStarters) return null;

    const comp = data.header?.competitions?.[0];
    const matchTime = comp?.date ? formatMatchTimes(comp.date) : '';
    const homeTeam = comp?.competitors?.find(c => c.homeAway === 'home')?.team?.name || 'Home';
    const awayTeam = comp?.competitors?.find(c => c.homeAway === 'away')?.team?.name || 'Away';

    let output = `🚨 <b>CONFIRMED STARTING XI — 30 MINS TO KICK-OFF</b>\n` +
                 `━━━━━━━━━━━━━━━━━━━\n` +
                 `⚔️ <b>${homeTeam} vs ${awayTeam}</b>\n` +
                 `⏰ Kick-off: <b>${matchTime}</b>\n\n`;

    for (const teamRoster of rosters) {
      const teamName = teamRoster.team?.displayName || "Team";
      const formation = teamRoster.formation ? `(${teamRoster.formation})` : "";
      const coach = teamRoster.coaches?.[0]?.name;

      output += `🛡️ <b>${teamName.toUpperCase()}</b> ${formation}\n`;
      output += `<b>Starting XI:</b>\n`;

      const allPlayers = teamRoster.roster || [];
      const starters = allPlayers.filter(p => p.starter);
      const bench = allPlayers.filter(p => !p.starter);

      const gks = [], dfs = [], mfs = [], fws = [], others = [];

      starters.forEach(p => {
        const num = p.jersey ? `#${p.jersey} ` : '';
        const name = p.athlete?.displayName || p.athlete?.name || 'Player';
        const pos = (p.position?.name || p.position?.abbreviation || '').toLowerCase();

        if (pos.includes('goal') || pos === 'g' || pos === 'gk') gks.push(`🧤 ${num}<b>${name}</b> (GK)`);
        else if (pos.includes('def') || pos.includes('back') || pos === 'd') dfs.push(`🛡️ ${num}<b>${name}</b>`);
        else if (pos.includes('mid') || pos === 'm') mfs.push(`⚙️ ${num}<b>${name}</b>`);
        else if (pos.includes('forw') || pos.includes('strik') || pos.includes('wing') || pos === 'f') fws.push(`⚡ ${num}<b>${name}</b>`);
        else others.push(`🏃 ${num}<b>${name}</b>`);
      });

      [...gks, ...dfs, ...mfs, ...fws, ...others].forEach(line => output += `${line}\n`);

      if (bench.length > 0) {
        output += `\n🪑 <b>Bench:</b> `;
        const benchNames = bench.map(p => {
          const num = p.jersey ? `#${p.jersey} ` : '';
          return `${num}${p.athlete?.displayName || 'Player'}`;
        });
        output += `<i>${benchNames.slice(0, 9).join(', ')}</i>\n`;
      }

      if (coach) output += `👔 <b>Manager:</b> <i>${coach}</i>\n`;
      output += `\n`;
    }

    output += `📺 <b>TECH SPORT TV</b>`;
    return output;
  } catch (err) {
    return null;
  }
}

async function fetchMatchLineup(queryOrCode, maybeEventId = null) {
  let leagueCode = queryOrCode;
  let eventId = maybeEventId;

  if (!maybeEventId) {
    if (/^\d+$/.test(queryOrCode)) {
      eventId = queryOrCode;
      leagueCode = 'eng.1';
    } else {
      const match = await findMatchByTeamName(queryOrCode);
      if (!match) return `❌ <b>Match not found for:</b> "${queryOrCode}". Check /today for fixtures.`;
      leagueCode = match.leagueCode;
      eventId = match.eventId;
    }
  }

  const alert = await getOfficialLineupForAlert(leagueCode, eventId);
  if (alert) return alert;

  return `⚠️ <b>OFFICIAL LINEUPS NOT READY YET</b>\n\nOfficial Starting XIs are typically released 30-60 minutes before kick-off. Check back soon!`;
}

module.exports = { fetchMatchLineup, getOfficialLineupForAlert };
