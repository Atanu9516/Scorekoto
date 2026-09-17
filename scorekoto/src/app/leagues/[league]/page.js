import pool from "@/app/lib/db";
import FavoriteButton from "@/components/FavoriteButton";
import LeagueTabs from "@/components/LeagueTabs";
import Link from "next/link";

async function getLeagueDataFromDb(leagueParam) {
  try {
    const decoded = decodeURIComponent(leagueParam).trim().toLowerCase();
    const isId = Number.isInteger(Number(decoded)) && Number(decoded) > 0;

    const leagueQuery = isId
      ? `SELECT league_id as id, name, type, country, logo_url, LOWER(REPLACE(name, ' ', '-')) as slug FROM league WHERE league_id = $1 LIMIT 1`
      : `SELECT league_id as id, name, type, country, logo_url, LOWER(REPLACE(name, ' ', '-')) as slug FROM league WHERE LOWER(REPLACE(name, ' ', '-')) = $1 OR LOWER(name) = $1 LIMIT 1`;

    const leagueRes = await pool.query(leagueQuery, [isId ? Number(decoded) : decoded]);
    if (leagueRes.rows.length === 0) return null;

    const league = leagueRes.rows[0];

    // Clean whitespace in logo_url
    if (league.logo_url) {
      league.logo_url = league.logo_url.replace(/\s+/g, "");
    }

    // Find the latest active season for this league that has standings or matches
    const seasonRes = await pool.query(`
      SELECT s.season_id, s.year, COUNT(tss.team_id) as standings_count
      FROM season s
      LEFT JOIN team_season_stats tss ON s.season_id = tss.season_id
      WHERE s.league_id = $1
      GROUP BY s.season_id, s.year
      ORDER BY standings_count DESC, s.season_id DESC
      LIMIT 1;
    `, [league.id]);

    const activeSeason = seasonRes.rows[0];
    const targetSeasonId = activeSeason?.season_id;
    const seasonDisplayName = activeSeason
      ? (activeSeason.year.includes('-') ? activeSeason.year.replace('-', '/') : activeSeason.year)
      : "2024/2025";

    // 1. Fetch matches for this league (from target season or latest)
    const matchRes = await pool.query(
      `SELECT 
         m.match_id as id,
         m.status,
         m.match_date as "matchDate",
         m.home_score as "homeScore",
         m.away_score as "awayScore",
         ht.name as "homeTeam",
         ht.logo_url as "homeLogo",
         at.name as "awayTeam",
         at.logo_url as "awayLogo",
         l.name as league
       FROM match m
       JOIN team ht ON m.home_team_id = ht.team_id
       JOIN team at ON m.away_team_id = at.team_id
       JOIN season s ON m.season_id = s.season_id
       JOIN league l ON s.league_id = l.league_id
       WHERE l.league_id = $1
       ORDER BY m.match_date DESC
       LIMIT 100`,
      [league.id]
    );
    const leagueMatches = matchRes.rows;

    // 2. Fetch genuine top scorers from player_season_stats
    const pssRes = await pool.query(
      `SELECT 
         CONCAT(p.first_name, ' ', p.last_name) as player,
         COALESCE(t.name, 'Club') as team,
         SUM(pss.goals)::int as goals,
         SUM(pss.assists)::int as assists,
         SUM(pss.appearances)::int as appearances
       FROM player_season_stats pss
       JOIN player p ON pss.player_id = p.player_id
       LEFT JOIN team t ON p.team_id = t.team_id
       JOIN season s ON pss.season_id = s.season_id
       WHERE s.league_id = $1
       GROUP BY p.player_id, p.first_name, p.last_name, t.name
       HAVING SUM(pss.goals) > 0
       ORDER BY goals DESC, assists DESC
       LIMIT 20`,
      [league.id]
    );
    const dbTopScorers = pssRes.rows;

    // 3. Fetch official standings from team_season_stats
    const tssRes = targetSeasonId
      ? await pool.query(
          `SELECT 
             t.name as team,
             t.logo_url as logo,
             tss.wins,
             tss.losses,
             tss.draws,
             tss.goals_for as "goalsFor",
             tss.goals_against as "goalsAgainst",
             (tss.goals_for - tss.goals_against) as "goalDifference",
             tss.points,
             tss.matches_played as played
           FROM team_season_stats tss
           JOIN team t ON tss.team_id = t.team_id
           WHERE tss.season_id = $1
           ORDER BY tss.points DESC, (tss.goals_for - tss.goals_against) DESC, tss.goals_for DESC`,
          [targetSeasonId]
        )
      : await pool.query(
          `SELECT 
             t.name as team,
             t.logo_url as logo,
             tss.wins,
             tss.losses,
             tss.draws,
             tss.goals_for as "goalsFor",
             tss.goals_against as "goalsAgainst",
             (tss.goals_for - tss.goals_against) as "goalDifference",
             tss.points,
             tss.matches_played as played
           FROM team_season_stats tss
           JOIN team t ON tss.team_id = t.team_id
           JOIN season s ON tss.season_id = s.season_id
           WHERE s.league_id = $1
           ORDER BY tss.points DESC, (tss.goals_for - tss.goals_against) DESC, tss.goals_for DESC
           LIMIT 25`,
          [league.id]
        );
    const dbSeasonStandings = tssRes.rows;

    // 4. Collect distinct teams
    const teamMap = new Map();

    leagueMatches.forEach((m) => {
      if (m.homeTeam && !teamMap.has(m.homeTeam)) {
        teamMap.set(m.homeTeam, {
          id: m.homeTeam,
          name: m.homeTeam,
          league: league.name,
          logo: m.homeLogo,
        });
      }
      if (m.awayTeam && !teamMap.has(m.awayTeam)) {
        teamMap.set(m.awayTeam, {
          id: m.awayTeam,
          name: m.awayTeam,
          league: league.name,
          logo: m.awayLogo,
        });
      }
    });

    dbSeasonStandings.forEach((s) => {
      if (s.team && !teamMap.has(s.team)) {
        teamMap.set(s.team, {
          id: s.team,
          name: s.team,
          league: league.name,
          logo: s.logo,
        });
      }
    });

    const leagueTeams = Array.from(teamMap.values());

    return {
      league: {
        ...league,
        season: seasonDisplayName,
      },
      leagueMatches,
      leagueTeams,
      dbTopScorers,
      dbSeasonStandings,
    };
  } catch (err) {
    console.error("Error querying league from DB:", err);
    return null;
  }
}

export default async function LeaguePage({ params }) {
  const { league } = await params;

  // 1. Fetch from PostgreSQL Database
  const dbData = await getLeagueDataFromDb(league);

  if (!dbData || !dbData.league) {
    return (
      <main className="league-page">
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <h2>Competition Not Found</h2>
          <p style={{ color: "var(--muted)", margin: "10px 0 20px" }}>
            The requested competition could not be located in the database.
          </p>
          <Link
            href="/leagues"
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
            ← Browse Leagues
          </Link>
        </div>
      </main>
    );
  }

  const leagueData = dbData.league;
  const leagueMatches = dbData.leagueMatches || [];
  const leagueTeams = dbData.leagueTeams || [];
  const dbTopScorers = dbData.dbTopScorers || [];
  const dbSeasonStandings = dbData.dbSeasonStandings || [];

  const finishedMatches = leagueMatches.filter(
    (match) => match.status === "FT" || match.status === "AET" || match.status === "PEN"
  );

  // Standings: Use genuine PostgreSQL team_season_stats first!
  let standings = [];

  if (dbSeasonStandings.length > 0) {
    standings = dbSeasonStandings.map((s, idx) => ({
      ...s,
      position: idx + 1,
    }));
  } else if (finishedMatches.length > 0 && leagueTeams.length > 0) {
    const standingsMap = {};

    leagueTeams.forEach((team) => {
      standingsMap[team.name] = {
        team: team.name,
        logo: team.logo,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
      };
    });

    finishedMatches.forEach((match) => {
      const home = standingsMap[match.homeTeam];
      const away = standingsMap[match.awayTeam];

      if (!home || !away) return;

      home.played += 1;
      away.played += 1;

      home.goalsFor += match.homeScore ?? 0;
      home.goalsAgainst += match.awayScore ?? 0;

      away.goalsFor += match.awayScore ?? 0;
      away.goalsAgainst += match.homeScore ?? 0;

      if (match.homeScore > match.awayScore) {
        home.wins += 1;
        away.losses += 1;
        home.points += 3;
      } else if (match.homeScore < match.awayScore) {
        away.wins += 1;
        home.losses += 1;
        away.points += 3;
      } else {
        home.draws += 1;
        away.draws += 1;
        home.points += 1;
        away.points += 1;
      }
    });

    standings = Object.values(standingsMap)
      .map((team) => ({
        ...team,
        goalDifference: team.goalsFor - team.goalsAgainst,
      }))
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
        return b.goalsFor - a.goalsFor;
      })
      .map((team, index) => ({
        ...team,
        position: index + 1,
      }));
  }

  // Genuine Top Scorers from DB
  const topScorers = dbTopScorers;

  const leagueStats = {
    totalMatches: leagueMatches.length,
    finishedMatches: finishedMatches.length,
    liveMatches: leagueMatches.filter((match) => match.status === "LIVE").length,
    upcomingMatches: leagueMatches.filter((match) => match.status === "UPCOMING" || match.status === "NS").length,
    goals: leagueMatches.length > 0
      ? leagueMatches.reduce(
          (total, match) => total + (match.homeScore ?? 0) + (match.awayScore ?? 0),
          0
        )
      : standings.reduce((total, s) => total + (s.goalsFor ?? 0), 0),
  };

  return (
    <main className="league-page">
      {/* LEAGUE HEADER */}
      <div className="league-header">
        <div className="league-logo">
          {leagueData.logo_url ? (
            <img
              src={leagueData.logo_url}
              alt={leagueData.name}
              style={{ width: "48px", height: "48px", objectFit: "contain" }}
            />
          ) : (
            "🏆"
          )}
        </div>

        <div>
          <h1>{leagueData.name}</h1>
          <p>
            {leagueData.country || "Global Competition"} · {leagueData.season || "2024/2025"}
          </p>
        </div>
        <FavoriteButton
          type="leagues"
          id={leagueData.slug || leagueData.name.toLowerCase().replaceAll(" ", "-")}
        />
      </div>

      <LeagueTabs
        league={leagueData}
        leagueMatches={leagueMatches}
        leagueTeams={leagueTeams}
        standings={standings}
        topScorers={topScorers}
        leagueStats={leagueStats}
      />
    </main>
  );
}