// Maps API-Football lineup data without inventing missing players or formations.
export function mapApiSportsLineup(
  apiLineups,
  homeTeamName,
  awayTeamName,
  homeTeamId = null,
  awayTeamId = null,
  apiPlayers = null
) {
  if (!Array.isArray(apiLineups) || apiLineups.length < 2) {
    return null;
  }

  const playerRatings = buildPlayerRatings(apiPlayers);

  function getPlayerRating(player) {
    if (player?.id && playerRatings.byId.has(Number(player.id))) {
      return playerRatings.byId.get(Number(player.id));
    }

    return playerRatings.byName.get(normalizePlayerName(player?.name)) ?? null;
  }

  function mapSingleTeam(item, defaultTeam) {
    const startingXI = (item.startXI || [])
      .filter((entry) => entry.player?.name)
      .map((entry) => {
        const gridRow = entry.player.grid
          ? Number.parseInt(entry.player.grid.split(':')[0], 10)
          : null;
        const positionRow = { G: 1, D: 2, M: 3, F: 4 }[entry.player.pos] || null;

        return {
          id: entry.player.id || null,
          name: entry.player.name,
          number: entry.player.number ?? null,
          position: entry.player.pos || null,
          row: gridRow || positionRow || 1,
          rating: getPlayerRating(entry.player),
        };
      });

    const substitutes = (item.substitutes || [])
      .filter((entry) => entry.player?.name)
      .map((entry) => ({
        id: entry.player.id || null,
        name: entry.player.name,
        number: entry.player.number ?? null,
        rating: getPlayerRating(entry.player),
      }));

    if (startingXI.length === 0) {
      return null;
    }

    return {
      team: item.team?.name || defaultTeam,
      formation: item.formation || null,
      coach: item.coach?.name || null,
      startingXI,
      substitutes,
    };
  }

  const homeItem = apiLineups.find((item) => Number(item.team?.id) === Number(homeTeamId)) || apiLineups[0];
  const awayItem = apiLineups.find((item) => Number(item.team?.id) === Number(awayTeamId)) || apiLineups[1];
  const home = mapSingleTeam(homeItem, homeTeamName);
  const away = mapSingleTeam(awayItem, awayTeamName);

  return home && away ? { home, away } : null;
}

export async function getLineupForMatch(match, apiLineups = null, apiPlayers = null) {
  if (!match) return null;
  return mapApiSportsLineup(
    apiLineups,
    match.homeTeam,
    match.awayTeam,
    match.homeTeamId,
    match.awayTeamId,
    apiPlayers
  );
}

function buildPlayerRatings(apiPlayers) {
  const byId = new Map();
  const byName = new Map();

  for (const team of Array.isArray(apiPlayers) ? apiPlayers : []) {
    for (const entry of Array.isArray(team?.players) ? team.players : []) {
      const rawRating = entry?.statistics?.[0]?.games?.rating;
      if (rawRating === null || rawRating === undefined || rawRating === "") continue;

      const parsedRating = Number(rawRating);
      if (!Number.isFinite(parsedRating)) continue;

      if (entry.player?.id) byId.set(Number(entry.player.id), parsedRating);
      const normalizedName = normalizePlayerName(entry.player?.name);
      if (normalizedName) byName.set(normalizedName, parsedRating);
    }
  }

  return { byId, byName };
}

function normalizePlayerName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLocaleLowerCase();
}
