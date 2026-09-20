/**
 * Helper to test if a player name is missing or a generic fallback
 */
export function isGenericOrMissingPlayer(name) {
  if (!name || typeof name !== 'string') return true;
  const clean = name.trim().toLowerCase();
  if (!clean) return true;
  const genericWords = [
    'player',
    'polayer',
    'football player',
    'forward',
    'attacker',
    'winger',
    'midfielder',
    'defender',
    'goalkeeper',
    'playmaker',
    'substitute',
    'striker',
    'sub',
  ];
  if (genericWords.includes(clean)) return true;
  // Also catch patterns like "Home Team Fwd 1", "Team Sub 2", "Arsenal Def 1", "Real Madrid GK"
  if (/\b(fwd|mid|def|sub|gk)\s*\d*$/i.test(clean)) return true;
  return false;
}

/**
 * Generates match timeline events and commentary for any match
 * based on its scoreline, teams, and lineup data.
 */
export function getEventsForMatch(match, existingEvents = [], lineup = null) {
  if (existingEvents && Array.isArray(existingEvents) && existingEvents.length > 0) {
    return existingEvents;
  }

  const homeTeam = match?.homeTeam || "Home Team";
  const awayTeam = match?.awayTeam || "Away Team";
  const homeScore = typeof match?.homeScore === "number" ? match.homeScore : 0;
  const awayScore = typeof match?.awayScore === "number" ? match.awayScore : 0;
  const status = (match?.status || '').toUpperCase();
  const isFinished = status === "FT" || status === "AET" || status === "PEN";

  // Helper to extract real players from lineup starting XI and substitutes
  const extractRealPlayers = (teamLineup) => {
    if (!teamLineup) return { scorers: [], assisters: [], defenders: [], subs: [], all: [] };
    const starting = teamLineup.startingXI || teamLineup.starting || [];
    const subsList = teamLineup.substitutes || [];

    const realStarting = starting.map((p) => p.name).filter((n) => !isGenericOrMissingPlayer(n));
    const realSubs = subsList.map((p) => p.name).filter((n) => !isGenericOrMissingPlayer(n));

    // Attackers / Midfielders (row 3 and 4 or positions F/M)
    const attackingPlayers = starting
      .filter((p) => (p.row === 4 || p.row === 3 || ['FWD', 'ST', 'RW', 'LW', 'CAM', 'AM', 'CM'].includes(p.position)) && !isGenericOrMissingPlayer(p.name))
      .map((p) => p.name);

    const defensivePlayers = starting
      .filter((p) => (p.row === 2 || ['CB', 'LB', 'RB', 'DM', 'CDM'].includes(p.position)) && !isGenericOrMissingPlayer(p.name))
      .map((p) => p.name);

    return {
      scorers: attackingPlayers.length > 0 ? attackingPlayers : realStarting,
      assisters: realStarting.length > 0 ? realStarting : [],
      defenders: defensivePlayers.length > 0 ? defensivePlayers : realStarting,
      subs: realSubs,
      all: [...realStarting, ...realSubs],
    };
  };

  const homeSquad = extractRealPlayers(lineup?.home);
  const awaySquad = extractRealPlayers(lineup?.away);

  const events = [];

  // 1. Kickoff whistle
  events.push({
    minute: "1'",
    type: "whistle",
    player: "Referee",
    team: homeTeam,
    detail: "Match kicks off at " + (match?.venue || "Stadium"),
  });

  // 2. Home Goals
  const homeMins = [23, 54, 78, 88, 36, 68];
  for (let i = 0; i < homeScore; i++) {
    const min = homeMins[i % homeMins.length];
    const scorer = homeSquad.scorers.length > 0 ? homeSquad.scorers[i % homeSquad.scorers.length] : "";
    let assister = null;
    if (homeSquad.assisters.length > 1) {
      const candidates = homeSquad.assisters.filter((p) => p !== scorer);
      assister = candidates.length > 0 ? candidates[i % candidates.length] : null;
    }
    events.push({
      minute: `${min}'`,
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
    const scorer = awaySquad.scorers.length > 0 ? awaySquad.scorers[i % awaySquad.scorers.length] : "";
    let assister = null;
    if (awaySquad.assisters.length > 1) {
      const candidates = awaySquad.assisters.filter((p) => p !== scorer);
      assister = candidates.length > 0 ? candidates[i % candidates.length] : null;
    }
    events.push({
      minute: `${min}'`,
      type: "goal",
      player: scorer,
      team: awayTeam,
      assist: assister,
    });
  }

  // 4. Cards & Tactical events (Only add player names if real players exist)
  if (awaySquad.defenders.length > 0 || awaySquad.all.length > 0) {
    const cardedPlayer = awaySquad.defenders[0] || awaySquad.all[0];
    events.push({
      minute: "38'",
      type: "yellow-card",
      player: cardedPlayer,
      team: awayTeam,
      detail: "Tactical foul in the midfield area",
    });
  }

  events.push({
    minute: "45+1'",
    type: "whistle",
    player: "Referee",
    team: homeTeam,
    detail: "First half comes to a close",
  });

  if (homeSquad.subs.length > 0 && homeSquad.scorers.length > 0) {
    events.push({
      minute: "64'",
      type: "substitution",
      player: homeSquad.subs[0],
      team: homeTeam,
      playerIn: homeSquad.subs[0],
      playerOut: homeSquad.scorers[0],
    });
  }

  if (homeSquad.defenders.length > 0) {
    events.push({
      minute: "76'",
      type: "yellow-card",
      player: homeSquad.defenders[0],
      team: homeTeam,
      detail: "Late challenge",
    });
  }

  if (isFinished) {
    events.push({
      minute: "90+3'",
      type: "whistle",
      player: "Referee",
      team: homeTeam,
      detail: `Full-Time! Final Score: ${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}`,
    });
  }

  return events.sort((a, b) => {
    const minA = parseInt(a.minute.replace(/[^0-9]/g, ""), 10) || 0;
    const minB = parseInt(b.minute.replace(/[^0-9]/g, ""), 10) || 0;
    return minA - minB;
  });
}