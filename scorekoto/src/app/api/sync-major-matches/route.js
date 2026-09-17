import { NextResponse } from 'next/server';
import pool from '../../lib/db';

// Fetches and upserts fixtures for major global football leagues for season 2023
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
    let totalMatchesInserted = 0;
    const resultsSummary = [];

    for (const league of majorLeagues) {
      // 1. Resolve real season_id for league and seasonYear to satisfy foreign key constraint
      let seasonId = null;
      try {
        const seasonRes = await pool.query(
          `SELECT season_id FROM season 
           WHERE league_id = $1 AND (year LIKE $2 OR year LIKE $3) 
           ORDER BY season_id DESC LIMIT 1`,
          [league.id, `${seasonYear}%`, `%${seasonYear}%`]
        );
        if (seasonRes.rows.length > 0) {
          seasonId = seasonRes.rows[0].season_id;
        } else {
          // Check if league exists before creating a season
          const leagueCheck = await pool.query(`SELECT league_id FROM league WHERE league_id = $1`, [league.id]);
          if (leagueCheck.rows.length === 0) {
            await pool.query(
              `INSERT INTO league (league_id, name, country, type) VALUES ($1, $2, 'Global', 'League') ON CONFLICT DO NOTHING`,
              [league.id, league.name]
            );
          }
          const insertSeason = await pool.query(
            `INSERT INTO season (league_id, year, start_date, end_date)
             VALUES ($1, $2, $3, $4)
             RETURNING season_id`,
            [league.id, `${seasonYear}-${seasonYear + 1}`, `${seasonYear}-08-01`, `${seasonYear + 1}-05-31`]
          );
          seasonId = insertSeason.rows[0]?.season_id;
        }
      } catch (seasonErr) {
        console.warn(`Could not resolve season for ${league.name}:`, seasonErr.message);
      }

      if (!seasonId) {
        resultsSummary.push({ league: league.name, matchesAdded: 0, status: 'No season found in DB' });
        continue;
      }

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

        // Ensure teams exist to avoid foreign key errors
        await pool.query(
          `INSERT INTO team (team_id, name, logo_url)
           VALUES ($1, $2, $3)
           ON CONFLICT (team_id) DO NOTHING`,
          [teams.home.id, teams.home.name, teams.home.logo]
        ).catch(() => {});

        await pool.query(
          `INSERT INTO team (team_id, name, logo_url)
           VALUES ($1, $2, $3)
           ON CONFLICT (team_id) DO NOTHING`,
          [teams.away.id, teams.away.name, teams.away.logo]
        ).catch(() => {});

        // Upsert match data and scorelines
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
          seasonId,
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