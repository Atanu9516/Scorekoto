import { NextResponse } from 'next/server';
import pool from '@/app/lib/db';
import { getUserFromRequest } from '@/app/lib/auth';

// Helper to resolve player_id from ID, name, or slug
async function resolvePlayerId(identifier) {
  if (!identifier) return null;

  if (Number.isInteger(Number(identifier)) && Number(identifier) > 0) {
    const res = await pool.query('SELECT player_id FROM player WHERE player_id = $1 LIMIT 1', [Number(identifier)]);
    if (res.rows.length > 0) return res.rows[0].player_id;
  }

  const normalized = String(identifier).trim().toLowerCase();
  const res = await pool.query(
    `SELECT player_id FROM player 
     WHERE LOWER(REPLACE(CONCAT(first_name, ' ', last_name), ' ', '-')) = $1 
        OR LOWER(CONCAT(first_name, ' ', last_name)) = $1 
        OR LOWER(last_name) = $1
     LIMIT 1`,
    [normalized]
  );

  if (res.rows.length > 0) {
    return res.rows[0].player_id;
  }
  return null;
}

// GET /api/favorites/players - List favorite players for logged in user or guest identifiers
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
          p.player_id,
          CONCAT(p.first_name, ' ', p.last_name) as name,
          p.first_name,
          p.last_name,
          p.primary_position as position,
          p.nationality,
          p.photo_url as photo,
          LOWER(REPLACE(CONCAT(p.first_name, ' ', p.last_name), ' ', '-')) as slug,
          t.team_id,
          t.name as team_name,
          t.logo_url as team_logo
        FROM player p
        LEFT JOIN team t ON p.team_id = t.team_id
        WHERE (array_length($1::int[], 1) IS NOT NULL AND p.player_id = ANY($1::int[]))
           OR (array_length($2::text[], 1) IS NOT NULL AND (
                LOWER(REPLACE(CONCAT(p.first_name, ' ', p.last_name), ' ', '-')) = ANY($2::text[])
             OR LOWER(CONCAT(p.first_name, ' ', p.last_name)) = ANY($2::text[])
             OR LOWER(p.last_name) = ANY($2::text[])
           ))
        ORDER BY p.last_name ASC;
      `;
      const result = await pool.query(query, [numIds, strSlugs]);
      return NextResponse.json({
        success: true,
        favorites: result.rows,
        playerIds: result.rows.map((r) => r.player_id),
        slugs: result.rows.map((r) => r.slug),
      });
    }

    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: true, favorites: [], playerIds: [], slugs: [] });
    }

    const query = `
      SELECT 
        p.player_id,
        CONCAT(p.first_name, ' ', p.last_name) as name,
        p.first_name,
        p.last_name,
        p.primary_position as position,
        p.nationality,
        p.photo_url as photo,
        LOWER(REPLACE(CONCAT(p.first_name, ' ', p.last_name), ' ', '-')) as slug,
        t.team_id,
        t.name as team_name,
        t.logo_url as team_logo
      FROM user_favorite_player ufp
      JOIN player p ON ufp.player_id = p.player_id
      LEFT JOIN team t ON p.team_id = t.team_id
      WHERE ufp.user_id = $1
      ORDER BY p.last_name ASC;
    `;
    const result = await pool.query(query, [user.user_id]);

    return NextResponse.json({
      success: true,
      favorites: result.rows,
      playerIds: result.rows.map((r) => r.player_id),
      slugs: result.rows.map((r) => r.slug),
    });
  } catch (error) {
    console.error('Error fetching favorite players:', error);
    return NextResponse.json({ error: 'Failed to fetch favorite players' }, { status: 500 });
  }
}

// POST /api/favorites/players - Add player to favorites
export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { playerId, playerSlug, slug, id, name } = body;

    const targetPlayerId = await resolvePlayerId(playerId || playerSlug || slug || id || name);

    if (!targetPlayerId) {
      return NextResponse.json({ error: 'Player not found in database' }, { status: 404 });
    }

    await pool.query(
      `INSERT INTO user_favorite_player (user_id, player_id) 
       VALUES ($1, $2) 
       ON CONFLICT (user_id, player_id) DO NOTHING`,
      [user.user_id, targetPlayerId]
    );

    return NextResponse.json({
      success: true,
      message: 'Player added to favorites',
      player_id: targetPlayerId,
    }, { status: 201 });
  } catch (error) {
    console.error('Error adding favorite player:', error);
    return NextResponse.json({ error: 'Failed to add favorite player' }, { status: 500 });
  }
}

// DELETE /api/favorites/players - Remove player from favorites
export async function DELETE(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const paramId = searchParams.get('playerId') || searchParams.get('id') || searchParams.get('slug');

    const targetPlayerId = await resolvePlayerId(paramId);

    if (!targetPlayerId) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    await pool.query(
      `DELETE FROM user_favorite_player WHERE user_id = $1 AND player_id = $2`,
      [user.user_id, targetPlayerId]
    );

    return NextResponse.json({
      success: true,
      message: 'Player removed from favorites',
      player_id: targetPlayerId,
    });
  } catch (error) {
    console.error('Error removing favorite player:', error);
    return NextResponse.json({ error: 'Failed to remove favorite player' }, { status: 500 });
  }
}

