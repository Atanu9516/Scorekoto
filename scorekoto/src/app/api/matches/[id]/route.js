import { NextResponse } from 'next/server';
import pool from '../../../lib/db';
import { getLineupForMatch } from '@/app/lib/lineups';
import {
  getHeadToHead,
  getStoredMatchDetails,
  recordMatchDetailAttempt,
  saveMatchDetails,
  shouldRefreshMatchDetails,
} from '@/app/lib/match-details';
import { hasKnownKickoffTime } from '@/app/lib/kickoff-time';

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
        m.home_rating as "homeRating",
        m.away_rating as "awayRating",
        m.venue,
        m.home_team_id as "homeTeamId",
        m.away_team_id as "awayTeamId",
        ht.name as "homeTeam",
        ht.logo_url as "homeLogo",
        ht.stadium_name as "stadium",
        at.name as "awayTeam",
        at.logo_url as "awayLogo",
        l.name as league
      FROM match m
      JOIN team ht ON m.home_team_id = ht.team_id
      JOIN team at ON m.away_team_id = at.team_id
      JOIN season s ON m.season_id = s.season_id
      JOIN league l ON s.league_id = l.league_id
      WHERE m.match_id = $1
      LIMIT 1;
    `;
    const result = await pool.query(query, [matchId]);
    const dbRow = result.rows.length > 0 ? result.rows[0] : null;

    const storedDetails = dbRow ? await getStoredMatchDetails({
      ...dbRow,
      homePossession: dbRow.homePossession === null ? null : Number(dbRow.homePossession),
      awayPossession: dbRow.awayPossession === null ? null : Number(dbRow.awayPossession),
      homeRating: dbRow.homeRating === null ? null : Number(dbRow.homeRating),
      awayRating: dbRow.awayRating === null ? null : Number(dbRow.awayRating),
    }) : null;
    const shouldFetchApi = !dbRow || shouldRefreshMatchDetails(dbRow, storedDetails, forceRefresh);
    let providerMessage = null;

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

          if (liveData.errors && Object.keys(liveData.errors).length > 0) {
            providerMessage = 'Provider request limit reached; showing saved match data.';
            if (dbRow) {
              await recordMatchDetailAttempt(matchId, Object.values(liveData.errors).join(', '));
            }
          }

          if (liveData.response && Array.isArray(liveData.response) && liveData.response.length > 0) {
            const item = liveData.response[0];
            if (!item.fixture?.id || !item.fixture?.date || !item.teams?.home?.name || !item.teams?.away?.name) {
              throw new Error('Incomplete fixture payload from API-Sports');
            }
            const statusShort = item.fixture?.status?.short || '';
            const isFinished = isFinishedStatus(statusShort);
            const isUpcoming = ['NS', 'TBD', 'TIMED'].includes(statusShort);
            const isLive = isLiveStatus(statusShort);

            let stats = null;
            if (item.statistics && item.statistics.length >= 2) {
              const homeStatistics = item.statistics.find(
                (entry) => Number(entry.team?.id) === Number(item.teams.home.id)
              ) || item.statistics[0];
              const awayStatistics = item.statistics.find(
                (entry) => Number(entry.team?.id) === Number(item.teams.away.id)
              ) || item.statistics[1];
              const homeStatMap = Object.fromEntries(
                (homeStatistics.statistics || []).map((s) => [s.type, s.value])
              );
              const awayStatMap = Object.fromEntries(
                (awayStatistics.statistics || []).map((s) => [s.type, s.value])
              );

              const parseStat = (val) => {
                if (val === null || val === undefined) return null;
                const parsed = Number(String(val).replace('%', '').trim());
                return Number.isFinite(parsed) ? parsed : null;
              };

              const pair = (type) => [parseStat(homeStatMap[type]), parseStat(awayStatMap[type])];

              stats = {
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

              if (!Object.values(stats).some((values) => values.some((value) => value !== null))) {
                stats = null;
              }
            }

            const homeScore = item.goals?.home ?? null;
            const awayScore = item.goals?.away ?? null;
            const resolvedStatus = isFinished
              ? statusShort
              : isUpcoming
              ? 'UPCOMING'
              : isLive
              ? 'LIVE'
              : statusShort;

            const formattedMatch = {
              id: item.fixture.id,
              homeTeamId: item.teams.home.id,
              awayTeamId: item.teams.away.id,
              homeTeam: item.teams.home.name,
              awayTeam: item.teams.away.name,
              homeLogo: item.teams?.home?.logo || dbRow?.homeLogo || null,
              awayLogo: item.teams?.away?.logo || dbRow?.awayLogo || null,
              homeScore: homeScore,
              awayScore: awayScore,
              status: resolvedStatus,
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
              league: item.league?.name || dbRow?.league || 'Competition unavailable',
              venue: item.fixture?.venue?.name || dbRow?.venue || null,
              matchDate: item.fixture?.date || dbRow?.matchDate,
              rawLineups: item.lineups || null,
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
              stats,
            };

            // Persist every authoritative API field so stale relationships are corrected too.
            try {
              await saveApiMatchToDb(formattedMatch, item);
              await pool.query(
                `UPDATE match SET
                   home_possession = COALESCE($1, home_possession),
                   away_possession = COALESCE($2, away_possession)
                 WHERE match_id = $3`,
                [stats?.possession?.[0] ?? null, stats?.possession?.[1] ?? null, matchId]
              );
            } catch (uErr) {
              console.warn('Could not persist API match data:', uErr.message);
            }

            const lineupData = await getLineupForMatch(formattedMatch, item.lineups, item.players);
            await saveMatchDetails(matchId, {
              events: formattedMatch.events,
              stats: formattedMatch.stats,
              lineup: lineupData,
              providerStatus: statusShort,
              playerRatingsChecked: Array.isArray(item.players),
            });
            formattedMatch.h2h = await getHeadToHead(formattedMatch);
            return NextResponse.json({
              success: true,
              match: formattedMatch,
              lineup: lineupData,
            });
          }
        } else {
          providerMessage = `The live provider returned HTTP ${liveRes.status}; showing saved match data.`;
          if (dbRow) {
            await recordMatchDetailAttempt(matchId, `HTTP ${liveRes.status}`);
          }
        }
      } catch (apiErr) {
        console.warn('API-Sports single fixture lookup error:', apiErr.message);
        providerMessage = 'The live provider is temporarily unavailable; showing saved match data.';
        if (dbRow) {
          await recordMatchDetailAttempt(matchId, apiErr.message).catch(() => {});
        }
      }
    }

    // 3. Fallback: Return match from PostgreSQL database
    if (dbRow) {
      const isLiveDb = isLiveStatus(dbRow.status);

      const formattedMatch = {
        id: dbRow.id,
        homeTeamId: dbRow.homeTeamId,
        awayTeamId: dbRow.awayTeamId,
        homeTeam: dbRow.homeTeam,
        awayTeam: dbRow.awayTeam,
        homeLogo: dbRow.homeLogo,
        awayLogo: dbRow.awayLogo,
        homeScore: dbRow.homeScore,
        awayScore: dbRow.awayScore,
        homePossession: dbRow.homePossession === null ? null : Number(dbRow.homePossession),
        awayPossession: dbRow.awayPossession === null ? null : Number(dbRow.awayPossession),
        homeRating: dbRow.homeRating === null ? null : Number(dbRow.homeRating),
        awayRating: dbRow.awayRating === null ? null : Number(dbRow.awayRating),
        status: dbRow.status,
        providerStatus: dbRow.status,
        minute: isLiveDb
          ? calculateElapsedMinute(dbRow.matchDate, dbRow.status)
          : dbRow.status === 'HT'
          ? 'HT'
          : ['NS', 'UPCOMING', 'TBD', 'TIMED', 'PST'].includes(String(dbRow.status).toUpperCase())
          ? hasKnownKickoffTime(dbRow.matchDate, dbRow.status) ? null : 'TBD'
          : '',
        league: dbRow.league,
        venue: dbRow.venue || dbRow.stadium,
        matchDate: dbRow.matchDate,
        events: [],
        stats: null,
      };

      const details = storedDetails || await getStoredMatchDetails(formattedMatch);
      formattedMatch.events = details.events;
      formattedMatch.stats = details.stats;
      formattedMatch.h2h = await getHeadToHead(formattedMatch);
      const lineupData = details.lineup || await getLineupForMatch(formattedMatch);

      return NextResponse.json({
        success: true,
        match: formattedMatch,
        lineup: lineupData,
        providerMessage,
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
  if (!fullName) return { firstName: null, lastName: '' };
  const parts = fullName.trim().split(' ');
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
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
  return null;
}

// Save authoritative match, competition, teams, and available squad players.
async function saveApiMatchToDb(formattedMatch, rawItem) {
  try {
    const matchId = formattedMatch.id;
    const homeTeamName = formattedMatch.homeTeam;
    const awayTeamName = formattedMatch.awayTeam;
    const homeLogo = formattedMatch.homeLogo || null;
    const awayLogo = formattedMatch.awayLogo || null;
    const homeScore = typeof formattedMatch.homeScore === 'number' ? formattedMatch.homeScore : null;
    const awayScore = typeof formattedMatch.awayScore === 'number' ? formattedMatch.awayScore : null;
    const venue = formattedMatch.venue || null;
    const matchDate = formattedMatch.matchDate || new Date();
    const status = formattedMatch.status || 'FT';

    let homeTeamId = rawItem?.teams?.home?.id;
    if (!homeTeamId) {
      const dbHomeRes = await pool.query(
        `SELECT team_id FROM team WHERE LOWER(name) = LOWER($1) LIMIT 1`,
        [homeTeamName]
      );
      homeTeamId = dbHomeRes.rows[0]?.team_id;
    }

    let awayTeamId = rawItem?.teams?.away?.id;
    if (!awayTeamId) {
      const dbAwayRes = await pool.query(
        `SELECT team_id FROM team WHERE LOWER(name) = LOWER($1) LIMIT 1`,
        [awayTeamName]
      );
      awayTeamId = dbAwayRes.rows[0]?.team_id;
    }

    const rawLeagueId = rawItem?.league?.id;
    const seasonYear = Number(rawItem?.league?.season);
    if (!rawLeagueId || !seasonYear || !homeTeamId || !awayTeamId) {
      console.warn(`Skipped match ${matchId}: authoritative league, season, or team IDs are missing.`);
      return;
    }

    await pool.query(
      `INSERT INTO league (league_id, name, country, type, logo_url)
       VALUES ($1, $2, $3, 'League', $4)
       ON CONFLICT (league_id) DO UPDATE SET
         name = EXCLUDED.name,
         country = EXCLUDED.country,
         logo_url = COALESCE(EXCLUDED.logo_url, league.logo_url)`,
      [rawLeagueId, rawItem.league.name, rawItem.league.country || 'World', rawItem.league.logo || null]
    );

    let seasonRes = await pool.query(
      `SELECT season_id FROM season
       WHERE league_id = $1 AND SPLIT_PART(year, '-', 1) = $2
       ORDER BY season_id DESC LIMIT 1`,
      [rawLeagueId, String(seasonYear)]
    );
    if (seasonRes.rows.length === 0) {
      seasonRes = await pool.query(
        `INSERT INTO season (league_id, year, start_date, end_date)
         VALUES ($1, $2, $3, $4) RETURNING season_id`,
        [rawLeagueId, `${seasonYear}-${seasonYear + 1}`, `${seasonYear}-07-01`, `${seasonYear + 1}-06-30`]
      );
    }
    const seasonId = seasonRes.rows[0].season_id;

    // 1. Ensure home team in DB
    await pool.query(
      `INSERT INTO team (team_id, name, logo_url, stadium_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (team_id) DO UPDATE SET 
         name = EXCLUDED.name, 
         logo_url = COALESCE(EXCLUDED.logo_url, team.logo_url)`,
      [homeTeamId, homeTeamName, homeLogo, null]
    );

    // 2. Ensure away team in DB
    await pool.query(
      `INSERT INTO team (team_id, name, logo_url, stadium_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (team_id) DO UPDATE SET 
         name = EXCLUDED.name, 
         logo_url = COALESCE(EXCLUDED.logo_url, team.logo_url)`,
      [awayTeamId, awayTeamName, awayLogo, null]
    );

    // 3. Upsert match in DB
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
          if (!p || !p.id || !p.name?.trim()) continue;
          const { firstName, lastName } = parsePlayerName(p.name);
          const position = mapPlayerPos(p.pos);
          try {
            await pool.query(
              `INSERT INTO player (player_id, team_id, first_name, last_name, primary_position)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (player_id) DO UPDATE SET
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
