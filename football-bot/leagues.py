LEAGUES = {
    "Premier League (England)": "PL",
    "UEFA Champions League": "CL",
    "La Liga (Spain)": "PD",
    "Serie A (Italy)": "SA",
    "Bundesliga (Germany)": "BL1",
    "Ligue 1 (France)": "FL1",
    "Eredivisie (Netherlands)": "DED",
    "Championship (England)": "ELC",
    "Primeira Liga (Portugal)": "PPL",
    "Copa Libertadores": "CLI"
}

LEAGUE_BY_CODE = {v: k for k, v in LEAGUES.items()}

DEFAULT_LEAGUES = [
    "PL",
    "CL",
    "PD",
    "SA",
    "BL1"
]
