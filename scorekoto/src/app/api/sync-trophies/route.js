import { NextResponse } from 'next/server';
import pool from '../../lib/db';

// Seeds base trophies and syncs team trophy records from API-Sports
export async function GET() {
  try {
    // Seed primary football competitions into Trophy table
    const trophiesList = [
      { name: 'UEFA Champions League', type: 'International Cup' },
      { name: 'Premier League', type: 'Domestic League' },
      { name: 'La Liga', type: 'Domestic League' },
      { name: 'Serie A', type: 'Domestic League' },
      { name: 'Bundesliga', type: 'Domestic League' },
      { name: 'Ligue 1', type: 'Domestic League' },
      { name: 'Eredivisie', type: 'Domestic League' },
      { name: 'Primeira Liga', type: 'Domestic League' },
      { name: 'FIFA World Cup', type: 'World Cup' },
      { name: 'Copa America', type: 'Continental Cup' },
      { name: 'UEFA Euro', type: 'Continental Cup' }
    ];

    let trophiesInserted = 0;
    for (const t of trophiesList) {
      const res = await pool.query(`
        INSERT INTO Trophy (Name, Type)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING;
      `, [t.name, t.type]);
      if (res.rowCount > 0) trophiesInserted++;
    }

    // Fetch team trophy honours from API-Sports for top teams
    const { rows: majorTeams } = await pool.query(`
      SELECT Team_ID, Name FROM Team LIMIT 20;
    `);

    const apiKey = process.env.API_SPORTS_KEY;
    let teamTrophiesInserted = 0;

    if (apiKey) {
      for (const team of majorTeams) {
        try {
          const res = await fetch(`https://v3.football.api-sports.io/trophies?team=${team.team_id}`, {
            headers: { 'x-apisports-key': apiKey }
          });
          const data = await res.json();

          if (data.response && data.response.length > 0) {
            for (const item of data.response) {
              const trophyName = item.league || item.country;
              const seasonWon = item.season || '2023';

              // Ensure trophy entry exists
              const tRes = await pool.query(`
                INSERT INTO Trophy (Name, Type) VALUES ($1, $2)
                ON CONFLICT DO NOTHING RETURNING Trophy_ID;
              `, [trophyName, item.place || 'Winner']);

              const trophyId = tRes.rows[0]?.trophy_id || 1;

              // Associate trophy with the team in junction table
              await pool.query(`
                INSERT INTO Team_Trophy (Team_ID, Trophy_ID, Season_Won)
                VALUES ($1, $2, $3)
                ON CONFLICT (Team_ID, Trophy_ID, Season_Won) DO NOTHING;
              `, [team.team_id, trophyId, seasonWon]).catch(() => {});

              teamTrophiesInserted++;
            }
          }
        } catch (err) {
          console.error(`Trophy fetch error for team ${team.team_id}:`, err.message);
        }
      }
    }

    const { rows: trophyCount } = await pool.query(`SELECT COUNT(*) FROM Trophy;`);
    const { rows: teamTrophyCount } = await pool.query(`SELECT COUNT(*) FROM Team_Trophy;`);

    return NextResponse.json({
      success: true,
      message: 'Successfully populated Trophy and Team_Trophy tables!',
      stats: {
        trophiesTotal: parseInt(trophyCount[0].count, 10),
        teamTrophiesTotal: parseInt(teamTrophyCount[0].count, 10)
      }
    });

  } catch (err) {
    console.error("Trophy sync failed:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
