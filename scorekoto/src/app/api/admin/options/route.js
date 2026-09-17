import { NextResponse } from 'next/server';
import pool from '@/app/lib/db';
import { getAdminFromRequest } from '@/app/lib/auth';

export const dynamic = 'force-dynamic';

// GET: Fetch teams and seasons for admin dropdowns
export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin privileges required.' },
        { status: 403 }
      );
    }

    // Fetch teams
    const teamsRes = await pool.query(`
      SELECT team_id, name, short_name, logo_url
      FROM team
      ORDER BY name ASC;
    `);

    // Fetch seasons with league names
    const seasonsRes = await pool.query(`
      SELECT s.season_id, s.year, l.name as league_name
      FROM season s
      JOIN league l ON s.league_id = l.league_id
      ORDER BY s.season_id DESC
      LIMIT 60;
    `);

    return NextResponse.json({
      success: true,
      teams: teamsRes.rows,
      seasons: seasonsRes.rows,
    });
  } catch (err) {
    console.error('Admin options fetch error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch options' },
      { status: 500 }
    );
  }
}

