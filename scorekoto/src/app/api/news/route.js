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
        n.news_id as id,
        n.headline as title,
        n.category,
        n.content as description,
        n.published_at,
        t.name as team_name,
        t.logo_url as team_logo
      FROM news n
      LEFT JOIN team t ON n.team_id = t.team_id
      ORDER BY n.published_at DESC, n.news_id DESC
      LIMIT $1;
    `;

    const result = await pool.query(query, [limit]);

    const newsItems = result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      category: row.category || 'Football News',
      description: row.description,
      time: formatRelativeTime(row.published_at),
      publishedAt: row.published_at,
      teamName: row.team_name,
      teamLogo: row.team_logo,
    }));

    return NextResponse.json({
      success: true,
      count: newsItems.length,
      news: newsItems,
    });
  } catch (err) {
    console.error('Failed to fetch news from database:', err);
    return NextResponse.json(
      { error: 'Failed to fetch news', details: err.message },
      { status: 500 }
    );
  }
}

