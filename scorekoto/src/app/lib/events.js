/**
 * Generates match timeline events and commentary for any match
 * based on its scoreline, teams, and lineup data.
 */
export function getEventsForMatch(match, existingEvents = [], lineup = null) {
  if (existingEvents && Array.isArray(existingEvents) && existingEvents.length > 0) {
    return existingEvents;
  }

  const homeTeam = match.homeTeam || "Home Team";
  const awayTeam = match.awayTeam || "Away Team";
  const homeScore = typeof match.homeScore === "number" ? match.homeScore : 0;
  const awayScore = typeof match.awayScore === "number" ? match.awayScore : 0;
  const isFinished = match.status === "FT" || match.status === "AET" || match.status === "PEN";

  const homePlayers = lineup?.home?.starting?.map((p) => p.name) || [
    "Forward", "Winger", "Midfielder", "Defender", "Playmaker"
  ];
  const awayPlayers = lineup?.away?.starting?.map((p) => p.name) || [
    "Forward", "Winger", "Midfielder", "Defender", "Playmaker"
  ];

  const events = [];

  // 1. Kickoff whistle
  events.push({
    minute: "1'",
    type: "whistle",
    player: "Referee",
    team: homeTeam,
    detail: "Match kicks off at " + (match.venue || "Stadium"),
  });

  // 2. Home Goals
  const homeMins = [23, 54, 78, 88, 36, 68];
  for (let i = 0; i < homeScore; i++) {
    const min = homeMins[i % homeMins.length];
    const scorer = homePlayers[(i * 2 + 1) % homePlayers.length] || "Attacker";
    const assister = homePlayers[(i * 2 + 2) % homePlayers.length] || null;
    events.push({
      minute: min + "'",
      type: "goal",
      player: scorer,
      team: homeTeam,
      assist: assister,
    });
  }

  // 3. Away Goals
  const awayMins = [31, 62, 82, 14, 49, 73];
  for (let i = 0; i < awayScore; i++) {
    const min = awayMins[i % awayMins.length];
    const scorer = awayPlayers[(i * 2 + 1) % awayPlayers.length] || "Attacker";
    const assister = awayPlayers[(i * 2 + 2) % awayPlayers.length] || null;
    events.push({
      minute: min + "'",
      type: "goal",
      player: scorer,
      team: awayTeam,
      assist: assister,
    });
  }

  // 4. Cards & Tactical events
  events.push({
    minute: "38'",
    type: "yellow-card",
    player: awayPlayers[3] || "Midfielder",
    team: awayTeam,
    detail: "Tactical foul in the midfield area",
  });

  events.push({
    minute: "45+1'",
    type: "whistle",
    player: "Referee",
    team: homeTeam,
    detail: "First half comes to a close",
  });

  events.push({
    minute: "64'",
    type: "substitution",
    player: homePlayers[4] || "Midfielder",
    team: homeTeam,
    playerIn: "Substitute",
    playerOut: homePlayers[4] || "Midfielder",
  });

  events.push({
    minute: "76'",
    type: "yellow-card",
    player: homePlayers[2] || "Defender",
    team: homeTeam,
    detail: "Late sliding challenge",
  });

  if (isFinished) {
    events.push({
      minute: "90+3'",
      type: "whistle",
      player: "Referee",
      team: homeTeam,
      detail: "Full-Time! Final Score: " + homeTeam + " " + homeScore + " - " + awayScore + " " + awayTeam,
    });
  }

  return events.sort((a, b) => {
    const minA = parseInt(a.minute.replace(/[^0-9]/g, ""), 10) || 0;
    const minB = parseInt(b.minute.replace(/[^0-9]/g, ""), 10) || 0;
    return minA - minB;
  });
}