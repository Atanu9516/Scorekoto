import { NextResponse } from 'next/server';
import pool from '../../lib/db';

export async function GET() {
  try {
    // 1. Fetch all leagues from API-Sports
    const response = await fetch('https://v3.football.api-sports.io/leagues', {
      method: 'GET',
      headers: {
        'x-apisports-key': process.env.API_SPORTS_KEY,
        'Accept': 'application/json'
      }
    });

    const data = await response.json();
    const leagues = data.response;

    let leaguesInserted = 0;
    let seasonsInserted = 0;

    // 2. Loop through every league returned by the API
    for (const item of leagues) {
      const league = item.league;
      const country = item.country;
      const seasons = item.seasons;

      // Insert League using UPSERT
      const leagueQuery = `
        INSERT INTO League (League_ID, Name, Type, Country)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (League_ID) DO UPDATE SET 
          Name = EXCLUDED.Name,
          Type = EXCLUDED.Type,
          Country = EXCLUDED.Country;
      `;
      
      await pool.query(leagueQuery, [league.id, league.name, league.type, country.name]);
      leaguesInserted++;

      // 3. Loop through each season available for this league and insert them
      for (const season of seasons) {
        // season.year is typically an integer (e.g., 2023), convert to string format matching your schema
        const yearString = `${season.year}-${season.year + 1}`;

        const seasonQuery = `
          INSERT INTO Season (League_ID, Year, Start_Date, End_Date)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT DO NOTHING;
        `;
        
        // Note: API-Sports provides start and end dates for the season
        await pool.query(seasonQuery, [
          league.id, 
          yearString, 
          season.start, 
          season.end
        ]);
        seasonsInserted++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${leaguesInserted} leagues and processed ${seasonsInserted} seasons into the database!`
    });

  } catch (err) {
    console.error("League sync failed:", err);
    return NextResponse.json({ error: "Failed to sync leagues and seasons" }, { status: 500 });
  }
}