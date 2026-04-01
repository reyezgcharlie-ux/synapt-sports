// SYNAPT — Sports Score API
// ESPN Public API (gratis, sin key)
// Vercel Serverless Function

const SPORT_EMOJI = {
  basketball_nba: "🏀", baseball_mlb: "⚾", football_nfl: "🏈",
  hockey_nhl: "🏒", soccer_usa_1: "⚽"
};

const SPORT_LABEL = {
  basketball_nba: "NBA", baseball_mlb: "MLB", football_nfl: "NFL",
  hockey_nhl: "NHL", soccer_usa_1: "MLS"
};

const ESPN_ENDPOINTS = {
  basketball_nba: "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard",
  baseball_mlb:   "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard",
  football_nfl:   "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
  hockey_nhl:     "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard",
  soccer_usa_1:   "https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard"
};

function parseESPN(data, sportKey) {
  const emoji = SPORT_EMOJI[sportKey];
  const events = data && data.events ? data.events : [];
  if (!events.length) return null;

  const lines = events.slice(0, 8).map(function(event) {
    const comp = event.competitions && event.competitions[0];
    if (!comp) return null;
    const competitors = comp.competitors || [];
    const home = competitors.find(function(c) { return c.homeAway === "home"; });
    const away = competitors.find(function(c) { return c.homeAway === "away"; });
    if (!home || !away) return null;

    const homeName = (home.team && home.team.abbreviation) || "Home";
    const awayName = (away.team && away.team.abbreviation) || "Away";
    const homeScore = home.score || "–";
    const awayScore = away.score || "–";
    const status = comp.status && comp.status.type && comp.status.type.name || "";
    const statusDesc = comp.status && comp.status.type && comp.status.type.shortDetail || "";

    if (status === "STATUS_FINAL") {
      const winner = parseInt(homeScore) > parseInt(awayScore) ? homeName : awayName;
      return emoji + " " + awayName + " " + awayScore + " - " + homeScore + " " + homeName + "  \u2713 " + winner;
    } else if (status === "STATUS_IN_PROGRESS") {
      return emoji + " " + awayName + " " + awayScore + " - " + homeScore + " " + homeName + "  \uD83D\uDD34 " + statusDesc;
    } else {
      var time = event.date
        ? new Date(event.date).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" })
        : statusDesc;
      return emoji + " " + awayName + " vs " + homeName + "  \uD83D\uDCC5 " + time;
    }
  }).filter(Boolean);

  if (!lines.length) return null;
  return emoji + " " + SPORT_LABEL[sportKey] + "\n" + lines.join("\n");
}

async function fetchSport(sportKey) {
  try {
    const res = await fetch(ESPN_ENDPOINTS[sportKey]);
    if (!res.ok) return null;
    const data = await res.json();
    return parseESPN(data, sportKey);
  } catch (e) {
    return null;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  const today = new Date().toLocaleDateString("es-MX", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    timeZone: "America/Mexico_City"
  });
  const todayUpper = today.charAt(0).toUpperCase() + today.slice(1);

  const results = await Promise.all([
    fetchSport("basketball_nba"),
    fetchSport("baseball_mlb"),
    fetchSport("football_nfl"),
    fetchSport("hockey_nhl"),
    fetchSport("soccer_usa_1")
  ]);

  const sections = results.filter(Boolean);
  const header = "\uD83C\uDFC6 RESUMEN DEPORTIVO \u2014 " + todayUpper;
  const footer = "__________\nSYNAPT.LIVE | @SynaptLiveOfficial\n#Deportes #NBA #MLB #NHL #MLS #SynaptLive";

  const text = sections.length
    ? header + "\n\n" + sections.join("\n\n") + "\n\n" + footer
    : header + "\n\nSin juegos programados para hoy.\n\n" + footer;

  return res.status(200).json({
    text: text,
    telegram: text.substring(0, 4096),
    facebook: text.substring(0, 2000),
    hasGames: sections.length > 0
  });
};
