// SYNAPT Sports API — Vercel Serverless Function
// ESPN Public API — sin key requerida

const LEAGUES = [
  { key: "basketball/nba", emoji: "🏀", label: "NBA" },
  { key: "baseball/mlb",   emoji: "⚾", label: "MLB" },
  { key: "football/nfl",   emoji: "🏈", label: "NFL" },
  { key: "hockey/nhl",     emoji: "🏒", label: "NHL" },
  { key: "soccer/usa.1",   emoji: "⚽", label: "MLS" }
];

function formatGame(event, emoji) {
  var comp = event.competitions && event.competitions[0];
  if (!comp) return null;
  var competitors = comp.competitors || [];
  var home = competitors.find(function(c) { return c.homeAway === "home"; });
  var away = competitors.find(function(c) { return c.homeAway === "away"; });
  if (!home || !away) return null;

  var homeName = (home.team && (home.team.abbreviation || home.team.shortDisplayName)) || "Home";
  var awayName = (away.team && (away.team.abbreviation || away.team.shortDisplayName)) || "Away";
  var homeScore = home.score !== undefined ? home.score : "-";
  var awayScore = away.score !== undefined ? away.score : "-";
  var statusName = comp.status && comp.status.type && comp.status.type.name || "";
  var statusDetail = comp.status && comp.status.type && comp.status.type.shortDetail || "";

  if (statusName === "STATUS_FINAL") {
    var winner = (parseInt(homeScore) || 0) > (parseInt(awayScore) || 0) ? homeName : awayName;
    return emoji + " " + awayName + " " + awayScore + " - " + homeScore + " " + homeName + "  V " + winner;
  } else if (statusName === "STATUS_IN_PROGRESS") {
    return emoji + " " + awayName + " " + awayScore + " - " + homeScore + " " + homeName + "  EN VIVO " + statusDetail;
  } else {
    var time = "";
    if (event.date) {
      time = new Date(event.date).toLocaleTimeString("es-MX", {
        hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City"
      });
    }
    return emoji + " " + awayName + " vs " + homeName + (time ? "  " + time : "");
  }
}

async function fetchLeague(league) {
  try {
    var url = "https://site.api.espn.com/apis/site/v2/sports/" + league.key + "/scoreboard";
    var res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
        "Referer": "https://www.espn.com/",
        "Origin": "https://www.espn.com"
      }
    });
    if (!res.ok) return null;
    var data = await res.json();
    var events = (data.events || []).filter(function(e) {
      if (!e.date) return true;
      var diff = Date.now() - new Date(e.date).getTime();
      return diff > -3600000 && diff < 86400000 * 2;
    });
    if (!events.length) return null;

    var lines = events.slice(0, 6).map(function(e) { return formatGame(e, league.emoji); }).filter(Boolean);
    if (!lines.length) return null;
    return { label: league.emoji + " " + league.label, lines: lines };
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

  // Devolver estructura separada por sección — Make arma el texto
  var nba = results[0], mlb = results[1], nfl = results[2], nhl = results[3], mls = results[4];

  // Construir texto con saltos REALES (no escapados)
  var parts = ["🏆 RESUMEN DEPORTIVO — " + todayUpper];
  if (nba) parts.push(nba.label + "\n" + nba.lines.join("\n"));
  if (mlb) parts.push(mlb.label + "\n" + mlb.lines.join("\n"));
  if (nfl) parts.push(nfl.label + "\n" + nfl.lines.join("\n"));
  if (nhl) parts.push(nhl.label + "\n" + nhl.lines.join("\n"));
  if (mls) parts.push(mls.label + "\n" + mls.lines.join("\n"));

  var hasGames = sections.length > 0;
  if (!hasGames) parts.push("Sin juegos programados para hoy.");
  parts.push("__________\nSYNAPT.LIVE | @SynaptLiveOfficial\n#Deportes #NBA #MLB #NHL #MLS #SynaptLive");

  var fullText = parts.join("\n\n");

  return res.status(200).json({
    text: fullText,
    telegram: fullText.substring(0, 4096),
    facebook: fullText.substring(0, 2000),
    hasGames: hasGames,
    date: todayUpper,
    nba: nba ? nba.lines : [],
    mlb: mlb ? mlb.lines : [],
    nfl: nfl ? nfl.lines : [],
    nhl: nhl ? nhl.lines : [],
    mls: mls ? mls.lines : []
  });
};
