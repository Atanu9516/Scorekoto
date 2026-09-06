import { NextResponse } from 'next/server';
import pool from '../../lib/db';

// Fetches live football news articles from NewsAPI.org and saves them to the database
export async function GET() {
  try {
    const apiKey = process.env.NEWS_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'NEWS_API_KEY is missing in .env.local' }, { status: 400 });
    }

    // Ensure news ID sequence exists
    await pool.query('CREATE SEQUENCE IF NOT EXISTS news_news_id_seq;');
    await pool.query('ALTER TABLE news ALTER COLUMN news_id SET DEFAULT nextval(\'news_news_id_seq\');').catch(() => {});

    // Fetch latest football news headlines
    const url = `https://newsapi.org/v2/everything?q=football OR soccer OR "Premier League" OR "Champions League"&language=en&sortBy=publishedAt&pageSize=25&apiKey=${apiKey}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== 'ok' || !data.articles) {
      return NextResponse.json({ error: 'Failed to fetch from NewsAPI', details: data.message }, { status: 500 });
    }

    let insertedCount = 0;

    for (const article of data.articles) {
      if (!article.title || article.title === '[Removed]') continue;

      const headline = article.title.slice(0, 190);
      const content = article.description || article.content || 'Full story available on official sports outlets.';
      const category = (article.source && article.source.name) ? article.source.name.slice(0, 45) : 'Football News';

      const query = `
        INSERT INTO news (category, headline, content, published_at)
        VALUES ($1, $2, $3, NOW());
      `;

      await pool.query(query, [category, headline, content]).catch(() => {});
      insertedCount++;
    }

    const { rows: totalNews } = await pool.query(`SELECT COUNT(*) FROM news;`);

    return NextResponse.json({
      success: true,
      message: `Successfully fetched and stored live football news from NewsAPI.org!`,
      stats: {
        newArticlesFetched: insertedCount,
        totalNewsArticlesInDB: parseInt(totalNews[0].count, 10)
      }
    });

  } catch (err) {
    console.error("Live News Sync Error:", err);
    return NextResponse.json({ error: 'Failed to sync news', details: err.message }, { status: 500 });
  }
}
