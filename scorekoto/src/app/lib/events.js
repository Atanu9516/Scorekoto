/**
 * Helper to test if a player name is missing or a generic fallback.
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

  return genericWords.includes(clean) || /\b(fwd|mid|def|sub|gk)\s*\d*$/i.test(clean);
}

// Prefer provider-supplied events. When a finished fixture has no event feed,
// show one factual result entry derived directly from the stored score.
export function getEventsForMatch(match, existingEvents = []) {
  if (Array.isArray(existingEvents) && existingEvents.length > 0) {
    return existingEvents;
  }

  const status = String(match?.status || "").toUpperCase();
  if (
    ["FT", "AET", "PEN"].includes(status) &&
    match?.homeScore !== null && match?.homeScore !== undefined &&
    match?.awayScore !== null && match?.awayScore !== undefined
  ) {
    const suffix = status === "AET" ? " after extra time" : status === "PEN" ? " after penalties" : "";
    return [{
      minute: status,
      type: "whistle",
      player: "",
      team: "",
      detail: `Full-time result${suffix}: ${match.homeTeam} ${match.homeScore}–${match.awayScore} ${match.awayTeam}.`,
    }];
  }

  return [];
}
