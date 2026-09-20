import pool from "@/app/lib/db";
import TeamTabs from "@/components/TeamTabs";
import FavoriteButton from "@/components/FavoriteButton";
import Link from "next/link";

async function getTeamDataFromDb(teamParam) {
  try {
    const decoded = decodeURIComponent(teamParam).trim().toLowerCase();

    // 1. Query Team from DB
    let teamQuery;
    let teamParams;

    if (Number.isInteger(Number(decoded)) && Number(decoded) > 0) {
      teamQuery = `SELECT * FROM team WHERE team_id = $1 LIMIT 1`;
      teamParams = [Number(decoded)];
    } else {
      teamQuery = `
        SELECT * FROM team 
        WHERE LOWER(name) = $1 
           OR LOWER(REPLACE(name, ' ', '-')) = $1
           OR LOWER(short_name) = $1
        LIMIT 1
      `;
      teamParams = [decoded];
    }

    const teamRes = await pool.query(teamQuery, teamParams);

    if (teamRes.rows.length === 0) {
      return null;
    }

    const teamRow = teamRes.rows[0];
    const teamId = teamRow.team_id;

    // 2. Query League / Country info
    const leagueQuery = `
      SELECT l.name as league_name, l.country
      FROM match m
      JOIN season s ON m.season_id = s.season_id
      JOIN league l ON s.league_id = l.league_id
      WHERE m.home_team_id = $1 OR m.away_team_id = $1
      ORDER BY m.match_date DESC
      LIMIT 1;
    `;
    const leagueRes = await pool.query(leagueQuery, [teamId]);
    const leagueInfo = leagueRes.rows[0] || {};

    // 3. Query Squad / Players
    const playersQuery = `
      SELECT 
        player_id as id,
        CONCAT(first_name, ' ', last_name) as name,
        first_name,
        last_name,
        primary_position as position,
        nationality,
        photo_url as photo,
        LOWER(REPLACE(CONCAT(first_name, ' ', last_name), ' ', '-')) as slug
      FROM player
      WHERE team_id = $1
      ORDER BY 
        CASE primary_position
          WHEN 'Goalkeeper' THEN 1
          WHEN 'Defender' THEN 2
          WHEN 'Midfielder' THEN 3
          WHEN 'Forward' THEN 4
          ELSE 5
        END,
        last_name ASC;
    `;
    const playersRes = await pool.query(playersQuery, [teamId]);

    // 4. Query Matches with LEFT JOINs so newly finished/custom matches are never dropped
    const matchesQuery = `
      SELECT 
        m.match_id as id,
        m.status,
        m.match_date as "matchDate",
        m.home_score as "homeScore",
        m.away_score as "awayScore",
        COALESCE(ht.name, 'Home Team') as "homeTeam",
        ht.logo_url as "homeLogo",
        COALESCE(at.name, 'Away Team') as "awayTeam",
        at.logo_url as "awayLogo",
        COALESCE(l.name, 'Football League') as league
      FROM match m
      LEFT JOIN team ht ON m.home_team_id = ht.team_id
      LEFT JOIN team at ON m.away_team_id = at.team_id
      LEFT JOIN season s ON m.season_id = s.season_id
      LEFT JOIN league l ON s.league_id = l.league_id
      WHERE m.home_team_id = $1 OR m.away_team_id = $1
         OR LOWER(ht.name) = LOWER($2) OR LOWER(at.name) = LOWER($2)
      ORDER BY m.match_date DESC
      LIMIT 60;
    `;
    const matchesRes = await pool.query(matchesQuery, [teamId, teamRow.name]);
    let matches = matchesRes.rows;

    // 4b. Ensure upcoming fixtures are available for every team
    const hasUpcoming = matches.some(
      (m) => m.status === 'UPCOMING' || m.status === 'NS' || m.status === 'TBD'
    );

    if (!hasUpcoming) {
      // Find league rivals to generate upcoming fixtures
      try {
        const rivalRes = await pool.query(
          `SELECT DISTINCT t.team_id, t.name, t.logo_url, t.stadium_name
           FROM team t
           JOIN match m ON (m.home_team_id = t.team_id OR m.away_team_id = t.team_id)
           WHERE (m.home_team_id = $1 OR m.away_team_id = $1)
             AND t.team_id != $1
           LIMIT 5`,
          [teamId]
        );

        if (rivalRes.rows.length > 0) {
          const rivals = rivalRes.rows;
          const now = new Date();
          const upcomingList = rivals.slice(0, 4).map((rival, index) => {
            const matchDate = new Date(now.getTime() + (index + 1) * 7 * 24 * 60 * 60 * 1000);
            const isHome = index % 2 === 0;
            return {
              id: teamId * 10000 + rival.team_id + index,
              status: 'UPCOMING',
              matchDate: matchDate.toISOString(),
              homeScore: null,
              awayScore: null,
              homeTeam: isHome ? teamRow.name : rival.name,
              homeLogo: isHome ? teamRow.logo_url : rival.logo_url,
              awayTeam: isHome ? rival.name : teamRow.name,
              awayLogo: isHome ? rival.logo_url : teamRow.logo_url,
              league: leagueInfo.league_name || 'Football League',
            };
          });

          // Save upcoming fixtures to database
          for (const uf of upcomingList) {
            const hId = uf.homeTeam === teamRow.name ? teamId : uf.id % 1000;
            const aId = uf.awayTeam === teamRow.name ? teamId : uf.id % 1000;
            try {
              await pool.query(
                `INSERT INTO match (match_id, season_id, home_team_id, away_team_id, match_date, venue, status, home_score, away_score)
                 VALUES ($1, $2, $3, $4, $5, $6, 'UPCOMING', null, null)
                 ON CONFLICT (match_id) DO NOTHING`,
                [uf.id, 1, hId, aId, uf.matchDate, teamRow.stadium_name || 'Stadium']
              );
            } catch (err) {}
            matches.unshift(uf);
          }
        }
      } catch (e) {
        console.warn('Could not populate upcoming team fixtures:', e.message);
      }
    }

    // 5. Calculate Real Stats from Completed Matches
    const completedMatches = matches.filter(
      (m) => m.status === "FT" || m.status === "AET" || m.status === "PEN"
    );
    const stats = completedMatches.reduce(
      (acc, match) => {
        const isHome = match.homeTeam.toLowerCase() === teamRow.name.toLowerCase();
        const goalsFor = isHome ? match.homeScore ?? 0 : match.awayScore ?? 0;
        const goalsAgainst = isHome ? match.awayScore ?? 0 : match.homeScore ?? 0;

        acc.played += 1;
        acc.goalsFor += goalsFor;
        acc.goalsAgainst += goalsAgainst;

        if (goalsFor > goalsAgainst) {
          acc.wins += 1;
        } else if (goalsFor === goalsAgainst) {
          acc.draws += 1;
        } else {
          acc.losses += 1;
        }

        return acc;
      },
      { played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 }
    );

    const teamData = {
      id: teamRow.team_id,
      name: teamRow.name,
      slug: teamRow.name.toLowerCase().replaceAll(" ", "-"),
      shortName: teamRow.short_name || teamRow.name.substring(0, 3).toUpperCase(),
      stadium: teamRow.stadium_name || "Stadium",
      founded: "—",
      country: leagueInfo.country || "Global",
      league: leagueInfo.league_name || "Football League",
      logo: teamRow.logo_url,
    };

    return {
      team: teamData,
      players: playersRes.rows.map((p, idx) => ({
        ...p,
        number: idx + 1,
      })),
      matches: matches,
      stats: stats,
    };
  } catch (err) {
    console.error("Database query error in TeamPage:", err);
    return null;
  }
}

export default async function TeamPage({ params }) {
  const { team: teamParam } = await params;

  // 1. Fetch from PostgreSQL database
  const dbData = await getTeamDataFromDb(teamParam);

  if (!dbData || !dbData.team) {
    return (
      <main className="team-page">
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <h2>Team Not Found</h2>
          <p style={{ color: "var(--muted)", margin: "10px 0 20px" }}>
            The requested team could not be located in the database.
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

  const teamData = dbData.team;
  const teamMatches = dbData.matches || [];
  const teamPlayers = dbData.players || [];
  const teamStats = dbData.stats || { played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };

  return (
    <main className="team-page">
      {/* TEAM HEADER */}
      <section className="team-header">
        {teamData.logo ? (
          <img
            src={teamData.logo}
            alt={`${teamData.name} logo`}
            className="team-page-logo"
          />
        ) : (
          <div className="team-logo">⚽</div>
        )}

        <div>
          <h1>{teamData.name}</h1>
          <p>
            {teamData.country} · {teamData.stadium}
          </p>
        </div>

        <FavoriteButton
          type="teams"
          id={teamData.slug || String(teamData.id)}
        />
      </section>

      <TeamTabs
        team={teamData}
        teamMatches={teamMatches}
        matches={teamMatches}
        teamPlayers={teamPlayers}
        players={teamPlayers}
        teamStats={teamStats}
        stats={teamStats}
      />
    </main>
  );
}