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

// These fixtures were originally imported from API-Football, but an old fallback
// attached them to season_id 1. Their provider ID ranges and clubs identify the
// correct competitions unambiguously.
const competitionByFixtureId = new Map([
  [1570399, 140], [1570393, 140], [1570395, 140], [1570398, 140], [1570394, 140], [1570396, 140],
  [1550135, 135], [1550136, 135], [1550130, 135], [1550131, 135], [1550134, 135], [1550132, 135],
  [1557409, 39], [1557407, 39],
  [1563167, 40], [1563169, 40],
  [1575168, 78], [1575169, 78],
]);

const client = await pool.connect();

try {
  const mismatchedResult = await client.query(`
    SELECT
      m.match_id,
      m.match_date,
      ht.name AS home_team,
      at.name AS away_team,
      l.name AS current_league,
      s.year AS current_season
    FROM match m
    JOIN team ht ON ht.team_id = m.home_team_id
    JOIN team at ON at.team_id = m.away_team_id
    JOIN season s ON s.season_id = m.season_id
    JOIN league l ON l.league_id = s.league_id
    WHERE m.match_id = ANY($1::int[])
    ORDER BY m.match_id
  `, [[...competitionByFixtureId.keys()]]);

  const fabricatedResult = await client.query(`
    SELECT
      m.match_id,
      m.match_date,
      ht.name AS home_team,
      at.name AS away_team,
      l.name AS current_league
    FROM match m
    JOIN team ht ON ht.team_id = m.home_team_id
    JOIN team at ON at.team_id = m.away_team_id
    JOIN season s ON s.season_id = m.season_id
    JOIN league l ON l.league_id = s.league_id
    WHERE m.status IN ('UPCOMING', 'NS', 'TBD')
      AND EXTRACT(SECOND FROM m.match_date) <> 0
      AND (
        m.match_id BETWEEN m.home_team_id * 10000 AND m.home_team_id * 10000 + 9999
        OR m.match_id BETWEEN m.away_team_id * 10000 AND m.away_team_id * 10000 + 9999
      )
    ORDER BY m.match_id
  `);

  const seasonLabelResult = await client.query(`
    SELECT s.season_id, l.name AS league, s.year
    FROM season s
    JOIN league l ON l.league_id = s.league_id
    WHERE s.league_id = ANY(ARRAY[1, 4, 6, 7, 9, 13])
      AND s.year LIKE '%-%'
    ORDER BY s.league_id, s.year
  `);

  const repairs = [];
  for (const match of mismatchedResult.rows) {
    const leagueId = competitionByFixtureId.get(Number(match.match_id));
    const seasonYear = new Date(match.match_date).getUTCFullYear();
    const seasonResult = await client.query(
      `SELECT s.season_id, s.year, l.name AS league
       FROM season s
       JOIN league l ON l.league_id = s.league_id
       WHERE s.league_id = $1 AND SPLIT_PART(s.year, '-', 1) = $2
       ORDER BY s.season_id DESC LIMIT 1`,
      [leagueId, String(seasonYear)]
    );

    if (seasonResult.rows.length === 0) {
      throw new Error(`No ${seasonYear} season exists for league ${leagueId}`);
    }

    repairs.push({
      matchId: match.match_id,
      fixture: `${match.home_team} vs ${match.away_team}`,
      from: `${match.current_league} (${match.current_season})`,
      to: `${seasonResult.rows[0].league} (${seasonResult.rows[0].year})`,
      seasonId: seasonResult.rows[0].season_id,
    });
  }

  if (repairs.length !== competitionByFixtureId.size) {
    throw new Error(`Expected ${competitionByFixtureId.size} misplaced API fixtures, found ${repairs.length}`);
  }

  if (applyChanges) {
    await client.query('BEGIN');
    for (const repair of repairs) {
      await client.query(
        'UPDATE match SET season_id = $2 WHERE match_id = $1',
        [repair.matchId, repair.seasonId]
      );
    }
    if (fabricatedResult.rows.length > 0) {
      await client.query(
        'DELETE FROM match WHERE match_id = ANY($1::int[])',
        [fabricatedResult.rows.map((match) => match.match_id)]
      );
    }
    for (const season of seasonLabelResult.rows) {
      await client.query(
        `UPDATE season SET year = SPLIT_PART(year, '-', 1) WHERE season_id = $1`,
        [season.season_id]
      );
    }
    await client.query('COMMIT');
  }

  console.log(JSON.stringify({
    mode: applyChanges ? 'applied' : 'dry-run',
    repaired: repairs.map(({ seasonId, ...repair }) => repair),
    removedFabricatedFixtures: fabricatedResult.rows,
    normalizedSeasonLabels: seasonLabelResult.rows.map((season) => ({
      seasonId: season.season_id,
      league: season.league,
      from: season.year,
      to: season.year.split('-')[0],
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
