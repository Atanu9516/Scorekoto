import { NextResponse } from 'next/server';
import pool from '../../../lib/db';

export async function GET(request, { params }) {
  try {
    const { team: teamParam } = await params;
    if (!teamParam) {
      return NextResponse.json({ error: 'Team identifier is required' }, { status: 400 });
    }

    const decoded = decodeURIComponent(teamParam).trim().toLowerCase();

    // 1. Find team by ID, slug, or name
    let teamQuery;
    let teamParams;

    if (Number.isInteger(Number(decoded)) && Number(decoded) > 0) {
      teamQuery = `SELECT * FROM team WHERE team_id = $1 LIMIT 1`;
      teamParams = [Number(decoded)];
    } else {
      teamQuery = `
        SELECT * FROM team 
        WHERE LOWER(name) = $1 
           OR LOWER(REPLACE(name, ' ', '-')) = $1
           OR LOWER(short_name) = $1
        LIMIT 1
      `;
      teamParams = [decoded];
    }

    const teamRes = await pool.query(teamQuery, teamParams);

    if (teamRes.rows.length === 0) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const teamData = teamRes.rows[0];
    const teamId = teamData.team_id;

    // Determine league and country from recent match / season if available
    const leagueQuery = `
      SELECT l.name as league_name, l.country
      FROM match m
      JOIN season s ON m.season_id = s.season_id
      JOIN league l ON s.league_id = l.league_id
      WHERE m.home_team_id = $1 OR m.away_team_id = $1
      ORDER BY m.match_date DESC
      LIMIT 1;
    `;
    const leagueRes = await pool.query(leagueQuery, [teamId]);
    const leagueInfo = leagueRes.rows[0] || {};

    // 2. Fetch Squad / Players from player table
    const playersQuery = `
      SELECT 
        player_id as id,
        CONCAT(first_name, ' ', last_name) as name,
        first_name,
        last_name,
        primary_position as position,
        nationality,
        date_of_birth,
        photo_url as photo,
        LOWER(REPLACE(CONCAT(first_name, ' ', last_name), ' ', '-')) as slug
      FROM player
      WHERE team_id = $1
      ORDER BY 
        CASE primary_position
          WHEN 'Goalkeeper' THEN 1
          WHEN 'Defender' THEN 2
          WHEN 'Midfielder' THEN 3
          WHEN 'Forward' THEN 4
          ELSE 5
        END,
        last_name ASC;
    `;
    const playersRes = await pool.query(playersQuery, [teamId]);

    // 3. Fetch Matches from match table
    const matchesQuery = `
      SELECT 
        m.match_id as id,
        m.status,
        m.match_date as "matchDate",
        m.home_score as "homeScore",
        m.away_score as "awayScore",
        ht.name as "homeTeam",
        ht.logo_url as "homeLogo",
        at.name as "awayTeam",
        at.logo_url as "awayLogo",
        COALESCE(l.name, 'League') as league
      FROM match m
      JOIN team ht ON m.home_team_id = ht.team_id
      JOIN team at ON m.away_team_id = at.team_id
      LEFT JOIN season s ON m.season_id = s.season_id
      LEFT JOIN league l ON s.league_id = l.league_id
      WHERE m.home_team_id = $1 OR m.away_team_id = $1
      ORDER BY m.match_date DESC
      LIMIT 100;
    `;
    const matchesRes = await pool.query(matchesQuery, [teamId]);
    const matches = matchesRes.rows;

    // 4. Calculate Stats from completed matches
    const completedMatches = matches.filter((m) => m.status === 'FT' || m.status === 'AET' || m.status === 'PEN');
    const stats = completedMatches.reduce(
      (acc, match) => {
        const isHome = match.homeTeam.toLowerCase() === teamData.name.toLowerCase();
        const goalsFor = isHome ? (match.homeScore ?? 0) : (match.awayScore ?? 0);
        const goalsAgainst = isHome ? (match.awayScore ?? 0) : (match.homeScore ?? 0);

        acc.played += 1;
        acc.goalsFor += goalsFor;
        acc.goalsAgainst += goalsAgainst;

        if (goalsFor > goalsAgainst) {
          acc.wins += 1;
        } else if (goalsFor === goalsAgainst) {
          acc.draws += 1;
        } else {
          acc.losses += 1;
        }

        return acc;
      },
      { played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 }
    );

    // 5. Fetch Trophies
    const trophiesQuery = `
      SELECT tt.season_won, t.name as trophy_name, t.type
      FROM team_trophy tt
      JOIN trophy t ON tt.trophy_id = t.trophy_id
      WHERE tt.team_id = $1
      ORDER BY tt.season_won DESC;
    `;
    const trophiesRes = await pool.query(trophiesQuery, [teamId]);

    const formattedTeam = {
      id: teamData.team_id,
      name: teamData.name,
      slug: teamData.name.toLowerCase().replaceAll(' ', '-'),
      shortName: teamData.short_name,
      stadium: teamData.stadium_name,
      logo: teamData.logo_url,
      history: teamData.history,
      manager: teamData.manager_name,
      country: leagueInfo.country || 'Global',
      league: leagueInfo.league_name || 'League',
    };

    return NextResponse.json({
      success: true,
      team: formattedTeam,
      players: playersRes.rows,
      matches: matches,
      stats: stats,
      trophies: trophiesRes.rows,
    });
  } catch (err) {
    console.error('Error fetching team details:', err);
    return NextResponse.json({ error: 'Failed to fetch team details' }, { status: 500 });
  }
}
