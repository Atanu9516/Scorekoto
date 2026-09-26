import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
const apiKey = process.env.API_SPORTS_KEY;

if (!connectionString || !apiKey) {
  throw new Error('DATABASE_URL and API_SPORTS_KEY are required');
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
});

try {
  const requestedId = Number(process.argv[2]);
  const matchResult = Number.isInteger(requestedId) && requestedId > 0
    ? await pool.query('SELECT match_id FROM match WHERE match_id = $1 LIMIT 1', [requestedId])
    : await pool.query(`
        SELECT match_id
        FROM match
        WHERE home_possession IS NOT NULL OR away_possession IS NOT NULL
        ORDER BY match_date DESC, match_id DESC
        LIMIT 1
      `);

  const matchId = matchResult.rows[0]?.match_id;
  if (!matchId) throw new Error('No stored match was found');

  const response = await fetch(`https://v3.football.api-sports.io/fixtures?id=${matchId}`, {
    headers: { 'x-apisports-key': apiKey, Accept: 'application/json' },
  });
  const data = await response.json();
  const fixture = data.response?.[0];

  console.log(JSON.stringify({
    matchId,
    httpStatus: response.status,
    errors: data.errors || {},
    resultCount: data.results ?? data.response?.length ?? 0,
    coverage: fixture ? {
      events: fixture.events?.length || 0,
      lineups: fixture.lineups?.length || 0,
      statisticsTeams: fixture.statistics?.length || 0,
      hasHomeTeam: Boolean(fixture.teams?.home?.name),
      hasAwayTeam: Boolean(fixture.teams?.away?.name),
    } : null,
  }, null, 2));
} finally {
  await pool.end();
}
