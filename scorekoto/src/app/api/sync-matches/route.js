import { NextResponse } from 'next/server';
import pool from '../../lib/db';

// Processes batches of unsynchronized league-seasons (2022+) to sync teams and match fixtures
export async function GET() {
  try {
    // Ensure table exists to track completed seasons
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Processed_Seasons (
        season_id INT PRIMARY KEY
      );
    `);
    
    // Fetch pending seasons starting from 2022
    const query = `
      SELECT s.season_id, s.league_id, s.year, l.name AS league_name 
      FROM Season s
      JOIN League l ON s.league_id = l.league_id
      WHERE s.season_id NOT IN (SELECT season_id FROM Processed_Seasons)
        AND CAST(SPLIT_PART(s.year, '-', 1) AS INTEGER) >= 2022
      ORDER BY l.league_id ASC, s.year DESC;
    `;
    
    const result = await pool.query(query);
    const unsyncedSeasons = result.rows;

    const countQuery = `
      SELECT COUNT(*) as remaining
      FROM Season s
      WHERE s.season_id NOT IN (SELECT season_id FROM Processed_Seasons)
        AND CAST(SPLIT_PART(s.year, '-', 1) AS INTEGER) >= 2022;
    `;
    const countRes = await pool.query(countQuery);
    const remainingInQueue = parseInt(countRes.rows[0].remaining, 10);

    if (unsyncedSeasons.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All accessible league-seasons (2022–2026) have been processed! 100% Match Sync Complete.',
        stats: { teamsUpserted: 0, matchesUpserted: 0, remainingInQueue: 0 }
      });
    }

    const batchLimit = 4;
    const currentBatch = unsyncedSeasons.slice(0, batchLimit);

    let totalTeamsAdded = 0;
    let totalMatchesAdded = 0;
    let processedCount = 0;

    const apiKey = process.env.API_SPORTS_KEY;

    for (const item of currentBatch) {
      const { season_id, league_id, year, league_name } = item;
      const seasonYear = year.split('-')[0];

      let seasonMatchesCount = 0;

      // Fetch and upsert teams participating in this league-season
      try {
        const teamsRes = await fetch(`https://v3.football.api-sports.io/teams?league=${league_id}&season=${seasonYear}`, {
          method: 'GET',
          headers: {
            'x-apisports-key': apiKey,
            'Accept': 'application/json'
          }
        });

        if (teamsRes.status === 429) {
          return NextResponse.json({ 
            success: false, 
            status: 'paused', 
            message: 'API Speed limit reached. Pause for 60 seconds before next batch.' 
          });
        }

        const teamsData = await teamsRes.json();
        
        if (teamsData.response && teamsData.response.length > 0) {
          for (const tItem of teamsData.response) {
            const t = tItem.team;
            const venue = tItem.venue;

            const teamQuery = `
              INSERT INTO Team (Team_ID, Name, Short_Name, Stadium_Name, logo_url)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (Team_ID) DO UPDATE SET 
                Name = EXCLUDED.Name,
                Short_Name = EXCLUDED.Short_Name,
                Stadium_Name = EXCLUDED.Stadium_Name,
                logo_url = EXCLUDED.logo_url;
            `;
            await pool.query(teamQuery, [t.id, t.name, t.code, venue ? venue.name : null, t.logo]);
            totalTeamsAdded++;
          }
        }
      } catch (err) {
        console.error(`Team fetch error for ${league_name} ${year}:`, err.message);
      }

      // Fetch and upsert fixtures and match results for this league-season
      try {
        const fixturesRes = await fetch(`https://v3.football.api-sports.io/fixtures?league=${league_id}&season=${seasonYear}`, {
          method: 'GET',
          headers: {
            'x-apisports-key': apiKey,
            'Accept': 'application/json'
          }
        });

        if (fixturesRes.status === 429) {
          return NextResponse.json({ 
            success: false, 
            status: 'paused', 
            message: 'API Speed limit reached. Pause for 60 seconds before next batch.' 
          });
        }

        const fixturesData = await fixturesRes.json();

        // Skip restricted seasons on free tier
        if (fixturesData.errors && fixturesData.errors.plan) {
          console.log(`Plan limit skip for ${league_name} ${year}:`, fixturesData.errors.plan);
          await pool.query(
            `INSERT INTO Processed_Seasons (season_id) VALUES ($1) ON CONFLICT DO NOTHING`,
            [season_id]
          );
          continue;
        }

        if (fixturesData.response && fixturesData.response.length > 0) {
          for (const fItem of fixturesData.response) {
            const fixture = fItem.fixture;
            const teams = fItem.teams;
            const goals = fItem.goals;

            await pool.query(`
              INSERT INTO Team (Team_ID, Name, Short_Name, Stadium_Name, logo_url)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (Team_ID) DO NOTHING;
            `, [teams.home.id, teams.home.name, teams.home.name.slice(0, 3).toUpperCase(), fixture.venue ? fixture.venue.name : null, teams.home.logo]).catch(() => {});

            await pool.query(`
              INSERT INTO Team (Team_ID, Name, Short_Name, Stadium_Name, logo_url)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (Team_ID) DO NOTHING;
            `, [teams.away.id, teams.away.name, teams.away.name.slice(0, 3).toUpperCase(), fixture.venue ? fixture.venue.name : null, teams.away.logo]).catch(() => {});

            const matchQuery = `
              INSERT INTO Match (Match_ID, Season_ID, Home_Team_ID, Away_Team_ID, Match_Date, Status, Home_Score, Away_Score, Venue)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              ON CONFLICT (Match_ID) DO UPDATE SET 
                  Status = EXCLUDED.Status,
                  Home_Score = EXCLUDED.Home_Score,
                  Away_Score = EXCLUDED.Away_Score;
            `;

            await pool.query(matchQuery, [
              fixture.id,
              season_id,
              teams.home.id,
              teams.away.id,
              fixture.date,
              fixture.status.short || 'FT',
              goals.home !== null ? goals.home : 0,
              goals.away !== null ? goals.away : 0,
              fixture.venue ? fixture.venue.name : null
            ]);
            totalMatchesAdded++;
            seasonMatchesCount++;
          }
        }
      } catch (err) {
        console.error(`Fixture fetch error for ${league_name} ${year}:`, err.message);
      }

      // Mark season as processed to advance the queue
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
      message: `Batch completed! Processed ${processedCount} seasons. Ingested ${totalMatchesAdded} matches.`,
      stats: {
        processedSeasons: processedCount,
        teamsUpserted: totalTeamsAdded,
        matchesUpserted: totalMatchesAdded,
        remainingInQueue: updatedRemaining
      }
    });

  } catch (err) {
    console.error("Match batch sync failed:", err);
    return NextResponse.json({ error: "Failed to run match batch sync", details: err.message }, { status: 500 });
  }
}
