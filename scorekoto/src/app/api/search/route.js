import { NextResponse } from 'next/server';
import pool from '@/app/lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || searchParams.get('query') || '';
    const type = searchParams.get('type'); // 'teams' | 'players' | 'leagues' | 'matches' | null (all)
    const limit = parseInt(searchParams.get('limit') || '8', 10);

    const term = `%${query.trim().toLowerCase()}%`;

    const results = {
      teams: [],
      players: [],
      leagues: [],
      matches: [],
    };

    if (!type || type === 'teams') {
      const teamsRes = await pool.query(
        `SELECT 
           team_id as id,
           name,
           short_name,
           logo_url,
           stadium_name,
           LOWER(REPLACE(name, ' ', '-')) as slug
         FROM team
         WHERE LOWER(name) LIKE $1 OR LOWER(short_name) LIKE $1
         ORDER BY name ASC
         LIMIT $2`,
        [term, limit]
      );
      results.teams = teamsRes.rows;
    }

    if (!type || type === 'players') {
      const playersRes = await pool.query(
        `SELECT 
           p.player_id as id,
           CONCAT(p.first_name, ' ', p.last_name) as name,
           p.primary_position as position,
           p.nationality,
           p.photo_url as photo,
           LOWER(REPLACE(CONCAT(p.first_name, ' ', p.last_name), ' ', '-')) as slug,
           t.name as team_name,
           t.logo_url as team_logo
         FROM player p
         LEFT JOIN team t ON p.team_id = t.team_id
         WHERE LOWER(CONCAT(p.first_name, ' ', p.last_name)) LIKE $1
            OR LOWER(p.last_name) LIKE $1
            OR LOWER(p.nationality) LIKE $1
         ORDER BY p.last_name ASC
         LIMIT $2`,
        [term, limit]
      );
      results.players = playersRes.rows;
    }

    if (!type || type === 'leagues') {
      const leaguesRes = await pool.query(
        `SELECT 
           league_id as id,
           name,
           country,
           type,
           logo_url,
           LOWER(REPLACE(name, ' ', '-')) as slug
         FROM league
         WHERE LOWER(name) LIKE $1 OR LOWER(country) LIKE $1
         ORDER BY name ASC
         LIMIT $2`,
        [term, limit]
      );
      results.leagues = leaguesRes.rows;
    }

    if (!type || type === 'matches') {
      const matchesRes = await pool.query(
        `SELECT 
           m.match_id as id,
           m.match_date as "matchDate",
           m.status,
           m.home_score as "homeScore",
           m.away_score as "awayScore",
           ht.name as "homeTeam",
           ht.logo_url as "homeLogo",
           at.name as "awayTeam",
           at.logo_url as "awayLogo",
           l.name as league
         FROM match m
         JOIN team ht ON m.home_team_id = ht.team_id
         JOIN team at ON m.away_team_id = at.team_id
         LEFT JOIN season s ON m.season_id = s.season_id
         LEFT JOIN league l ON s.league_id = l.league_id
         WHERE LOWER(ht.name) LIKE $1 OR LOWER(at.name) LIKE $1 OR LOWER(l.name) LIKE $1
         ORDER BY m.match_date DESC
         LIMIT $2`,
        [term, limit]
      );
      results.matches = matchesRes.rows;
    }

    return NextResponse.json({
      success: true,
      query: query.trim(),
      results,
    });
  } catch (error) {
    console.error('Unified search error:', error);
    return NextResponse.json({ error: 'Failed to search database' }, { status: 500 });
  }
}

