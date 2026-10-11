import asyncio
import logging
import socket
from datetime import datetime, timedelta, timezone

orig_getaddrinfo = socket.getaddrinfo
def getaddrinfo_ipv4(host, port, family=0, type=0, proto=0, flags=0):
    return orig_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)
socket.getaddrinfo = getaddrinfo_ipv4

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.constants import ParseMode
from telegram.ext import Application, CallbackQueryHandler, CommandHandler, ContextTypes
from telegram.request import HTTPXRequest

from api_client import ApiFootballClient, ApiFootballError
from config import DISCLAIMER, TELEGRAM_BOT_TOKEN
from leagues import DEFAULT_LEAGUES, LEAGUE_BY_CODE, LEAGUES
from predictor import analyze_match_data, format_fixture_line, format_prediction

logging.basicConfig(format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO)
logging.getLogger("httpx").setLevel(logging.WARNING)

HARARE = timezone(timedelta(hours=2))
client = ApiFootballClient()

def _today_str():
    return datetime.now(HARARE).strftime("%Y-%m-%d")

def _league_keyboard():
    rows, row = [], []
    for name, code in LEAGUES.items():
        row.append(InlineKeyboardButton(name, callback_data=f"lg:{code}"))
        if len(row) == 2:
            rows.append(row)
            row = []
    if row:
        rows.append(row)
    rows.append([InlineKeyboardButton("🌐 Default leagues", callback_data="lg:all")])
    return InlineKeyboardMarkup(rows)

async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = (
        "⚽️ *Football Predictor Bot (Free API)*\n\n"
        "Mitambo, statistics nema odds echokwadi.\n\n"
        "Commands:\n"
        "/matches - Mitambo inotevera\n"
        "/today - Mitambo yanhasi\n"
        "/leagues - Sarudza League\n"
        "/predict <id> - Full match prediction\n\n"
        + DISCLAIMER
    )
    await update.message.reply_text(text, parse_mode=ParseMode.MARKDOWN)

async def cmd_matches(update: Update, context: ContextTypes.DEFAULT_TYPE):
    code = context.user_data.get("league_code")
    try:
        if code:
            data = client.fixtures_by_league(code)
            fixtures = data.get("matches", [])
            title = LEAGUE_BY_CODE.get(code, "Selected league")
        else:
            fixtures = []
            for c in DEFAULT_LEAGUES[:3]:
                res = client.fixtures_by_league(c)
                fixtures.extend(res.get("matches", [])[:2])
            title = "Mitambo Inotevera"
    except ApiFootballError as exc:
        await update.message.reply_text(f"⚠️ {exc}")
        return

    if not fixtures:
        await update.message.reply_text("Hapana mitambo yakarongwa parizvino.")
        return

    msg = [f"📅 *{title}*\n"]
    for f in fixtures[:8]:
        msg.append(format_fixture_line(f) + "\n")
    msg.append("Kuti uone analysis, nyora: `/predict <id>`")
    await update.message.reply_text("\n".join(msg), parse_mode=ParseMode.MARKDOWN)

async def cmd_today(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        data = client.fixtures_by_date(_today_str())
        fixtures = data.get("matches", [])
    except ApiFootballError as exc:
        await update.message.reply_text(f"⚠️ {exc}")
        return

    if not fixtures:
        await update.message.reply_text("Hapana mitambo iripo nhasi pama league anowanikwa pachena.")
        return

    msg = [f"📅 *Mitambo Yanhasi ({_today_str()})*\n"]
    for f in fixtures[:10]:
        msg.append(format_fixture_line(f) + "\n")
    msg.append("Nyora `/predict <id>` kuitira prediction.")
    await update.message.reply_text("\n".join(msg), parse_mode=ParseMode.MARKDOWN)

async def cmd_leagues(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Sarudza league yaunoda kuona:", reply_markup=_league_keyboard())

async def on_league_button(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    data = query.data
    if data == "lg:all":
        context.user_data.pop("league_code", None)
        await query.edit_message_text("Wasarudza default leagues. Nyora /matches")
        return
    code = data.split(":", 1)[1]
    context.user_data["league_code"] = code
    name = LEAGUE_BY_CODE.get(code, code)
    await query.edit_message_text(f"Wasarudza: *{name}*.\nNyora /matches kuona mitambo yacho.")

async def cmd_predict(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.args:
        await update.message.reply_text("Shandisa seizvi: `/predict <id>`\nMuenzaniso: `/predict 435982`", parse_mode=ParseMode.MARKDOWN)
        return

    match_id = context.args[0].strip()
    wait_msg = await update.message.reply_text("⏳ *Ndiri ku-analyser match statistics nema odds...*", parse_mode=ParseMode.MARKDOWN)

    try:
        match_info = client.match_details_and_h2h(match_id)
        try:
            h2h_data = client.head_to_head(match_id)
        except Exception:
            h2h_data = {}

        analysis = analyze_match_data(match_info, h2h_data)
        await wait_msg.edit_text(format_prediction(analysis), parse_mode=ParseMode.MARKDOWN)
        await update.message.reply_text(DISCLAIMER, parse_mode=ParseMode.MARKDOWN)

    except ApiFootballError as exc:
        await wait_msg.edit_text(f"⚠️ {exc}")
    except Exception as exc:
        logging.error("Predict error", exc_info=exc)
        await wait_msg.edit_text("Hatina kukwanisa ku-analyser match iyi. Tarisa kana Match ID yacho iri yechokwadi.")

def main():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    req = HTTPXRequest(connect_timeout=40.0, read_timeout=40.0)
    app = Application.builder().token(TELEGRAM_BOT_TOKEN).request(req).build()

    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("matches", cmd_matches))
    app.add_handler(CommandHandler("today", cmd_today))
    app.add_handler(CommandHandler("leagues", cmd_leagues))
    app.add_handler(CommandHandler("predict", cmd_predict))
    app.add_handler(CallbackQueryHandler(on_league_button, pattern=r"^lg:"))

    print("Bot riri kushanda zvakanaka ne Football-Data API!")
    app.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == "__main__":
    main()
