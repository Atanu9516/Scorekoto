import { NextResponse } from 'next/server';
import pool from '../../lib/db';
import { fetchLeagueTopScorers } from '../../lib/league-season-data';

export const dynamic = 'force-dynamic';

// Populates genuine player season performance metrics (appearances, goals, assists, cards) from official sources
export async function GET(request) {
  try {
    const API_KEY = process.env.API_SPORTS_KEY;
    if (!API_KEY) {
      return NextResponse.json({ success: false, error: 'API_SPORTS_KEY not configured' }, { status: 500 });
    }

    const requestedSeason = Number(new URL(request.url).searchParams.get('season'));
    const now = new Date();
    const season = Number.isInteger(requestedSeason) && requestedSeason > 2000
      ? requestedSeason
      : (now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1);
    const year = `${season}-${season + 1}`;
    const majorLeagues = [
      { id: 39, name: 'Premier League', season, year },
      { id: 140, name: 'La Liga', season, year },
      { id: 78, name: 'Bundesliga', season, year },
      { id: 135, name: 'Serie A', season, year },
      { id: 61, name: 'Ligue 1', season, year },
      { id: 2, name: 'UEFA Champions League', season, year }
    ];

    let totalSynced = 0;

    for (const l of majorLeagues) {
      try {
        const seasonRes = await pool.query(
          `SELECT season_id, end_date
           FROM season
           WHERE league_id = $1 AND year = $2
           ORDER BY season_id DESC
           LIMIT 1`,
          [l.id, l.year]
        );
        if (seasonRes.rows.length === 0) continue;
        const { season_id: seasonId, end_date: seasonEndDate } = seasonRes.rows[0];
        const maxMatchesRes = await pool.query(
          `WITH team_matches AS (
             SELECT home_team_id AS team_id, COUNT(*)::int AS played
             FROM match
             WHERE season_id = $1 AND status IN ('FT', 'AET', 'PEN')
             GROUP BY home_team_id

             UNION ALL

             SELECT away_team_id AS team_id, COUNT(*)::int AS played
             FROM match
             WHERE season_id = $1 AND status IN ('FT', 'AET', 'PEN')
             GROUP BY away_team_id
           )
           SELECT COALESCE(MAX(played), 0)::int AS max_appearances
           FROM (
             SELECT team_id, SUM(played)::int AS played
             FROM team_matches
             GROUP BY team_id
           ) totals`,
          [seasonId]
        );
        const maxAppearances = maxMatchesRes.rows[0]?.max_appearances || 0;
        const scorers = await fetchLeagueTopScorers(
          l.id,
          seasonId,
          l.season,
          { maxAppearances, seasonEndDate }
        );

        totalSynced += scorers.length;
      } catch (err) {
        console.warn(`Error syncing stats for ${l.name}:`, err.message);
      }
    }

    const { rows: countRes } = await pool.query(`SELECT COUNT(*) FROM player_season_stats;`);

    return NextResponse.json({
      success: true,
      message: 'Successfully populated real Player_Season_Stats from official feeds!',
      stats: {
        totalSyncedInRun: totalSynced,
        totalPlayerStatsInDB: parseInt(countRes[0].count, 10)
      }
    });
  } catch (err) {
    console.error("Player season stats sync failed:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
