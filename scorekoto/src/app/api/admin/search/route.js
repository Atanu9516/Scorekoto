import { NextResponse } from 'next/server';
import pool from '@/app/lib/db';
import { getAdminFromRequest } from '@/app/lib/auth';

// GET: Admin search for matches, teams, or players
export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin privileges required.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'matches'; // 'matches' | 'teams' | 'players'
    const q = (searchParams.get('q') || '').trim();

    if (type === 'matches') {
      let query = `
        SELECT 
          m.match_id,
          m.home_team_id,
          m.away_team_id,
          m.home_score,
          m.away_score,
          m.status,
          m.venue,
          m.match_date,
          m.home_possession,
          m.away_possession,
          ht.name as home_team,
          at.name as away_team,
          COALESCE(l.name, 'League') as league
        FROM match m
        JOIN team ht ON m.home_team_id = ht.team_id
        JOIN team at ON m.away_team_id = at.team_id
        LEFT JOIN season s ON m.season_id = s.season_id
        LEFT JOIN league l ON s.league_id = l.league_id
      `;
      const params = [];
      if (q) {
        query += ` WHERE LOWER(ht.name) LIKE $1 OR LOWER(at.name) LIKE $1 OR CAST(m.match_id AS TEXT) = $2`;
        params.push(`%${q.toLowerCase()}%`, q);
      }
      query += ` ORDER BY m.match_date DESC LIMIT 30;`;
      const res = await pool.query(query, params);
      return NextResponse.json({ success: true, results: res.rows });
    }

    if (type === 'teams') {
      let query = `
        SELECT 
          team_id, 
          name, 
          short_name, 
          stadium_name, 
          history, 
          manager_name, 
          logo_url
        FROM team
      `;
      const params = [];
      if (q) {
        query += ` WHERE LOWER(name) LIKE $1 OR LOWER(short_name) LIKE $1 OR CAST(team_id AS TEXT) = $2`;
        params.push(`%${q.toLowerCase()}%`, q);
      }
      query += ` ORDER BY name ASC LIMIT 40;`;
      const res = await pool.query(query, params);
      return NextResponse.json({ success: true, results: res.rows });
    }

    if (type === 'players') {
      let query = `
        SELECT 
          p.player_id,
          p.team_id,
          p.first_name,
          p.last_name,
          p.primary_position,
          p.market_value_euros,
          p.weight_cm,
          p.date_of_birth,
          p.nationality,
          p.photo_url,
          t.name as team_name
        FROM player p
        LEFT JOIN team t ON p.team_id = t.team_id
      `;
      const params = [];
      if (q) {
        query += ` WHERE LOWER(p.first_name) LIKE $1 OR LOWER(p.last_name) LIKE $1 OR LOWER(t.name) LIKE $1 OR CAST(p.player_id AS TEXT) = $2`;
        params.push(`%${q.toLowerCase()}%`, q);
      }
      query += ` ORDER BY p.last_name ASC, p.first_name ASC LIMIT 40;`;
      const res = await pool.query(query, params);
      return NextResponse.json({ success: true, results: res.rows });
    }

    return NextResponse.json({ success: true, results: [] });
  } catch (err) {
    console.error('Admin search error:', err);
    return NextResponse.json(
      { error: 'Failed to search database' },
      { status: 500 }
    );
  }
}
