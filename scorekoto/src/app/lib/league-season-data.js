import "server-only";

import pool from "./db";

const COMPLETED_STATUSES = ["FT", "AET", "PEN"];
let playerSeasonSchemaPromise;

export function ensurePlayerSeasonStatsSchema() {
  if (!playerSeasonSchemaPromise) {
    playerSeasonSchemaPromise = pool.query(
      `ALTER TABLE player_season_stats
       ADD COLUMN IF NOT EXISTS team_id INTEGER
       REFERENCES team(team_id) ON DELETE SET NULL`
    );
  }

  return playerSeasonSchemaPromise;
}

function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateOnly(value, fallback = null) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString().slice(0, 10);
}

function statisticSignature(statistics) {
  return [
    numberOrZero(statistics.games?.appearences),
    numberOrZero(statistics.games?.lineups),
    numberOrZero(statistics.games?.minutes),
    numberOrZero(statistics.goals?.total),
    numberOrZero(statistics.goals?.assists),
    numberOrZero(statistics.cards?.yellow),
    numberOrZero(statistics.cards?.red),
  ].join(":");
}

async function fetchFootballData(path, revalidate) {
  const apiKey = process.env.API_SPORTS_KEY;
  if (!apiKey) return null;

  const response = await fetch(`https://v3.football.api-sports.io/${path}`, {
    headers: {
      "x-apisports-key": apiKey,
      Accept: "application/json",
    },
    next: { revalidate },
  });

  if (!response.ok) return null;

  const data = await response.json();
  return Array.isArray(data.response) ? data.response : [];
}

async function storeStandings(seasonId, standings) {
  await Promise.all(
    standings.map(async (entry) => {
      await pool.query(
        `INSERT INTO team (team_id, name, logo_url)
         VALUES ($1, $2, $3)
         ON CONFLICT (team_id) DO UPDATE SET
           name = EXCLUDED.name,
           logo_url = COALESCE(EXCLUDED.logo_url, team.logo_url)`,
        [entry.teamId, entry.team, entry.logo]
      );

      await pool.query(
        `INSERT INTO team_season_stats (
           team_id, season_id, wins, losses, draws,
           goals_for, goals_against, points, matches_played
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (team_id, season_id) DO UPDATE SET
           wins = EXCLUDED.wins,
           losses = EXCLUDED.losses,
           draws = EXCLUDED.draws,
           goals_for = EXCLUDED.goals_for,
           goals_against = EXCLUDED.goals_against,
           points = EXCLUDED.points,
           matches_played = EXCLUDED.matches_played`,
        [
          entry.teamId,
          seasonId,
          entry.wins,
          entry.losses,
          entry.draws,
          entry.goalsFor,
          entry.goalsAgainst,
          entry.points,
          entry.played,
        ]
      );
    })
  );
}

export async function fetchLeagueStandings(leagueId, seasonId, seasonYear) {
  if (!leagueId || !seasonId || !seasonYear) return [];

  try {
    const response = await fetchFootballData(
      `standings?league=${leagueId}&season=${seasonYear}`,
      60 * 60
    );
    const groups = response?.[0]?.league?.standings;
    if (!Array.isArray(groups)) return [];

    const standings = groups
      .flat()
      .filter((entry) => entry?.team?.id && entry?.team?.name)
      .map((entry) => {
        const goalsFor = numberOrZero(entry.all?.goals?.for);
        const goalsAgainst = numberOrZero(entry.all?.goals?.against);

        return {
          teamId: Number(entry.team.id),
          team: entry.team.name,
          logo: entry.team.logo || null,
          played: numberOrZero(entry.all?.played),
          wins: numberOrZero(entry.all?.win),
          draws: numberOrZero(entry.all?.draw),
          losses: numberOrZero(entry.all?.lose),
          goalsFor,
          goalsAgainst,
          goalDifference: numberOrZero(entry.goalsDiff) || goalsFor - goalsAgainst,
          points: numberOrZero(entry.points),
          apiPosition: numberOrZero(entry.rank),
          group: entry.group || null,
        };
      });

    if (standings.length > 0) {
      await storeStandings(seasonId, standings);
    }

    return standings;
  } catch (error) {
    console.warn(
      `Could not refresh standings for league ${leagueId}, season ${seasonYear}:`,
      error instanceof Error ? error.message : error
    );
    return [];
  }
}

export async function calculateStandingsFromMatches(seasonId) {
  if (!seasonId) return [];

  const { rows } = await pool.query(
    `WITH team_results AS (
       SELECT
         home_team_id AS team_id,
         CASE WHEN home_score > away_score THEN 1 ELSE 0 END AS wins,
         CASE WHEN home_score = away_score THEN 1 ELSE 0 END AS draws,
         CASE WHEN home_score < away_score THEN 1 ELSE 0 END AS losses,
         home_score AS goals_for,
         away_score AS goals_against
       FROM match
       WHERE season_id = $1
         AND status = ANY($2::text[])
         AND home_score IS NOT NULL
         AND away_score IS NOT NULL

       UNION ALL

       SELECT
         away_team_id AS team_id,
         CASE WHEN away_score > home_score THEN 1 ELSE 0 END AS wins,
         CASE WHEN away_score = home_score THEN 1 ELSE 0 END AS draws,
         CASE WHEN away_score < home_score THEN 1 ELSE 0 END AS losses,
         away_score AS goals_for,
         home_score AS goals_against
       FROM match
       WHERE season_id = $1
         AND status = ANY($2::text[])
         AND home_score IS NOT NULL
         AND away_score IS NOT NULL
     )
     SELECT
       t.name AS team,
       t.logo_url AS logo,
       COUNT(*)::int AS played,
       SUM(tr.wins)::int AS wins,
       SUM(tr.draws)::int AS draws,
       SUM(tr.losses)::int AS losses,
       SUM(tr.goals_for)::int AS "goalsFor",
       SUM(tr.goals_against)::int AS "goalsAgainst",
       (SUM(tr.goals_for) - SUM(tr.goals_against))::int AS "goalDifference",
       (SUM(tr.wins) * 3 + SUM(tr.draws))::int AS points
     FROM team_results tr
     JOIN team t ON t.team_id = tr.team_id
     GROUP BY tr.team_id, t.name, t.logo_url
     ORDER BY points DESC, "goalDifference" DESC, "goalsFor" DESC, t.name ASC`,
    [seasonId, COMPLETED_STATUSES]
  );

  return rows;
}

async function storeTopScorers(seasonId, scorers) {
  await ensurePlayerSeasonStatsSchema();

  await Promise.all(
    scorers.map(async (scorer) => {
      if (scorer.teamId) {
        await pool.query(
          `INSERT INTO team (team_id, name, logo_url)
           VALUES ($1, $2, $3)
           ON CONFLICT (team_id) DO UPDATE SET
             name = EXCLUDED.name,
             logo_url = COALESCE(EXCLUDED.logo_url, team.logo_url)`,
          [scorer.teamId, scorer.team, scorer.teamLogo]
        );
      }

      await pool.query(
        `INSERT INTO player (
           player_id, team_id, first_name, last_name, primary_position,
           nationality, date_of_birth, photo_url
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (player_id) DO UPDATE SET
           team_id = COALESCE(player.team_id, EXCLUDED.team_id),
           first_name = COALESCE(EXCLUDED.first_name, player.first_name),
           last_name = COALESCE(EXCLUDED.last_name, player.last_name),
           primary_position = COALESCE(EXCLUDED.primary_position, player.primary_position),
           nationality = COALESCE(EXCLUDED.nationality, player.nationality),
           date_of_birth = COALESCE(EXCLUDED.date_of_birth, player.date_of_birth),
           photo_url = COALESCE(EXCLUDED.photo_url, player.photo_url)`,
        [
          scorer.playerId,
          scorer.teamId,
          scorer.firstName,
          scorer.lastName,
          scorer.position,
          scorer.nationality,
          scorer.birthDate,
          scorer.photo,
        ]
      );

      await pool.query(
        `INSERT INTO player_season_stats (
           player_id, season_id, team_id, appearances, minutes_played,
           goals, assists, yellow_cards, red_cards
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (player_id, season_id) DO UPDATE SET
           team_id = EXCLUDED.team_id,
           appearances = EXCLUDED.appearances,
           minutes_played = EXCLUDED.minutes_played,
           goals = EXCLUDED.goals,
           assists = EXCLUDED.assists,
           yellow_cards = EXCLUDED.yellow_cards,
           red_cards = EXCLUDED.red_cards`,
        [
          scorer.playerId,
          seasonId,
          scorer.teamId,
          scorer.appearances,
          scorer.minutes,
          scorer.goals,
          scorer.assists,
          scorer.yellowCards,
          scorer.redCards,
        ]
      );
    })
  );
}

function buildScorer(player, statistics) {
  if (!player?.id || !statistics) return null;

  const firstName = player.firstname?.trim() || player.name?.trim();
  if (!firstName) return null;

  return {
    playerId: Number(player.id),
    player: player.name?.trim() || `${firstName} ${player.lastname || ""}`.trim(),
    firstName,
    lastName: player.lastname?.trim() || "",
    nationality: player.nationality || null,
    birthDate: player.birth?.date || null,
    photo: player.photo || null,
    teamId: statistics.team?.id ? Number(statistics.team.id) : null,
    team: statistics.team?.name || "Unassigned",
    teamLogo: statistics.team?.logo || null,
    position: statistics.games?.position || null,
    appearances: numberOrZero(statistics.games?.appearences),
    minutes: numberOrZero(statistics.games?.minutes),
    goals: numberOrZero(statistics.goals?.total),
    assists: numberOrZero(statistics.goals?.assists),
    yellowCards: numberOrZero(statistics.cards?.yellow),
    redCards: numberOrZero(statistics.cards?.red),
  };
}

async function getHistoricalTeamId(playerId, seasonEndDate) {
  const response = await fetchFootballData(
    `transfers?player=${playerId}`,
    7 * 24 * 60 * 60
  );
  const transfers = Array.isArray(response?.[0]?.transfers)
    ? [...response[0].transfers]
    : [];
  const referenceDate = dateOnly(seasonEndDate);

  if (!referenceDate || transfers.length === 0) return null;

  transfers.sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));

  const nextTransfer = transfers.find((transfer) =>
    transfer.date && transfer.date > referenceDate
  );
  if (nextTransfer?.teams?.out?.id) {
    return Number(nextTransfer.teams.out.id);
  }

  const latestTransfer = [...transfers]
    .reverse()
    .find((transfer) => transfer.date && transfer.date <= referenceDate);

  return latestTransfer?.teams?.in?.id
    ? Number(latestTransfer.teams.in.id)
    : null;
}

async function correctSuspiciousScorer(
  item,
  leagueId,
  seasonYear,
  seasonEndDate
) {
  const player = item?.player;
  if (!player?.id) return null;

  const detailResponse = await fetchFootballData(
    `players?id=${player.id}&season=${seasonYear}`,
    7 * 24 * 60 * 60
  );
  const leagueStatistics = (detailResponse?.[0]?.statistics || []).filter(
    (statistics) => Number(statistics?.league?.id) === Number(leagueId)
  );
  if (leagueStatistics.length === 0) return null;

  const uniqueStatistics = [];
  const seenSignatures = new Set();
  for (const statistics of leagueStatistics) {
    const signature = statisticSignature(statistics);
    if (!seenSignatures.has(signature)) {
      seenSignatures.add(signature);
      uniqueStatistics.push(statistics);
    }
  }

  if (uniqueStatistics.length === 1 && leagueStatistics.length === 1) {
    return buildScorer(detailResponse[0].player || player, uniqueStatistics[0]);
  }

  const historicalTeamId = await getHistoricalTeamId(player.id, seasonEndDate);
  const historicalStatistic = historicalTeamId
    ? leagueStatistics.find(
        (statistics) => Number(statistics?.team?.id) === historicalTeamId
      )
    : null;

  if (historicalStatistic) {
    return buildScorer(detailResponse[0].player || player, historicalStatistic);
  }

  if (uniqueStatistics.length === 1) {
    return buildScorer(detailResponse[0].player || player, uniqueStatistics[0]);
  }

  return null;
}

export async function fetchLeagueTopScorers(
  leagueId,
  seasonId,
  seasonYear,
  { maxAppearances = null, seasonEndDate = null } = {}
) {
  if (!leagueId || !seasonId || !seasonYear) return [];

  try {
    const response = await fetchFootballData(
      `players/topscorers?league=${leagueId}&season=${seasonYear}`,
      24 * 60 * 60
    );
    if (!Array.isArray(response)) return [];

    const rawGoalTotals = response
      .map((item) => numberOrZero(item?.statistics?.[0]?.goals?.total))
      .filter((goals) => goals > 0);
    const rawGoalCutoff = rawGoalTotals.length > 0
      ? Math.min(...rawGoalTotals)
      : 0;
    const invalidPlayerIds = [];

    const scorerCandidates = await Promise.all(
      response.map(async (item) => {
        const player = item?.player;
        const statistics = Array.isArray(item?.statistics)
          ? item.statistics.find((entry) => Number(entry?.league?.id) === Number(leagueId)) ||
            item.statistics[0]
          : null;

        const scorer = buildScorer(player, statistics);
        if (!scorer) return null;

        const seasonLimit = numberOrZero(maxAppearances);
        const hasImpossibleTotals =
          seasonLimit > 0 &&
          (scorer.appearances > seasonLimit ||
            scorer.minutes > seasonLimit * 130);

        if (!hasImpossibleTotals) return scorer;

        const correctedScorer = await correctSuspiciousScorer(
          item,
          leagueId,
          seasonYear,
          seasonEndDate
        );

        if (!correctedScorer) {
          invalidPlayerIds.push(scorer.playerId);
        }

        return correctedScorer;
      })
    );

    const correctedScorers = scorerCandidates
      .filter((scorer) => scorer && scorer.goals > 0)
      .sort((a, b) => b.goals - a.goals || b.assists - a.assists);

    if (correctedScorers.length > 0) {
      await storeTopScorers(seasonId, correctedScorers);
    }

    if (invalidPlayerIds.length > 0) {
      await pool.query(
        `DELETE FROM player_season_stats
         WHERE season_id = $1
           AND player_id = ANY($2::int[])`,
        [seasonId, invalidPlayerIds]
      );
    }

    return correctedScorers.filter((scorer) => scorer.goals >= rawGoalCutoff);
  } catch (error) {
    console.warn(
      `Could not refresh top scorers for league ${leagueId}, season ${seasonYear}:`,
      error instanceof Error ? error.message : error
    );
    return [];
  }
}
