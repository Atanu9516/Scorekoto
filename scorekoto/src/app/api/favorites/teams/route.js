import { NextResponse } from 'next/server';
import pool from '../../../lib/db';
import { getUserFromRequest } from '../../../lib/auth';

// Helper to resolve team_id from ID, name, or slug
async function resolveTeamId(teamIdentifier) {
  if (!teamIdentifier) return null;

  // If numeric ID
  if (Number.isInteger(Number(teamIdentifier)) && Number(teamIdentifier) > 0) {
    const res = await pool.query('SELECT team_id FROM team WHERE team_id = $1 LIMIT 1', [Number(teamIdentifier)]);
    if (res.rows.length > 0) return res.rows[0].team_id;
  }

  // If name or slug
  const normalized = String(teamIdentifier).trim().toLowerCase();
  const res = await pool.query(
    `SELECT team_id FROM team 
     WHERE LOWER(name) = $1 
        OR LOWER(REPLACE(name, ' ', '-')) = $1
        OR LOWER(short_name) = $1
     LIMIT 1`,
    [normalized]
  );

  if (res.rows.length > 0) {
    return res.rows[0].team_id;
  }

  return null;
}

// GET /api/favorites/teams - Get all favorite teams for the logged-in user
export async function GET(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const query = `
      SELECT 
        t.team_id,
        t.name,
        t.short_name,
        t.stadium_name,
        t.logo_url,
        LOWER(REPLACE(t.name, ' ', '-')) as slug
      FROM user_favorite_team uft
      JOIN team t ON uft.team_id = t.team_id
      WHERE uft.user_id = $1
      ORDER BY t.name ASC;
    `;
    const result = await pool.query(query, [user.user_id]);

    return NextResponse.json({
      success: true,
      favorites: result.rows,
      teamIds: result.rows.map(r => r.team_id),
      slugs: result.rows.map(r => r.slug),
    });
  } catch (error) {
    console.error('Error fetching favorite teams:', error);
    return NextResponse.json(
      { error: 'Failed to fetch favorite teams' },
      { status: 500 }
    );
  }
}

// POST /api/favorites/teams - Add a team to favorites
export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please log in to save favorites.' }, { status: 401 });
    }

    const body = await request.json();
    const { teamId, teamSlug, teamName, slug, id, name } = body;

    const targetTeamId = await resolveTeamId(
      teamId || teamSlug || teamName || slug || id || name
    );

    if (!targetTeamId) {
      return NextResponse.json(
        { error: 'Team not found in database' },
        { status: 404 }
      );
    }

    const insertQuery = `
      INSERT INTO user_favorite_team (user_id, team_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, team_id) DO NOTHING;
    `;
    await pool.query(insertQuery, [user.user_id, targetTeamId]);

    return NextResponse.json({
      success: true,
      message: 'Team added to favorites in database',
      team_id: targetTeamId,
    });
  } catch (error) {
    console.error('Error adding favorite team:', error);
    return NextResponse.json(
      { error: 'Failed to save favorite team' },
      { status: 500 }
    );
  }
}

// DELETE /api/favorites/teams - Remove a team from favorites
export async function DELETE(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let teamIdentifier = null;

    // Check query params
    const { searchParams } = new URL(request.url);
    const paramId =
      searchParams.get('teamId') ||
      searchParams.get('teamSlug') ||
      searchParams.get('slug') ||
      searchParams.get('id') ||
      searchParams.get('name') ||
      searchParams.get('teamName');

    if (paramId) {
      teamIdentifier = paramId;
    } else {
      // Check body
      try {
        const body = await request.json();
        teamIdentifier =
          body.teamId ||
          body.teamSlug ||
          body.slug ||
          body.id ||
          body.name ||
          body.teamName;
      } catch (e) {
        // empty body
      }
    }

    const targetTeamId = await resolveTeamId(teamIdentifier);

    if (!targetTeamId) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      );
    }

    const deleteQuery = `
      DELETE FROM user_favorite_team
      WHERE user_id = $1 AND team_id = $2;
    `;
    await pool.query(deleteQuery, [user.user_id, targetTeamId]);

    return NextResponse.json({
      success: true,
      message: 'Team removed from favorites in database',
      team_id: targetTeamId,
    });
  } catch (error) {
    console.error('Error removing favorite team:', error);
    return NextResponse.json(
      { error: 'Failed to remove favorite team' },
      { status: 500 }
    );
  }
}
