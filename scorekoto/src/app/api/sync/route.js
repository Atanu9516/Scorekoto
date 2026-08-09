import { NextResponse } from 'next/server';
import pool from '../../lib/db';

export async function GET() {
  try {
    // 1. Fetch the confirmed working Premier League 2023 dataset
    const response = await fetch('https://v3.football.api-sports.io/teams?league=39&season=2023', {
      method: 'GET',
      headers: {
        'x-apisports-key': process.env.API_SPORTS_KEY,
        'Accept': 'application/json'
      }
    });

    const data = await response.json();
    const teams = data.response; 

    let savedCount = 0;

    // 2. Loop through the JSON array and insert each team
    for (const item of teams) {
      const team = item.team;
      const venue = item.venue;

      const query = `
        INSERT INTO Team (Team_ID, Name, Short_Name, Stadium_Name)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (Team_ID) DO NOTHING;
      `;
      
      const values = [team.id, team.name, team.code, venue.name];
      
      const result = await pool.query(query, values);
      
      // result.rowCount tells us if a new row was added (1) or skipped (0)
      if (result.rowCount > 0) {
        savedCount++;
      }
    }

    return NextResponse.json({
      message: `Success! Checked ${teams.length} teams and inserted ${savedCount} new teams into the database.`
    });

  } catch (err) {
    console.error("Database sync failed:", err);
    return NextResponse.json({ error: "Failed to sync to database" }, { status: 500 });
  }
}