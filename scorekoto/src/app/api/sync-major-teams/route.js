import { NextResponse } from 'next/server';
import pool from '../../lib/db';

// Fetches and upserts teams across top global football leagues for season 2023
export async function GET() {
  try {
    // Top global competitions targeted for synchronization
    const majorLeagues = [
      { id: 39, name: 'Premier League' },
      { id: 140, name: 'La Liga' },
      { id: 135, name: 'Serie A' },
      { id: 78, name: 'Bundesliga' },
      { id: 61, name: 'Ligue 1' },
      { id: 2, name: 'UEFA Champions League' },
      { id: 88, name: 'Eredivisie' },
      { id: 94, name: 'Primeira Liga' },
      { id: 40, name: 'Championship' },
      { id: 13, name: 'Copa Libertadores' }
    ];

    const seasonYear = 2023;
    let totalTeamsInserted = 0;
    const resultsSummary = [];

    for (const league of majorLeagues) {
      const response = await fetch(`https://v3.football.api-sports.io/teams?league=${league.id}&season=${seasonYear}`, {
        method: 'GET',
        headers: {
          'x-apisports-key': process.env.API_SPORTS_KEY,
          'Accept': 'application/json'
        }
      });

      const data = await response.json();
      const teams = data.response;

      if (!teams || teams.length === 0) {
        resultsSummary.push({ league: league.name, status: 'No teams found or season not available' });
        continue;
      }

      let count = 0;
      for (const item of teams) {
        const t = item.team;
        const venue = item.venue;

        // Upsert team and stadium info
        const query = `
          INSERT INTO Team (Team_ID, Name, Short_Name, Stadium_Name)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (Team_ID) DO UPDATE SET 
            Name = EXCLUDED.Name,
            Short_Name = EXCLUDED.Short_Name,
            Stadium_Name = EXCLUDED.Stadium_Name;
        `;

        const values = [t.id, t.name, t.code, venue ? venue.name : null];
        const res = await pool.query(query, values);
        
        if (res.rowCount > 0) {
          totalTeamsInserted++;
          count++;
        }
      }

      resultsSummary.push({ league: league.name, teamsAdded: count });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synced teams across major global leagues!`,
      totalNewTeams: totalTeamsInserted,
      breakdown: resultsSummary
    });

  } catch (err) {
    console.error("Multi-league sync failed:", err);
    return NextResponse.json({ error: "Failed to sync major leagues" }, { status: 500 });
  }
}