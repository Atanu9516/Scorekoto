import { NextResponse } from "next/server";
import pool from "@/app/lib/db";
import { getUserFromRequest } from "@/app/lib/auth";

const TOP_ITEM_LIMIT = 4;

export async function GET(request) {
  try {
    const user = await getUserFromRequest(request);

    const topTeamsQuery = pool.query(
      `SELECT
         t.team_id,
         t.name,
         t.short_name,
         t.logo_url,
         LOWER(REPLACE(t.name, ' ', '-')) AS slug,
         COUNT(m.match_id)::int AS match_count
       FROM team t
       LEFT JOIN match m
         ON m.home_team_id = t.team_id OR m.away_team_id = t.team_id
       GROUP BY t.team_id, t.name, t.short_name, t.logo_url
       ORDER BY match_count DESC, t.name ASC
       LIMIT $1`,
      [TOP_ITEM_LIMIT]
    );

    const topLeaguesQuery = pool.query(
      `SELECT
         l.league_id,
         l.name,
         l.country,
         l.logo_url,
         LOWER(REPLACE(l.name, ' ', '-')) AS slug,
         COUNT(DISTINCT m.match_id)::int AS match_count
       FROM league l
       LEFT JOIN season s ON s.league_id = l.league_id
       LEFT JOIN match m ON m.season_id = s.season_id
       GROUP BY l.league_id, l.name, l.country, l.logo_url
       ORDER BY match_count DESC, l.name ASC
       LIMIT $1`,
      [TOP_ITEM_LIMIT]
    );

    const favoriteQueries = user
      ? [
          pool.query(
            `SELECT
               t.team_id,
               t.name,
               t.logo_url,
               LOWER(REPLACE(t.name, ' ', '-')) AS slug
             FROM user_favorite_team uft
             JOIN team t ON t.team_id = uft.team_id
             WHERE uft.user_id = $1
             ORDER BY t.name ASC`,
            [user.user_id]
          ),
          pool.query(
            `SELECT
               l.league_id,
               l.name,
               l.logo_url,
               LOWER(REPLACE(l.name, ' ', '-')) AS slug
             FROM user_favorite_league ufl
             JOIN league l ON l.league_id = ufl.league_id
             WHERE ufl.user_id = $1
             ORDER BY l.name ASC`,
            [user.user_id]
          ),
          pool.query(
            `SELECT
               p.player_id,
               CONCAT_WS(' ', p.first_name, NULLIF(BTRIM(p.last_name), '')) AS name,
               p.photo_url,
               LOWER(REPLACE(CONCAT_WS(' ', p.first_name, NULLIF(BTRIM(p.last_name), '')), ' ', '-')) AS slug
             FROM user_favorite_player ufp
             JOIN player p ON p.player_id = ufp.player_id
             WHERE ufp.user_id = $1
             ORDER BY p.last_name ASC, p.first_name ASC`,
            [user.user_id]
          ),
        ]
      : [Promise.resolve({ rows: [] }), Promise.resolve({ rows: [] }), Promise.resolve({ rows: [] })];

    const [topTeams, topLeagues, favoriteTeams, favoriteLeagues, favoritePlayers] =
      await Promise.all([topTeamsQuery, topLeaguesQuery, ...favoriteQueries]);

    return NextResponse.json({
      success: true,
      topTeams: topTeams.rows,
      topLeagues: topLeagues.rows,
      favorites: {
        teams: favoriteTeams.rows,
        leagues: favoriteLeagues.rows,
        players: favoritePlayers.rows,
      },
    });
  } catch (error) {
    console.error("Failed to load sidebar navigation:", error);
    return NextResponse.json(
      { error: "Failed to load sidebar navigation" },
      { status: 500 }
    );
  }
}
