import { NextResponse } from 'next/server';
import pool from '../../../lib/db';
import { getLineupForMatch } from '@/app/lib/lineups';

function isFinishedStatus(status) {
  if (!status) return false;
  const s = String(status).toUpperCase();
  return ['FT', 'AET', 'PEN'].includes(s);
}

function isLiveStatus(status) {
  if (!status) return false;
  const s = String(status).toUpperCase();
  return ['LIVE', '1H', '2H', 'HT', 'ET', 'BT', 'P', 'IN_PLAY'].includes(s);
}

function calculateElapsedMinute(matchDate, status) {
  const s = String(status || '').toUpperCase();
  if (s === 'HT') return 'HT';
  if (isFinishedStatus(s)) return 'FT';
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

export async function GET(request, { params }) {
  try {
    const { id: matchIdParam } = await params;
    const matchId = Number(matchIdParam);

    if (!matchId || isNaN(matchId)) {
      return NextResponse.json({ error: 'Valid match ID is required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('forceRefresh') === 'true';

    // 1. Check PostgreSQL database
    const query = `
      SELECT 
        m.match_id as id,
        m.status,
        m.match_date as "matchDate",
        m.home_score as "homeScore",
        m.away_score as "awayScore",
        m.home_possession as "homePossession",
        m.away_possession as "awayPossession",
        m.venue,
        COALESCE(ht.name, 'Home Team') as "homeTeam",
        ht.logo_url as "homeLogo",
        ht.stadium_name as "stadium",
        COALESCE(at.name, 'Away Team') as "awayTeam",
        at.logo_url as "awayLogo",
        COALESCE(l.name, 'Football League') as league
      FROM match m
      LEFT JOIN team ht ON m.home_team_id = ht.team_id
      LEFT JOIN team at ON m.away_team_id = at.team_id
      LEFT JOIN season s ON m.season_id = s.season_id
      LEFT JOIN league l ON s.league_id = l.league_id
      WHERE m.match_id = $1
      LIMIT 1;
    `;
    const result = await pool.query(query, [matchId]);
    const dbRow = result.rows.length > 0 ? result.rows[0] : null;

    const isDbFinished = dbRow ? isFinishedStatus(dbRow.status) : false;
    const shouldFetchApi = !dbRow || forceRefresh || !isDbFinished;

    // 2. Fetch fresh live data from API-Sports if live, forceRefresh requested, or match not in DB
    const apiKey = process.env.API_SPORTS_KEY;
    if (shouldFetchApi && apiKey) {
      try {
        const liveRes = await fetch(`https://v3.football.api-sports.io/fixtures?id=${matchId}`, {
          headers: { 'x-apisports-key': apiKey, Accept: 'application/json' },
          cache: forceRefresh ? 'no-store' : 'default',
          next: { revalidate: forceRefresh ? 0 : 20 },
        });

        if (liveRes.ok) {
          const liveData = await liveRes.json();

          if (liveData.response && Array.isArray(liveData.response) && liveData.response.length > 0) {
            const item = liveData.response[0];
            const statusShort = item.fixture?.status?.short || '';
            const isFinished = isFinishedStatus(statusShort);
            const isUpcoming = ['NS', 'TBD', 'TIMED'].includes(statusShort);
            const isLive = isLiveStatus(statusShort);

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

            const homeScore = item.goals?.home ?? (isUpcoming ? null : 0);
            const awayScore = item.goals?.away ?? (isUpcoming ? null : 0);
            const resolvedStatus = isFinished ? 'FT' : isUpcoming ? 'UPCOMING' : 'LIVE';

            const formattedMatch = {
              id: item.fixture.id,
              homeTeam: item.teams?.home?.name || dbRow?.homeTeam || 'Home Team',
              awayTeam: item.teams?.away?.name || dbRow?.awayTeam || 'Away Team',
              homeLogo: item.teams?.home?.logo || dbRow?.homeLogo || null,
              awayLogo: item.teams?.away?.logo || dbRow?.awayLogo || null,
              homeScore: homeScore,
              awayScore: awayScore,
              status: resolvedStatus,
              minute:
                statusShort === 'HT'
                  ? 'HT'
                  : item.fixture?.status?.elapsed
                  ? `${item.fixture.status.elapsed}'`
                  : isUpcoming
                  ? 'TBD'
                  : isFinished
                  ? 'FT'
                  : 'LIVE',
              league: item.league?.name || dbRow?.league || 'Football League',
              venue: item.fixture?.venue?.name || dbRow?.venue || 'Stadium',
              matchDate: item.fixture?.date || dbRow?.matchDate,
              rawLineups: item.lineups || null,
              events: (item.events || []).map((e) => {
                const typeLower = (e.type || '').toLowerCase();
                const detailLower = (e.detail || '').toLowerCase();
                const isGoal = typeLower.includes('goal');
                const isCard = typeLower.includes('card');
                const isSub = typeLower.includes('sub');
                const isYellow = isCard && detailLower.includes('yellow');
                const isRed = isCard && (detailLower.includes('red') || detailLower.includes('second yellow'));
                const isOwn = isGoal && detailLower.includes('own');
                const isPen = isGoal && detailLower.includes('penalty');

                const eventType = isOwn
                  ? 'own-goal'
                  : isPen
                  ? 'penalty-goal'
                  : isGoal
                  ? 'goal'
                  : isYellow
                  ? 'yellow-card'
                  : isRed
                  ? 'red-card'
                  : isSub
                  ? 'substitution'
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

            // Update scoreline & status in database
            if (dbRow) {
              try {
                await pool.query(
                  `UPDATE match SET 
                     home_score = COALESCE($1, home_score), 
                     away_score = COALESCE($2, away_score), 
                     status = $3,
                     home_possession = COALESCE($4, home_possession),
                     away_possession = COALESCE($5, away_possession)
                   WHERE match_id = $6`,
                  [
                    homeScore,
                    awayScore,
                    resolvedStatus,
                    stats?.possession?.[0] ?? null,
                    stats?.possession?.[1] ?? null,
                    matchId,
                  ]
                );
              } catch (uErr) {
                console.warn('Could not update live match score in DB:', uErr.message);
              }
            } else if (isFinished) {
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
      } catch (apiErr) {
        console.warn('API-Sports single fixture lookup error:', apiErr.message);
      }
    }

    // 3. Fallback: Return match from PostgreSQL database
    if (dbRow) {
      const homePoss = dbRow.homePossession !== null && dbRow.homePossession !== undefined ? Number(dbRow.homePossession) : 52;
      const awayPoss = dbRow.awayPossession !== null && dbRow.awayPossession !== undefined ? Number(dbRow.awayPossession) : (100 - homePoss);
      const isLiveDb = isLiveStatus(dbRow.status);

      const formattedMatch = {
        id: dbRow.id,
        homeTeam: dbRow.homeTeam,
        awayTeam: dbRow.awayTeam,
        homeLogo: dbRow.homeLogo,
        awayLogo: dbRow.awayLogo,
        homeScore: dbRow.homeScore ?? 0,
        awayScore: dbRow.awayScore ?? 0,
        status: dbRow.status || 'FT',
        minute: isLiveDb
          ? calculateElapsedMinute(dbRow.matchDate, dbRow.status)
          : dbRow.status === 'HT'
          ? 'HT'
          : '',
        league: dbRow.league,
        venue: dbRow.venue || dbRow.stadium,
        matchDate: dbRow.matchDate,
        events: [],
        stats: {
          possession: [homePoss, awayPoss],
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

    let homeTeamId = rawItem?.teams?.home?.id;
    const dbHomeRes = await pool.query(
      `SELECT team_id FROM team WHERE LOWER(name) = LOWER($1) LIMIT 1`,
      [homeTeamName]
    );
    if (dbHomeRes.rows.length > 0) {
      homeTeamId = dbHomeRes.rows[0].team_id;
    } else if (!homeTeamId) {
      homeTeamId = matchId * 10 + 1;
    }

    let awayTeamId = rawItem?.teams?.away?.id;
    const dbAwayRes = await pool.query(
      `SELECT team_id FROM team WHERE LOWER(name) = LOWER($1) LIMIT 1`,
      [awayTeamName]
    );
    if (dbAwayRes.rows.length > 0) {
      awayTeamId = dbAwayRes.rows[0].team_id;
    } else if (!awayTeamId) {
      awayTeamId = matchId * 10 + 2;
    }

    let seasonId = 1;
    const rawLeagueId = rawItem?.league?.id;
    if (rawLeagueId) {
      const sRes = await pool.query(
        `SELECT season_id FROM season WHERE league_id = $1 ORDER BY season_id DESC LIMIT 1`,
        [rawLeagueId]
      );
      if (sRes.rows.length > 0) seasonId = sRes.rows[0].season_id;
    }
    if (seasonId === 1) {
      const seasonRes = await pool.query('SELECT season_id FROM season LIMIT 1');
      if (seasonRes.rows.length > 0) {
        seasonId = seasonRes.rows[0].season_id;
      }
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
