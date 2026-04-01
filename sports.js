// SYNAPT Sports API — TheSportsDB con parametros correctos

const LEAGUES = [
  { name: "NBA", emoji: "🏀" },
  { name: "MLB", emoji: "⚾" },
  { name: "NFL", emoji: "🏈" },
  { name: "NHL", emoji: "🏒" },
  { name: "MLS", emoji: "⚽" }
];

async function getTodayGames(leagueName, emoji) {
  try {
    // Fecha de hoy en formato YYYY-MM-DD
    var now = new Date();
    var y = now.getFullYear();
    var m = String(now.getMonth() + 1).padStart(2, "0");
    var d = String(now.getDate()).padStart(2, "0");
    var dateStr = y + "-" + m + "-" + d;

    // TheSportsDB free — key "3", eventsday con nombre de liga
    var url = "https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=" + dateStr + "&l=" + leagueName;
    var res = await fetch(url, { headers: { "User-Agent": "SYNAPT/1.0" } });
    if (!res.ok) return null;
    var data = await res.json();
    var events = data.events || [];
    if (!events.length) return null;

    var lines = events.slice(0, 8).map(function(e) {
      var home = e.strHomeTeam || "";
      var away = e.strAwayTeam || "";
      var hs = e.intHomeScore;
      var as = e.intAwayScore;

      if (hs !== null && hs !== "" && as !== null && as !== "") {
        var h = parseInt(hs) || 0;
        var a = parseInt(as) || 0;
        var winner = h > a ? home : (a > h ? away : "");
        return emoji + " " + away + " " + as + " - " + hs + " " + home + (winner ? "  W " + winner : "  Empate");
      } else {
        var time = (e.strTime || "").substring(0, 5);
        return emoji + " " + away + " vs " + home + (time ? "  " + time : "");
      }
    }).filter(Boolean);

    if (!lines.length) return null;
    return emoji + " " + leagueName + "\n" + lines.join("\n");
  } catch(err) {
    return null;
  }
}

// También intentamos ayer por si los juegos de anoche no están en "hoy"
async function getYesterdayGames(leagueName, emoji) {
  try {
    var now = new Date();
    now.setDate(now.getDate() - 1);
    var y = now.getFullYear();
    var m = String(now.getMonth() + 1).padStart(2, "0");
    var d = String(now.getDate()).padStart(2, "0");
    var dateStr = y + "-" + m + "-" + d;

    var url = "https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=" + dateStr + "&l=" + leagueName;
    var res = await fetch(url, { headers: { "User-Agent": "SYNAPT/1.0" } });
    if (!res.ok) return null;
    var data = await res.json();
    var events = (data.events || []).filter(function(e) {
      return e.intHomeScore !== null && e.intHomeScore !== "";
    });
    if (!events.length) return null;

    var lines = events.slice(0, 6).map(function(e) {
      var home = e.strHomeTeam || "";
      var away = e.strAwayTeam || "";
      var hs = e.intHomeScore;
      var as = e.intAwayScore;
      var h = parseInt(hs) || 0;
      var a = parseInt(as) || 0;
      var winner = h > a ? home : (a > h ? away : "");
      return emoji + " " + away + " " + as + " - " + hs + " " + home + (winner ? "  W " + winner : "  Empate");
    }).filter(Boolean);

    if (!lines.length) return null;
    return emoji + " " + leagueName + " (ayer)\n" + lines.join("\n");
  } catch(err) {
    return null;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  var now = new Date();
  var today = now.toLocaleDateString("es-MX", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    timeZone: "America/Mexico_City"
  });
  var todayUpper = today.charAt(0).toUpperCase() + today.slice(1);

  // Intentar hoy primero, si vacío intentar ayer
  var sections = [];
  for (var i = 0; i < LEAGUES.length; i++) {
    var l = LEAGUES[i];
    var result = await getTodayGames(l.name, l.emoji);
    if (!result) {
      result = await getYesterdayGames(l.name, l.emoji);
    }
    if (result) sections.push(result);
  }

  var parts = ["🏆 RESUMEN DEPORTIVO — " + todayUpper];
  sections.forEach(function(s) { parts.push(s); });
  if (!sections.length) parts.push("Sin juegos recientes disponibles.");
  parts.push("__________\nSYNAPT.LIVE | @SynaptLiveOfficial\n#Deportes #NBA #MLB #NHL #MLS #SynaptLive");

  var fullText = parts.join("\n\n");

  return res.status(200).json({
    text: fullText,
    telegram: fullText.substring(0, 4096),
    facebook: fullText.substring(0, 2000),
    hasGames: sections.length > 0,
    debug: {
      date: todayUpper,
      sectionsFound: sections.length
    }
  });
};
