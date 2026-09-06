import { NextResponse } from 'next/server';
import pool from '../../lib/db';

// Synchronizes comprehensive trophy cabinets from API-Sports for top 50 major teams
export async function GET() {
  try {
    const { rows: majorTeams } = await pool.query(`
      SELECT Team_ID, Name FROM Team LIMIT 50;
    `);

    const apiKey = process.env.API_SPORTS_KEY;
    let trophiesAdded = 0;

    if (apiKey) {
      for (const team of majorTeams) {
        try {
          const res = await fetch(`https://v3.football.api-sports.io/trophies?team=${team.team_id}`, {
            headers: { 'x-apisports-key': apiKey }
          });
          const data = await res.json();

          if (data.response && data.response.length > 0) {
            for (const item of data.response) {
              const trophyName = item.league || item.country || 'Championship';
              const seasonWon = item.season || '2023';

              // Upsert trophy definition
              const tRes = await pool.query(`
                INSERT INTO Trophy (Name, Type) 
                VALUES ($1, $2)
                ON CONFLICT (Name) DO UPDATE SET Type = EXCLUDED.Type
                RETURNING Trophy_ID;
              `, [trophyName, item.place || 'Winner']);

              const trophyId = tRes.rows[0]?.trophy_id;

              if (trophyId) {
                // Link trophy to team
                await pool.query(`
                  INSERT INTO Team_Trophy (Team_ID, Trophy_ID, Season_Won)
                  VALUES ($1, $2, $3)
                  ON CONFLICT DO NOTHING;
                `, [team.team_id, trophyId, seasonWon]).catch(() => {});
                trophiesAdded++;
              }
            }
          }
        } catch (err) {
          console.error(`Trophy fetch error for ${team.name}:`, err.message);
        }
      }
    }

    const { rows: trophyCount } = await pool.query(`SELECT COUNT(*) FROM Trophy;`);
    const { rows: teamTrophyCount } = await pool.query(`SELECT COUNT(*) FROM Team_Trophy;`);

    return NextResponse.json({
      success: true,
      message: 'Full Trophy Cabinet Sync Complete!',
      stats: {
        totalUniqueTrophies: parseInt(trophyCount[0].count, 10),
        totalTeamTrophiesWon: parseInt(teamTrophyCount[0].count, 10)
      }
    });

  } catch (err) {
    console.error("Full trophy sync failed:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
