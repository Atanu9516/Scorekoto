const { Pool } = require('pg');

// PostgreSQL connection pool configuration for CLI script
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'Scorekoto',
  password: 'atanu',
  port: 5432,
});

const apiKey = 'deed37c19f8d4712aeec8cd973a4595c';

// Fetches live football news articles from NewsAPI.org and inserts into PostgreSQL
async function fetchLiveNews() {
  try {
    // Ensure news ID sequence exists
    await pool.query('CREATE SEQUENCE IF NOT EXISTS news_news_id_seq;');
    await pool.query('ALTER TABLE news ALTER COLUMN news_id SET DEFAULT nextval(\'news_news_id_seq\');').catch(() => {});

    // Fetch latest football news headlines
    const url = `https://newsapi.org/v2/everything?q=football OR soccer OR "Premier League" OR "Champions League"&language=en&sortBy=publishedAt&pageSize=25&apiKey=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();

    console.log("NewsAPI Response Status:", data.status, "| Articles Count:", data.articles ? data.articles.length : 0);

    if (data.articles && data.articles.length > 0) {
      let added = 0;
      for (const article of data.articles) {
        if (!article.title || article.title === '[Removed]') continue;

        const headline = article.title.slice(0, 190);
        const content = article.description || article.content || 'Full match coverage available on official sports outlets.';
        const category = (article.source && article.source.name) ? article.source.name.slice(0, 45) : 'Football News';

        await pool.query(
          `INSERT INTO news (category, headline, content, published_at) VALUES ($1, $2, $3, NOW())`,
          [category, headline, content]
        ).catch(err => console.error("Insert error:", err.message));

        added++;
      }
      console.log(`Inserted ${added} articles into news table.`);
    }

    const { rows: countRes } = await pool.query('SELECT COUNT(*) FROM news;');
    console.log('=== REAL LIVE NEWS ARTICLES IN POSTGRESQL DB ===', countRes[0].count);

  } catch (err) {
    console.error("News sync error:", err);
  } finally {
    pool.end();
  }
}

fetchLiveNews();
