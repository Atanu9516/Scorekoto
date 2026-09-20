import pool from "@/app/lib/db";
import FavoriteButton from "@/components/FavoriteButton";
import LeagueTabs from "@/components/LeagueTabs";
import Link from "next/link";

async function getLeagueDataFromDb(leagueParam, selectedSeasonYear = null) {
  try {
    const decoded = decodeURIComponent(leagueParam).trim().toLowerCase();
    const isId = Number.isInteger(Number(decoded)) && Number(decoded) > 0;

    const leagueQuery = isId
      ? `SELECT league_id as id, name, type, country, logo_url, LOWER(REPLACE(name, ' ', '-')) as slug FROM league WHERE league_id = $1 LIMIT 1`
      : `SELECT league_id as id, name, type, country, logo_url, LOWER(REPLACE(name, ' ', '-')) as slug FROM league WHERE LOWER(REPLACE(name, ' ', '-')) = $1 OR LOWER(name) = $1 LIMIT 1`;

    const leagueRes = await pool.query(leagueQuery, [isId ? Number(decoded) : decoded]);
    if (leagueRes.rows.length === 0) return null;

    const league = leagueRes.rows[0];

    if (league.logo_url) {
      league.logo_url = league.logo_url.replace(/\s+/g, "");
    }

    // 1. Query all available seasons for this league
    const allSeasonsRes = await pool.query(
      `SELECT s.season_id, s.year, COUNT(tss.team_id)::int as standings_count
       FROM season s
       LEFT JOIN team_season_stats tss ON s.season_id = tss.season_id
       WHERE s.league_id = $1
       GROUP BY s.season_id, s.year
       ORDER BY s.year DESC`,
      [league.id]
    );

    const availableSeasons = allSeasonsRes.rows.filter(
      (s) => s.standings_count > 0 || ['2024-2025', '2023-2024', '2022-2023', '2025-2026'].includes(s.year)
    );

    // 2. Determine target season
    let targetSeason = null;
    if (selectedSeasonYear) {
      targetSeason = allSeasonsRes.rows.find(
        (s) => s.year === selectedSeasonYear || s.year.startsWith(selectedSeasonYear)
      );
    }
    if (!targetSeason) {
      targetSeason = availableSeasons.find((s) => s.standings_count > 0) || availableSeasons[0] || allSeasonsRes.rows[0];
    }

    const targetSeasonId = targetSeason?.season_id;
    const seasonDisplayName = targetSeason
      ? (targetSeason.year.includes('-') ? targetSeason.year.replace('-', '/') : targetSeason.year)
      : "2024/2025";
    const seasonStartYear = targetSeason
      ? parseInt(targetSeason.year.split('-')[0], 10) || 2024
      : 2024;

    // 3. Query initial standings from PostgreSQL (always available on first run!)
    let dbSeasonStandings = [];
    if (targetSeasonId) {
      const tssRes = await pool.query(
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
      );
      dbSeasonStandings = tssRes.rows;
    }

    // 4. API-First: Attempt to fetch fresh standings from API-Sports
    const apiKey = process.env.API_SPORTS_KEY;
    if (apiKey && league.id) {
      try {
        const apiRes = await fetch(
          `https://v3.football.api-sports.io/standings?league=${league.id}&season=${seasonStartYear}`,
          {
            headers: { 'x-apisports-key': apiKey, Accept: 'application/json' },
            next: { revalidate: 3600 },
          }
        );

        if (apiRes.ok) {
          const apiData = await apiRes.json();
          const standingsList = apiData.response?.[0]?.league?.standings?.[0];

          if (Array.isArray(standingsList) && standingsList.length > 0) {
            const apiStandings = [];

            for (const item of standingsList) {
              const teamName = item.team.name;
              const teamLogo = item.team.logo;
              const teamApiId = item.team.id;
              const played = item.all?.played ?? 0;
              const wins = item.all?.win ?? 0;
              const draws = item.all?.draw ?? 0;
              const losses = item.all?.lose ?? 0;
              const goalsFor = item.all?.goals?.for ?? 0;
              const goalsAgainst = item.all?.goals?.against ?? 0;
              const points = item.points ?? 0;

              apiStandings.push({
                team: teamName,
                logo: teamLogo,
                played,
                wins,
                draws,
                losses,
                goalsFor,
                goalsAgainst,
                goalDifference: goalsFor - goalsAgainst,
                points,
              });

              // Asynchronously upsert into PostgreSQL so Supabase retains the authentic data
              if (targetSeasonId) {
                (async () => {
                  try {
                    let tId = teamApiId;
                    const dbT = await pool.query(
                      `SELECT team_id FROM team WHERE LOWER(name) = LOWER($1) LIMIT 1`,
                      [teamName]
                    );
                    if (dbT.rows.length > 0) {
                      tId = dbT.rows[0].team_id;
                    } else {
                      await pool.query(
                        `INSERT INTO team (team_id, name, logo_url) VALUES ($1, $2, $3) ON CONFLICT (team_id) DO UPDATE SET name = EXCLUDED.name, logo_url = EXCLUDED.logo_url`,
                        [tId, teamName, teamLogo]
                      );
                    }

                    await pool.query(
                      `INSERT INTO team_season_stats (team_id, season_id, wins, losses, draws, goals_for, goals_against, points, matches_played)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                       ON CONFLICT (team_id, season_id) DO UPDATE SET
                         wins = EXCLUDED.wins,
                         losses = EXCLUDED.losses,
                         draws = EXCLUDED.draws,
                         goals_for = EXCLUDED.goals_for,
                         goals_against = EXCLUDED.goals_against,
                         points = EXCLUDED.points,
                         matches_played = EXCLUDED.matches_played`,
                      [tId, targetSeasonId, wins, losses, draws, goalsFor, goalsAgainst, points, played]
                    );
                  } catch (uErr) {
                    // Ignore background sync error
                  }
                })();
              }
            }

            dbSeasonStandings = apiStandings;
          }
        }
      } catch (apiErr) {
        console.warn('API-Sports standings notice:', apiErr.message, '-> falling back to DB standings');
      }
    }

    // 5. Fetch matches for this league
    const matchRes = await pool.query(
      `SELECT 
         m.match_id as id,
         m.status,
         m.match_date as "matchDate",
         m.home_score as "homeScore",
         m.away_score as "awayScore",
         COALESCE(ht.name, 'Home Team') as "homeTeam",
         ht.logo_url as "homeLogo",
         COALESCE(at.name, 'Away Team') as "awayTeam",
         at.logo_url as "awayLogo",
         l.name as league
       FROM match m
       LEFT JOIN team ht ON m.home_team_id = ht.team_id
       LEFT JOIN team at ON m.away_team_id = at.team_id
       LEFT JOIN season s ON m.season_id = s.season_id
       LEFT JOIN league l ON s.league_id = l.league_id
       WHERE l.league_id = $1
       ORDER BY m.match_date DESC
       LIMIT 100`,
      [league.id]
    );
    const leagueMatches = matchRes.rows;

    // 6. Fetch top scorers
    const pssRes = targetSeasonId
      ? await pool.query(
          `SELECT 
             CONCAT(p.first_name, ' ', p.last_name) as player,
             COALESCE(t.name, 'Club') as team,
             SUM(pss.goals)::int as goals,
             SUM(pss.assists)::int as assists,
             SUM(pss.appearances)::int as appearances
           FROM player_season_stats pss
           JOIN player p ON pss.player_id = p.player_id
           LEFT JOIN team t ON p.team_id = t.team_id
           WHERE pss.season_id = $1
           GROUP BY p.player_id, p.first_name, p.last_name, t.name
           HAVING SUM(pss.goals) > 0
           ORDER BY goals DESC, assists DESC
           LIMIT 20`,
          [targetSeasonId]
        )
      : { rows: [] };

    let dbTopScorers = pssRes.rows;
    if (dbTopScorers.length === 0) {
      const fallbackPss = await pool.query(
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
      dbTopScorers = fallbackPss.rows;
    }

    // 7. Collect distinct teams
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
      availableSeasons: availableSeasons.map((s) => ({
        id: s.season_id,
        year: s.year,
        hasData: s.standings_count > 0,
      })),
      selectedSeason: targetSeason?.year || '2024-2025',
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

export default async function LeaguePage({ params, searchParams }) {
  const { league } = await params;
  const search = (await searchParams) || {};
  const selectedSeasonParam = search.season || null;

  // Fetch league data with season selection support
  const dbData = await getLeagueDataFromDb(league, selectedSeasonParam);

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
  const availableSeasons = dbData.availableSeasons || [];
  const selectedSeason = dbData.selectedSeason || '2024-2025';

  const finishedMatches = leagueMatches.filter(
    (match) => match.status === "FT" || match.status === "AET" || match.status === "PEN"
  );

  let standings = [];
  if (dbSeasonStandings.length > 0) {
    standings = dbSeasonStandings.map((s, idx) => ({
      ...s,
      position: idx + 1,
    }));
  }

  const leagueStats = {
    totalMatches: leagueMatches.length,
    finishedMatches: finishedMatches.length,
    liveMatches: leagueMatches.filter((match) => match.status === "LIVE").length,
    upcomingMatches: leagueMatches.filter((match) => match.status === "UPCOMING" || match.status === "NS").length,
    goals: standings.reduce((total, s) => total + (s.goalsFor ?? 0), 0) || leagueMatches.reduce(
      (total, match) => total + (match.homeScore ?? 0) + (match.awayScore ?? 0),
      0
    ),
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
        topScorers={dbTopScorers}
        leagueStats={leagueStats}
        availableSeasons={availableSeasons}
        selectedSeason={selectedSeason}
      />
    </main>
  );
}