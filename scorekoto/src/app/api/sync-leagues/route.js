import { NextResponse } from 'next/server';
import pool from '../../lib/db';

// Fetches all available leagues and their historical seasons from API-Sports and upserts them
export async function GET() {
  try {
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

    for (const item of leagues) {
      const league = item.league;
      const country = item.country;
      const seasons = item.seasons;

      // Upsert league metadata
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

      // Insert each recorded season for this league
      for (const season of seasons) {
        const yearString = `${season.year}-${season.year + 1}`;

        const seasonQuery = `
          INSERT INTO Season (League_ID, Year, Start_Date, End_Date)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT DO NOTHING;
        `;
        
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