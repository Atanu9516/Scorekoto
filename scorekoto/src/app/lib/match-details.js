import "server-only";

import pool from "@/app/lib/db";

const FINISHED_STATUSES = ["FT", "AET", "PEN"];

function normalizeStoredEvent(row) {
  let metadata = {};
  try {
    metadata = row.detail?.trim().startsWith("{") ? JSON.parse(row.detail) : {};
  } catch {
    metadata = {};
  }

  return {
    minute: row.match_minute === null ? "" : `${row.match_minute}'`,
    type: row.event_type || "event",
    player: row.player_name || "",
    team: metadata.team || row.team_name || "",
    assist: metadata.assist || null,
    playerIn: metadata.playerIn || null,
    playerOut: metadata.playerOut || null,
    detail: metadata.description || row.detail || "",
  };
}

function positionRow(position) {
  const normalized = String(position || "").toLowerCase();
  if (normalized.includes("goal")) return 1;
  if (normalized.includes("def")) return 2;
  if (normalized.includes("mid")) return 3;
  if (normalized.includes("forward") || normalized.includes("attack")) return 4;
  return 5;
}

function buildLegacyLineup(rows, match) {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const buildTeam = (teamId, teamName) => {
    const teamRows = rows.filter((row) => Number(row.team_id) === Number(teamId));
    const mapPlayer = (row) => ({
      id: row.player_id,
      name: row.player_name,
      number: null,
      position: row.primary_position || null,
      row: positionRow(row.primary_position),
    });

    return {
      team: teamName,
      formation: null,
      coach: null,
      startingXI: teamRows.filter((row) => row.is_starter).map(mapPlayer),
      substitutes: teamRows.filter((row) => !row.is_starter).map(mapPlayer),
    };
  };

  const home = buildTeam(match.homeTeamId, match.homeTeam);
  const away = buildTeam(match.awayTeamId, match.awayTeam);
  return home.startingXI.length > 0 && away.startingXI.length > 0 ? { home, away } : null;
}

export async function getStoredMatchDetails(match) {
  if (!match?.id) {
    return {
      events: [],
      stats: null,
      lineup: null,
      fetchedAt: null,
      lastAttemptedAt: null,
      providerError: null,
      coverage: {},
    };
  }

  const [cachedResult, legacyEventsResult, legacyLineupResult] = await Promise.all([
    pool.query(
      `SELECT events, statistics, lineups, fetched_at, last_attempted_at, provider_error, coverage
       FROM match_detail_data
       WHERE match_id = $1
       LIMIT 1`,
      [match.id]
    ),
    pool.query(
      `SELECT
         me.match_minute,
         me.event_type,
         me.detail,
         CONCAT_WS(' ', p.first_name, NULLIF(BTRIM(p.last_name), '')) AS player_name,
         t.name AS team_name
       FROM match_event me
       LEFT JOIN player p ON p.player_id = me.player_id
       LEFT JOIN team t ON t.team_id = p.team_id
       WHERE me.match_id = $1
       ORDER BY me.match_minute ASC, me.event_id ASC`,
      [match.id]
    ),
    pool.query(
      `SELECT
         ml.player_id,
         ml.team_id,
         ml.is_starter,
         CONCAT_WS(' ', p.first_name, NULLIF(BTRIM(p.last_name), '')) AS player_name,
         p.primary_position
       FROM match_lineup ml
       JOIN player p ON p.player_id = ml.player_id
       WHERE ml.match_id = $1
       ORDER BY ml.team_id, ml.is_starter DESC, p.primary_position, p.last_name, p.first_name`,
      [match.id]
    ),
  ]);

  const cached = cachedResult.rows[0];
  const possession = match.homePossession !== null || match.awayPossession !== null
    ? { possession: [match.homePossession, match.awayPossession] }
    : null;
  const ratings = match.homeRating !== null || match.awayRating !== null
    ? { ratings: [match.homeRating, match.awayRating] }
    : null;
  const storedStats = { ...(possession || {}), ...(ratings || {}), ...(cached?.statistics || {}) };

  return {
    events: Array.isArray(cached?.events) && cached.events.length > 0
      ? cached.events
      : legacyEventsResult.rows.map(normalizeStoredEvent),
    stats: Object.keys(storedStats).length > 0 ? storedStats : null,
    lineup: cached?.lineups || buildLegacyLineup(legacyLineupResult.rows, match),
    fetchedAt: cached?.fetched_at || null,
    lastAttemptedAt: cached?.last_attempted_at || cached?.fetched_at || null,
    providerError: cached?.provider_error || null,
    coverage: cached?.coverage || {},
  };
}

export async function saveMatchDetails(matchId, {
  events,
  stats,
  lineup,
  providerStatus = null,
  playerRatingsChecked = false,
}) {
  if (!matchId) return;

  const normalizedEvents = Array.isArray(events) ? events : [];
  const coverage = {
    checked: true,
    unsupported: false,
    providerStatus: providerStatus || null,
    events: normalizedEvents.length > 0,
    statistics: Boolean(stats),
    lineups: Boolean(lineup),
    playerRatings: lineupHasPlayerRatings(lineup),
    playerRatingsChecked: Boolean(playerRatingsChecked),
  };

  await pool.query(
    `INSERT INTO match_detail_data (
       match_id, events, statistics, lineups, fetched_at,
       last_attempted_at, provider_error, coverage
     )
     VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, NOW(), NOW(), NULL, $5::jsonb)
     ON CONFLICT (match_id) DO UPDATE SET
       events = CASE
         WHEN jsonb_array_length(EXCLUDED.events) > 0 THEN EXCLUDED.events
         ELSE match_detail_data.events
       END,
       statistics = COALESCE(EXCLUDED.statistics, match_detail_data.statistics),
       lineups = COALESCE(EXCLUDED.lineups, match_detail_data.lineups),
       fetched_at = NOW(),
       last_attempted_at = NOW(),
       provider_error = NULL,
       coverage = (match_detail_data.coverage || EXCLUDED.coverage) || jsonb_build_object(
         'events', jsonb_array_length(
           CASE
             WHEN jsonb_array_length(EXCLUDED.events) > 0 THEN EXCLUDED.events
             ELSE match_detail_data.events
           END
         ) > 0,
         'statistics', COALESCE(EXCLUDED.statistics, match_detail_data.statistics) IS NOT NULL,
         'lineups', COALESCE(EXCLUDED.lineups, match_detail_data.lineups) IS NOT NULL
       )`,
    [
      matchId,
      JSON.stringify(normalizedEvents),
      stats ? JSON.stringify(stats) : null,
      lineup ? JSON.stringify(lineup) : null,
      JSON.stringify(coverage),
    ]
  );
}

export async function recordMatchDetailAttempt(matchId, error) {
  if (!matchId) return;

  await pool.query(
    `INSERT INTO match_detail_data (
       match_id, events, statistics, lineups, fetched_at,
       last_attempted_at, provider_error, coverage
     )
     VALUES ($1, '[]'::jsonb, NULL, NULL, NULL, NOW(), $2, '{}'::jsonb)
     ON CONFLICT (match_id) DO UPDATE SET
       last_attempted_at = NOW(),
       provider_error = EXCLUDED.provider_error`,
    [matchId, String(error || "Provider lookup failed").slice(0, 500)]
  );
}

export function shouldRefreshMatchDetails(match, storedDetails, forceRefresh = false) {
  if (forceRefresh || !match?.id) return Boolean(match?.id);

  const status = String(match.status || "").toUpperCase();
  const isLive = ["LIVE", "1H", "2H", "HT", "ET", "BT", "P", "IN_PLAY"].includes(status);
  const isUpcoming = ["NS", "TBD", "TIMED", "UPCOMING", "PST"].includes(status);
  const lastAttempt = storedDetails?.lastAttemptedAt
    ? new Date(storedDetails.lastAttemptedAt).getTime()
    : 0;
  const lastSuccess = storedDetails?.fetchedAt
    ? new Date(storedDetails.fetchedAt).getTime()
    : 0;
  const now = Date.now();

  if (isLive) return now - lastAttempt >= 20_000;

  if (isUpcoming) {
    const kickoff = match.matchDate ? new Date(match.matchDate).getTime() : Number.NaN;
    const untilKickoff = Number.isFinite(kickoff) ? kickoff - now : Number.POSITIVE_INFINITY;
    const interval = untilKickoff <= 2 * 60 * 60 * 1000
      ? 15 * 60 * 1000
      : 6 * 60 * 60 * 1000;
    return now - lastAttempt >= interval;
  }

  if (FINISHED_STATUSES.includes(status)) {
    const needsPlayerRatingLookup = Boolean(storedDetails?.lineup) &&
      storedDetails?.coverage?.playerRatingsChecked !== true;
    if (needsPlayerRatingLookup && now - lastAttempt >= 5 * 60 * 1000) {
      return true;
    }

    const successfulFinishedLookup = FINISHED_STATUSES.includes(
      String(storedDetails?.coverage?.providerStatus || "").toUpperCase()
    );
    const kickoff = match.matchDate ? new Date(match.matchDate).getTime() : Number.NaN;
    const expectedFinalDataAt = Number.isFinite(kickoff)
      ? kickoff + 3 * 60 * 60 * 1000
      : 0;
    if (successfulFinishedLookup && lastSuccess >= expectedFinalDataAt && lastSuccess > 0) {
      return false;
    }

    return now - lastAttempt >= 6 * 60 * 60 * 1000;
  }

  return !lastSuccess && now - lastAttempt >= 6 * 60 * 60 * 1000;
}

function lineupHasPlayerRatings(lineup) {
  const players = [
    ...(lineup?.home?.startingXI || []),
    ...(lineup?.home?.substitutes || []),
    ...(lineup?.away?.startingXI || []),
    ...(lineup?.away?.substitutes || []),
  ];

  return players.some((player) =>
    player?.rating !== null &&
    player?.rating !== undefined &&
    player?.rating !== "" &&
    Number.isFinite(Number(player.rating))
  );
}

export async function getHeadToHead(match, limit = 10) {
  if (!match?.homeTeamId || !match?.awayTeamId) return [];

  const result = await pool.query(
    `SELECT
       m.match_id AS id,
       m.match_date AS "matchDate",
       m.status,
       m.home_score AS "homeScore",
       m.away_score AS "awayScore",
       m.home_team_id AS "homeTeamId",
       m.away_team_id AS "awayTeamId",
       ht.name AS "homeTeam",
       ht.logo_url AS "homeLogo",
       at.name AS "awayTeam",
       at.logo_url AS "awayLogo",
       l.name AS league
     FROM match m
     JOIN team ht ON ht.team_id = m.home_team_id
     JOIN team at ON at.team_id = m.away_team_id
     JOIN season s ON s.season_id = m.season_id
     JOIN league l ON l.league_id = s.league_id
     WHERE m.status = ANY($3::text[])
       AND m.match_id <> $4
       AND (
         (m.home_team_id = $1 AND m.away_team_id = $2)
         OR (m.home_team_id = $2 AND m.away_team_id = $1)
       )
     ORDER BY m.match_date DESC, m.match_id DESC
     LIMIT $5`,
    [match.homeTeamId, match.awayTeamId, FINISHED_STATUSES, match.id, limit]
  );

  return result.rows;
}
