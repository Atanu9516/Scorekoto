import { NextResponse } from 'next/server';
import pool from '../../lib/db';
import { hasKnownKickoffTime } from '../../lib/kickoff-time';
import { getLineupForMatch } from '../../lib/lineups';
import { saveMatchDetails } from '../../lib/match-details';

// In-memory cache for matches by date and live fixtures
let liveCache = {
  timestamp: 0,
  data: [],
  apiLimitHit: false,
  message: '',
};

const dateCache = new Map(); // key: `${dateParam}` -> { timestamp, data, apiLimitHit, message }
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

const competitionNames = {
  2: 'UEFA Champions League',
  4: 'Euro Championship',
  13: 'Copa Libertadores',
  39: 'Premier League',
  40: 'Championship',
  61: 'Ligue 1',
  78: 'Bundesliga',
  88: 'Eredivisie',
  94: 'Primeira Liga',
  135: 'Serie A',
  140: 'La Liga',
  307: 'Saudi Pro League',
};

function getCompetitionName(leagueId, leagueName) {
  return leagueName || competitionNames[Number(leagueId)] || 'Competition unavailable';
}

// Helper to get stored league IDs and names from PostgreSQL database
async function getStoredLeagues() {
  try {
    const res = await pool.query('SELECT league_id, name FROM league');
    const ids = new Set(res.rows.map((r) => r.league_id));
    const names = res.rows.map((r) => r.name.toLowerCase());
    return { ids, names };
  } catch (err) {
    console.error('Error fetching stored leagues:', err);
    return {
      ids: new Set([1, 2, 4, 5, 6, 7, 9, 13, 39, 40, 61, 78, 88, 94, 135, 140, 307]),
      names: [
        'premier league',
        'la liga',
        'serie a',
        'bundesliga',
        'ligue 1',
        'uefa champions league',
        'championship',
        'eredivisie',
        'primeira liga',
        'pro league',
        'world cup',
        'euro championship',
        'uefa nations league',
        'africa cup of nations',
        'asian cup',
        'copa america',
        'conmebol libertadores',
      ],
    };
  }
}

function calculateElapsedMinute(matchDate, status) {
  const s = String(status || '').toUpperCase();
  if (s === 'HT') return 'HT';
  if (['FT', 'AET', 'PEN'].includes(s)) return 'FT';
  if (!matchDate) return 'LIVE';

  const start = new Date(matchDate).getTime();
  const now = Date.now();
  const diffMinutes = Math.floor((now - start) / (60 * 1000));
  if (diffMinutes < 0) return 'TBD';
  if (diffMinutes <= 45) return `${Math.max(1, diffMinutes)}'`;
  if (diffMinutes <= 60) return 'HT';
  if (diffMinutes <= 105) return `${diffMinutes - 15}'`;
  return "90+'";
}

function getDateString(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

function mapApiStatistics(item) {
  if (!Array.isArray(item.statistics) || item.statistics.length < 2) return null;
  const home = item.statistics.find(
    (entry) => Number(entry.team?.id) === Number(item.teams?.home?.id)
  ) || item.statistics[0];
  const away = item.statistics.find(
    (entry) => Number(entry.team?.id) === Number(item.teams?.away?.id)
  ) || item.statistics[1];
  const homeMap = Object.fromEntries((home.statistics || []).map((stat) => [stat.type, stat.value]));
  const awayMap = Object.fromEntries((away.statistics || []).map((stat) => [stat.type, stat.value]));
  const parse = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(String(value).replace('%', '').trim());
    return Number.isFinite(parsed) ? parsed : null;
  };
  const pair = (type) => [parse(homeMap[type]), parse(awayMap[type])];
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

// Map API-Sports raw fixture to standard Scorekoto format
function mapApiFixture(item, dateLabel = 'today') {
  const statusShort = item.fixture?.status?.short || '';
  const isFinished = ['FT', 'AET', 'PEN'].includes(statusShort);
  const isUpcoming = ['NS', 'TBD', 'TIMED'].includes(statusShort);
  const isLive = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE'].includes(statusShort);

  return {
    id: item.fixture.id,
    date: dateLabel,
    homeTeam: item.teams.home.name,
    awayTeam: item.teams.away.name,
    homeTeamId: item.teams?.home?.id || null,
    awayTeamId: item.teams?.away?.id || null,
    homeLogo: item.teams?.home?.logo || null,
    awayLogo: item.teams?.away?.logo || null,
    homeScore: item.goals?.home ?? null,
    awayScore: item.goals?.away ?? null,
    status: isFinished ? statusShort : isUpcoming ? 'UPCOMING' : isLive ? 'LIVE' : statusShort,
    providerStatus: statusShort,
    minute:
      statusShort === 'HT'
        ? 'HT'
        : item.fixture?.status?.elapsed
        ? `${item.fixture.status.elapsed}'`
        : isUpcoming
        ? hasKnownKickoffTime(item.fixture?.date, statusShort) ? null : 'TBD'
        : isFinished
        ? 'FT'
        : isLive
        ? 'LIVE'
        : statusShort,
    leagueId: item.league?.id || null,
    league: getCompetitionName(item.league?.id, item.league?.name),
    leagueSeason: item.league?.season || null,
    leagueCountry: item.league?.country || 'World',
    leagueLogo: item.league?.logo || null,
    matchDate: item.fixture?.date,
    venue: item.fixture?.venue?.name || null,
    events: (item.events || []).map((e) => {
      const typeLower = (e.type || '').toLowerCase();
      const detailLower = (e.detail || '').toLowerCase();
      const isGoal = typeLower.includes('goal');
      const isCard = typeLower.includes('card');
      const isSub = typeLower.includes('subst') || typeLower.includes('sub');
      const isMissedPenalty = isGoal && detailLower.includes('missed penalty');
      const isRed = isCard && (detailLower.includes('red') || detailLower.includes('second yellow'));
      const isYellow = isCard && detailLower.includes('yellow') && !isRed;
      const isOwn = isGoal && detailLower.includes('own');
      const isPen = isGoal && detailLower.includes('penalty') && !isMissedPenalty;

      const eventType = isMissedPenalty
        ? 'missed-penalty'
        : isOwn
        ? 'own-goal'
        : isPen
        ? 'penalty-goal'
        : isGoal
        ? 'goal'
        : isRed
        ? 'red-card'
        : isYellow
        ? 'yellow-card'
        : isSub
        ? 'substitution'
        : typeLower.includes('var')
        ? 'var'
        : 'event';

      return {
        minute: e.time?.extra ? `${e.time.elapsed}+${e.time.extra}'` : `${e.time?.elapsed || 0}'`,
        type: eventType,
        player: e.player?.name?.trim() || '',
        team: e.team?.name?.trim() || '',
        assist: isSub ? null : (e.assist?.name?.trim() || null),
        playerIn: isSub ? (e.assist?.name?.trim() || null) : null,
        playerOut: isSub ? (e.player?.name?.trim() || null) : null,
        detail: e.detail || '',
      };
    }),
    stats: mapApiStatistics(item),
    rawLineups: item.lineups || null,
  };
}

// Background auto-save of matches to PostgreSQL
async function autoSaveFixturesToDb(fixtures) {
  if (!fixtures || fixtures.length === 0) return;
  try {
    for (const f of fixtures) {
      if (!f.id || !f.matchDate || !f.homeTeamId || !f.awayTeamId) continue;
      try {
        let homeId = f.homeTeamId;
        if (!homeId) {
          const htRes = await pool.query(
            `SELECT team_id FROM team WHERE LOWER(name) = LOWER($1) LIMIT 1`,
            [f.homeTeam]
          );
          homeId = htRes.rows[0]?.team_id;
        }

        let awayId = f.awayTeamId;
        if (!awayId) {
          const atRes = await pool.query(
            `SELECT team_id FROM team WHERE LOWER(name) = LOWER($1) LIMIT 1`,
            [f.awayTeam]
          );
          awayId = atRes.rows[0]?.team_id;
        }

        if (!homeId || !awayId) continue;

        // Upsert teams
        await pool.query(
          `INSERT INTO team (team_id, name, logo_url, stadium_name)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (team_id) DO UPDATE SET
             name = EXCLUDED.name,
             logo_url = COALESCE(EXCLUDED.logo_url, team.logo_url)`,
          [homeId, f.homeTeam, f.homeLogo, null]
        );

        await pool.query(
          `INSERT INTO team (team_id, name, logo_url, stadium_name)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (team_id) DO UPDATE SET
             name = EXCLUDED.name,
             logo_url = COALESCE(EXCLUDED.logo_url, team.logo_url)`,
          [awayId, f.awayTeam, f.awayLogo, null]
        );

        // Keep the fixture attached to its actual competition instead of the first season in the database.
        let seasonId = null;
        if (f.leagueId) {
          const leagueName = getCompetitionName(f.leagueId, f.league);
          await pool.query(
            `INSERT INTO league (league_id, name, country, type, logo_url)
             VALUES ($1, $2, $3, 'League', $4)
             ON CONFLICT (league_id) DO UPDATE SET
               name = EXCLUDED.name,
               country = EXCLUDED.country,
               logo_url = COALESCE(EXCLUDED.logo_url, league.logo_url)`,
            [f.leagueId, leagueName, f.leagueCountry || 'World', f.leagueLogo || null]
          );

          const seasonYear = Number(f.leagueSeason);
          if (!seasonYear) continue;
          const seasonRes = await pool.query(
            `SELECT season_id FROM season
             WHERE league_id = $1 AND SPLIT_PART(year, '-', 1) = $2
             ORDER BY season_id DESC LIMIT 1`,
            [f.leagueId, String(seasonYear)]
          );

          if (seasonRes.rows.length > 0) {
            seasonId = seasonRes.rows[0].season_id;
          } else {
            const insertSeason = await pool.query(
              `INSERT INTO season (league_id, year, start_date, end_date)
               VALUES ($1, $2, $3, $4)
               RETURNING season_id`,
              [
                f.leagueId,
                `${seasonYear}-${seasonYear + 1}`,
                `${seasonYear}-07-01`,
                `${seasonYear + 1}-06-30`,
              ]
            );
            seasonId = insertSeason.rows[0]?.season_id;
          }
        }

        if (!seasonId) continue;

        // Upsert match
        await pool.query(
          `INSERT INTO match (match_id, season_id, home_team_id, away_team_id, match_date, venue, status, home_score, away_score)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (match_id) DO UPDATE SET
             season_id = EXCLUDED.season_id,
             home_team_id = EXCLUDED.home_team_id,
             away_team_id = EXCLUDED.away_team_id,
             status = EXCLUDED.status,
             home_score = EXCLUDED.home_score,
             away_score = EXCLUDED.away_score,
             match_date = EXCLUDED.match_date,
             venue = EXCLUDED.venue`,
          [
            f.id,
            seasonId,
            homeId,
            awayId,
            f.matchDate,
            f.venue || null,
            f.status,
            f.homeScore,
            f.awayScore,
          ]
        );

        const lineup = await getLineupForMatch(f, f.rawLineups);
        if (f.events.length > 0 || f.stats || lineup) {
          await saveMatchDetails(f.id, {
            events: f.events,
            stats: f.stats,
            lineup,
            providerStatus: f.providerStatus,
          });
        }
      } catch (err) {
        // Ignore individual fixture conflict
      }
    }
  } catch (outerErr) {
    console.warn('Auto-save fixtures notice:', outerErr.message);
  }
}

// Fetch live matches from API-Sports
async function fetchLiveMatchesFromApi(storedLeagues, forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && (now - liveCache.timestamp < CACHE_TTL_MS) && liveCache.data.length > 0) {
    return {
      matches: liveCache.data,
      apiLimitHit: liveCache.apiLimitHit,
      message: liveCache.message,
    };
  }

  const apiKey = process.env.API_SPORTS_KEY;
  if (!apiKey) {
    return { matches: [], apiLimitHit: false, message: '' };
  }

  try {
    const res = await fetch('https://v3.football.api-sports.io/fixtures?live=all', {
      method: 'GET',
      headers: { 'x-apisports-key': apiKey, Accept: 'application/json' },
      cache: forceRefresh ? 'no-store' : 'default',
      next: { revalidate: forceRefresh ? 0 : 25 },
    });

    const data = await res.json();

    if (data.errors && Object.keys(data.errors).length > 0) {
      const errMsg = Object.values(data.errors).join(', ');
      console.warn('API-Sports notice:', errMsg);
      liveCache = {
        timestamp: now,
        data: [],
        apiLimitHit: true,
        message: 'Live match API quota reached. Displaying fixtures from database.',
      };
      return { matches: [], apiLimitHit: true, message: liveCache.message };
    }

    if (data.response && Array.isArray(data.response) && data.response.length > 0) {
      const filtered = data.response.filter((item) =>
        storedLeagues.ids.has(item.league?.id) &&
        item.fixture?.id &&
        item.fixture?.date &&
        item.teams?.home?.id &&
        item.teams?.away?.id &&
        item.teams?.home?.name &&
        item.teams?.away?.name
      );
      const formatted = filtered.map((item) => mapApiFixture(item, 'today'));

      autoSaveFixturesToDb(formatted).catch(() => {});

      liveCache = {
        timestamp: now,
        data: formatted,
        apiLimitHit: false,
        message: '',
      };
      return { matches: liveCache.data, apiLimitHit: false, message: '' };
    }

    liveCache = { timestamp: now, data: [], apiLimitHit: false, message: '' };
    return { matches: [], apiLimitHit: false, message: '' };
  } catch (err) {
    console.error('Error fetching live matches:', err);
    return { matches: [], apiLimitHit: false, message: '' };
  }
}

// Fetch fixtures by specific calendar date from API-Sports
async function fetchFixturesByDate(dateStr, dateLabel, storedLeagues, forceRefresh = false) {
  const cacheKey = `${dateLabel}_${dateStr}`;
  const now = Date.now();
  const cached = dateCache.get(cacheKey);

  if (!forceRefresh && cached && (now - cached.timestamp < CACHE_TTL_MS * 2)) {
    return cached;
  }

  const apiKey = process.env.API_SPORTS_KEY;
  if (!apiKey) {
    return { matches: [], apiLimitHit: false, message: '' };
  }

  try {
    const res = await fetch(`https://v3.football.api-sports.io/fixtures?date=${dateStr}`, {
      method: 'GET',
      headers: { 'x-apisports-key': apiKey, Accept: 'application/json' },
      cache: forceRefresh ? 'no-store' : 'default',
      next: { revalidate: forceRefresh ? 0 : 60 },
    });

    const data = await res.json();

    if (data.errors && Object.keys(data.errors).length > 0) {
      const errMsg = Object.values(data.errors).join(', ');
      console.warn(`API-Sports notice for date ${dateStr}:`, errMsg);
      const result = {
        matches: [],
        apiLimitHit: true,
        message: 'API quota reached. Showing database records.',
      };
      dateCache.set(cacheKey, { timestamp: now, ...result });
      return result;
    }

    if (data.response && Array.isArray(data.response)) {
      const filtered = data.response.filter((item) =>
        storedLeagues.ids.has(item.league?.id) &&
        item.fixture?.id &&
        item.fixture?.date &&
        item.teams?.home?.id &&
        item.teams?.away?.id &&
        item.teams?.home?.name &&
        item.teams?.away?.name
      );
      const formatted = filtered.map((item) => mapApiFixture(item, dateLabel));

      // Preserve every provider payload so detail data is not discarded during list synchronization.
      autoSaveFixturesToDb(formatted).catch(() => {});

      const result = { matches: formatted, apiLimitHit: false, message: '' };
      dateCache.set(cacheKey, { timestamp: now, ...result });
      return result;
    }
  } catch (err) {
    console.error(`Error fetching fixtures for date ${dateStr}:`, err);
  }

  return { matches: [], apiLimitHit: false, message: '' };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = (searchParams.get('date') || 'today').toLowerCase();
    const forceRefresh = searchParams.get('forceRefresh') === 'true';

    const yesterdayDate = getDateString(-1);
    const todayDate = getDateString(0);
    const tomorrowDate = getDateString(1);
    const dayAfterTomorrowDate = getDateString(2);

    // 1. Get stored leagues from DB
    const storedLeagues = await getStoredLeagues();
    const leagueIdsArray = Array.from(storedLeagues.ids);

    const baseSelect = `
      SELECT 
        m.match_id as id,
        m.status,
        m.match_date as "matchDate",
        m.home_score as "homeScore",
        m.away_score as "awayScore",
        m.home_possession as "homePossession",
        m.away_possession as "awayPossession",
        ht.name as "homeTeam",
        ht.logo_url as "homeLogo",
        at.name as "awayTeam",
        at.logo_url as "awayLogo",
        l.league_id as "leagueId",
        l.name as league
      FROM match m
      JOIN team ht ON m.home_team_id = ht.team_id
      JOIN team at ON m.away_team_id = at.team_id
      JOIN season s ON m.season_id = s.season_id
      JOIN league l ON s.league_id = l.league_id
    `;

    // ==========================================
    // CASE A: YESTERDAY'S MATCHES
    // ==========================================
    if (dateParam === 'yesterday') {
      const apiResult = await fetchFixturesByDate(yesterdayDate, 'yesterday', storedLeagues, forceRefresh);
      let finishedMatches = [...apiResult.matches.filter((m) => m.status === 'FT')];

      // Query database for yesterday's matches or recent finished matches
      try {
        const dbRes = await pool.query(
          `${baseSelect}
           WHERE m.status IN ('FT', 'AET', 'PEN')
             AND (l.league_id = ANY($1::int[]) OR l.league_id IS NULL)
             AND (m.match_date >= $2::timestamp AND m.match_date < $3::timestamp)
           ORDER BY m.match_date DESC
           LIMIT 50`,
          [leagueIdsArray, `${yesterdayDate} 00:00:00`, `${todayDate} 00:00:00`]
        );

        const dbMatches = dbRes.rows.map((row) => ({
          id: row.id,
          date: 'yesterday',
          homeTeam: row.homeTeam,
          awayTeam: row.awayTeam,
          homeLogo: row.homeLogo,
          awayLogo: row.awayLogo,
          homeScore: row.homeScore ?? 0,
          awayScore: row.awayScore ?? 0,
          status: row.status || 'FT',
          minute: '',
          league: getCompetitionName(row.leagueId, row.league),
          events: [],
          stats: null,
        }));

        // Merge: Avoid duplicates by match id
        for (const dbm of dbMatches) {
          if (!finishedMatches.some((m) => m.id === dbm.id)) {
            finishedMatches.push(dbm);
          }
        }

      } catch (dbErr) {
        console.warn('DB yesterday matches query error:', dbErr.message);
      }

      return NextResponse.json({
        success: true,
        date: yesterdayDate,
        liveMatches: [],
        upcomingMatches: [],
        finishedMatches,
        apiLimitHit: apiResult.apiLimitHit,
        apiMessage: apiResult.message,
      });
    }

    // ==========================================
    // CASE B: TOMORROW'S MATCHES
    // ==========================================
    if (dateParam === 'tomorrow') {
      const apiResult = await fetchFixturesByDate(tomorrowDate, 'tomorrow', storedLeagues, forceRefresh);
      let upcomingMatches = [...apiResult.matches.filter((m) => m.status === 'UPCOMING' || m.status === 'NS')];

      // Query database for upcoming scheduled fixtures
      try {
        const dbRes = await pool.query(
          `${baseSelect}
           WHERE m.status IN ('NS', 'UPCOMING', 'TBD', 'TIMED')
             AND (l.league_id = ANY($1::int[]) OR l.league_id IS NULL)
             AND m.match_date >= $2::timestamp
             AND m.match_date < $3::timestamp
           ORDER BY m.match_date ASC
           LIMIT 40`,
          [leagueIdsArray, `${tomorrowDate} 00:00:00`, `${dayAfterTomorrowDate} 00:00:00`]
        );

        const dbMatches = dbRes.rows.map((row) => ({
          id: row.id,
          date: 'tomorrow',
          homeTeam: row.homeTeam,
          awayTeam: row.awayTeam,
          homeLogo: row.homeLogo,
          awayLogo: row.awayLogo,
          homeScore: null,
          awayScore: null,
          status: 'UPCOMING',
          providerStatus: row.status,
          minute: hasKnownKickoffTime(row.matchDate, row.status) ? null : 'TBD',
          matchDate: row.matchDate,
          league: getCompetitionName(row.leagueId, row.league),
          events: [],
          stats: null,
        }));

        for (const dbm of dbMatches) {
          if (!upcomingMatches.some((m) => m.id === dbm.id)) {
            upcomingMatches.push(dbm);
          }
        }
      } catch (dbErr) {
        console.warn('DB tomorrow matches query error:', dbErr.message);
      }

      return NextResponse.json({
        success: true,
        date: tomorrowDate,
        liveMatches: [],
        finishedMatches: [],
        upcomingMatches,
        apiLimitHit: apiResult.apiLimitHit,
        apiMessage: apiResult.message,
      });
    }

    // ==========================================
    // CASE C: TODAY'S MATCHES (DEFAULT)
    // ==========================================
    const liveResult = await fetchLiveMatchesFromApi(storedLeagues, forceRefresh);
    const todayApiResult = await fetchFixturesByDate(todayDate, 'today', storedLeagues, forceRefresh);

    let dbFinishedMatches = [];
    let dbLiveMatches = [];
    let dbUpcomingMatches = [];

    try {
      // 1. Finished Matches
      const finishedRes = await pool.query(
        `${baseSelect}
         WHERE m.status IN ('FT', 'AET', 'PEN')
           AND (l.league_id = ANY($1::int[]) OR l.league_id IS NULL)
           AND m.match_date >= $2::timestamp
           AND m.match_date < $3::timestamp
         ORDER BY m.match_date DESC
         LIMIT 60`,
        [leagueIdsArray, `${todayDate} 00:00:00`, `${tomorrowDate} 00:00:00`]
      );
      dbFinishedMatches = finishedRes.rows.map((row) => ({
        id: row.id,
        date: 'today',
        homeTeam: row.homeTeam,
        awayTeam: row.awayTeam,
        homeLogo: row.homeLogo,
        awayLogo: row.awayLogo,
        homeScore: row.homeScore ?? 0,
        awayScore: row.awayScore ?? 0,
        status: row.status || 'FT',
        minute: '',
        league: getCompetitionName(row.leagueId, row.league),
        events: [],
        stats: null,
      }));

      // 2. Live Matches in PostgreSQL
      const liveDbRes = await pool.query(
        `${baseSelect}
         WHERE m.status IN ('LIVE', '1H', 'HT', '2H', 'ET', 'BT', 'P', 'SUSP', 'INT')
           AND m.match_date >= $1::timestamp
           AND m.match_date < $2::timestamp
         ORDER BY m.match_date DESC
         LIMIT 20`,
        [`${todayDate} 00:00:00`, `${tomorrowDate} 00:00:00`]
      );
      dbLiveMatches = liveDbRes.rows.map((row) => ({
        id: row.id,
        date: 'today',
        homeTeam: row.homeTeam,
        awayTeam: row.awayTeam,
        homeLogo: row.homeLogo,
        awayLogo: row.awayLogo,
        homeScore: row.homeScore ?? 0,
        awayScore: row.awayScore ?? 0,
        status: 'LIVE',
        minute: calculateElapsedMinute(row.matchDate, row.status),
        league: getCompetitionName(row.leagueId, row.league),
        events: [],
        stats: null,
      }));

      // 3. Upcoming Matches in PostgreSQL
      const upcomingRes = await pool.query(
        `${baseSelect}
         WHERE m.status IN ('NS', 'UPCOMING', 'TBD', 'TIMED')
           AND m.match_date >= $1::timestamp
           AND m.match_date < $2::timestamp
         ORDER BY m.match_date ASC
         LIMIT 30`,
        [`${todayDate} 00:00:00`, `${tomorrowDate} 00:00:00`]
      );
      dbUpcomingMatches = upcomingRes.rows.map((row) => ({
        id: row.id,
        date: 'today',
        homeTeam: row.homeTeam,
        awayTeam: row.awayTeam,
        homeLogo: row.homeLogo,
        awayLogo: row.awayLogo,
        homeScore: null,
        awayScore: null,
        status: 'UPCOMING',
        providerStatus: row.status,
        minute: hasKnownKickoffTime(row.matchDate, row.status) ? null : 'TBD',
        matchDate: row.matchDate,
        league: getCompetitionName(row.leagueId, row.league),
        events: [],
        stats: null,
      }));
    } catch (dbErr) {
      console.error('Failed to query matches from DB:', dbErr);
    }

    const apiTodayMatches = todayApiResult.matches || [];
    const apiTodayFinished = apiTodayMatches.filter((match) => match.status === 'FT');
    const apiTodayUpcoming = apiTodayMatches.filter((match) => match.status === 'UPCOMING');
    const apiTodayLive = apiTodayMatches.filter((match) => match.status === 'LIVE');

    dbFinishedMatches = apiTodayFinished.length > 0 ? apiTodayFinished : dbFinishedMatches;
    dbUpcomingMatches = apiTodayUpcoming.length > 0 ? apiTodayUpcoming : dbUpcomingMatches;

    // Merge live matches
    const combinedLiveMatches = apiTodayLive.length > 0 ? [...apiTodayLive] : [...dbLiveMatches];
    for (const apiMatch of liveResult.matches) {
      if (!combinedLiveMatches.some((m) => m.id === apiMatch.id)) {
        combinedLiveMatches.push(apiMatch);
      }
    }

    return NextResponse.json({
      success: true,
      date: todayDate,
      liveMatches: combinedLiveMatches,
      apiLimitHit: liveResult.apiLimitHit || todayApiResult.apiLimitHit,
      apiMessage: liveResult.message || todayApiResult.message,
      finishedMatches: dbFinishedMatches,
      upcomingMatches: dbUpcomingMatches,
    });
  } catch (err) {
    console.error('Error in matches API:', err);
    return NextResponse.json({
      success: true,
      liveMatches: [],
      apiLimitHit: false,
      apiMessage: '',
      finishedMatches: [],
      upcomingMatches: [],
    });
  }
}
