import { NextResponse } from 'next/server';
import pool from '../../lib/db';

export const dynamic = 'force-dynamic';

function formatRelativeTime(date) {
  if (!date) return 'Recently';
  const now = new Date();
  const diffMs = now - new Date(date);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '8', 10);

    const query = `
      SELECT 
        m.match_id,
        m.status,
        m.home_score,
        m.away_score,
        m.match_date,
        ht.name as home_team,
        at.name as away_team,
        l.name as league_name
      FROM match m
      JOIN team ht ON m.home_team_id = ht.team_id
      JOIN team at ON m.away_team_id = at.team_id
      LEFT JOIN season s ON m.season_id = s.season_id
      LEFT JOIN league l ON s.league_id = l.league_id
      ORDER BY m.match_date DESC
      LIMIT $1;
    `;

    const result = await pool.query(query, [limit]);

    const notifications = result.rows.map((row, index) => {
      const isLive = row.status === 'LIVE' || row.status === '1H' || row.status === '2H' || row.status === 'HT';
      const isFinished = row.status === 'FT' || row.status === 'AET' || row.status === 'PEN';
      const isUpcoming = row.status === 'NS' || row.status === 'TBD' || row.status === 'UPCOMING';

      let type = 'result';
      let title = 'Match Update';
      let message = `${row.home_team} vs ${row.away_team}`;

      if (isLive) {
        type = 'live';
        title = 'Match is Live';
        message = `${row.home_team} ${row.home_score ?? 0} - ${row.away_score ?? 0} ${row.away_team} is underway.`;
      } else if (isFinished) {
        type = 'result';
        title = 'Full Time';
        message = `${row.home_team} ${row.home_score ?? 0} - ${row.away_score ?? 0} ${row.away_team} (${row.league_name || 'Match'})`;
      } else if (isUpcoming) {
        type = 'upcoming';
        title = 'Match Scheduled';
        message = `${row.home_team} vs ${row.away_team} in ${row.league_name || 'League'}.`;
      }

      return {
        id: row.match_id || index + 1,
        type,
        title,
        message,
        matchId: row.match_id,
        time: formatRelativeTime(row.match_date),
        read: index > 1, // First two unread as fresh highlights
      };
    });

    return NextResponse.json({
      success: true,
      count: notifications.length,
      notifications,
    });
  } catch (err) {
    console.error('Failed to fetch notifications from database:', err);
    return NextResponse.json(
      { error: 'Failed to fetch notifications', details: err.message },
      { status: 500 }
    );
  }
}

