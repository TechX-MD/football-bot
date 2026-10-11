import math

def analyze_match_data(match_data, h2h_data):
    home_team = match_data.get("homeTeam", {})
    away_team = match_data.get("awayTeam", {})
    home_id = home_team.get("id")
    away_id = away_team.get("id")
    home_name = home_team.get("name", "Home")
    away_name = away_team.get("name", "Away")
    
    competition = match_data.get("competition", {}).get("name", "League")
    utc_date = match_data.get("utcDate", "").replace("T", " ").replace("Z", " UTC")

    # 1. Kuverenga mitambo ye Head-to-Head chaiyo kubva mu list
    matches = h2h_data.get("matches", []) if h2h_data else []
    if not matches and "head2head" in h2h_data:
        matches = h2h_data.get("head2head", {}).get("matches", [])

    home_wins = 0
    away_wins = 0
    draws = 0
    total_goals = 0
    played = 0

    for m in matches:
        score = m.get("score", {})
        winner = score.get("winner")
        ft = score.get("fullTime", {})
        hg = ft.get("home")
        ag = ft.get("away")

        if hg is not None and ag is not None:
            played += 1
            total_goals += (hg + ag)
            m_hid = m.get("homeTeam", {}).get("id")
            m_aid = m.get("awayTeam", {}).get("id")

            if winner == "DRAW" or hg == ag:
                draws += 1
            elif (winner == "HOME_TEAM" and m_hid == home_id) or (winner == "AWAY_TEAM" and m_aid == home_id):
                home_wins += 1
            elif (winner == "HOME_TEAM" and m_hid == away_id) or (winner == "AWAY_TEAM" and m_aid == away_id):
                away_wins += 1
            else:
                if m_hid == home_id:
                    if hg > ag: home_wins += 1
                    elif ag > hg: away_wins += 1
                    else: draws += 1
                else:
                    if ag > hg: home_wins += 1
                    elif hg > ag: away_wins += 1
                    else: draws += 1

    avg_goals = round(total_goals / played, 2) if played > 0 else 2.75

    # 2. Probability Model (Home Advantage + H2H Performance)
    # Mu nhabvu yepamusoro (Premier League), Home team ine advantage ye ~46% baseline
    base_home = 0.46
    base_draw = 0.26
    base_away = 0.28

    if played >= 3:
        # Sanganisa baseline ne H2H record yavo
        h2h_weight = 0.55
        h2h_home_rate = (home_wins + 0.5) / (played + 1.5)
        h2h_away_rate = (away_wins + 0.5) / (played + 1.5)
        h2h_draw_rate = (draws + 0.5) / (played + 1.5)

        raw_home = (base_home * (1 - h2h_weight)) + (h2h_home_rate * h2h_weight) + 0.05
        raw_away = (base_away * (1 - h2h_weight)) + (h2h_away_rate * h2h_weight) - 0.03
        raw_draw = (base_draw * (1 - h2h_weight)) + (h2h_draw_rate * h2h_weight) - 0.02
    else:
        raw_home, raw_draw, raw_away = 0.50, 0.26, 0.24

    total_prob = raw_home + raw_draw + raw_away
    p_home = round((raw_home / total_prob) * 100)
    p_away = round((raw_away / total_prob) * 100)
    p_draw = 100 - (p_home + p_away)

    # 3. Real Market Odds (Fair Odds)
    odd_home = f"{round(100.0 / max(p_home, 5), 2):.2f}"
    odd_draw = f"{round(100.0 / max(p_draw, 5), 2):.2f}"
    odd_away = f"{round(100.0 / max(p_away, 5), 2):.2f}"

    # 4. Over/Under 2.5 Goals
    over_prob = min(80, max(35, int((avg_goals / 3.2) * 65)))
    under_prob = 100 - over_prob
    odd_over = f"{round(100.0 / over_prob, 2):.2f}"
    odd_under = f"{round(100.0 / under_prob, 2):.2f}"

    # 5. Smart Betting Tip & Advice
    if p_home >= 53:
        advice = f"1 (Direct Win: {home_name})"
        winner = f"{home_name} Win"
    elif p_home >= 45:
        advice = f"1X (Double Chance: {home_name} or Draw)"
        winner = f"{home_name} or Draw"
    elif p_away >= 50:
        advice = f"2 (Direct Win: {away_name})"
        winner = f"{away_name} Win"
    elif p_away >= 42:
        advice = f"X2 (Double Chance: {away_name} or Draw)"
        winner = f"{away_name} or Draw"
    else:
        if over_prob >= 60:
            advice = "Over 2.5 Goals / Both Teams To Score (BTTS)"
            winner = "Over 2.5 Goals"
        else:
            advice = "Under 3.5 Goals"
            winner = "Under 3.5 Goals"

    return {
        "league": competition,
        "home": home_name,
        "away": away_name,
        "date": utc_date,
        "advice": advice,
        "winner": winner,
        "prob_home": p_home,
        "prob_draw": p_draw,
        "prob_away": p_away,
        "odd_home": odd_home,
        "odd_draw": odd_draw,
        "odd_away": odd_away,
        "odd_over": odd_over,
        "odd_under": odd_under,
        "over_prob": over_prob,
        "h2h_played": played,
        "home_wins": home_wins,
        "away_wins": away_wins,
        "draws": draws,
        "avg_goals": avg_goals
    }

def format_fixture_line(match):
    home = match.get("homeTeam", {}).get("name", "Home")
    away = match.get("awayTeam", {}).get("name", "Away")
    comp = match.get("competition", {}).get("name", "")
    mid = match.get("id")
    date = match.get("utcDate", "").replace("T", " ").replace("Z", "")
    return (
        f"⚽️ *{home}* vs *{away}*\n"
        f"   🏆 {comp}\n"
        f"   🕒 {date}\n"
        f"   🆔 Match ID: `{mid}`"
    )

def format_prediction(a):
    h, aw = a["home"], a["away"]
    lines = [
        f"🏆 *{a['league']}*",
        f"⚽️ *{h}* vs *{aw}*",
        f"🕒 *Nguva:* {a['date']}",
        "",
        "🔔 *PREDICTION & TIP:*",
        f"   👉 *Advice:* `{a['advice']}`",
        f"   🎯 *Main Pick:* *{a['winner']}*",
        "",
        "📊 *WIN PROBABILITIES:*",
        f"   ▪️ {h}: *{a['prob_home']}%*",
        f"   ▪️ Draw: *{a['prob_draw']}%*",
        f"   ▪️ {aw}: *{a['prob_away']}%*",
        "",
        "💰 *BOOKMAKER ODDS (1X2):*",
        f"   • 1 ({h} Win): *{a['odd_home']}*",
        f"   • X (Draw): *{a['odd_draw']}*",
        f"   • 2 ({aw} Win): *{a['odd_away']}*",
        "",
        "🎯 *GOALS MARKET (Over / Under 2.5):*",
        f"   • Over 2.5 ({a['over_prob']}%): *{a['odd_over']}*",
        f"   • Under 2.5: *{a['odd_under']}*",
        f"   • Avg Goals mu H2H: *{a['avg_goals']}*",
        "",
        f"🤝 *HEAD-TO-HEAD (Mitambo {a['h2h_played']}):*",
        f"   • {h} Wins: *{a['home_wins']}* | {aw} Wins: *{a['away_wins']}* | Draws: *{a['draws']}*"
    ]
    return "\n".join(lines)
