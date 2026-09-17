import { NextResponse } from 'next/server';
import pool from '../../lib/db';

// In-memory cache for live matches to prevent burning API quota on rapid reloads
let liveCache = {
  timestamp: 0,
  data: [],
  apiLimitHit: false,
  message: '',
};
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

// Helper to get stored league IDs and names from PostgreSQL database
async function getStoredLeagues() {
  try {
    const res = await pool.query('SELECT league_id, name FROM league');
    const ids = new Set(res.rows.map((r) => r.league_id));
    const names = res.rows.map((r) => r.name.toLowerCase());
    return { ids, names };
  } catch (err) {
    console.error('Error fetching stored leagues:', err);
    // Default to the 17 core stored league IDs
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
    return {
      matches: [],
      apiLimitHit: false,
      message: '',
    };
  }

  try {
    const res = await fetch('https://v3.football.api-sports.io/fixtures?live=all', {
      method: 'GET',
      headers: {
        'x-apisports-key': apiKey,
        'Accept': 'application/json',
      },
      cache: forceRefresh ? 'no-store' : 'default',
      next: { revalidate: forceRefresh ? 0 : 30 },
    });

    const data = await res.json();

    // Check for API errors or quota limits
    if (data.errors && Object.keys(data.errors).length > 0) {
      const errMsg = Object.values(data.errors).join(', ');
      console.warn('API-Sports notice:', errMsg, '-> Showing database matches.');
      liveCache = {
        timestamp: now,
        data: [],
        apiLimitHit: true,
        message: 'Live match API quota reached. Displaying fixtures and matches from our PostgreSQL database.',
      };
      return {
        matches: [],
        apiLimitHit: true,
        message: liveCache.message,
      };
    }

    if (data.response && Array.isArray(data.response) && data.response.length > 0) {
      // Filter live fixtures strictly and exclusively by stored database league IDs
      const filteredFixtures = data.response.filter((item) => {
        const leagueId = item.league ? item.league.id : null;
        return storedLeagues.ids.has(leagueId);
      });

      const formatted = filteredFixtures.map((item) => ({
        id: item.fixture.id,
        date: 'today',
        homeTeam: item.teams.home.name,
        awayTeam: item.teams.away.name,
        homeLogo: item.teams.home.logo,
        awayLogo: item.teams.away.logo,
        homeScore: item.goals.home ?? 0,
        awayScore: item.goals.away ?? 0,
        status: 'LIVE',
        minute:
          item.fixture.status.short === 'HT'
            ? 'HT'
            : item.fixture.status.elapsed
            ? `${item.fixture.status.elapsed}'`
            : 'LIVE',
        league: item.league.name || 'Football League',
        events: (item.events || []).map((e) => ({
          minute: `${e.time.elapsed}'`,
          type: e.type.toLowerCase().includes('goal')
            ? 'goal'
            : e.type.toLowerCase().includes('card')
            ? e.detail?.toLowerCase().includes('yellow')
              ? 'yellow-card'
              : 'red-card'
            : 'substitution',
          player: e.player.name,
          team: e.team.name,
          assist: e.assist?.name || null,
        })),
        stats: null,
      }));

      liveCache = {
        timestamp: now,
        data: formatted,
        apiLimitHit: false,
        message: '',
      };
      return {
        matches: liveCache.data,
        apiLimitHit: liveCache.apiLimitHit,
        message: liveCache.message,
      };
    }

    liveCache = {
      timestamp: now,
      data: [],
      apiLimitHit: false,
      message: '',
    };
    return {
      matches: liveCache.data,
      apiLimitHit: liveCache.apiLimitHit,
      message: liveCache.message,
    };
  } catch (err) {
    console.error('Error fetching live matches:', err);
    liveCache = {
      timestamp: now,
      data: [],
      apiLimitHit: false,
      message: '',
    };
    return {
      matches: liveCache.data,
      apiLimitHit: liveCache.apiLimitHit,
      message: liveCache.message,
    };
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date') || 'today';
    const forceRefresh = searchParams.get('forceRefresh') === 'true';

    // 1. Get stored leagues from DB
    const storedLeagues = await getStoredLeagues();

    // 2. Fetch live matches (filtered strictly by stored leagues)
    const liveResult = await fetchLiveMatchesFromApi(storedLeagues, forceRefresh);

    // 3. Query PostgreSQL for matches (Primary source of truth for admin updates)
    let dbFinishedMatches = [];
    let dbLiveMatches = [];
    let dbUpcomingMatches = [];

    try {
      const leagueIdsArray = Array.from(storedLeagues.ids);

      // Base select
      const baseSelect = `
        SELECT 
          m.match_id as id,
          m.status,
          m.match_date as "matchDate",
          m.home_score as "homeScore",
          m.away_score as "awayScore",
          m.home_possession as "homePossession",
          m.away_possession as "awayPossession",
          COALESCE(ht.name, 'Home Team') as "homeTeam",
          ht.logo_url as "homeLogo",
          COALESCE(at.name, 'Away Team') as "awayTeam",
          at.logo_url as "awayLogo",
          COALESCE(l.name, 'Premier League') as league
        FROM match m
        LEFT JOIN team ht ON m.home_team_id = ht.team_id
        LEFT JOIN team at ON m.away_team_id = at.team_id
        LEFT JOIN season s ON m.season_id = s.season_id
        LEFT JOIN league l ON s.league_id = l.league_id
      `;

      // 3a. Finished Matches
      const finishedQuery = `
        ${baseSelect}
        WHERE m.status IN ('FT', 'AET', 'PEN')
          AND (l.league_id = ANY($1::int[]) OR l.league_id IS NULL)
        ORDER BY m.match_date DESC
        LIMIT 60;
      `;
      const finishedRes = await pool.query(finishedQuery, [leagueIdsArray]);
      dbFinishedMatches = finishedRes.rows.map((row) => ({
        id: row.id,
        date: dateParam,
        homeTeam: row.homeTeam,
        awayTeam: row.awayTeam,
        homeLogo: row.homeLogo,
        awayLogo: row.awayLogo,
        homeScore: row.homeScore ?? 0,
        awayScore: row.awayScore ?? 0,
        status: row.status || 'FT',
        minute: '',
        league: row.league,
        events: [],
        stats: null,
      }));

      // 3b. Live Matches in PostgreSQL (e.g. set by Admin in Admin Console)
      const liveDbQuery = `
        ${baseSelect}
        WHERE m.status = 'LIVE'
        ORDER BY m.match_date DESC
        LIMIT 20;
      `;
      const liveDbRes = await pool.query(liveDbQuery);
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
        minute: "65'",
        league: row.league,
        events: [],
        stats: null,
      }));

      // 3c. Upcoming Matches in PostgreSQL
      const upcomingQuery = `
        ${baseSelect}
        WHERE m.status IN ('NS', 'UPCOMING', 'TBD', 'TIMED', 'POSTPONED')
        ORDER BY m.match_date ASC
        LIMIT 30;
      `;
      const upcomingRes = await pool.query(upcomingQuery);
      dbUpcomingMatches = upcomingRes.rows.map((row) => ({
        id: row.id,
        date: 'tomorrow',
        homeTeam: row.homeTeam,
        awayTeam: row.awayTeam,
        homeLogo: row.homeLogo,
        awayLogo: row.awayLogo,
        homeScore: null,
        awayScore: null,
        status: 'UPCOMING',
        minute: 'TBD',
        league: row.league,
        events: [],
        stats: null,
      }));
    } catch (dbErr) {
      console.error('Failed to query matches from DB:', dbErr);
    }

    // Merge API live matches with DB live matches (DB takes precedence on matching ID)
    const combinedLiveMatches = [...dbLiveMatches];
    for (const apiMatch of liveResult.matches) {
      if (!combinedLiveMatches.some((m) => m.id === apiMatch.id)) {
        combinedLiveMatches.push(apiMatch);
      }
    }

    // Prepare response based on selected date
    let finalFinished = dbFinishedMatches;
    let finalLive = combinedLiveMatches;
    let finalUpcoming = dbUpcomingMatches;

    if (dateParam === 'yesterday') {
      finalLive = [];
      finalUpcoming = [];
    } else if (dateParam === 'tomorrow') {
      finalLive = [];
    }

    return NextResponse.json({
      success: true,
      liveMatches: finalLive,
      apiLimitHit: liveResult.apiLimitHit,
      apiMessage: liveResult.message,
      finishedMatches: finalFinished,
      upcomingMatches: finalUpcoming,
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
