import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) throw new Error('DATABASE_URL is required');

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
});

try {
  await pool.query('BEGIN');

  await pool.query(`
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

  await pool.query(`ALTER TABLE team_squad_sync ADD COLUMN IF NOT EXISTS failure_count INT NOT NULL DEFAULT 0`);

  await pool.query(`
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

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_team_squad_member_current
    ON team_squad_member(team_id, is_current)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_team_squad_sync_status_synced
    ON team_squad_sync(status, synced_at)
  `);

  await pool.query('COMMIT');
  console.log('Team squad cache tables are ready.');
} catch (error) {
  await pool.query('ROLLBACK');
  throw error;
} finally {
  await pool.end();
}
