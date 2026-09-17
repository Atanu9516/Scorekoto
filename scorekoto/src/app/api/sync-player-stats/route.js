import { NextResponse } from 'next/server';
import pool from '../../lib/db';

export const dynamic = 'force-dynamic';

// Populates genuine player season performance metrics (appearances, goals, assists, cards) from official sources
export async function GET() {
  try {
    const API_KEY = process.env.API_SPORTS_KEY;
    if (!API_KEY) {
      return NextResponse.json({ success: false, error: 'API_SPORTS_KEY not configured' }, { status: 500 });
    }

    const majorLeagues = [
      { id: 39, name: 'Premier League', season: 2023, year: '2023-2024' },
      { id: 140, name: 'La Liga', season: 2023, year: '2023-2024' },
      { id: 78, name: 'Bundesliga', season: 2023, year: '2023-2024' },
      { id: 135, name: 'Serie A', season: 2023, year: '2023-2024' },
      { id: 61, name: 'Ligue 1', season: 2023, year: '2023-2024' },
      { id: 2, name: 'Champions League', season: 2023, year: '2023-2024' }
    ];

    let totalSynced = 0;

    for (const l of majorLeagues) {
      try {
        const res = await fetch(`https://v3.football.api-sports.io/players/topscorers?league=${l.id}&season=${l.season}`, {
          headers: { 'x-apisports-key': API_KEY }
        });
        if (!res.ok) continue;

        const data = await res.json();
        const scorers = data.response || [];

        const seasonRes = await pool.query(
          'SELECT season_id FROM season WHERE league_id = $1 AND year = $2 LIMIT 1',
          [l.id, l.year]
        );
        if (seasonRes.rows.length === 0) continue;
        const seasonId = seasonRes.rows[0].season_id;

        for (const item of scorers) {
          const p = item.player;
          const s = item.statistics[0];
          if (!p || !s) continue;

          const teamId = s.team?.id;
          if (teamId) {
            await pool.query(`
              INSERT INTO team (team_id, name, short_name, logo_url)
              VALUES ($1, $2, $3, $4)
              ON CONFLICT (team_id) DO UPDATE SET
                name = EXCLUDED.name,
                logo_url = COALESCE(EXCLUDED.logo_url, team.logo_url);
            `, [teamId, s.team.name, s.team.name.substring(0, 3).toUpperCase(), s.team.logo]);
          }

          const [firstName, ...lastNames] = (p.name || 'Player').split(' ');
          const lastName = lastNames.join(' ') || p.lastname || firstName;

          await pool.query(`
            INSERT INTO player (
              player_id, team_id, first_name, last_name, primary_position, 
              nationality, date_of_birth, weight_cm, photo_url
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (player_id) DO UPDATE SET
              first_name = EXCLUDED.first_name,
              last_name = EXCLUDED.last_name,
              team_id = COALESCE(EXCLUDED.team_id, player.team_id),
              primary_position = EXCLUDED.primary_position,
              nationality = EXCLUDED.nationality,
              photo_url = COALESCE(EXCLUDED.photo_url, player.photo_url);
          `, [
            p.id,
            teamId,
            firstName,
            lastName,
            s.games.position || 'Forward',
            p.nationality || 'International',
            p.birth?.date || null,
            parseInt(p.weight || '75', 10),
            p.photo
          ]);

          await pool.query(`
            INSERT INTO player_season_stats (
              player_id, season_id, appearances, minutes_played, goals, assists, yellow_cards, red_cards
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (player_id, season_id) DO UPDATE SET
              appearances = EXCLUDED.appearances,
              minutes_played = EXCLUDED.minutes_played,
              goals = EXCLUDED.goals,
              assists = EXCLUDED.assists,
              yellow_cards = EXCLUDED.yellow_cards,
              red_cards = EXCLUDED.red_cards;
          `, [
            p.id,
            seasonId,
            s.games.appearences || 0,
            s.games.minutes || 0,
            s.goals.total || 0,
            s.goals.assists || 0,
            s.cards.yellow || 0,
            s.cards.red || 0
          ]);

          totalSynced++;
        }
      } catch (err) {
        console.warn(`Error syncing stats for ${l.name}:`, err.message);
      }
    }

    const { rows: countRes } = await pool.query(`SELECT COUNT(*) FROM player_season_stats;`);

    return NextResponse.json({
      success: true,
      message: 'Successfully populated real Player_Season_Stats from official feeds!',
      stats: {
        totalSyncedInRun: totalSynced,
        totalPlayerStatsInDB: parseInt(countRes[0].count, 10)
      }
    });
  } catch (err) {
    console.error("Player season stats sync failed:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
