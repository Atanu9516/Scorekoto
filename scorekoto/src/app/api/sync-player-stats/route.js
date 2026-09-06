import { NextResponse } from 'next/server';
import pool from '../../lib/db';

// Populates player season performance metrics (appearances, goals, assists, cards)
export async function GET() {
  try {
    const { rows: players } = await pool.query(`SELECT Player_ID FROM Player LIMIT 200;`);
    const { rows: seasons } = await pool.query(`SELECT Season_ID FROM Season LIMIT 10;`);

    let statsInserted = 0;

    for (const p of players) {
      for (const s of seasons) {
        // Generate simulated season performance metrics
        const appearances = Math.floor(Math.random() * 30) + 5;
        const minutesPlayed = appearances * Math.floor(Math.random() * 30 + 60);
        const goals = Math.floor(Math.random() * 12);
        const assists = Math.floor(Math.random() * 8);
        const yellowCards = Math.floor(Math.random() * 5);
        const redCards = Math.random() > 0.85 ? 1 : 0;

        const res = await pool.query(`
          INSERT INTO Player_Season_Stats 
            (Player_ID, Season_ID, Appearances, Minutes_Played, Goals, Assists, Yellow_Cards, Red_Cards)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (Player_ID, Season_ID) DO UPDATE SET
            Appearances = EXCLUDED.Appearances,
            Goals = EXCLUDED.Goals,
            Assists = EXCLUDED.Assists;
        `, [p.player_id, s.season_id, appearances, minutesPlayed, goals, assists, yellowCards, redCards]);

        if (res.rowCount > 0) statsInserted++;
      }
    }

    const { rows: countRes } = await pool.query(`SELECT COUNT(*) FROM Player_Season_Stats;`);

    return NextResponse.json({
      success: true,
      message: 'Successfully populated Player_Season_Stats table!',
      stats: {
        totalPlayerStatsInDB: parseInt(countRes[0].count, 10)
      }
    });

  } catch (err) {
    console.error("Player season stats sync failed:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
