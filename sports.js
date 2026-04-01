// SYNAPT — Sports Score API
// Usa ESPN Public API (gratis, sin key)
// Make.com llama GET /api/sports → retorna texto listo para publicar

const SPORT_EMOJI = {
  basketball_nba: "🏀", baseball_mlb: "⚾", football_nfl: "🏈",
  hockey_nhl: "🏒", soccer_usa_1: "⚽"
};

const SPORT_LABEL = {
  basketball_nba: "NBA", baseball_mlb: "MLB", football_nfl: "NFL",
  hockey_nhl: "NHL", soccer_usa_1: "MLS"
};

const ESPN_ENDPOINTS = {
  basketball_nba:  "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard",
  baseball_mlb:    "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard",
  football_nfl:    "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
  hockey_nhl:      "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard",
  soccer_usa_1:    "https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard"
};

function parseESPN(data, sportKey) {
  const emoji = SPORT_EMOJI[sportKey];
  const events = data?.events || [];
  if (!events.length) return null;

  const lines = events.slice(0, 8).map(event => {
    const comp = event.competitions?.[0];
    if (!comp) return null;
    const home = comp.competitors?.find(c => c.homeAway === "home");
    const away = comp.competitors?.find(c => c.homeAway === "away");
    if (!home || !away) return null;
    const homeName = home.team?.abbreviation || "Home";
    const awayName = away.team?.abbreviation || "Away";
    const homeScore = home.score || "–";
    const awayScore = away.score || "–";
    const status = comp.status?.type?.name || "";
    const statusDesc = comp.status?.type?.shortDetail || "";

    if (status === "STATUS_FINAL") {
      const winner = parseInt(homeScore) > parseInt(awayScore) ? homeName : awayName;
      return `${emoji} ${awayName} ${awayScore} - ${homeScore} ${homeName}  ✓ ${winner}`;
    } else if (status === "STATUS_IN_PROGRESS") {
      return `${emoji} ${awayName} ${awayScore} - ${homeScore} ${homeName}  🔴 ${statusDesc}`;
    } else {
      const time = event.date
        ? new Date(event.date).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" })
        : statusDesc;
      return `${emoji} ${awayName} vs ${homeName}  📅 ${time}`;
    }
  }).filter(Boolean);

  if (!lines.length) return null;
  return `${emoji} ${SPORT_LABEL[sportKey]}\n${lines.join("\n")}`;
}

async function fetchSport(sportKey) {
  try {
    const res = await fetch(ESPN_ENDPOINTS[sportKey], { headers: { "User-Agent": "SYNAPT/1.0" } });
    if (!res.ok) return null;
    return parseESPN(await res.json(), sportKey);
  } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const today = new Date().toLocaleDateString("es-MX", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    timeZone: "America/Mexico_City"
  });
  const todayUpper = today.charAt(0).toUpperCase() + today.slice(1);

  const [nba, mlb, nfl, nhl, mls] = await Promise.all([
    fetchSport("basketball_nba"), fetchSport("baseball_mlb"),
    fetchSport("football_nfl"),  fetchSport("hockey_nhl"),
    fetchSport("soccer_usa_1")
  ]);

  const sections = [nba, mlb, nfl, nhl, mls].filter(Boolean);
  const header = `🏆 RESUMEN DEPORTIVO — ${todayUpper}`;
  const footer = `__________\nSYNAPT.LIVE | @SynaptLiveOfficial\n#Deportes #NBA #MLB #NHL #MLS #SynaptLive`;
  const text = sections.length
    ? `${header}\n\n${sections.join("\n\n")}\n\n${footer}`
    : `${header}\n\nSin juegos programados para hoy.\n\n${footer}`;

  return res.status(200).json({
    text,
    telegram: text.substring(0, 4096),
    facebook: text.substring(0, 2000),
    hasGames: sections.length > 0
  });
}
