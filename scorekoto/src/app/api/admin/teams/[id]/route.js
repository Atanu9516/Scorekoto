import { NextResponse } from 'next/server';
import pool from '@/app/lib/db';
import { getAdminFromRequest } from '@/app/lib/auth';

// PUT: Update team attributes in database
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
    const teamId = Number(id);

    if (!teamId || isNaN(teamId)) {
      return NextResponse.json(
        { error: 'Invalid team ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      name,
      short_name,
      stadium_name,
      manager_name,
      history,
      logo_url,
    } = body;

    const updateQuery = `
      UPDATE team
      SET 
        name = COALESCE($1, name),
        short_name = COALESCE($2, short_name),
        stadium_name = COALESCE($3, stadium_name),
        manager_name = COALESCE($4, manager_name),
        history = COALESCE($5, history),
        logo_url = COALESCE($6, logo_url)
      WHERE team_id = $7
      RETURNING *;
    `;

    const result = await pool.query(updateQuery, [
      name || null,
      short_name || null,
      stadium_name || null,
      manager_name || null,
      history || null,
      logo_url || null,
      teamId,
    ]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Team not found in database' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Team attributes updated successfully in database',
      team: result.rows[0],
    });
  } catch (err) {
    console.error('Error updating team:', err);
    return NextResponse.json(
      { error: 'Failed to update team attributes' },
      { status: 500 }
    );
  }
}
