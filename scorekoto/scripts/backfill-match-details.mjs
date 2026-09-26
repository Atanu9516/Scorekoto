import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
const apiKey = process.env.API_SPORTS_KEY;
const applyChanges = process.argv.includes('--apply');
const forceSingleRequests = process.argv.includes('--single');
const retryUnsupported = process.argv.includes('--retry-unsupported');
const maxRequestsArg = process.argv.find((arg) => arg.startsWith('--max-requests='));
const maxRequests = Math.max(1, Number(maxRequestsArg?.split('=')[1]) || 90);

if (!connectionString || !apiKey) {
  throw new Error('DATABASE_URL and API_SPORTS_KEY are required');
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
});

function parseStat(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace('%', '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function mapStatistics(item) {
  if (!Array.isArray(item.statistics) || item.statistics.length < 2) return null;

  const home = item.statistics.find(
    (entry) => Number(entry.team?.id) === Number(item.teams?.home?.id)
  ) || item.statistics[0];
  const away = item.statistics.find(
    (entry) => Number(entry.team?.id) === Number(item.teams?.away?.id)
  ) || item.statistics[1];
  const homeMap = Object.fromEntries((home.statistics || []).map((stat) => [stat.type, stat.value]));
  const awayMap = Object.fromEntries((away.statistics || []).map((stat) => [stat.type, stat.value]));
  const pair = (type) => [parseStat(homeMap[type]), parseStat(awayMap[type])];
  const result = {
    possession: pair('Ball Possession'),
    shots: pair('Total Shots'),
    shotsOnTarget: pair('Shots on Goal'),
    shotsOffTarget: pair('Shots off Goal'),
    blockedShots: pair('Blocked Shots'),
    shotsInsideBox: pair('Shots insidebox'),
    shotsOutsideBox: pair('Shots outsidebox'),
    corners: pair('Corner Kicks'),
    fouls: pair('Fouls'),
    offsides: pair('Offsides'),
    yellowCards: pair('Yellow Cards'),
    redCards: pair('Red Cards'),
    goalkeeperSaves: pair('Goalkeeper Saves'),
    totalPasses: pair('Total passes'),
    accuratePasses: pair('Passes accurate'),
    passAccuracy: pair('Passes %'),
  };

  return Object.values(result).some((values) => values.some((value) => value !== null))
    ? result
    : null;
}

function mapEvents(item) {
  return (item.events || []).map((event) => {
    const type = String(event.type || '').toLowerCase();
    const detail = String(event.detail || '').toLowerCase();
    const isGoal = type.includes('goal');
    const isCard = type.includes('card');
    const isSubstitution = type.includes('subst') || type.includes('sub');
    const isMissedPenalty = isGoal && detail.includes('missed penalty');
    const isOwnGoal = isGoal && detail.includes('own');
    const isPenaltyGoal = isGoal && detail.includes('penalty') && !isMissedPenalty;
    const isRed = isCard && (detail.includes('red') || detail.includes('second yellow'));
    const isYellow = isCard && detail.includes('yellow') && !isRed;
    const eventType = isMissedPenalty
      ? 'missed-penalty'
      : isOwnGoal
      ? 'own-goal'
      : isPenaltyGoal
      ? 'penalty-goal'
      : isGoal
      ? 'goal'
      : isRed
      ? 'red-card'
      : isYellow
      ? 'yellow-card'
      : isSubstitution
      ? 'substitution'
      : type.includes('var')
      ? 'var'
      : 'event';

    return {
      minute: event.time?.extra
        ? `${event.time.elapsed ?? 0}+${event.time.extra}'`
        : `${event.time?.elapsed ?? 0}'`,
      type: eventType,
      player: event.player?.name?.trim() || '',
      team: event.team?.name?.trim() || '',
      assist: isSubstitution ? null : (event.assist?.name?.trim() || null),
      playerIn: isSubstitution ? (event.assist?.name?.trim() || null) : null,
      playerOut: isSubstitution ? (event.player?.name?.trim() || null) : null,
      detail: event.detail || '',
    };
  });
}

function mapLineupTeam(raw, fallbackName) {
  if (!raw) return null;
  const startingXI = (raw.startXI || []).filter((entry) => entry.player?.name).map((entry) => {
    const gridRow = entry.player.grid
      ? Number.parseInt(entry.player.grid.split(':')[0], 10)
      : null;
    return {
      id: entry.player.id || null,
      name: entry.player.name,
      number: entry.player.number ?? null,
      position: entry.player.pos || null,
      row: gridRow || { G: 1, D: 2, M: 3, F: 4 }[entry.player.pos] || 1,
    };
  });
  if (startingXI.length === 0) return null;

  return {
    team: raw.team?.name || fallbackName,
    formation: raw.formation || null,
    coach: raw.coach?.name || null,
    startingXI,
    substitutes: (raw.substitutes || []).filter((entry) => entry.player?.name).map((entry) => ({
      id: entry.player.id || null,
      name: entry.player.name,
      number: entry.player.number ?? null,
    })),
  };
}

function mapLineups(item) {
  if (!Array.isArray(item.lineups) || item.lineups.length < 2) return null;
  const homeRaw = item.lineups.find(
    (entry) => Number(entry.team?.id) === Number(item.teams?.home?.id)
  ) || item.lineups[0];
  const awayRaw = item.lineups.find(
    (entry) => Number(entry.team?.id) === Number(item.teams?.away?.id)
  ) || item.lineups[1];
  const home = mapLineupTeam(homeRaw, item.teams?.home?.name);
  const away = mapLineupTeam(awayRaw, item.teams?.away?.name);
  return home && away ? { home, away } : null;
}

function splitName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] || 'Unknown', lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts.at(-1) };
}

async function saveFixtureDetails(item) {
  const matchId = Number(item.fixture?.id);
  const status = String(item.fixture?.status?.short || '').toUpperCase();
  const events = mapEvents(item);
  const statistics = mapStatistics(item);
  const lineups = mapLineups(item);
  const coverage = {
    checked: true,
    unsupported: false,
    providerStatus: status || null,
    events: events.length > 0,
    statistics: Boolean(statistics),
    lineups: Boolean(lineups),
  };

  await pool.query(
    `INSERT INTO match_detail_data (
       match_id, events, statistics, lineups, fetched_at,
       last_attempted_at, provider_error, coverage
     )
     VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, NOW(), NOW(), NULL, $5::jsonb)
     ON CONFLICT (match_id) DO UPDATE SET
       events = CASE
         WHEN jsonb_array_length(EXCLUDED.events) > 0 THEN EXCLUDED.events
         ELSE match_detail_data.events
       END,
       statistics = COALESCE(EXCLUDED.statistics, match_detail_data.statistics),
       lineups = COALESCE(EXCLUDED.lineups, match_detail_data.lineups),
       fetched_at = NOW(),
       last_attempted_at = NOW(),
       provider_error = NULL,
       coverage = (match_detail_data.coverage || EXCLUDED.coverage) || jsonb_build_object(
         'events', jsonb_array_length(
           CASE
             WHEN jsonb_array_length(EXCLUDED.events) > 0 THEN EXCLUDED.events
             ELSE match_detail_data.events
           END
         ) > 0,
         'statistics', COALESCE(EXCLUDED.statistics, match_detail_data.statistics) IS NOT NULL,
         'lineups', COALESCE(EXCLUDED.lineups, match_detail_data.lineups) IS NOT NULL
       )`,
    [
      matchId,
      JSON.stringify(events),
      statistics ? JSON.stringify(statistics) : null,
      lineups ? JSON.stringify(lineups) : null,
      JSON.stringify(coverage),
    ]
  );

  await pool.query(
    `UPDATE match SET
       status = COALESCE(NULLIF($2, ''), status),
       home_score = COALESCE($3, home_score),
       away_score = COALESCE($4, away_score),
       venue = COALESCE($5, venue),
       home_possession = COALESCE($6, home_possession),
       away_possession = COALESCE($7, away_possession)
     WHERE match_id = $1`,
    [
      matchId,
      status,
      item.goals?.home ?? null,
      item.goals?.away ?? null,
      item.fixture?.venue?.name || null,
      statistics?.possession?.[0] ?? null,
      statistics?.possession?.[1] ?? null,
    ]
  );

  for (const teamLineup of item.lineups || []) {
    const teamId = teamLineup.team?.id;
    if (!teamId) continue;
    const players = [
      ...(teamLineup.startXI || []).map((entry) => entry.player),
      ...(teamLineup.substitutes || []).map((entry) => entry.player),
    ];
    for (const player of players) {
      if (!player?.id || !player.name?.trim()) continue;
      const { firstName, lastName } = splitName(player.name);
      const position = { G: 'Goalkeeper', D: 'Defender', M: 'Midfielder', F: 'Forward' }[player.pos] || null;
      await pool.query(
        `INSERT INTO player (player_id, team_id, first_name, last_name, primary_position)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (player_id) DO NOTHING`,
        [player.id, teamId, firstName, lastName, position]
      );
    }
  }

  return {
    matchId,
    events: events.length,
    statistics: Boolean(statistics),
    lineups: Boolean(lineups),
  };
}

async function markUnsupported(matchId, error) {
  await pool.query(
    `INSERT INTO match_detail_data (
       match_id, events, statistics, lineups, fetched_at,
       last_attempted_at, provider_error, coverage
     )
     VALUES (
       $1, '[]'::jsonb, NULL, NULL, NULL,
       NOW(), $2, '{"unsupported": true}'::jsonb
     )
     ON CONFLICT (match_id) DO UPDATE SET
       last_attempted_at = NOW(),
       provider_error = EXCLUDED.provider_error,
       coverage = match_detail_data.coverage || EXCLUDED.coverage`,
    [matchId, String(error || 'Fixture details are unavailable on the current provider plan').slice(0, 500)]
  );
}

try {
  const countResult = await pool.query(`
    SELECT COUNT(*)::int AS count
    FROM match m
    LEFT JOIN match_detail_data d ON d.match_id = m.match_id
    WHERE m.status IN ('FT', 'AET', 'PEN')
      AND COALESCE(d.coverage->>'providerStatus', '') NOT IN ('FT', 'AET', 'PEN')
      AND ($1::boolean OR COALESCE(d.coverage->>'unsupported', 'false') <> 'true')
  `, [retryUnsupported]);
  const unsupportedResult = await pool.query(`
    SELECT COUNT(*)::int AS count
    FROM match_detail_data
    WHERE coverage->>'unsupported' = 'true'
  `);
  const candidateLimit = maxRequests * (forceSingleRequests ? 1 : 20);
  const candidatesResult = await pool.query(`
    SELECT m.match_id, m.match_date, ht.name AS home_team, at.name AS away_team
    FROM match m
    JOIN team ht ON ht.team_id = m.home_team_id
    JOIN team at ON at.team_id = m.away_team_id
    LEFT JOIN match_detail_data d ON d.match_id = m.match_id
    WHERE m.status IN ('FT', 'AET', 'PEN')
      AND COALESCE(d.coverage->>'providerStatus', '') NOT IN ('FT', 'AET', 'PEN')
      AND ($2::boolean OR COALESCE(d.coverage->>'unsupported', 'false') <> 'true')
    ORDER BY m.match_date DESC, m.match_id DESC
    LIMIT $1
  `, [candidateLimit, retryUnsupported]);

  if (!applyChanges) {
    console.log(JSON.stringify({
      mode: 'dry-run',
      totalRemaining: countResult.rows[0].count,
      unsupportedMatches: unsupportedResult.rows[0].count,
      selectedFixtures: candidatesResult.rows.length,
      plannedRequests: forceSingleRequests
        ? candidatesResult.rows.length
        : Math.ceil(candidatesResult.rows.length / 20),
      maxRequests,
      requestMode: forceSingleRequests ? 'single' : 'auto',
      newestCandidate: candidatesResult.rows[0] || null,
      instruction: 'Run with --apply --single after the free-plan provider quota resets.',
    }, null, 2));
  } else {
    const candidates = candidatesResult.rows;
    const summary = {
      mode: 'applied',
      totalRemainingBeforeRun: countResult.rows[0].count,
      requests: 0,
      fixturesReturned: 0,
      fixturesSaved: 0,
      fixturesWithEvents: 0,
      fixturesWithStatistics: 0,
      fixturesWithLineups: 0,
      providerErrors: [],
      requestMode: forceSingleRequests ? 'single' : 'auto',
    };

    let cursor = 0;
    let useSingleRequests = forceSingleRequests;
    while (cursor < candidates.length && summary.requests < maxRequests) {
      const chunkSize = useSingleRequests ? 1 : 20;
      const chunk = candidates.slice(cursor, cursor + chunkSize);
      const idValue = chunk.map((match) => match.match_id).join('-');
      const query = useSingleRequests ? `id=${idValue}` : `ids=${idValue}`;
      const response = await fetch(`https://v3.football.api-sports.io/fixtures?${query}`, {
        headers: { 'x-apisports-key': apiKey, Accept: 'application/json' },
      });
      summary.requests += 1;
      const data = await response.json();

      if (!response.ok || (data.errors && Object.keys(data.errors).length > 0)) {
        const errorText = Object.values(data.errors || {}).join(' ').toLowerCase();
        if (!useSingleRequests && errorText.includes('ids parameter')) {
          useSingleRequests = true;
          summary.requestMode = 'single-fallback';
          continue;
        }

        summary.providerErrors.push({
          fixtureIds: idValue,
          httpStatus: response.status,
          errors: data.errors || { http: response.statusText },
        });
        if (errorText.includes('request limit') || response.status === 429) break;
        if (useSingleRequests && data.errors?.plan) {
          await markUnsupported(chunk[0].match_id, Object.values(data.errors).join(', '));
        }
        cursor += chunkSize;
        continue;
      }

      summary.fixturesReturned += data.response?.length || 0;
      for (const item of data.response || []) {
        const saved = await saveFixtureDetails(item);
        summary.fixturesSaved += 1;
        if (saved.events > 0) summary.fixturesWithEvents += 1;
        if (saved.statistics) summary.fixturesWithStatistics += 1;
        if (saved.lineups) summary.fixturesWithLineups += 1;
      }
      cursor += chunkSize;
    }

    const remainingResult = await pool.query(`
      SELECT COUNT(*)::int AS count
      FROM match m
      LEFT JOIN match_detail_data d ON d.match_id = m.match_id
      WHERE m.status IN ('FT', 'AET', 'PEN')
        AND COALESCE(d.coverage->>'providerStatus', '') NOT IN ('FT', 'AET', 'PEN')
        AND ($1::boolean OR COALESCE(d.coverage->>'unsupported', 'false') <> 'true')
    `, [retryUnsupported]);
    summary.totalRemainingAfterRun = remainingResult.rows[0].count;
    const unsupportedAfterResult = await pool.query(`
      SELECT COUNT(*)::int AS count
      FROM match_detail_data
      WHERE coverage->>'unsupported' = 'true'
    `);
    summary.unsupportedMatches = unsupportedAfterResult.rows[0].count;
    console.log(JSON.stringify(summary, null, 2));
  }
} finally {
  await pool.end();
}
