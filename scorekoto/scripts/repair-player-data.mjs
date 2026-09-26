import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
const applyChanges = process.argv.includes('--apply');

if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
});

const client = await pool.connect();

try {
  const repeatedNames = await client.query(`
    SELECT player_id, first_name, last_name
    FROM player
    WHERE NULLIF(BTRIM(first_name), '') IS NOT NULL
      AND LOWER(BTRIM(first_name)) = LOWER(BTRIM(last_name))
    ORDER BY player_id
  `);

  if (applyChanges && repeatedNames.rows.length > 0) {
    await client.query('BEGIN');
    await client.query(`
      UPDATE player
      SET last_name = ''
      WHERE NULLIF(BTRIM(first_name), '') IS NOT NULL
        AND LOWER(BTRIM(first_name)) = LOWER(BTRIM(last_name))
    `);
    await client.query('COMMIT');
  }

  console.log(JSON.stringify({
    mode: applyChanges ? 'applied' : 'dry-run',
    normalizedRepeatedNames: repeatedNames.rows.map((player) => ({
      playerId: player.player_id,
      from: `${player.first_name} ${player.last_name}`,
      to: player.first_name,
    })),
  }, null, 2));
} catch (error) {
  if (applyChanges) {
    await client.query('ROLLBACK').catch(() => {});
  }
  throw error;
} finally {
  client.release();
  await pool.end();
}
