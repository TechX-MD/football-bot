module.exports = {
  ESPN_LEAGUES: [
    { key: 'epl', name: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League', code: 'eng.1', c1: '🟣', c2: '🟢', tag: 'PREMIER LEAGUE' },
    { key: 'laliga', name: '🇪🇸 La Liga', code: 'esp.1', c1: '🔴', c2: '🟡', tag: 'LA LIGA' },
    { key: 'bundesliga', name: '🇩🇪 Bundesliga', code: 'ger.1', c1: '🔴', c2: '⚪', tag: 'BUNDESLIGA' },
    { key: 'seriea', name: '🇮🇹 Serie A', code: 'ita.1', c1: '🔵', c2: '⚪', tag: 'SERIE A' },
    { key: 'ligue1', name: '🇫🇷 Ligue 1', code: 'fra.1', c1: '🟢', c2: '🔵', tag: 'LIGUE 1' },
    { key: 'cl', name: '🏆 UEFA Champions League', code: 'uefa.champions', c1: '🔵', c2: '⭐', tag: 'CHAMPIONS LEAGUE' },
    { key: 'uel', name: '🏆 UEFA Europa League', code: 'uefa.europa', c1: '🟠', c2: '⚫', tag: 'EUROPA LEAGUE' },
    { key: 'nations', name: '🇪🇺 UEFA Nations League', code: 'uefa.nations', c1: '⚪', c2: '🔵', tag: 'NATIONS LEAGUE' },
    { key: 'afcon', name: '🌍 Africa Cup of Nations', code: 'caf.nations', c1: '🟢', c2: '🔴', tag: 'AFCON' },
    { key: 'afcon_qual', name: '🌍 AFCON Qualifiers', code: 'caf.nations_qual', c1: '🟢', c2: '🟡', tag: 'AFCON QUALIFIERS' },
    { key: 'carabao', name: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Carabao Cup', code: 'eng.league_cup', c1: '🟢', c2: '⚪', tag: 'CARABAO CUP' },
    { key: 'championship', name: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship', code: 'eng.2', c1: '🔴', c2: '⚪', tag: 'CHAMPIONSHIP' },
    { key: 'saudi', name: '🇸🇦 Saudi Pro League', code: 'sau.1', c1: '🟢', c2: '🟡', tag: 'SAUDI PRO LEAGUE' }
  ],
  TABLE_MAP: {
    epl: ['eng.1', 'Premier League', '🟣', '🟢'],
    laliga: ['esp.1', 'La Liga', '🔴', '🟡'],
    bundesliga: ['ger.1', 'Bundesliga', '🔴', '⚪'],
    seriea: ['ita.1', 'Serie A', '🔵', '⚪'],
    ligue1: ['fra.1', 'Ligue 1', '🟢', '🔵'],
    cl: ['uefa.champions', 'Champions League', '🔵', '⭐'],
    uel: ['uefa.europa', 'Europa League', '🟠', '⚫'],
    europa: ['uefa.europa', 'Europa League', '🟠', '⚫'],
    nations: ['uefa.nations', 'UEFA Nations League', '⚪', '🔵'],
    unl: ['uefa.nations', 'UEFA Nations League', '⚪', '🔵'],
    afcon: ['caf.nations', 'Africa Cup of Nations', '🟢', '🔴'],
    'afcon qual': ['caf.nations_qual', 'AFCON Qualifiers', '🟢', '🟡'],
    carabao: ['eng.league_cup', 'Carabao Cup', '🟢', '⚪'],
    saudi: ['sau.1', 'Saudi Pro League', '🟢', '🟡'],
    championship: ['eng.2', 'Championship', '🔴', '⚪']
  }
};
