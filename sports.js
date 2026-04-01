// SYNAPT Sports API — SportRadar via RapidAPI (funciona desde servidores)
// Alternativa: TheSportsDB gratuita sin bloqueos

const SPORTSDB = "https://www.thesportsdb.com/api/v1/json/3";

async function getTodayEvents(leagueId, emoji, label) {
  try {
    var today = new Date().toISOString().split("T")[0];
    var url = SPORTSDB + "/eventsday.php?d=" + today + "&l=" + leagueId;
    var res = await fetch(url, {
      headers: { "User-Agent": "SYNAPT/1.0" }
    });
    if (!res.ok) return null;
    var data = await res.json();
    var events = data.events || [];
    if (!events.length) return null;

    var lines = events.slice(0, 8).map(function(e) {
      var home = e.strHomeTeam || "Home";
      var away = e.strAwayTeam || "Away";
      var homeScore = e.intHomeScore;
      var awayScore = e.intAwayScore;
      var status = e.strStatus || "";

      if (homeScore !== null && homeScore !== "" && awayScore !== null && awayScore !== "") {
        var hs = parseInt(homeScore) || 0;
        var as = parseInt(awayScore) || 0;
        var winner = hs > as ? home : (as > hs ? away : "Empate");
        return emoji + " " + away + " " + awayScore + " - " + homeScore + " " + home + (winner !== "Empate" ? "  V " + winner : "  Empate");
      } else {
        var time = e.strTime ? e.strTime.substring(0,5) : (e.strProgress || "");
        if (status === "NS" || !status) {
          return emoji + " " + away + " vs " + home + (time ? "  " + time : "");
        } else {
          return emoji + " " + away + " vs " + home + "  " + status;
        }
      }
    }).filter(Boolean);

    if (!lines.length) return null;
    return emoji + " " + label + "\n" + lines.join("\n");
  } catch(e) {
    return null;
  }
}

// IDs de TheSportsDB para cada liga
// NBA=4387, MLB=4424, NFL=4391, NHL=4380, MLS=4346
var LEAGUES = [
  { id: "4387", emoji: "🏀", label: "NBA" },
  { id: "4424", emoji: "⚾", label: "MLB" },
  { id: "4391", emoji: "🏈", label: "NFL" },
  { id: "4380", emoji: "🏒", label: "NHL" },
  { id: "4346", emoji: "⚽", label: "MLS" }
];

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  var today = new Date().toLocaleDateString("es-MX", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    timeZone: "America/Mexico_City"
  });
  var todayUpper = today.charAt(0).toUpperCase() + today.slice(1);

  var results = await Promise.all(
    LEAGUES.map(function(l) { return getTodayEvents(l.id, l.emoji, l.label); })
  );
  var sections = results.filter(Boolean);

  var parts = ["🏆 RESUMEN DEPORTIVO — " + todayUpper];
  sections.forEach(function(s) { parts.push(s); });
  if (!sections.length) parts.push("Sin juegos programados para hoy.");
  parts.push("__________\nSYNAPT.LIVE | @SynaptLiveOfficial\n#Deportes #NBA #MLB #NHL #MLS #SynaptLive");

  var fullText = parts.join("\n\n");

  return res.status(200).json({
    text: fullText,
    telegram: fullText.substring(0, 4096),
    facebook: fullText.substring(0, 2000),
    hasGames: sections.length > 0,
    date: todayUpper,
    debug: {
      sectionsFound: sections.length,
      leagues: results.map(function(r, i) { return { league: LEAGUES[i].label, found: !!r }; })
    }
  });
};
