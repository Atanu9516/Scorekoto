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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS match_detail_data (
      match_id INTEGER PRIMARY KEY REFERENCES match(match_id) ON DELETE CASCADE,
      events JSONB NOT NULL DEFAULT '[]'::jsonb,
      statistics JSONB,
      lineups JSONB,
      fetched_at TIMESTAMP WITHOUT TIME ZONE,
      last_attempted_at TIMESTAMP WITHOUT TIME ZONE,
      provider_error TEXT,
      coverage JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `);

  await pool.query(`
    ALTER TABLE match_detail_data
      ALTER COLUMN fetched_at DROP NOT NULL,
      ADD COLUMN IF NOT EXISTS last_attempted_at TIMESTAMP WITHOUT TIME ZONE,
      ADD COLUMN IF NOT EXISTS provider_error TEXT,
      ADD COLUMN IF NOT EXISTS coverage JSONB NOT NULL DEFAULT '{}'::jsonb
  `);

  await pool.query(`
    UPDATE match_detail_data
    SET
      last_attempted_at = COALESCE(last_attempted_at, fetched_at),
      coverage = jsonb_build_object(
        'checked', true,
        'events', jsonb_array_length(COALESCE(events, '[]'::jsonb)) > 0,
        'statistics', statistics IS NOT NULL AND statistics <> '{}'::jsonb,
        'lineups', lineups IS NOT NULL AND lineups <> '{}'::jsonb
      )
    WHERE last_attempted_at IS NULL OR coverage = '{}'::jsonb
  `);

  const result = await pool.query('SELECT COUNT(*)::int AS cached_matches FROM match_detail_data');
  console.log(JSON.stringify({
    success: true,
    cachedMatches: result.rows[0].cached_matches,
  }, null, 2));
} finally {
  await pool.end();
}
