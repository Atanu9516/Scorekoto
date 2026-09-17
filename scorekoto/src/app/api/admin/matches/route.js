import { NextResponse } from 'next/server';
import pool from '@/app/lib/db';
import { getAdminFromRequest } from '@/app/lib/auth';

export const dynamic = 'force-dynamic';

// POST: Create a new match in PostgreSQL database
export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized. Administrator privileges required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      home_team_id,
      away_team_id,
      season_id,
      match_date,
      venue,
      status,
      home_score,
      away_score,
      home_possession,
      away_possession,
    } = body;

    const homeId = parseInt(home_team_id, 10);
    const awayId = parseInt(away_team_id, 10);

    if (!homeId || isNaN(homeId) || !awayId || isNaN(awayId)) {
      return NextResponse.json(
        { error: 'Both Home Team and Away Team must be selected.' },
        { status: 400 }
      );
    }

    if (homeId === awayId) {
      return NextResponse.json(
        { error: 'Home Team and Away Team cannot be the same club.' },
        { status: 400 }
      );
    }

    // Verify both teams exist
    const teamCheck = await pool.query(
      'SELECT team_id, name, stadium_name FROM team WHERE team_id IN ($1, $2)',
      [homeId, awayId]
    );

    if (teamCheck.rows.length < 2) {
      return NextResponse.json(
        { error: 'One or both selected teams do not exist in the database.' },
        { status: 400 }
      );
    }

    const homeTeam = teamCheck.rows.find((t) => t.team_id === homeId);
    const awayTeam = teamCheck.rows.find((t) => t.team_id === awayId);

    // Resolve season
    let resolvedSeasonId = parseInt(season_id, 10);
    if (!resolvedSeasonId || isNaN(resolvedSeasonId)) {
      const defaultSeasonRes = await pool.query(
        'SELECT season_id FROM season ORDER BY season_id DESC LIMIT 1'
      );
      if (defaultSeasonRes.rows.length > 0) {
        resolvedSeasonId = defaultSeasonRes.rows[0].season_id;
      } else {
        return NextResponse.json(
          { error: 'No seasons found in database. Please create a season first.' },
          { status: 400 }
        );
      }
    } else {
      const seasonCheck = await pool.query('SELECT season_id FROM season WHERE season_id = $1', [resolvedSeasonId]);
      if (seasonCheck.rows.length === 0) {
        return NextResponse.json(
          { error: 'Selected season does not exist.' },
          { status: 400 }
        );
      }
    }

    const matchVenue = venue && venue.trim() ? venue.trim() : (homeTeam.stadium_name || 'Home Stadium');
    const matchStatus = status && status.trim() ? status.trim() : 'UPCOMING';
    const parsedHomeScore = home_score !== undefined && home_score !== '' ? parseInt(home_score, 10) : 0;
    const parsedAwayScore = away_score !== undefined && away_score !== '' ? parseInt(away_score, 10) : 0;
    const parsedHomePossession = home_possession !== undefined && home_possession !== '' ? parseFloat(home_possession) : 50;
    const parsedAwayPossession = away_possession !== undefined && away_possession !== '' ? parseFloat(away_possession) : 50;
    const parsedDate = match_date && match_date.trim() ? new Date(match_date).toISOString() : new Date().toISOString();

    const insertQuery = `
      INSERT INTO match (
        season_id,
        home_team_id,
        away_team_id,
        match_date,
        venue,
        status,
        home_score,
        away_score,
        home_possession,
        away_possession
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `;

    const result = await pool.query(insertQuery, [
      resolvedSeasonId,
      homeId,
      awayId,
      parsedDate,
      matchVenue,
      matchStatus,
      parsedHomeScore,
      parsedAwayScore,
      parsedHomePossession,
      parsedAwayPossession,
    ]);

    const createdMatch = result.rows[0];

    // Fetch league name for display
    const leagueRes = await pool.query(`
      SELECT l.name as league_name
      FROM season s
      JOIN league l ON s.league_id = l.league_id
      WHERE s.season_id = $1
    `, [resolvedSeasonId]);

    const leagueName = leagueRes.rows.length > 0 ? leagueRes.rows[0].league_name : 'League';

    return NextResponse.json(
      {
        success: true,
        message: 'Match created successfully in database',
        match: {
          ...createdMatch,
          home_team: homeTeam.name,
          away_team: awayTeam.name,
          league: leagueName,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Error creating match:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create match in database' },
      { status: 500 }
    );
  }
}

