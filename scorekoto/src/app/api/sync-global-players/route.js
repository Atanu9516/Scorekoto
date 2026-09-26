import { NextResponse } from 'next/server';
import pool from '../../lib/db';
import { ensureTeamSquadSchema, normalizeSquadPosition } from '../../lib/team-squad';

// API-Football's senior international tournaments and qualification series.
// Keeping these separate prevents a national-team snapshot from replacing a
// player's club on the legacy player profile record.
const INTERNATIONAL_LEAGUE_IDS = [1, 4, 5, 6, 7, 8, 9, 10, 19, 21, 22, 23, 28, 29, 30, 31, 32, 33, 34];
const DEFAULT_BATCH_SIZE = 3;
const MAX_BATCH_SIZE = 10;
const REFRESH_AFTER_DAYS = 7;

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function providerErrorMessage(errors) {
  if (!errors) return null;
  if (typeof errors === 'string') return errors;
  if (Array.isArray(errors)) return errors.filter(Boolean).join('; ') || null;
  if (typeof errors === 'object' && Object.keys(errors).length > 0) {
    return Object.entries(errors)
      .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
      .join('; ');
  }
  return null;
}

function isQuotaError(message, status) {
  return status === 429 || /rate|request limit|requests.*limit|quota|too many/i.test(message || '');
}

async function recordSyncError(teamId, message) {
  await pool.query(
    `INSERT INTO team_squad_sync
       (team_id, status, player_count, failure_count, attempted_at, provider_error)
     VALUES ($1, 'error', 0, 1, NOW(), $2)
     ON CONFLICT (team_id) DO UPDATE SET
       status = 'error',
       failure_count = team_squad_sync.failure_count + 1,
       attempted_at = NOW(),
       provider_error = EXCLUDED.provider_error`,
    [teamId, String(message || 'Unknown provider error').slice(0, 2000)]
  );
}

async function isNationalTeam(teamId) {
  const { rows: [classification] } = await pool.query(
    `SELECT
       COALESCE(BOOL_OR(s.league_id = ANY($2::int[])), false) AS has_international,
       COALESCE(BOOL_OR(NOT (s.league_id = ANY($2::int[]))), false) AS has_club
     FROM match m
     JOIN season s ON s.season_id = m.season_id
     WHERE m.home_team_id = $1 OR m.away_team_id = $1`,
    [teamId, INTERNATIONAL_LEAGUE_IDS]
  );

  return classification.has_international && !classification.has_club;
}

async function storeSquadSnapshot(teamId, players, nationalTeam) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM team_squad_member WHERE team_id = $1', [teamId]);

    let stored = 0;
    const uniquePlayers = new Map();
    for (const player of players) {
      if (Number.isInteger(Number(player?.id)) && String(player?.name || '').trim()) {
        uniquePlayers.set(Number(player.id), player);
      }
    }

    for (const player of uniquePlayers.values()) {
      const playerId = Number(player.id);
      const name = String(player.name).trim();
      const position = normalizeSquadPosition(player.position);
      const shirtNumber = player.number != null && Number.isInteger(Number(player.number))
        ? Number(player.number)
        : null;

      await client.query(
        `INSERT INTO player
           (player_id, team_id, first_name, last_name, primary_position, market_value_euros, weight_cm, date_of_birth, nationality, photo_url)
         VALUES ($1, $2, $3, '', $4, NULL, NULL, NULL, NULL, $5)
         ON CONFLICT (player_id) DO UPDATE SET
           team_id = CASE
             WHEN $6::boolean AND player.team_id IS NOT NULL THEN player.team_id
             ELSE EXCLUDED.team_id
           END,
           first_name = COALESCE(NULLIF(BTRIM(player.first_name), ''), EXCLUDED.first_name),
           primary_position = COALESCE(EXCLUDED.primary_position, player.primary_position),
           photo_url = COALESCE(EXCLUDED.photo_url, player.photo_url)`,
        [playerId, teamId, name, position, player.photo || null, nationalTeam]
      );

      await client.query(
        `INSERT INTO team_squad_member
           (team_id, player_id, shirt_number, position, source, is_current, synced_at)
         VALUES ($1, $2, $3, $4, 'api-football-squads', TRUE, NOW())`,
        [teamId, playerId, shirtNumber, position]
      );
      stored += 1;
    }

    await client.query(
      `INSERT INTO team_squad_sync
         (team_id, status, player_count, failure_count, attempted_at, synced_at, provider_error)
       VALUES ($1, 'success', $2, 0, NOW(), NOW(), NULL)
       ON CONFLICT (team_id) DO UPDATE SET
         status = 'success',
         player_count = EXCLUDED.player_count,
         failure_count = 0,
         attempted_at = NOW(),
         synced_at = NOW(),
         provider_error = NULL`,
      [teamId, stored]
    );

    await client.query('COMMIT');
    return stored;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function GET(request) {
  try {
    if (!process.env.API_SPORTS_KEY) {
      return NextResponse.json({ success: false, error: 'API_SPORTS_KEY is not configured' }, { status: 500 });
    }

    await ensureTeamSquadSchema();

    const requestedLimit = Number(new URL(request.url).searchParams.get('limit'));
    const batchSize = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), MAX_BATCH_SIZE)
      : DEFAULT_BATCH_SIZE;

    const { rows: pendingTeams } = await pool.query(
      `WITH latest_matches AS (
         SELECT team_id, MAX(match_date) AS latest_match
         FROM (
           SELECT home_team_id AS team_id, match_date FROM match
           UNION ALL
           SELECT away_team_id AS team_id, match_date FROM match
         ) appearances
         GROUP BY team_id
       )
       SELECT t.team_id, t.name
       FROM team t
       LEFT JOIN team_squad_sync sync ON sync.team_id = t.team_id
       LEFT JOIN latest_matches latest ON latest.team_id = t.team_id
       WHERE sync.team_id IS NULL
          OR (sync.status = 'success' AND sync.synced_at < NOW() - ($2 * INTERVAL '1 day'))
          OR (sync.status = 'error'
              AND (sync.synced_at IS NOT NULL OR sync.failure_count < 3)
              AND sync.attempted_at < NOW() - INTERVAL '1 day')
       ORDER BY
         CASE WHEN sync.team_id IS NULL THEN 0 WHEN sync.status = 'error' THEN 1 ELSE 2 END,
         latest.latest_match DESC NULLS LAST,
         t.name ASC
       LIMIT $1`,
      [batchSize, REFRESH_AFTER_DAYS]
    );

    if (pendingTeams.length === 0) {
      return NextResponse.json({ success: true, message: 'All eligible team squads are synchronized.', playersSynced: 0, teamsSynced: 0, remainingInQueue: 0 });
    }

    let playersSynced = 0;
    let teamsSynced = 0;
    const errors = [];

    for (const team of pendingTeams) {
      let response;
      let data;
      try {
        response = await fetch(`https://v3.football.api-sports.io/players/squads?team=${team.team_id}`, {
          method: 'GET',
          headers: { 'x-apisports-key': process.env.API_SPORTS_KEY },
          cache: 'no-store',
        });
        data = await response.json();
      } catch (error) {
        const message = `Unable to reach squad provider: ${error.message}`;
        await recordSyncError(team.team_id, message);
        errors.push({ teamId: team.team_id, team: team.name, error: message });
        continue;
      }

      const apiError = providerErrorMessage(data?.errors);
      if (!response.ok || apiError) {
        const message = apiError || `API HTTP ${response.status}`;
        if (isQuotaError(message, response.status)) {
          return NextResponse.json({
            success: false,
            status: 'quota_exhausted',
            message,
            playersSynced,
            teamsSynced,
            errors,
          }, { status: 429 });
        }

        await recordSyncError(team.team_id, message);
        errors.push({ teamId: team.team_id, team: team.name, error: message });
        continue;
      }

      const squad = (data.response || []).find((entry) => Number(entry?.team?.id) === Number(team.team_id));
      const players = Array.isArray(squad?.players) ? squad.players : [];
      if (!squad || players.length === 0) {
        const message = 'Provider returned no current squad for this team ID.';
        await recordSyncError(team.team_id, message);
        errors.push({ teamId: team.team_id, team: team.name, error: message });
        continue;
      }

      const nationalTeam = await isNationalTeam(team.team_id);
      const stored = await storeSquadSnapshot(team.team_id, players, nationalTeam);
      playersSynced += stored;
      teamsSynced += 1;
      await wait(350);
    }

    const { rows: [{ remaining }] } = await pool.query(
      `SELECT COUNT(*)::int AS remaining
       FROM team t
       LEFT JOIN team_squad_sync sync ON sync.team_id = t.team_id
       WHERE sync.team_id IS NULL
          OR (sync.status = 'success' AND sync.synced_at < NOW() - ($1 * INTERVAL '1 day'))
          OR (sync.status = 'error'
              AND (sync.synced_at IS NOT NULL OR sync.failure_count < 3)
              AND sync.attempted_at < NOW() - INTERVAL '1 day')`,
      [REFRESH_AFTER_DAYS]
    );

    return NextResponse.json({
      success: true,
      message: errors.length > 0 ? 'Batch completed with provider errors.' : 'Squad batch completed successfully.',
      playersSynced,
      teamsSynced,
      remainingInQueue: remaining,
      errors,
    });
  } catch (error) {
    console.error('Squad sync error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
