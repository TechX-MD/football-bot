async function fetchMatchLineup(leagueCode, eventId) {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueCode}/summary?event=${eventId}`;
    const res = await fetch(url);
    const data = await res.json();

    const rosters = data.rosters;
    if (!rosters || rosters.length === 0) {
      return "⚠️ <b>LINEUPS UPDATE</b>\n\nOfficial lineups have not been announced yet.";
    }

    let text = `📋 <b>OFFICIAL MATCH LINEUPS</b>\n━━━━━━━━━━━━━━━━━━━\n\n`;

    for (const teamRoster of rosters) {
      const teamName = teamRoster.team?.displayName || "Team";
      const formation = teamRoster.formation ? `(${teamRoster.formation})` : "";

      text += `🛡️ <b>${teamName.toUpperCase()}</b> ${formation}\n<b>Starting XI:</b>\n`;
      const starters = teamRoster.roster?.filter(p => p.starter) || [];

      starters.forEach((p, idx) => {
        const name = p.athlete?.displayName || p.athlete?.name || 'Player';
        const pos = p.position?.abbreviation ? `<i>(${p.position.abbreviation})</i>` : '';
        const jersey = p.jersey ? `#${p.jersey}` : '';
        text += `${idx + 1}. ${jersey} <b>${name}</b> ${pos}\n`;
      });

      text += `\n`;
    }

    return text;
  } catch (err) {
    return "❌ Lineups currently unavailable.";
  }
}

module.exports = { fetchMatchLineup };
