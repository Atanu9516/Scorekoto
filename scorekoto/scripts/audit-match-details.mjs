import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
});

try {
  const [totals, byCompetition, recent] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*)::int AS total_matches,
        COUNT(*) FILTER (WHERE m.status IN ('FT', 'AET', 'PEN'))::int AS finished_matches,
        COUNT(*) FILTER (WHERE m.home_possession IS NOT NULL OR m.away_possession IS NOT NULL)::int AS matches_with_possession,
        COUNT(d.match_id)::int AS cached_matches,
        COUNT(*) FILTER (WHERE jsonb_array_length(COALESCE(d.events, '[]'::jsonb)) > 0)::int AS matches_with_cached_events,
        COUNT(*) FILTER (WHERE d.statistics IS NOT NULL AND d.statistics <> '{}'::jsonb)::int AS matches_with_cached_statistics,
        COUNT(*) FILTER (WHERE d.lineups IS NOT NULL AND d.lineups <> '{}'::jsonb)::int AS matches_with_cached_lineups,
        COUNT(*) FILTER (WHERE d.coverage->>'checked' = 'true')::int AS provider_checked_matches,
        COUNT(*) FILTER (WHERE d.provider_error IS NOT NULL)::int AS provider_error_matches,
        COUNT(*) FILTER (WHERE d.coverage->>'unsupported' = 'true')::int AS provider_unsupported_matches,
        COUNT(*) FILTER (WHERE h2h.count > 1)::int AS matches_with_prior_head_to_head
      FROM match m
      LEFT JOIN match_detail_data d ON d.match_id = m.match_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS count
        FROM match other
        WHERE other.status IN ('FT', 'AET', 'PEN')
          AND other.match_date <= m.match_date
          AND (
            (other.home_team_id = m.home_team_id AND other.away_team_id = m.away_team_id)
            OR (other.home_team_id = m.away_team_id AND other.away_team_id = m.home_team_id)
          )
      ) h2h ON true
    `),
    pool.query(`
      SELECT
        l.league_id,
        l.name AS league,
        s.year,
        COUNT(*)::int AS matches,
        COUNT(*) FILTER (WHERE m.home_possession IS NOT NULL OR m.away_possession IS NOT NULL)::int AS possession,
        COUNT(d.match_id)::int AS cached,
        COUNT(*) FILTER (WHERE jsonb_array_length(COALESCE(d.events, '[]'::jsonb)) > 0)::int AS events,
        COUNT(*) FILTER (WHERE d.statistics IS NOT NULL AND d.statistics <> '{}'::jsonb)::int AS statistics,
        COUNT(*) FILTER (WHERE d.lineups IS NOT NULL AND d.lineups <> '{}'::jsonb)::int AS lineups,
        COUNT(*) FILTER (WHERE d.coverage->>'checked' = 'true')::int AS provider_checked,
        COUNT(*) FILTER (WHERE d.provider_error IS NOT NULL)::int AS provider_errors
      FROM match m
      JOIN season s ON s.season_id = m.season_id
      JOIN league l ON l.league_id = s.league_id
      LEFT JOIN match_detail_data d ON d.match_id = m.match_id
      GROUP BY l.league_id, l.name, s.year
      ORDER BY l.league_id, s.year
    `),
    pool.query(`
      SELECT
        m.match_id,
        m.match_date,
        m.status,
        ht.name AS home,
        at.name AS away,
        l.name AS league,
        s.year,
        m.home_possession,
        m.away_possession,
        d.fetched_at,
        d.last_attempted_at,
        d.provider_error,
        d.coverage,
        jsonb_array_length(COALESCE(d.events, '[]'::jsonb))::int AS events,
        (d.statistics IS NOT NULL AND d.statistics <> '{}'::jsonb) AS statistics,
        (d.lineups IS NOT NULL AND d.lineups <> '{}'::jsonb) AS lineups
      FROM match m
      JOIN team ht ON ht.team_id = m.home_team_id
      JOIN team at ON at.team_id = m.away_team_id
      JOIN season s ON s.season_id = m.season_id
      JOIN league l ON l.league_id = s.league_id
      LEFT JOIN match_detail_data d ON d.match_id = m.match_id
      ORDER BY m.match_date DESC, m.match_id DESC
      LIMIT 30
    `),
  ]);

  console.log(JSON.stringify({
    totals: totals.rows[0],
    byCompetition: byCompetition.rows,
    recent: recent.rows,
  }, null, 2));
} finally {
  await pool.end();
}
