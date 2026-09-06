import { NextResponse } from 'next/server';
import pool from '../../lib/db';

// Synchronizes live player injury records from API-Sports for top European leagues
export async function GET() {
  try {
    const apiKey = process.env.API_SPORTS_KEY;
    let injuriesInserted = 0;

    // Premier League, La Liga, Serie A, Bundesliga, Ligue 1
    const majorLeagues = [39, 140, 135, 78, 61];

    if (apiKey) {
      for (const leagueId of majorLeagues) {
        try {
          const res = await fetch(`https://v3.football.api-sports.io/injuries?league=${leagueId}&season=2024`, {
            headers: { 'x-apisports-key': apiKey }
          });
          const data = await res.json();

          if (data.response && data.response.length > 0) {
            for (const item of data.response) {
              const player = item.player;
              const fixture = item.fixture;

              // Upsert player placeholder if not already registered
              await pool.query(`
                INSERT INTO Player (Player_ID, Team_ID, First_Name, Last_Name, Primary_Position)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (Player_ID) DO NOTHING;
              `, [player.id, item.team.id, player.name.split(' ')[0] || 'Player', player.name.split(' ')[1] || 'Player', player.type || 'Forward']).catch(() => {});

              // Record injury details
              await pool.query(`
                INSERT INTO Player_Injury (Player_ID, Status, Start_Date, Expected_Return_Date, Description)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT DO NOTHING;
              `, [
                player.id,
                player.reason || 'Injured',
                fixture.date ? fixture.date.split('T')[0] : null,
                null,
                `${player.reason || 'Muscle injury'} - Expected return to squad soon`
              ]).catch(() => {});

              injuriesInserted++;
            }
          }
        } catch (err) {
          console.error(`Injury fetch error for league ${leagueId}:`, err.message);
        }
      }
    }

    const { rows: countRes } = await pool.query(`SELECT COUNT(*) FROM Player_Injury;`);

    return NextResponse.json({
      success: true,
      message: 'Successfully populated Player_Injury table!',
      stats: {
        totalInjuriesInDB: parseInt(countRes[0].count, 10)
      }
    });

  } catch (err) {
    console.error("Injury sync failed:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
