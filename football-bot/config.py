import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

API_FOOTBALL_KEY = os.getenv("API_FOOTBALL_KEY", "")
API_FOOTBALL_HOST = os.getenv("API_FOOTBALL_HOST", "v3.football.api-sports.io")
API_FOOTBALL_BASE_URL = f"https://{API_FOOTBALL_HOST}"

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")

DEFAULT_SEASON = int(os.getenv("DEFAULT_SEASON", "2025"))
HTTP_TIMEOUT = int(os.getenv("HTTP_TIMEOUT", "20"))
CACHE_TTL = int(os.getenv("CACHE_TTL", "300"))
TIMEZONE = os.getenv("TIMEZONE", "Africa/Harare")

DISCLAIMER = (
    "⚠️ *Disclaimer:* Predictions idzi dzinobva pama statistics ematambiro ezvikwata. "
    "Hadziite guarantee 100%. Bheja nezvaunokwanisa kurasikirwa nazvo. 18+"
)

