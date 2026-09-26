import Link from "next/link";
import pool from "@/app/lib/db";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

async function getLeagues() {
  try {
    const res = await pool.query(`
      SELECT 
        league_id as id,
        name,
        country,
        type,
        logo_url,
        LOWER(REPLACE(name, ' ', '-')) as slug
      FROM league
      ORDER BY name ASC
    `);

    if (res.rows.length > 0) {
      return res.rows;
    }
  } catch (err) {
    console.error("Error fetching leagues from DB:", err);
  }
  return [];
}

export default async function LeaguesPage() {
  const leagues = await getLeagues();

  return (
    <main className="leagues-page">
      <section className="page-title">
        <span className="page-title-kicker">Competition hub</span>
        <h1><Icon name="trophy" /> Football Competitions</h1>
        <p>Explore live tables, match schedules, and clubs across major global leagues.</p>
      </section>

      <div className="league-grid">
        {leagues.map((league) => (
          <Link
            key={league.id}
            href={`/leagues/${league.slug || league.name.toLowerCase().replaceAll(" ", "-")}`}
            className="league-card"
          >
            <div className="league-icon">
              {league.logo_url ? (
                <img src={league.logo_url} alt={league.name} style={{ width: "36px", height: "36px", objectFit: "contain" }} />
              ) : (
                <Icon name="trophy" />
              )}
            </div>

            <div>
              <h2>{league.name}</h2>
              <p>{league.country || "Country unavailable"}</p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
