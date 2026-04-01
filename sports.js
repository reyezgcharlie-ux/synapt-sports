// SYNAPT — Sports Score API
// Usa ESPN Public API con headers correctos para evitar bloqueo

const LEAGUES = [
  { key: "basketball/nba", emoji: "🏀", label: "NBA" },
  { key: "baseball/mlb",   emoji: "⚾", label: "MLB" },
  { key: "football/nfl",   emoji: "🏈", label: "NFL" },
  { key: "hockey/nhl",     emoji: "🏒", label: "NHL" },
  { key: "soccer/usa.1",   emoji: "⚽", label: "MLS" }
];

function formatGame(event, emoji) {
  const comp = event.competitions && event.competitions[0];
  if (!comp) return null;
  const competitors = comp.competitors || [];
  const home = competitors.find(function(c) { return c.homeAway === "home"; });
  const away = competitors.find(function(c) { return c.homeAway === "away"; });
  if (!home || !away) return null;

  const homeName = (home.team && (home.team.abbreviation || home.team.shortDisplayName)) || "Home";
  const awayName = (away.team && (away.team.abbreviation || away.team.shortDisplayName)) || "Away";
  const homeScore = home.score !== undefined ? home.score : "–";
  const awayScore = away.score !== undefined ? away.score : "–";
  const statusName = comp.status && comp.status.type && comp.status.type.name || "";
  const statusDetail = comp.status && comp.status.type && comp.status.type.shortDetail || "";

  if (statusName === "STATUS_FINAL") {
    const hs = parseInt(homeScore) || 0;
    const as = parseInt(awayScore) || 0;
    const winner = hs > as ? homeName : awayName;
    return emoji + " " + awayName + " " + awayScore + " - " + homeScore + " " + homeName + "  \u2713 " + winner;
  } else if (statusName === "STATUS_IN_PROGRESS") {
    return emoji + " " + awayName + " " + awayScore + " - " + homeScore + " " + homeName + "  \uD83D\uDD34 " + statusDetail;
  } else {
    var time = "";
    if (event.date) {
      var d = new Date(event.date);
      time = d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" });
    }
    return emoji + " " + awayName + " vs " + homeName + (time ? "  \uD83D\uDCC5 " + time : "");
  }
}

async function fetchLeague(league) {
  try {
    var url = "https://site.api.espn.com/apis/site/v2/sports/" + league.key + "/scoreboard";
    var res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SYNAPT-Sports/1.0)",
        "Accept": "application/json",
        "Origin": "https://www.espn.com",
        "Referer": "https://www.espn.com/"
      }
    });
    if (!res.ok) return null;
    var data = await res.json();
    var events = data.events || [];
    if (!events.length) return null;

    // Solo juegos de hoy — filtrar los que tengan score o sean de hoy
    var todayGames = events.filter(function(e) {
      if (!e.date) return true;
      var d = new Date(e.date);
      var now = new Date();
      return d.toDateString() === now.toDateString() || 
             (now - d) < 86400000; // últimas 24h
    });

    if (!todayGames.length) todayGames = events.slice(0, 6);

    var lines = todayGames.slice(0, 8).map(function(e) {
      return formatGame(e, league.emoji);
    }).filter(Boolean);

    if (!lines.length) return null;
    return league.emoji + " " + league.label + "\n" + lines.join("\n");
  } catch (e) {
    return null;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  var today = new Date().toLocaleDateString("es-MX", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    timeZone: "America/Mexico_City"
  });
  var todayUpper = today.charAt(0).toUpperCase() + today.slice(1);

  var results = await Promise.all(LEAGUES.map(function(l) { return fetchLeague(l); }));
  var sections = results.filter(Boolean);

  var header = "\uD83C\uDFC6 RESUMEN DEPORTIVO \u2014 " + todayUpper;
  var footer = "__________\nSYNAPT.LIVE | @SynaptLiveOfficial\n#Deportes #NBA #MLB #NHL #MLS #SynaptLive";

  var text = sections.length
    ? header + "\n\n" + sections.join("\n\n") + "\n\n" + footer
    : header + "\n\nSin juegos programados para hoy.\n\n" + footer;

  return res.status(200).json({
    text: text,
    telegram: text.substring(0, 4096),
    facebook: text.substring(0, 2000),
    hasGames: sections.length > 0,
    sportsFound: sections.length
  });
};
