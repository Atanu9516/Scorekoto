import { NextResponse } from 'next/server';
import pool from '@/app/lib/db';
import { getAdminFromRequest } from '@/app/lib/auth';

export const dynamic = 'force-dynamic';

// POST: Create a new player in PostgreSQL database
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
      first_name,
      last_name,
      team_id,
      primary_position,
      nationality,
      date_of_birth,
      market_value_euros,
      weight_cm,
      photo_url,
    } = body;

    if (!first_name || !first_name.trim() || !last_name || !last_name.trim()) {
      return NextResponse.json(
        { error: 'Both First Name and Last Name are required.' },
        { status: 400 }
      );
    }

    const cleanFirstName = first_name.trim();
    const cleanLastName = last_name.trim();
    const cleanPosition = primary_position ? primary_position.trim() : 'Midfielder';
    const cleanNationality = nationality ? nationality.trim() : null;
    const cleanDob = date_of_birth ? date_of_birth.trim() : null;
    const cleanMarketValue = market_value_euros ? parseFloat(market_value_euros) : 0;
    const cleanWeight = weight_cm ? parseFloat(weight_cm) : 0;
    const cleanPhoto = photo_url ? photo_url.trim() : null;

    let validTeamId = null;
    if (team_id) {
      const parsedTeamId = parseInt(team_id, 10);
      if (!isNaN(parsedTeamId)) {
        const teamCheck = await pool.query('SELECT team_id FROM team WHERE team_id = $1', [parsedTeamId]);
        if (teamCheck.rows.length > 0) {
          validTeamId = parsedTeamId;
        }
      }
    }

    const insertQuery = `
      INSERT INTO player (
        first_name,
        last_name,
        team_id,
        primary_position,
        nationality,
        date_of_birth,
        market_value_euros,
        weight_cm,
        photo_url,
        transfer_history
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, '[]'::jsonb)
      RETURNING *;
    `;

    const result = await pool.query(insertQuery, [
      cleanFirstName,
      cleanLastName,
      validTeamId,
      cleanPosition,
      cleanNationality,
      cleanDob || null,
      cleanMarketValue,
      cleanWeight,
      cleanPhoto,
    ]);

    const createdPlayer = result.rows[0];

    // Fetch team name if assigned
    let teamName = null;
    if (createdPlayer.team_id) {
      const teamRes = await pool.query('SELECT name FROM team WHERE team_id = $1', [createdPlayer.team_id]);
      if (teamRes.rows.length > 0) {
        teamName = teamRes.rows[0].name;
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Player created successfully in database',
        player: {
          ...createdPlayer,
          team_name: teamName,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Error creating player:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create player in database' },
      { status: 500 }
    );
  }
}

