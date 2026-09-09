import { NextResponse } from 'next/server';
import pool from '@/app/lib/db';
import { getAdminFromRequest } from '@/app/lib/auth';

// PUT: Update match attributes in database
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
    const matchId = Number(id);

    if (!matchId || isNaN(matchId)) {
      return NextResponse.json(
        { error: 'Invalid match ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      home_score,
      away_score,
      status,
      venue,
      match_date,
      home_possession,
      away_possession,
    } = body;

    const updateQuery = `
      UPDATE match
      SET 
        home_score = COALESCE($1, home_score),
        away_score = COALESCE($2, away_score),
        status = COALESCE($3, status),
        venue = COALESCE($4, venue),
        match_date = COALESCE($5, match_date),
        home_possession = COALESCE($6, home_possession),
        away_possession = COALESCE($7, away_possession)
      WHERE match_id = $8
      RETURNING *;
    `;

    const result = await pool.query(updateQuery, [
      home_score !== undefined ? parseInt(home_score, 10) : null,
      away_score !== undefined ? parseInt(away_score, 10) : null,
      status || null,
      venue || null,
      match_date || null,
      home_possession !== undefined ? parseFloat(home_possession) : null,
      away_possession !== undefined ? parseFloat(away_possession) : null,
      matchId,
    ]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Match not found in database' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Match attributes updated successfully in database',
      match: result.rows[0],
    });
  } catch (err) {
    console.error('Error updating match:', err);
    return NextResponse.json(
      { error: 'Failed to update match attributes' },
      { status: 500 }
    );
  }
}
