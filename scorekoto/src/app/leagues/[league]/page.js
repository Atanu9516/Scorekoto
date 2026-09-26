import pool from "@/app/lib/db";
import FavoriteButton from "@/components/FavoriteButton";
import LeagueTabs from "@/components/LeagueTabs";
import {
  calculateStandingsFromMatches,
  ensurePlayerSeasonStatsSchema,
  fetchLeagueStandings,
  fetchLeagueTopScorers,
} from "@/app/lib/league-season-data";
import Link from "next/link";
import Icon from "@/components/Icon";

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
      `SELECT
         s.season_id,
         s.year,
         s.start_date,
         s.end_date,
         (SELECT COUNT(*)::int FROM team_season_stats tss WHERE tss.season_id = s.season_id) AS standings_count,
         (SELECT COUNT(*)::int FROM match m WHERE m.season_id = s.season_id) AS match_count,
         (SELECT COUNT(*)::int FROM player_season_stats pss WHERE pss.season_id = s.season_id AND pss.goals > 0) AS scorers_count
       FROM season s
       WHERE s.league_id = $1
       ORDER BY s.start_date DESC NULLS LAST, s.end_date DESC NULLS LAST, s.season_id DESC`,
      [league.id]
    );

    const availableSeasons = allSeasonsRes.rows.filter(
      (season) => season.standings_count > 0 || season.scorers_count > 0
    );

    // 2. Determine target season
    let targetSeason = null;
    if (selectedSeasonYear) {
      targetSeason = allSeasonsRes.rows.find(
        (s) => s.year === selectedSeasonYear || s.year.startsWith(selectedSeasonYear)
      );
    }
    if (!targetSeason) {
      targetSeason = availableSeasons[0] || allSeasonsRes.rows[0];
    }

    const targetSeasonId = targetSeason?.season_id;
    const seasonDisplayName = targetSeason
      ? (targetSeason.year.includes('-') ? targetSeason.year.replace('-', '/') : targetSeason.year)
      : "Season unavailable";
    const yearMatch = targetSeason?.year?.match(/\b(19|20)\d{2}\b/);
    const seasonStartYear = targetSeason
      ? Number(yearMatch?.[0]) || null
      : null;

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

    // 4. Refresh authentic standings; calculate them from stored results if the feed is unavailable.
    const refreshedStandings = await fetchLeagueStandings(
      league.id,
      targetSeasonId,
      seasonStartYear
    );
    if (refreshedStandings.length > 0) {
      dbSeasonStandings = refreshedStandings;
    } else if (dbSeasonStandings.length === 0) {
      dbSeasonStandings = await calculateStandingsFromMatches(targetSeasonId);
    }

    // 5. Fetch matches for this league
    const matchRes = await pool.query(
      `SELECT 
         m.match_id as id,
         m.status,
         m.match_date as "matchDate",
         m.home_score as "homeScore",
         m.away_score as "awayScore",
         ht.team_id as "homeTeamId",
         ht.name as "homeTeam",
         ht.logo_url as "homeLogo",
         at.team_id as "awayTeamId",
         at.name as "awayTeam",
         at.logo_url as "awayLogo",
         l.name as league
       FROM match m
       JOIN team ht ON m.home_team_id = ht.team_id
       JOIN team at ON m.away_team_id = at.team_id
       JOIN season s ON m.season_id = s.season_id
       JOIN league l ON s.league_id = l.league_id
       WHERE l.league_id = $1
         AND ($2::int IS NULL OR m.season_id = $2)
       ORDER BY m.match_date DESC`,
      [league.id, targetSeasonId || null]
    );
    const leagueMatches = matchRes.rows;

    // 6. Fetch top scorers
    await ensurePlayerSeasonStatsSchema();
    const pssRes = targetSeasonId
      ? await pool.query(
           `SELECT
             CONCAT_WS(' ', p.first_name, NULLIF(BTRIM(p.last_name), '')) as player,
             COALESCE(season_team.name, current_team.name, 'Unassigned') as team,
             pss.goals::int as goals,
             pss.assists::int as assists,
             pss.appearances::int as appearances
           FROM player_season_stats pss
           JOIN player p ON pss.player_id = p.player_id
           LEFT JOIN team season_team ON pss.team_id = season_team.team_id
           LEFT JOIN team current_team ON p.team_id = current_team.team_id
           WHERE pss.season_id = $1
             AND pss.goals > 0
           ORDER BY goals DESC, assists DESC
           LIMIT 20`,
          [targetSeasonId]
        )
      : { rows: [] };

    const completedStatuses = new Set(["FT", "AET", "PEN"]);
    const teamMatchCounts = new Map();
    for (const match of leagueMatches) {
      if (!completedStatuses.has(match.status)) continue;
      teamMatchCounts.set(
        match.homeTeamId,
        (teamMatchCounts.get(match.homeTeamId) || 0) + 1
      );
      teamMatchCounts.set(
        match.awayTeamId,
        (teamMatchCounts.get(match.awayTeamId) || 0) + 1
      );
    }
    const maxAppearances = Math.max(0, ...teamMatchCounts.values());

    const refreshedTopScorers = await fetchLeagueTopScorers(
      league.id,
      targetSeasonId,
      seasonStartYear,
      {
        maxAppearances,
        seasonEndDate: targetSeason?.end_date,
      }
    );
    const dbTopScorers = refreshedTopScorers.length > 0
      ? refreshedTopScorers
      : pssRes.rows;

    // 7. Collect distinct teams
    const teamMap = new Map();
    leagueMatches.forEach((m) => {
      if (m.homeTeam && !teamMap.has(m.homeTeam)) {
        teamMap.set(m.homeTeam, {
          id: m.homeTeamId,
          name: m.homeTeam,
          league: league.name,
          country: league.country || "Country unavailable",
          logo: m.homeLogo,
        });
      }
      if (m.awayTeam && !teamMap.has(m.awayTeam)) {
        teamMap.set(m.awayTeam, {
          id: m.awayTeamId,
          name: m.awayTeam,
          league: league.name,
          country: league.country || "Country unavailable",
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
          country: league.country || "Country unavailable",
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
        hasData: s.standings_count > 0 || s.scorers_count > 0,
      })),
      selectedSeason: targetSeason?.year || '',
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
            <Icon name="arrowLeft" /> Browse Leagues
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
  const selectedSeason = dbData.selectedSeason || '';

  const finishedMatches = leagueMatches.filter(
    (match) => match.status === "FT" || match.status === "AET" || match.status === "PEN"
  );

  let standings = [];
  if (dbSeasonStandings.length > 0) {
    standings = dbSeasonStandings.map((s, idx) => ({
      ...s,
      position: s.apiPosition || idx + 1,
    }));
  }

  const leagueStats = {
    totalMatches: leagueMatches.length,
    finishedMatches: finishedMatches.length,
    liveMatches: leagueMatches.filter((match) => ["LIVE", "1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT"].includes(match.status)).length,
    upcomingMatches: leagueMatches.filter((match) => ["UPCOMING", "NS", "TBD", "TIMED", "PST"].includes(match.status)).length,
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
            <Icon name="trophy" />
          )}
        </div>

        <div>
          <h1>{leagueData.name}</h1>
          <p>
            {leagueData.country || "Country unavailable"} · {leagueData.season || "Season unavailable"}
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
