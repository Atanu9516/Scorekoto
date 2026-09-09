import { NextResponse } from 'next/server';
import pool from '@/app/lib/db';
import { getAdminFromRequest } from '@/app/lib/auth';

// PUT: Update player attributes in database
export async function PUT(request, { params }) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized. Administrator privileges required.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const playerId = Number(id);

    if (!playerId || isNaN(playerId)) {
      return NextResponse.json(
        { error: 'Invalid player ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      first_name,
      last_name,
      primary_position,
      nationality,
      date_of_birth,
      market_value_euros,
      weight_cm,
      photo_url,
      team_id,
    } = body;

    const updateQuery = `
      UPDATE player
      SET 
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        primary_position = COALESCE($3, primary_position),
        nationality = COALESCE($4, nationality),
        date_of_birth = COALESCE($5, date_of_birth),
        market_value_euros = COALESCE($6, market_value_euros),
        weight_cm = COALESCE($7, weight_cm),
        photo_url = COALESCE($8, photo_url),
        team_id = COALESCE($9, team_id)
      WHERE player_id = $10
      RETURNING *;
    `;

    const result = await pool.query(updateQuery, [
      first_name || null,
      last_name || null,
      primary_position || null,
      nationality || null,
      date_of_birth || null,
      market_value_euros !== undefined ? parseFloat(market_value_euros) : null,
      weight_cm !== undefined ? parseFloat(weight_cm) : null,
      photo_url || null,
      team_id !== undefined ? parseInt(team_id, 10) : null,
      playerId,
    ]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Player not found in database' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Player attributes updated successfully in database',
      player: result.rows[0],
    });
  } catch (err) {
    console.error('Error updating player:', err);
    return NextResponse.json(
      { error: 'Failed to update player attributes' },
      { status: 500 }
    );
  }
}
