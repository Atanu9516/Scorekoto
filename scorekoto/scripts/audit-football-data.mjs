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
  const [
    competitions,
    suspiciousMatches,
    dateSeasonMismatches,
    calendarSeasonLabels,
    duplicateSeasons,
    incompleteRelations,
    entityQuality,
    matchQuality,
    statusCounts,
    statsQuality,
    duplicateNames,
    incompletePlayerSamples,
    schemaColumns,
    detailCoverage,
  ] = await Promise.all([
    pool.query(`
      SELECT
        l.league_id,
        l.name,
        l.country,
        s.season_id,
        s.year,
        COUNT(m.match_id)::int AS match_count
      FROM league l
      LEFT JOIN season s ON s.league_id = l.league_id
      LEFT JOIN match m ON m.season_id = s.season_id
      GROUP BY l.league_id, l.name, l.country, s.season_id, s.year
      ORDER BY l.league_id, s.year
    `),
    pool.query(`
      SELECT
        m.match_id,
        m.season_id,
        m.match_date,
        m.status,
        ht.team_id AS home_id,
        ht.name AS home_team,
        at.team_id AS away_id,
        at.name AS away_team,
        l.league_id,
        l.name AS league
      FROM match m
      LEFT JOIN team ht ON ht.team_id = m.home_team_id
      LEFT JOIN team at ON at.team_id = m.away_team_id
      LEFT JOIN season s ON s.season_id = m.season_id
      LEFT JOIN league l ON l.league_id = s.league_id
      WHERE
        ht.team_id IS NULL
        OR at.team_id IS NULL
        OR l.league_id IS NULL
        OR (
          m.status IN ('UPCOMING', 'NS', 'TBD')
          AND (
            m.match_id BETWEEN m.home_team_id * 10000 AND m.home_team_id * 10000 + 9999
            OR m.match_id BETWEEN m.away_team_id * 10000 AND m.away_team_id * 10000 + 9999
          )
        )
      ORDER BY m.match_id
    `),
    pool.query(`
      SELECT
        m.match_id,
        m.match_date,
        ht.name AS home_team,
        at.name AS away_team,
        l.league_id,
        l.name AS league,
        s.season_id,
        s.year
      FROM match m
      JOIN team ht ON ht.team_id = m.home_team_id
      JOIN team at ON at.team_id = m.away_team_id
      JOIN season s ON s.season_id = m.season_id
      JOIN league l ON l.league_id = s.league_id
      WHERE EXTRACT(YEAR FROM m.match_date)::int NOT IN (
        NULLIF(SPLIT_PART(s.year, '-', 1), '')::int,
        NULLIF(SPLIT_PART(s.year, '-', 2), '')::int
      )
      ORDER BY m.match_date, m.match_id
    `),
    pool.query(`
      SELECT s.season_id, s.league_id, l.name AS league, s.year, s.start_date, s.end_date
      FROM season s
      JOIN league l ON l.league_id = s.league_id
      WHERE s.league_id = ANY(ARRAY[1, 4, 6, 7, 9, 13])
        AND s.year LIKE '%-%'
      ORDER BY s.league_id, s.start_date
    `),
    pool.query(`
      SELECT league_id, year, COUNT(*)::int AS duplicates, ARRAY_AGG(season_id ORDER BY season_id) AS season_ids
      FROM season
      GROUP BY league_id, year
      HAVING COUNT(*) > 1
      ORDER BY league_id, year
    `),
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE s.season_id IS NULL)::int AS missing_season,
        COUNT(*) FILTER (WHERE ht.team_id IS NULL)::int AS missing_home_team,
        COUNT(*) FILTER (WHERE at.team_id IS NULL)::int AS missing_away_team,
        COUNT(*) FILTER (WHERE m.home_team_id = m.away_team_id)::int AS same_team,
        COUNT(*)::int AS total_matches
      FROM match m
      LEFT JOIN season s ON s.season_id = m.season_id
      LEFT JOIN team ht ON ht.team_id = m.home_team_id
      LEFT JOIN team at ON at.team_id = m.away_team_id
    `),
    pool.query(`
      SELECT
        (SELECT COUNT(*) FROM league)::int AS total_leagues,
        (SELECT COUNT(*) FROM league WHERE NULLIF(BTRIM(name), '') IS NULL)::int AS leagues_missing_name,
        (SELECT COUNT(*) FROM league WHERE NULLIF(BTRIM(country), '') IS NULL)::int AS leagues_missing_country,
        (SELECT COUNT(*) FROM league WHERE NULLIF(BTRIM(type), '') IS NULL)::int AS leagues_missing_type,
        (SELECT COUNT(*) FROM league WHERE NULLIF(BTRIM(logo_url), '') IS NULL)::int AS leagues_missing_logo,
        (SELECT COUNT(*) FROM team)::int AS total_teams,
        (SELECT COUNT(*) FROM team WHERE NULLIF(BTRIM(name), '') IS NULL)::int AS teams_missing_name,
        (SELECT COUNT(*) FROM team WHERE NULLIF(BTRIM(logo_url), '') IS NULL)::int AS teams_missing_logo,
        (SELECT COUNT(*) FROM team WHERE NULLIF(BTRIM(stadium_name), '') IS NULL)::int AS teams_missing_stadium,
        (SELECT COUNT(*) FROM player)::int AS total_players,
        (SELECT COUNT(*) FROM player WHERE NULLIF(BTRIM(CONCAT_WS(' ', first_name, last_name)), '') IS NULL)::int AS players_missing_name,
        (SELECT COUNT(*) FROM player WHERE team_id IS NULL)::int AS players_without_team,
        (SELECT COUNT(*) FROM player WHERE NULLIF(BTRIM(primary_position), '') IS NULL)::int AS players_missing_position,
        (SELECT COUNT(*) FROM player WHERE NULLIF(BTRIM(nationality), '') IS NULL OR LOWER(BTRIM(nationality)) = 'international')::int AS players_missing_nationality,
        (SELECT COUNT(*) FROM player WHERE date_of_birth IS NULL)::int AS players_missing_birth_date,
        (SELECT COUNT(*) FROM player WHERE NULLIF(BTRIM(photo_url), '') IS NULL)::int AS players_missing_photo,
        (SELECT COUNT(*) FROM player WHERE LOWER(BTRIM(first_name)) = LOWER(BTRIM(last_name)))::int AS players_repeated_name_parts,
        (SELECT COUNT(*) FROM player WHERE LOWER(BTRIM(nationality)) = 'international')::int AS players_placeholder_nationality,
        (SELECT COUNT(*) FROM player p LEFT JOIN team t ON t.team_id = p.team_id WHERE p.team_id IS NOT NULL AND t.team_id IS NULL)::int AS players_with_missing_team
    `),
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE match_date IS NULL)::int AS missing_date,
        COUNT(*) FILTER (WHERE NULLIF(BTRIM(status), '') IS NULL)::int AS missing_status,
        COUNT(*) FILTER (WHERE status NOT IN ('TBD', 'NS', '1H', 'HT', '2H', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE', 'FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO'))::int AS unknown_status,
        COUNT(*) FILTER (WHERE status IN ('FT', 'AET', 'PEN') AND (home_score IS NULL OR away_score IS NULL))::int AS completed_missing_score,
        COUNT(*) FILTER (WHERE status IN ('TBD', 'NS', 'PST') AND (home_score IS NOT NULL OR away_score IS NOT NULL))::int AS scheduled_with_score,
        COUNT(*) FILTER (WHERE home_score < 0 OR away_score < 0)::int AS negative_score,
        COUNT(*) FILTER (WHERE NULLIF(BTRIM(venue), '') IS NULL)::int AS missing_venue
      FROM match
    `),
    pool.query(`
      SELECT COALESCE(NULLIF(BTRIM(status), ''), '<missing>') AS status, COUNT(*)::int AS count
      FROM match
      GROUP BY COALESCE(NULLIF(BTRIM(status), ''), '<missing>')
      ORDER BY count DESC, status
    `),
    pool.query(`
      SELECT
        (SELECT COUNT(*) FROM player_season_stats)::int AS total_player_stats,
        (SELECT COUNT(*) FROM player_season_stats pss LEFT JOIN player p ON p.player_id = pss.player_id WHERE p.player_id IS NULL)::int AS stats_missing_player,
        (SELECT COUNT(*) FROM player_season_stats pss LEFT JOIN season s ON s.season_id = pss.season_id WHERE s.season_id IS NULL)::int AS stats_missing_season,
        (SELECT COUNT(*) FROM player_season_stats WHERE appearances < 0 OR goals < 0 OR assists < 0 OR yellow_cards < 0 OR red_cards < 0 OR minutes_played < 0)::int AS stats_negative_values,
        (SELECT COUNT(*) FROM player_season_stats WHERE goals > appearances * 10 OR assists > appearances * 10 OR minutes_played > appearances * 130)::int AS stats_implausible_values,
        (SELECT COUNT(*) FROM team_season_stats)::int AS total_team_stats,
        (SELECT COUNT(*) FROM team_season_stats tss LEFT JOIN team t ON t.team_id = tss.team_id WHERE t.team_id IS NULL)::int AS team_stats_missing_team,
        (SELECT COUNT(*) FROM team_season_stats tss LEFT JOIN season s ON s.season_id = tss.season_id WHERE s.season_id IS NULL)::int AS team_stats_missing_season
    `),
    pool.query(`
      SELECT entity, normalized_name, duplicates, ids
      FROM (
        SELECT 'league' AS entity, LOWER(BTRIM(name)) AS normalized_name, COUNT(*)::int AS duplicates, ARRAY_AGG(league_id ORDER BY league_id) AS ids
        FROM league
        WHERE NULLIF(BTRIM(name), '') IS NOT NULL
        GROUP BY LOWER(BTRIM(name))
        HAVING COUNT(*) > 1
        UNION ALL
        SELECT 'team' AS entity, LOWER(BTRIM(name)) AS normalized_name, COUNT(*)::int AS duplicates, ARRAY_AGG(team_id ORDER BY team_id) AS ids
        FROM team
        WHERE NULLIF(BTRIM(name), '') IS NOT NULL
        GROUP BY LOWER(BTRIM(name))
        HAVING COUNT(*) > 1
      ) duplicates
      ORDER BY entity, normalized_name
    `),
    pool.query(`
      SELECT
        p.player_id,
        CONCAT_WS(' ', p.first_name, p.last_name) AS name,
        p.primary_position,
        p.nationality,
        p.date_of_birth,
        p.photo_url,
        p.weight_cm,
        t.name AS team
      FROM player p
      LEFT JOIN team t ON t.team_id = p.team_id
      WHERE NULLIF(BTRIM(p.nationality), '') IS NULL
         OR LOWER(BTRIM(p.nationality)) = 'international'
         OR NULLIF(BTRIM(p.photo_url), '') IS NULL
      ORDER BY p.player_id
      LIMIT 25
    `),
    pool.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `),
    pool.query(`
      SELECT
        (SELECT COUNT(*) FROM match_event)::int AS match_events,
        (SELECT COUNT(DISTINCT match_id) FROM match_event)::int AS matches_with_events,
        (SELECT COUNT(*) FROM match_lineup)::int AS lineup_entries,
        (SELECT COUNT(DISTINCT match_id) FROM match_lineup)::int AS matches_with_lineups,
        (SELECT COUNT(*) FROM match WHERE home_possession IS NOT NULL OR away_possession IS NOT NULL)::int AS matches_with_possession,
        (SELECT COUNT(*) FROM match WHERE home_rating IS NOT NULL OR away_rating IS NOT NULL)::int AS matches_with_ratings,
        (SELECT COUNT(*) FROM team WHERE NULLIF(BTRIM(manager_name), '') IS NOT NULL)::int AS teams_with_manager,
        (SELECT COUNT(*) FROM team WHERE NULLIF(BTRIM(history), '') IS NOT NULL)::int AS teams_with_history,
        (SELECT COUNT(*) FROM team_trophy)::int AS team_trophies,
        (SELECT COUNT(DISTINCT team_id) FROM team_trophy)::int AS teams_with_trophies,
        (SELECT COUNT(*) FROM player_injury)::int AS player_injuries,
        (SELECT COUNT(DISTINCT player_id) FROM player_injury)::int AS players_with_injuries,
        (SELECT COUNT(*) FROM player_injury WHERE NULLIF(BTRIM(description), '') IS NOT NULL)::int AS injuries_with_description,
        (SELECT COUNT(*) FROM player_injury WHERE expected_return_date IS NOT NULL)::int AS injuries_with_expected_return,
        (SELECT COUNT(*) FROM player WHERE date_of_birth IS NOT NULL)::int AS players_with_birth_date,
        (SELECT COUNT(*) FROM player WHERE NULLIF(BTRIM(nationality), '') IS NOT NULL AND LOWER(BTRIM(nationality)) <> 'international')::int AS players_with_nationality,
        (SELECT COUNT(*) FROM player WHERE NULLIF(BTRIM(photo_url), '') IS NOT NULL)::int AS players_with_photo,
        (SELECT COUNT(DISTINCT player_id) FROM player_season_stats)::int AS players_with_season_stats,
        (SELECT COUNT(*) FROM (
          SELECT player_id
          FROM player_season_stats pss
          JOIN season s ON s.season_id = pss.season_id
          GROUP BY player_id
          HAVING COUNT(DISTINCT s.year) > 1
        ) multi_season_players)::int AS players_with_multiple_stat_seasons,
        (SELECT COUNT(*) FROM player WHERE transfer_history IS NOT NULL AND transfer_history <> '[]'::jsonb AND transfer_history <> '{}'::jsonb)::int AS players_with_transfer_history,
        (SELECT COUNT(*) FROM player WHERE market_value_euros IS NOT NULL)::int AS players_with_market_value,
        (SELECT COUNT(*) FROM player WHERE weight_cm IS NOT NULL)::int AS players_with_weight
    `),
  ]);

  const report = {
    competitions: competitions.rows,
    suspiciousMatches: suspiciousMatches.rows,
    dateSeasonMismatches: dateSeasonMismatches.rows,
    calendarSeasonLabels: calendarSeasonLabels.rows,
    duplicateSeasons: duplicateSeasons.rows,
    integrity: incompleteRelations.rows[0],
    entityQuality: entityQuality.rows[0],
    matchQuality: matchQuality.rows[0],
    statusCounts: statusCounts.rows,
    statsQuality: statsQuality.rows[0],
    duplicateNames: duplicateNames.rows,
    incompletePlayerSamples: incompletePlayerSamples.rows,
    schemaColumns: schemaColumns.rows,
    detailCoverage: detailCoverage.rows[0],
  };

  console.log(JSON.stringify(process.argv.includes('--summary') ? {
    leagues: [...new Map(report.competitions.map((item) => [item.league_id, {
      leagueId: item.league_id,
      name: item.name,
      country: item.country,
    }])).values()],
    integrity: report.integrity,
    suspiciousMatchCount: report.suspiciousMatches.length,
    suspiciousMatches: report.suspiciousMatches,
    dateSeasonMismatchCount: report.dateSeasonMismatches.length,
    dateSeasonMismatches: report.dateSeasonMismatches,
    calendarSeasonLabelCount: report.calendarSeasonLabels.length,
    calendarSeasonLabels: report.calendarSeasonLabels,
    duplicateSeasonCount: report.duplicateSeasons.length,
    entityQuality: report.entityQuality,
    matchQuality: report.matchQuality,
    statusCounts: report.statusCounts,
    statsQuality: report.statsQuality,
    duplicateNameCount: report.duplicateNames.length,
    duplicateNames: report.duplicateNames,
    incompletePlayerSamples: report.incompletePlayerSamples,
    schemaColumns: report.schemaColumns,
    detailCoverage: report.detailCoverage,
  } : report, null, 2));
} finally {
  await pool.end();
}
