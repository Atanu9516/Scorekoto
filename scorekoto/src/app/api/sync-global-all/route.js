import { NextResponse } from 'next/server';
import pool from '../../lib/db';

export async function GET() {
  try {
    // 1. Ensure we have a tracking table so empty seasons don't trap the queue
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Processed_Seasons (
        season_id INT PRIMARY KEY
      );
    `);

    // 2. Find league-seasons that haven't been processed yet
    const query = `
      SELECT l.league_id, l.name AS league_name, s.season_id, s.year 
      FROM League l
      JOIN Season s ON l.league_id = s.league_id
      WHERE s.season_id NOT IN (SELECT season_id FROM Processed_Seasons)
      ORDER BY l.league_id, s.year DESC;
    `;
    
    const result = await pool.query(query);
    const unsyncedSeasons = result.rows;

    const countQuery = `
      SELECT COUNT(*) as remaining
      FROM Season s
      WHERE s.season_id NOT IN (SELECT season_id FROM Processed_Seasons);
    `;
    const countRes = await pool.query(countQuery);
    const remainingInQueue = parseInt(countRes.rows[0].remaining, 10);

    if (unsyncedSeasons.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All league-seasons have been processed!',
        stats: { teamsUpserted: 0, matchesUpserted: 0, remainingInQueue: 0 }
      });
    }

    const batchLimit = 15;
    const currentBatch = unsyncedSeasons.slice(0, batchLimit);

    let totalTeamsAdded = 0;
    let totalMatchesAdded = 0;
    let processedCount = 0;

    for (const item of currentBatch) {
      const { league_id, season_id, year } = item;
      const seasonYear = year.split('-')[0];

      // --- A. SYNC TEAMS ---
      try {
        const teamsRes = await fetch(`https://v3.football.api-sports.io/teams?league=${league_id}&season=${seasonYear}`, {
          method: 'GET',
          headers: {
            'x-apisports-key': process.env.API_SPORTS_KEY,
            'Accept': 'application/json'
          }
        });
        const teamsData = await teamsRes.json();
        
        if (teamsData.response && teamsData.response.length > 0) {
          for (const tItem of teamsData.response) {
            const t = tItem.team;
            const venue = tItem.venue;

            const teamQuery = `
              INSERT INTO Team (Team_ID, Name, Short_Name, Stadium_Name)
              VALUES ($1, $2, $3, $4)
              ON CONFLICT (Team_ID) DO UPDATE SET 
                Name = EXCLUDED.Name,
                Short_Name = EXCLUDED.Short_Name,
                Stadium_Name = EXCLUDED.Stadium_Name;
            `;
            await pool.query(teamQuery, [t.id, t.name, t.code, venue ? venue.name : null]);
            totalTeamsAdded++;
          }
        }
      } catch (err) {
        console.error(`Team fetch error for league ${league_id}:`, err.message);
      }

      // --- B. SYNC MATCHES ---
      try {
        const fixturesRes = await fetch(`https://v3.football.api-sports.io/fixtures?league=${league_id}&season=${seasonYear}`, {
          method: 'GET',
          headers: {
            'x-apisports-key': process.env.API_SPORTS_KEY,
            'Accept': 'application/json'
          }
        });
        const fixturesData = await fixturesRes.json();

        if (fixturesData.response && fixturesData.response.length > 0) {
          for (const fItem of fixturesData.response) {
            const fixture = fItem.fixture;
            const teams = fItem.teams;
            const goals = fItem.goals;

            const matchQuery = `
              INSERT INTO match (match_id, season_id, home_team_id, away_team_id, match_date, status, home_score, away_score, venue)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              ON CONFLICT (match_id) DO UPDATE SET 
                  status = EXCLUDED.status,
                  home_score = EXCLUDED.home_score,
                  away_score = EXCLUDED.away_score;
            `;

            await pool.query(matchQuery, [
              fixture.id,
              season_id,
              teams.home.id,
              teams.away.id,
              fixture.date,
              fixture.status.short,
              goals.home !== null ? goals.home : 0,
              goals.away !== null ? goals.away : 0,
              fixture.venue ? fixture.venue.name : null
            ]);
            totalMatchesAdded++;
          }
        }
      } catch (err) {
        console.error(`Fixture fetch error for league ${league_id}:`, err.message);
      }

      // --- C. MARK SEASON AS PROCESSED ---
      // This ensures even if a league/season had 0 matches, it will never be checked again and queue decreases.
      await pool.query(
        `INSERT INTO Processed_Seasons (season_id) VALUES ($1) ON CONFLICT DO NOTHING`,
        [season_id]
      );

      processedCount++;
    }

    const newCountRes = await pool.query(countQuery);
    const updatedRemaining = parseInt(newCountRes.rows[0].remaining, 10);

    return NextResponse.json({
      success: true,
      message: `Batch completed! Processed ${processedCount} league-seasons.`,
      stats: {
        teamsUpserted: totalTeamsAdded,
        matchesUpserted: totalMatchesAdded,
        remainingInQueue: updatedRemaining
      }
    });

  } catch (err) {
    console.error("Global sync failed:", err);
    return NextResponse.json({ error: "Failed to run global multi-season sync" }, { status: 500 });
  }
}