import { NextResponse } from 'next/server';
import pool from '@/app/lib/db';
import { getUserFromRequest } from '@/app/lib/auth';

// Helper to resolve league_id from ID, name, or slug
async function resolveLeagueId(identifier) {
  if (!identifier) return null;

  if (Number.isInteger(Number(identifier)) && Number(identifier) > 0) {
    const res = await pool.query('SELECT league_id FROM league WHERE league_id = $1 LIMIT 1', [Number(identifier)]);
    if (res.rows.length > 0) return res.rows[0].league_id;
  }

  const normalized = String(identifier).trim().toLowerCase();
  const res = await pool.query(
    `SELECT league_id FROM league 
     WHERE LOWER(REPLACE(name, ' ', '-')) = $1 
        OR LOWER(name) = $1 
     LIMIT 1`,
    [normalized]
  );

  if (res.rows.length > 0) {
    return res.rows[0].league_id;
  }
  return null;
}

// GET /api/favorites/leagues - List favorite leagues for logged in user or guest identifiers
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const identifiersParam = searchParams.get('identifiers') || searchParams.get('ids');

    if (identifiersParam) {
      const tokens = identifiersParam.split(',').map((t) => t.trim()).filter(Boolean);
      const numIds = tokens.map(Number).filter((n) => Number.isInteger(n) && n > 0);
      const strSlugs = tokens.map((t) => t.toLowerCase());

      const query = `
        SELECT 
          l.league_id,
          l.name,
          l.type,
          l.country,
          l.logo_url,
          LOWER(REPLACE(l.name, ' ', '-')) as slug
        FROM league l
        WHERE (array_length($1::int[], 1) IS NOT NULL AND l.league_id = ANY($1::int[]))
           OR (array_length($2::text[], 1) IS NOT NULL AND (
                LOWER(REPLACE(l.name, ' ', '-')) = ANY($2::text[])
             OR LOWER(l.name) = ANY($2::text[])
           ))
        ORDER BY l.name ASC;
      `;
      const result = await pool.query(query, [numIds, strSlugs]);
      return NextResponse.json({
        success: true,
        favorites: result.rows,
        leagueIds: result.rows.map((r) => r.league_id),
        slugs: result.rows.map((r) => r.slug),
      });
    }

    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: true, favorites: [], leagueIds: [], slugs: [] });
    }

    const query = `
      SELECT 
        l.league_id,
        l.name,
        l.type,
        l.country,
        l.logo_url,
        LOWER(REPLACE(l.name, ' ', '-')) as slug
      FROM user_favorite_league ufl
      JOIN league l ON ufl.league_id = l.league_id
      WHERE ufl.user_id = $1
      ORDER BY l.name ASC;
    `;
    const result = await pool.query(query, [user.user_id]);

    return NextResponse.json({
      success: true,
      favorites: result.rows,
      leagueIds: result.rows.map((r) => r.league_id),
      slugs: result.rows.map((r) => r.slug),
    });
  } catch (error) {
    console.error('Error fetching favorite leagues:', error);
    return NextResponse.json({ error: 'Failed to fetch favorite leagues' }, { status: 500 });
  }
}

// POST /api/favorites/leagues - Add league to favorites
export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { leagueId, leagueSlug, slug, id, name } = body;

    const targetLeagueId = await resolveLeagueId(leagueId || leagueSlug || slug || id || name);

    if (!targetLeagueId) {
      return NextResponse.json({ error: 'League not found in database' }, { status: 404 });
    }

    await pool.query(
      `INSERT INTO user_favorite_league (user_id, league_id) 
       VALUES ($1, $2) 
       ON CONFLICT (user_id, league_id) DO NOTHING`,
      [user.user_id, targetLeagueId]
    );

    return NextResponse.json({
      success: true,
      message: 'League added to favorites',
      league_id: targetLeagueId,
    }, { status: 201 });
  } catch (error) {
    console.error('Error adding favorite league:', error);
    return NextResponse.json({ error: 'Failed to add favorite league' }, { status: 500 });
  }
}

// DELETE /api/favorites/leagues - Remove league from favorites
export async function DELETE(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const paramId = searchParams.get('leagueId') || searchParams.get('id') || searchParams.get('slug');

    const targetLeagueId = await resolveLeagueId(paramId);

    if (!targetLeagueId) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }

    await pool.query(
      `DELETE FROM user_favorite_league WHERE user_id = $1 AND league_id = $2`,
      [user.user_id, targetLeagueId]
    );

    return NextResponse.json({
      success: true,
      message: 'League removed from favorites',
      league_id: targetLeagueId,
    });
  } catch (error) {
    console.error('Error removing favorite league:', error);
    return NextResponse.json({ error: 'Failed to remove favorite league' }, { status: 500 });
  }
}

