import pool from "@/app/lib/db";

const MISSING_SQUAD_TABLE = "42P01";

export function normalizeSquadPosition(position) {
  const value = String(position || "").trim().toLowerCase();

  if (value.includes("goalkeeper") || value === "keeper") return "Goalkeeper";
  if (value.includes("defender") || value === "defence" || value === "defense") return "Defender";
  if (value.includes("midfielder") || value === "midfield") return "Midfielder";
  if (value.includes("forward") || value.includes("attacker") || value === "attack") return "Forward";
  return position ? String(position).trim() : "Unknown";
}

export async function ensureTeamSquadSchema(queryable = pool) {
  await queryable.query(`
    CREATE TABLE IF NOT EXISTS team_squad_sync (
      team_id INT PRIMARY KEY REFERENCES team(team_id) ON DELETE CASCADE,
      status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'error')),
      player_count INT NOT NULL DEFAULT 0 CHECK (player_count >= 0),
      failure_count INT NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
      attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      synced_at TIMESTAMPTZ,
      provider_error TEXT
    )
  `);
  await queryable.query(`ALTER TABLE team_squad_sync ADD COLUMN IF NOT EXISTS failure_count INT NOT NULL DEFAULT 0`);
  await queryable.query(`
    CREATE TABLE IF NOT EXISTS team_squad_member (
      team_id INT NOT NULL REFERENCES team(team_id) ON DELETE CASCADE,
      player_id INT NOT NULL REFERENCES player(player_id) ON DELETE CASCADE,
      shirt_number INT,
      position VARCHAR(50),
      source VARCHAR(50) NOT NULL DEFAULT 'api-football-squads',
      is_current BOOLEAN NOT NULL DEFAULT TRUE,
      synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (team_id, player_id)
    )
  `);
  await queryable.query(`CREATE INDEX IF NOT EXISTS idx_team_squad_member_current ON team_squad_member(team_id, is_current)`);
  await queryable.query(`CREATE INDEX IF NOT EXISTS idx_team_squad_sync_status_synced ON team_squad_sync(status, synced_at)`);
}

async function getStoredTeamPlayers(teamId, queryable) {
  const { rows } = await queryable.query(
    `SELECT
       p.player_id AS id,
       CONCAT_WS(' ', NULLIF(BTRIM(p.first_name), ''), NULLIF(BTRIM(p.last_name), '')) AS name,
       p.first_name,
       p.last_name,
       COALESCE(NULLIF(BTRIM(p.primary_position), ''), 'Unknown') AS position,
       p.nationality,
       p.date_of_birth,
       p.photo_url AS photo,
       NULL::int AS number,
       LOWER(REPLACE(CONCAT_WS(' ', NULLIF(BTRIM(p.first_name), ''), NULLIF(BTRIM(p.last_name), '')), ' ', '-')) AS slug
     FROM player p
     WHERE p.team_id = $1
     ORDER BY
       CASE p.primary_position
         WHEN 'Goalkeeper' THEN 1
         WHEN 'Defender' THEN 2
         WHEN 'Midfielder' THEN 3
         WHEN 'Forward' THEN 4
         WHEN 'Attacker' THEN 4
         ELSE 5
       END,
       p.last_name ASC,
       p.first_name ASC`,
    [teamId]
  );

  return rows.map((player) => ({
    ...player,
    position: normalizeSquadPosition(player.position),
  }));
}

async function getProvisionalSquad(teamId, queryable, sync = null) {
  const players = await getStoredTeamPlayers(teamId, queryable);
  return {
    players,
    meta: {
      status: players.length > 0 ? "provisional" : "not_synced",
      playerCount: players.length,
      syncedAt: null,
      attemptedAt: sync?.attempted_at?.toISOString?.() || sync?.attempted_at || null,
      error: sync?.provider_error || null,
      source: players.length > 0 ? "Stored roster awaiting verification" : null,
    },
  };
}

export async function getTeamSquad(teamId, queryable = pool) {
  try {
    const { rows: syncRows } = await queryable.query(
      `SELECT status, player_count, synced_at, attempted_at, provider_error
       FROM team_squad_sync
       WHERE team_id = $1
       LIMIT 1`,
      [teamId]
    );

    const sync = syncRows[0];
    if (!sync || !sync.synced_at) {
      return getProvisionalSquad(teamId, queryable, sync);
    }

    const { rows } = await queryable.query(
      `SELECT
         p.player_id AS id,
         CONCAT_WS(' ', NULLIF(BTRIM(p.first_name), ''), NULLIF(BTRIM(p.last_name), '')) AS name,
         p.first_name,
         p.last_name,
         COALESCE(NULLIF(BTRIM(tsm.position), ''), p.primary_position, 'Unknown') AS position,
         p.nationality,
         p.date_of_birth,
         p.photo_url AS photo,
         tsm.shirt_number AS number,
         LOWER(REPLACE(CONCAT_WS(' ', NULLIF(BTRIM(p.first_name), ''), NULLIF(BTRIM(p.last_name), '')), ' ', '-')) AS slug
       FROM team_squad_member tsm
       JOIN player p ON p.player_id = tsm.player_id
       WHERE tsm.team_id = $1 AND tsm.is_current = TRUE
       ORDER BY
         CASE COALESCE(NULLIF(BTRIM(tsm.position), ''), p.primary_position)
           WHEN 'Goalkeeper' THEN 1
           WHEN 'Defender' THEN 2
           WHEN 'Midfielder' THEN 3
           WHEN 'Forward' THEN 4
           ELSE 5
         END,
         tsm.shirt_number ASC NULLS LAST,
         p.last_name ASC,
         p.first_name ASC`,
      [teamId]
    );

    return {
      players: rows.map((player) => ({
        ...player,
        position: normalizeSquadPosition(player.position),
      })),
      meta: {
        status: "success",
        playerCount: rows.length,
        syncedAt: sync.synced_at?.toISOString?.() || sync.synced_at || null,
        attemptedAt: sync.attempted_at?.toISOString?.() || sync.attempted_at || null,
        error: null,
        source: "API-Football current squad",
      },
    };
  } catch (error) {
    if (error?.code === MISSING_SQUAD_TABLE) {
      return getProvisionalSquad(teamId, queryable);
    }

    throw error;
  }
}
