import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) throw new Error('DATABASE_URL is required');

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
});

try {
  const [summary, rosterSizes, latestStatConflicts, processedSyncs, duplicateAssignments] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*)::int AS teams,
        COUNT(*) FILTER (WHERE player_count = 0)::int AS teams_without_players,
        COUNT(*) FILTER (WHERE player_count BETWEEN 1 AND 14)::int AS teams_with_tiny_squads,
        COUNT(*) FILTER (WHERE player_count BETWEEN 15 AND 40)::int AS teams_with_plausible_squads,
        COUNT(*) FILTER (WHERE player_count > 40)::int AS teams_with_oversized_squads,
        MIN(player_count)::int AS smallest_squad,
        MAX(player_count)::int AS largest_squad,
        ROUND(AVG(player_count), 2) AS average_squad
      FROM (
        SELECT t.team_id, COUNT(p.player_id)::int AS player_count
        FROM team t
        LEFT JOIN player p ON p.team_id = t.team_id
        GROUP BY t.team_id
      ) counts
    `),
    pool.query(`
      WITH player_counts AS (
        SELECT t.team_id, COUNT(p.player_id)::int AS player_count
        FROM team t
        LEFT JOIN player p ON p.team_id = t.team_id
        GROUP BY t.team_id
      ), latest_matches AS (
        SELECT team_id, MAX(match_date) AS latest_match
        FROM (
          SELECT home_team_id AS team_id, match_date FROM match
          UNION ALL
          SELECT away_team_id AS team_id, match_date FROM match
        ) team_matches
        GROUP BY team_id
      )
      SELECT t.team_id, t.name, pc.player_count, lm.latest_match
      FROM team t
      JOIN player_counts pc ON pc.team_id = t.team_id
      LEFT JOIN latest_matches lm ON lm.team_id = t.team_id
      WHERE pc.player_count < 15 OR pc.player_count > 40
      ORDER BY pc.player_count, lm.latest_match DESC NULLS LAST, t.name
    `),
    pool.query(`
      WITH latest_stats AS (
        SELECT DISTINCT ON (pss.player_id)
          pss.player_id,
          pss.team_id,
          s.year,
          s.start_date
        FROM player_season_stats pss
        JOIN season s ON s.season_id = pss.season_id
        WHERE pss.team_id IS NOT NULL
        ORDER BY pss.player_id, s.start_date DESC NULLS LAST, s.season_id DESC
      )
      SELECT
        p.player_id,
        CONCAT_WS(' ', p.first_name, p.last_name) AS player,
        p.team_id AS stored_team_id,
        stored.name AS stored_team,
        latest_stats.team_id AS latest_stats_team_id,
        expected.name AS latest_stats_team,
        latest_stats.year
      FROM latest_stats
      JOIN player p ON p.player_id = latest_stats.player_id
      LEFT JOIN team stored ON stored.team_id = p.team_id
      LEFT JOIN team expected ON expected.team_id = latest_stats.team_id
      WHERE p.team_id <> latest_stats.team_id
      ORDER BY latest_stats.start_date DESC NULLS LAST, player
    `),
    pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND LOWER(table_name) IN ('processed_teams_players', 'processed_teams_players_v2')
      ORDER BY table_name
    `),
    pool.query(`
      SELECT
        LOWER(BTRIM(CONCAT_WS(' ', p.first_name, p.last_name))) AS normalized_name,
        COUNT(*)::int AS records,
        ARRAY_AGG(p.player_id ORDER BY p.player_id) AS player_ids,
        ARRAY_AGG(t.name ORDER BY t.name) AS teams
      FROM player p
      JOIN team t ON t.team_id = p.team_id
      GROUP BY LOWER(BTRIM(CONCAT_WS(' ', p.first_name, p.last_name)))
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC, normalized_name
      LIMIT 50
    `),
  ]);

  const processedDetails = {};
  for (const { table_name: tableName } of processedSyncs.rows) {
    const safeTable = tableName === 'processed_teams_players_v2'
      ? 'processed_teams_players_v2'
      : 'processed_teams_players';
    const orderBy = safeTable === 'processed_teams_players_v2' ? '1, 2' : '1';
    processedDetails[safeTable] = (await pool.query(`SELECT * FROM ${safeTable} ORDER BY ${orderBy}`)).rows;
  }

  const { rows: [{ squad_cache_exists: squadCacheExists }] } = await pool.query(`
    SELECT to_regclass('public.team_squad_member') IS NOT NULL
       AND to_regclass('public.team_squad_sync') IS NOT NULL AS squad_cache_exists
  `);

  let squadCache = { installed: false };
  if (squadCacheExists) {
    const { rows: [cacheSummary] } = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM team_squad_sync WHERE status = 'success') AS verified_teams,
        (SELECT COUNT(*)::int FROM team_squad_sync WHERE status = 'error') AS failed_teams,
        (SELECT COUNT(*)::int FROM team_squad_member WHERE is_current = TRUE) AS current_memberships,
        (SELECT COUNT(*)::int
         FROM team_squad_sync sync
         WHERE sync.synced_at IS NOT NULL
           AND sync.player_count <> (
             SELECT COUNT(*) FROM team_squad_member member
             WHERE member.team_id = sync.team_id AND member.is_current = TRUE
           )) AS count_mismatches
    `);
    const { rows: failedTeams } = await pool.query(`
      SELECT sync.team_id, team.name, sync.failure_count, sync.attempted_at, sync.provider_error
      FROM team_squad_sync sync
      JOIN team ON team.team_id = sync.team_id
      WHERE sync.status = 'error'
      ORDER BY sync.attempted_at DESC
    `);
    squadCache = { installed: true, ...cacheSummary, failedTeams };
  }

  console.log(JSON.stringify({
    summary: summary.rows[0],
    implausibleRosterCount: rosterSizes.rows.length,
    implausibleRosters: rosterSizes.rows,
    latestStatConflictCount: latestStatConflicts.rows.length,
    latestStatConflicts: latestStatConflicts.rows,
    processedSyncs: processedDetails,
    squadCache,
    duplicateNameSamples: duplicateAssignments.rows,
  }, null, 2));
} finally {
  await pool.end();
}
