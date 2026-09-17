import { NextResponse } from 'next/server';
import pool from '@/app/lib/db';
import { getAdminFromRequest } from '@/app/lib/auth';

export const dynamic = 'force-dynamic';

// POST: Create a new team in PostgreSQL database
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
      name,
      short_name,
      stadium_name,
      manager_name,
      history,
      logo_url,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Team name is required' },
        { status: 400 }
      );
    }

    const cleanName = name.trim();
    const cleanShortName = short_name ? short_name.trim() : null;
    const cleanStadium = stadium_name ? stadium_name.trim() : null;
    const cleanManager = manager_name ? manager_name.trim() : null;
    const cleanHistory = history ? history.trim() : null;
    const cleanLogo = logo_url ? logo_url.trim() : null;

    const insertQuery = `
      INSERT INTO team (name, short_name, stadium_name, manager_name, history, logo_url)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;

    const result = await pool.query(insertQuery, [
      cleanName,
      cleanShortName,
      cleanStadium,
      cleanManager,
      cleanHistory,
      cleanLogo,
    ]);

    return NextResponse.json(
      {
        success: true,
        message: 'Team created successfully in database',
        team: result.rows[0],
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Error creating team:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create team in database' },
      { status: 500 }
    );
  }
}

