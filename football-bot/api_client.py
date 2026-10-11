import time
import requests
from config import API_FOOTBALL_KEY, CACHE_TTL, HTTP_TIMEOUT

class ApiFootballError(Exception):
    pass

class ApiFootballClient:
    BASE_URL = "https://api.football-data.org/v4"

    def __init__(self, api_key=None):
        self.api_key = api_key or API_FOOTBALL_KEY
        self.session = requests.Session()
        self._cache = {}

    def _headers(self):
        return {"X-Auth-Token": self.api_key}

    def _get(self, path, params=None):
        params = params or {}
        cache_key = (path, tuple(sorted(params.items())))
        now = time.time()
        if cache_key in self._cache:
            ts, data = self._cache[cache_key]
            if now - ts < CACHE_TTL:
                return data

        url = f"{self.BASE_URL}/{path.lstrip('/')}"
        try:
            resp = self.session.get(url, headers=self._headers(), params=params, timeout=HTTP_TIMEOUT)
        except requests.RequestException as exc:
            raise ApiFootballError(f"Network error: {exc}")

        if resp.status_code == 403 or resp.status_code == 401:
            raise ApiFootballError("Token rako harisi kushanda. Tarisa mu .env")
        if resp.status_code == 429:
            raise ApiFootballError("Wait a minute: wa-exceeder requests dzemahara.")
        if resp.status_code != 200:
            raise ApiFootballError(f"API Error {resp.status_code}")

        data = resp.json()
        self._cache[cache_key] = (now, data)
        return data

    def fixtures_by_date(self, date_str):
        # Football-Data inoshandisa dateFrom ne dateTo
        return self._get("matches", {"dateFrom": date_str, "dateTo": date_str})

    def fixtures_by_league(self, league_code):
        return self._get(f"competitions/{league_code}/matches", {"status": "SCHEDULED"})

    def match_details_and_h2h(self, match_id):
        # Inodzosera match info pamwechete ne head2head stats
        return self._get(f"matches/{match_id}")

    def head_to_head(self, match_id):
        return self._get(f"matches/{match_id}/head2head", {"limit": 10})
