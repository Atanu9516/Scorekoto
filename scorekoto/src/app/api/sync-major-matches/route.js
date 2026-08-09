import { NextResponse } from 'next/server';
import pool from '../../lib/db';

export async function GET() {
  try {
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
    let totalMatchesInserted = 0;
    const resultsSummary = [];

    for (const league of majorLeagues) {
      const response = await fetch(`https://v3.football.api-sports.io/fixtures?league=${league.id}&season=${seasonYear}`, {
        method: 'GET',
        headers: {
          'x-apisports-key': process.env.API_SPORTS_KEY,
          'Accept': 'application/json'
        }
      });

      const data = await response.json();
      const fixtures = data.response;

      if (!fixtures || fixtures.length === 0) {
        resultsSummary.push({ league: league.name, matchesAdded: 0, status: 'No fixtures found' });
        continue;
      }

      let leagueMatchCount = 0;

      for (const item of fixtures) {
        const fixture = item.fixture;
        const teams = item.teams;
        const goals = item.goals;

        const homeScore = goals.home !== null ? goals.home : 0;
        const awayScore = goals.away !== null ? goals.away : 0;

        const query = `
          INSERT INTO match (match_id, season_id, home_team_id, away_team_id, match_date, status, home_score, away_score, venue)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (match_id) DO UPDATE SET 
              status = EXCLUDED.status,
              home_score = EXCLUDED.home_score,
              away_score = EXCLUDED.away_score;
        `;
        
        const values = [
          fixture.id,
          seasonYear, // Maps to the 2023 season row we seeded
          teams.home.id,
          teams.away.id,
          fixture.date,
          fixture.status.short,
          homeScore,
          awayScore,
          fixture.venue ? fixture.venue.name : null
        ];
        
        const res = await pool.query(query, values);
        if (res.rowCount > 0) {
          totalMatchesInserted++;
          leagueMatchCount++;
        }
      }

      resultsSummary.push({ league: league.name, matchesAdded: leagueMatchCount });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synced matches for major global leagues!`,
      totalNewMatches: totalMatchesInserted,
      breakdown: resultsSummary
    });

  } catch (err) {
    console.error("Match multi-league sync failed:", err);
    return NextResponse.json({ error: "Failed to sync major league matches" }, { status: 500 });
  }
}