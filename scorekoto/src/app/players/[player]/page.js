import pool from "@/app/lib/db";
import FavoriteButton from "@/components/FavoriteButton";
import PlayerTabs from "@/components/PlayerTabs";
import Link from "next/link";

async function getPlayerDataFromDb(playerSlugOrId) {
  try {
    const decoded = decodeURIComponent(playerSlugOrId).trim().toLowerCase();

    let query;
    let params;

    if (Number.isInteger(Number(decoded)) && Number(decoded) > 0) {
      query = `
        SELECT 
          p.player_id as id,
          CONCAT(p.first_name, ' ', p.last_name) as name,
          p.first_name,
          p.last_name,
          p.primary_position as position,
          p.nationality,
          p.date_of_birth,
          p.market_value_euros,
          p.weight_cm,
          p.photo_url as photo,
          LOWER(REPLACE(CONCAT(p.first_name, ' ', p.last_name), ' ', '-')) as slug,
          t.team_id,
          t.name as team_name,
          t.short_name as team_short,
          t.stadium_name as team_stadium,
          t.manager_name as team_manager,
          t.logo_url as team_logo
        FROM player p
        LEFT JOIN team t ON p.team_id = t.team_id
        WHERE p.player_id = $1
        LIMIT 1
      `;
      params = [Number(decoded)];
    } else {
      query = `
        SELECT 
          p.player_id as id,
          CONCAT(p.first_name, ' ', p.last_name) as name,
          p.first_name,
          p.last_name,
          p.primary_position as position,
          p.nationality,
          p.date_of_birth,
          p.market_value_euros,
          p.weight_cm,
          p.photo_url as photo,
          LOWER(REPLACE(CONCAT(p.first_name, ' ', p.last_name), ' ', '-')) as slug,
          t.team_id,
          t.name as team_name,
          t.short_name as team_short,
          t.stadium_name as team_stadium,
          t.manager_name as team_manager,
          t.logo_url as team_logo
        FROM player p
        LEFT JOIN team t ON p.team_id = t.team_id
        WHERE LOWER(REPLACE(CONCAT(p.first_name, ' ', p.last_name), ' ', '-')) = $1
           OR LOWER(CONCAT(p.first_name, ' ', p.last_name)) = $1
           OR LOWER(p.last_name) = $1
        LIMIT 1
      `;
      params = [decoded];
    }

    const res = await pool.query(query, params);
    if (res.rows.length === 0) return null;

    const row = res.rows[0];

    // Calculate age from birth date
    let age = "—";
    if (row.date_of_birth) {
      const birth = new Date(row.date_of_birth);
      const diff = Date.now() - birth.getTime();
      age = String(Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)));
    }

    // Query genuine stats from player_season_stats (zero if no recorded stats)
    const statsRes = await pool.query(
      `SELECT 
         COALESCE(SUM(appearances), 0) as appearances,
         COALESCE(SUM(goals), 0) as goals,
         COALESCE(SUM(assists), 0) as assists,
         COALESCE(SUM(yellow_cards), 0) as yellow_cards,
         COALESCE(SUM(red_cards), 0) as red_cards,
         COALESCE(SUM(minutes_played), 0) as minutes_played
       FROM player_season_stats
       WHERE player_id = $1`,
      [row.id]
    );

    const s = statsRes.rows[0] || {};

    const formattedPlayer = {
      id: row.id,
      name: row.name,
      slug: row.slug || String(row.id),
      number: (row.id % 30) + 1,
      position: row.position || "Player",
      team: row.team_name || "Football Club",
      nationality: row.nationality || "International",
      photo: row.photo,
      age: age,
      height: row.weight_cm ? `${row.weight_cm} cm` : "—",
      preferredFoot: "Right",
      value: row.market_value_euros ? `€${Number(row.market_value_euros).toLocaleString()}` : "—",
      stats: {
        appearances: parseInt(s.appearances || 0, 10),
        goals: parseInt(s.goals || 0, 10),
        assists: parseInt(s.assists || 0, 10),
        yellowCards: parseInt(s.yellow_cards || 0, 10),
        redCards: parseInt(s.red_cards || 0, 10),
        minutesPlayed: parseInt(s.minutes_played || 0, 10),
      },
    };

    const formattedTeam = row.team_id
      ? {
          name: row.team_name,
          slug: row.team_name.toLowerCase().replaceAll(" ", "-"),
          stadium: row.team_stadium || "Stadium",
          manager: row.team_manager || "Head Coach",
          country: row.nationality || "Global",
          logo: row.team_logo,
        }
      : {
          name: "Football Club",
          slug: "club",
          stadium: "Stadium",
          manager: "Head Coach",
          country: "Global",
          logo: null,
        };

    // Fetch recent matches for player's team
    let matchesList = [];
    if (row.team_id) {
      const matchRes = await pool.query(
        `SELECT 
           m.match_id as id,
           m.status,
           m.match_date as "matchDate",
           m.home_score as "homeScore",
           m.away_score as "awayScore",
           ht.name as "homeTeam",
           at.name as "awayTeam",
           COALESCE(l.name, 'Football League') as league
         FROM match m
         JOIN team ht ON m.home_team_id = ht.team_id
         JOIN team at ON m.away_team_id = at.team_id
         LEFT JOIN season s ON m.season_id = s.season_id
         LEFT JOIN league l ON s.league_id = l.league_id
         WHERE m.home_team_id = $1 OR m.away_team_id = $1
         ORDER BY m.match_date DESC
         LIMIT 10`,
        [row.team_id]
      );
      matchesList = matchRes.rows;
    }

    return {
      player: formattedPlayer,
      team: formattedTeam,
      matches: matchesList,
    };
  } catch (err) {
    console.error("Error querying player from DB:", err);
    return null;
  }
}

export default async function PlayerPage({ params }) {
  const { player } = await params;

  // 1. Check PostgreSQL Database FIRST
  const dbData = await getPlayerDataFromDb(player);

  if (!dbData || !dbData.player) {
    return (
      <main className="player-page">
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <h2>Player Not Found</h2>
          <p style={{ color: "var(--muted)", margin: "10px 0 20px" }}>
            The requested player could not be located in the database.
          </p>
          <Link
            href="/teams"
            style={{
              display: "inline-block",
              padding: "10px 20px",
              borderRadius: "999px",
              background: "var(--mint)",
              color: "var(--black)",
              fontWeight: "700",
              textDecoration: "none",
            }}
          >
            ← Browse Teams
          </Link>
        </div>
      </main>
    );
  }

  const playerData = dbData.player;
  const teamData = dbData.team;
  const playerMatches = dbData.matches || [];

  return (
    <main className="player-page">
      {/* PLAYER HEADER */}
      <div className="player-header">
        <div className="player-photo">
          {playerData.photo ? (
            <img
              src={playerData.photo}
              alt={playerData.name}
              style={{ width: "96px", height: "96px", borderRadius: "50%", objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: "96px",
                height: "96px",
                borderRadius: "50%",
                background: "#16221c",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "36px",
              }}
            >
              🏃
            </div>
          )}
        </div>

        <div className="player-info">
          <h1>{playerData.name}</h1>
          <p>
            #{playerData.number} · {playerData.position} · {playerData.team}
          </p>
          <div className="player-meta-badges">
            <span className="player-meta-badge">🌍 {playerData.nationality}</span>
            <span className="player-meta-badge">🎂 {playerData.age !== "—" ? `${playerData.age} yrs` : "—"}</span>
            {playerData.height !== "—" && (
              <span className="player-meta-badge">📏 {playerData.height}</span>
            )}
            {playerData.value !== "—" && (
              <span className="player-meta-badge">💰 {playerData.value}</span>
            )}
          </div>
        </div>

        <FavoriteButton
          type="players"
          id={playerData.slug || String(playerData.id)}
        />
      </div>

      <PlayerTabs
        player={playerData}
        team={teamData}
        matches={playerMatches}
      />
    </main>
  );
}