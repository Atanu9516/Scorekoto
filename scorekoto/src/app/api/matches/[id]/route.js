import { NextResponse } from 'next/server';
import pool from '../../../lib/db';
import fallbackMatches from '@/data/matches';
import { getLineupForMatch } from '@/app/lib/lineups';

export async function GET(request, { params }) {
  try {
    const { id: matchIdParam } = await params;
    const matchId = Number(matchIdParam);

    if (!matchId || isNaN(matchId)) {
      return NextResponse.json({ error: 'Valid match ID is required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('forceRefresh') === 'true';

    // 1. Check API-Sports live/official fixture first
    const apiKey = process.env.API_SPORTS_KEY;
    if (apiKey) {
      try {
        const liveRes = await fetch(`https://v3.football.api-sports.io/fixtures?id=${matchId}`, {
          headers: { 'x-apisports-key': apiKey, Accept: 'application/json' },
          cache: forceRefresh ? 'no-store' : 'default',
          next: { revalidate: forceRefresh ? 0 : 30 },
        });

        if (!liveRes.ok) {
          console.warn(`API-Sports HTTP ${liveRes.status} in single match API. Falling back to DB.`);
        } else {
          const liveData = await liveRes.json();

          if (liveData.errors && Object.keys(liveData.errors).length > 0) {
            const errMsg = Object.values(liveData.errors).join(', ');
            console.warn('API-Sports notice in single match API:', errMsg, '-> Falling back to DB.');
          } else if (liveData.response && Array.isArray(liveData.response) && liveData.response.length > 0) {
            const item = liveData.response[0];
            const statusShort = item.fixture?.status?.short;
            const isFinished = statusShort === 'FT' || statusShort === 'AET' || statusShort === 'PEN';
            const isUpcoming = statusShort === 'NS' || statusShort === 'TBD';

          let stats = null;
          if (item.statistics && item.statistics.length >= 2) {
            const homeStatMap = Object.fromEntries(
              (item.statistics[0].statistics || []).map((s) => [s.type, s.value])
            );
            const awayStatMap = Object.fromEntries(
              (item.statistics[1].statistics || []).map((s) => [s.type, s.value])
            );

            const parseStat = (val) => {
              if (val === null || val === undefined) return 0;
              return parseInt(String(val).replace('%', ''), 10) || 0;
            };

            stats = {
              possession: [
                parseStat(homeStatMap['Ball Possession'] || 50),
                parseStat(awayStatMap['Ball Possession'] || 50),
              ],
              shots: [
                parseStat(homeStatMap['Total Shots'] || 0),
                parseStat(awayStatMap['Total Shots'] || 0),
              ],
              shotsOnTarget: [
                parseStat(homeStatMap['Shots on Goal'] || 0),
                parseStat(awayStatMap['Shots on Goal'] || 0),
              ],
              corners: [
                parseStat(homeStatMap['Corner Kicks'] || 0),
                parseStat(awayStatMap['Corner Kicks'] || 0),
              ],
              fouls: [
                parseStat(homeStatMap['Fouls'] || 0),
                parseStat(awayStatMap['Fouls'] || 0),
              ],
              offsides: [
                parseStat(homeStatMap['Offsides'] || 0),
                parseStat(awayStatMap['Offsides'] || 0),
              ],
              yellowCards: [
                parseStat(homeStatMap['Yellow Cards'] || 0),
                parseStat(awayStatMap['Yellow Cards'] || 0),
              ],
              redCards: [
                parseStat(homeStatMap['Red Cards'] || 0),
                parseStat(awayStatMap['Red Cards'] || 0),
              ],
            };
          }

          const formattedMatch = {
            id: item.fixture.id,
            homeTeam: item.teams.home.name,
            awayTeam: item.teams.away.name,
            homeLogo: item.teams.home.logo,
            awayLogo: item.teams.away.logo,
            homeScore: item.goals.home ?? (isUpcoming ? null : 0),
            awayScore: item.goals.away ?? (isUpcoming ? null : 0),
            status: isFinished ? 'FT' : isUpcoming ? 'UPCOMING' : 'LIVE',
            minute:
              statusShort === 'HT'
                ? 'HT'
                : item.fixture.status.elapsed
                ? `${item.fixture.status.elapsed}'`
                : isUpcoming
                ? 'TBD'
                : 'LIVE',
            league: item.league.name || 'Football League',
            venue: item.fixture.venue?.name || 'Stadium',
            matchDate: item.fixture.date,
            rawLineups: item.lineups || null,
            events: (item.events || []).map((e) => ({
              minute: `${e.time.elapsed}'`,
              type: e.type.toLowerCase().includes('goal')
                ? 'goal'
                : e.type.toLowerCase().includes('card')
                ? e.detail?.toLowerCase().includes('yellow')
                  ? 'yellow-card'
                  : 'red-card'
                : 'substitution',
              player: e.player?.name || 'Player',
              team: e.team?.name || '',
              assist: e.assist?.name || null,
            })),
            stats: stats || {
              possession: [50, 50],
              shots: [8, 6],
              shotsOnTarget: [4, 3],
              corners: [5, 4],
              fouls: [9, 10],
              offsides: [1, 1],
              yellowCards: [1, 2],
              redCards: [0, 0],
            },
          };

          // Auto-save/persist official match, teams, and squad players into PostgreSQL
          if (isFinished) {
            await saveFinishedMatchToDb(formattedMatch, item);
          }

          const lineupData = await getLineupForMatch(formattedMatch, item.lineups);
          return NextResponse.json({
            success: true,
            match: formattedMatch,
            lineup: lineupData,
          });
        }
      }
      } catch (e) {
        console.error('API-Sports single fixture error:', e);
      }
    }

    // 2. Fallback to PostgreSQL database
    const query = `
      SELECT 
        m.match_id as id,
        m.status,
        m.match_date as "matchDate",
        m.home_score as "homeScore",
        m.away_score as "awayScore",
        m.venue,
        ht.name as "homeTeam",
        ht.logo_url as "homeLogo",
        ht.stadium_name as "stadium",
        at.name as "awayTeam",
        at.logo_url as "awayLogo",
        COALESCE(l.name, 'Football League') as league
      FROM match m
      JOIN team ht ON m.home_team_id = ht.team_id
      JOIN team at ON m.away_team_id = at.team_id
      LEFT JOIN season s ON m.season_id = s.season_id
      LEFT JOIN league l ON s.league_id = l.league_id
      WHERE m.match_id = $1
      LIMIT 1;
    `;
    const result = await pool.query(query, [matchId]);

    if (result.rows.length > 0) {
      const row = result.rows[0];

      const formattedMatch = {
        id: row.id,
        homeTeam: row.homeTeam,
        awayTeam: row.awayTeam,
        homeLogo: row.homeLogo,
        awayLogo: row.awayLogo,
        homeScore: row.homeScore ?? 0,
        awayScore: row.awayScore ?? 0,
        status: row.status || 'FT',
        minute: row.status === 'LIVE' ? "65'" : '',
        league: row.league,
        venue: row.venue || row.stadium,
        matchDate: row.matchDate,
        events: [],
        stats: {
          possession: [52, 48],
          shots: [11, 8],
          shotsOnTarget: [5, 3],
          corners: [6, 4],
          fouls: [10, 12],
          offsides: [2, 1],
          yellowCards: [1, 2],
          redCards: [0, 0],
        },
      };

      const lineupData = await getLineupForMatch(formattedMatch);

      return NextResponse.json({
        success: true,
        match: formattedMatch,
        lineup: lineupData,
      });
    }

    // 3. Fallback to static matches
    const fallbackMatch = fallbackMatches.find((m) => m.id === matchId);
    if (fallbackMatch) {
      const lineupData = await getLineupForMatch(fallbackMatch);
      return NextResponse.json({
        success: true,
        match: fallbackMatch,
        lineup: lineupData,
      });
    }

    return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  } catch (err) {
    console.error('Error fetching match details:', err);
    return NextResponse.json({ error: 'Failed to fetch match details' }, { status: 500 });
  }
}

// Helper to parse player names
function parsePlayerName(fullName) {
  if (!fullName) return { firstName: 'Football', lastName: 'Player' };
  const parts = fullName.trim().split(' ');
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts.slice(-1).join(' '),
  };
}

function mapPlayerPos(pos) {
  if (pos === 'G') return 'Goalkeeper';
  if (pos === 'D') return 'Defender';
  if (pos === 'M') return 'Midfielder';
  if (pos === 'F') return 'Forward';
  return 'Midfielder';
}

// Auto-save finished match, teams, and squad players to PostgreSQL database
async function saveFinishedMatchToDb(formattedMatch, rawItem) {
  try {
    const matchId = formattedMatch.id;
    const homeTeamName = formattedMatch.homeTeam;
    const awayTeamName = formattedMatch.awayTeam;
    const homeLogo = formattedMatch.homeLogo || null;
    const awayLogo = formattedMatch.awayLogo || null;
    const homeScore = typeof formattedMatch.homeScore === 'number' ? formattedMatch.homeScore : 0;
    const awayScore = typeof formattedMatch.awayScore === 'number' ? formattedMatch.awayScore : 0;
    const venue = formattedMatch.venue || 'Stadium';
    const matchDate = formattedMatch.matchDate || new Date();
    const status = formattedMatch.status || 'FT';

    const homeTeamId = rawItem?.teams?.home?.id || matchId * 10 + 1;
    const awayTeamId = rawItem?.teams?.away?.id || matchId * 10 + 2;

    let seasonId = 1;
    const seasonRes = await pool.query('SELECT season_id FROM season LIMIT 1');
    if (seasonRes.rows.length > 0) {
      seasonId = seasonRes.rows[0].season_id;
    }

    // 1. Ensure home team in DB
    await pool.query(
      `INSERT INTO team (team_id, name, logo_url, stadium_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (team_id) DO UPDATE SET 
         name = EXCLUDED.name, 
         logo_url = COALESCE(EXCLUDED.logo_url, team.logo_url)`,
      [homeTeamId, homeTeamName, homeLogo, venue]
    );

    // 2. Ensure away team in DB
    await pool.query(
      `INSERT INTO team (team_id, name, logo_url, stadium_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (team_id) DO UPDATE SET 
         name = EXCLUDED.name, 
         logo_url = COALESCE(EXCLUDED.logo_url, team.logo_url)`,
      [awayTeamId, awayTeamName, awayLogo, venue]
    );

    // 3. Upsert match in DB
    await pool.query(
      `INSERT INTO match (match_id, season_id, home_team_id, away_team_id, match_date, venue, status, home_score, away_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (match_id) DO UPDATE SET
         status = EXCLUDED.status,
         home_score = EXCLUDED.home_score,
         away_score = EXCLUDED.away_score,
         venue = EXCLUDED.venue,
         match_date = EXCLUDED.match_date`,
      [matchId, seasonId, homeTeamId, awayTeamId, matchDate, venue, status, homeScore, awayScore]
    );

    // 4. Upsert players from starting XI and substitutes into player table
    if (rawItem?.lineups && Array.isArray(rawItem.lineups)) {
      for (const teamLineup of rawItem.lineups) {
        const tId = teamLineup.team?.id;
        if (!tId) continue;
        const allPlayers = [
          ...(teamLineup.startXI || []).map((p) => p.player),
          ...(teamLineup.substitutes || []).map((p) => p.player),
        ];
        for (const p of allPlayers) {
          if (!p || !p.id) continue;
          const { firstName, lastName } = parsePlayerName(p.name);
          const position = mapPlayerPos(p.pos);
          try {
            await pool.query(
              `INSERT INTO player (player_id, team_id, first_name, last_name, primary_position)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (player_id) DO UPDATE SET
                 team_id = EXCLUDED.team_id,
                 first_name = EXCLUDED.first_name,
                 last_name = EXCLUDED.last_name,
                 primary_position = COALESCE(EXCLUDED.primary_position, player.primary_position)`,
              [p.id, tId, firstName, lastName, position]
            );
          } catch (pErr) {
            // Ignore individual player conflict
          }
        }
      }
    }
  } catch (dbErr) {
    console.warn('Database auto-save notice for finished match:', dbErr.message);
  }
}
