import pool from "@/app/lib/db";
import FavoriteButton from "@/components/FavoriteButton";
import PlayerTabs from "@/components/PlayerTabs";
import Link from "next/link";
import Icon from "@/components/Icon";

const INTERNATIONAL_LEAGUE_IDS = new Set([1, 4, 5, 6, 7, 9]);

function calculateAge(birthDate) {
  if (!birthDate) return null;

  const [year, month, day] = birthDate.split("-").map(Number);
  if (!year || !month || !day) return null;

  const today = new Date();
  let age = today.getFullYear() - year;
  const birthdayHasPassed =
    today.getMonth() + 1 > month ||
    (today.getMonth() + 1 === month && today.getDate() >= day);

  if (!birthdayHasPassed) age -= 1;
  return age;
}

function normalizeTransferHistory(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.transfers)) return value.transfers;
  return [];
}

function buildStatSeasons(rows) {
  const grouped = new Map();

  for (const row of rows) {
    const seasonKey = row.season || String(row.seasonId);
    if (!grouped.has(seasonKey)) {
      grouped.set(seasonKey, {
        season: row.season,
        startDate: row.startDate,
        endDate: row.endDate,
        competitions: [],
        competitionNames: [],
        appearances: 0,
        goals: 0,
        assists: 0,
        yellowCards: 0,
        redCards: 0,
        minutesPlayed: 0,
      });
    }

    const season = grouped.get(seasonKey);
    const competition = {
      seasonId: row.seasonId,
      leagueId: row.leagueId,
      name: row.competition,
      country: row.competitionCountry,
      logo: row.competitionLogo,
      teamId: row.statsTeamId,
      teamName: row.statsTeamName,
      teamLogo: row.statsTeamLogo,
      appearances: Number(row.appearances || 0),
      goals: Number(row.goals || 0),
      assists: Number(row.assists || 0),
      yellowCards: Number(row.yellowCards || 0),
      redCards: Number(row.redCards || 0),
      minutesPlayed: Number(row.minutesPlayed || 0),
    };

    season.competitions.push(competition);
    if (competition.name && !season.competitionNames.includes(competition.name)) {
      season.competitionNames.push(competition.name);
    }
    season.appearances += competition.appearances;
    season.goals += competition.goals;
    season.assists += competition.assists;
    season.yellowCards += competition.yellowCards;
    season.redCards += competition.redCards;
    season.minutesPlayed += competition.minutesPlayed;
  }

  return Array.from(grouped.values()).map((season) => ({
    ...season,
    competitionNames: undefined,
    competitionLabel: season.competitionNames.join(", "),
  }));
}

async function getPlayerDataFromDb(playerSlugOrId) {
  try {
    const decoded = decodeURIComponent(playerSlugOrId).trim().toLowerCase();
    const selectPlayer = `
      SELECT
        p.player_id AS id,
        CONCAT_WS(' ', p.first_name, NULLIF(BTRIM(p.last_name), '')) AS name,
        p.primary_position AS position,
        p.nationality,
        TO_CHAR(p.date_of_birth, 'YYYY-MM-DD') AS birth_date,
        p.market_value_euros,
        p.weight_cm,
        p.transfer_history,
        p.photo_url AS photo,
        LOWER(REPLACE(CONCAT_WS(' ', p.first_name, NULLIF(BTRIM(p.last_name), '')), ' ', '-')) AS slug,
        t.team_id,
        t.name AS team_name,
        t.short_name AS team_short,
        t.stadium_name AS team_stadium,
        t.manager_name AS team_manager,
        t.logo_url AS team_logo
      FROM player p
      LEFT JOIN team t ON p.team_id = t.team_id
    `;

    let query;
    let params;

    if (Number.isInteger(Number(decoded)) && Number(decoded) > 0) {
      query = `${selectPlayer} WHERE p.player_id = $1 LIMIT 1`;
      params = [Number(decoded)];
    } else {
      query = `${selectPlayer}
        WHERE LOWER(REPLACE(CONCAT_WS(' ', p.first_name, NULLIF(BTRIM(p.last_name), '')), ' ', '-')) = $1
           OR LOWER(CONCAT_WS(' ', p.first_name, NULLIF(BTRIM(p.last_name), ''))) = $1
           OR LOWER(p.last_name) = $1
        ORDER BY
          CASE WHEN LOWER(REPLACE(CONCAT_WS(' ', p.first_name, NULLIF(BTRIM(p.last_name), '')), ' ', '-')) = $1 THEN 0 ELSE 1 END,
          p.player_id
        LIMIT 1`;
      params = [decoded];
    }

    const res = await pool.query(query, params);
    if (res.rows.length === 0) return null;

    const row = res.rows[0];

    let teamCompetitions = [];
    if (row.team_id) {
      const teamLeagueRes = await pool.query(
        `SELECT
           l.league_id AS id,
           l.name,
           l.country,
           MAX(m.match_date) AS latest_match,
           COUNT(*)::int AS match_count
         FROM match m
         JOIN season s ON s.season_id = m.season_id
         JOIN league l ON l.league_id = s.league_id
         WHERE m.home_team_id = $1 OR m.away_team_id = $1
         GROUP BY l.league_id, l.name, l.country
         ORDER BY
           CASE WHEN LOWER(COALESCE(l.country, 'world')) = 'world' THEN 1 ELSE 0 END,
           MAX(m.match_date) DESC,
           COUNT(*) DESC`,
        [row.team_id]
      );
      teamCompetitions = teamLeagueRes.rows;
    }

    const statsRes = await pool.query(
      `SELECT
         pss.season_id AS "seasonId",
         s.year AS season,
         TO_CHAR(s.start_date, 'YYYY-MM-DD') AS "startDate",
         TO_CHAR(s.end_date, 'YYYY-MM-DD') AS "endDate",
         l.league_id AS "leagueId",
         l.name AS competition,
         l.country AS "competitionCountry",
         l.logo_url AS "competitionLogo",
         pss.team_id AS "statsTeamId",
         stats_team.name AS "statsTeamName",
         stats_team.logo_url AS "statsTeamLogo",
         COALESCE(pss.appearances, 0)::int AS appearances,
         COALESCE(pss.goals, 0)::int AS goals,
         COALESCE(pss.assists, 0)::int AS assists,
         COALESCE(pss.yellow_cards, 0)::int AS "yellowCards",
         COALESCE(pss.red_cards, 0)::int AS "redCards",
         COALESCE(pss.minutes_played, 0)::int AS "minutesPlayed"
       FROM player_season_stats pss
       JOIN season s ON s.season_id = pss.season_id
       JOIN league l ON l.league_id = s.league_id
       LEFT JOIN team stats_team ON stats_team.team_id = pss.team_id
       WHERE pss.player_id = $1
       ORDER BY s.start_date DESC NULLS LAST, s.season_id DESC, l.name`,
      [row.id]
    );
    const statSeasons = buildStatSeasons(statsRes.rows);

    const injuriesRes = await pool.query(
      `SELECT injury_id, status, start_date, expected_return_date, description
       FROM player_injury
       WHERE player_id = $1
       ORDER BY start_date DESC NULLS LAST, injury_id DESC`,
      [row.id]
    );

    const formattedPlayer = {
      id: row.id,
      name: row.name,
      slug: row.slug || String(row.id),
      position: row.position || null,
      team: row.team_name || null,
      nationality: row.nationality || null,
      photo: row.photo,
      birthDate: row.birth_date,
      age: calculateAge(row.birth_date),
      weight: row.weight_cm ? `${Number(row.weight_cm)} kg` : null,
      value: row.market_value_euros
        ? `€${Number(row.market_value_euros).toLocaleString()}`
        : null,
      injuries: injuriesRes.rows,
      transferHistory: normalizeTransferHistory(row.transfer_history),
      stats: statSeasons[0] || null,
      statSeasons,
    };

    const hasInternationalCompetition = teamCompetitions.some((item) =>
      INTERNATIONAL_LEAGUE_IDS.has(Number(item.id))
    );
    const hasClubCompetition = teamCompetitions.some(
      (item) => !INTERNATIONAL_LEAGUE_IDS.has(Number(item.id))
    );
    const primaryCompetition = teamCompetitions[0] || null;

    const formattedTeam = row.team_id
      ? {
          id: row.team_id,
          name: row.team_name,
          shortName: row.team_short,
          slug: row.team_name?.toLowerCase().replaceAll(" ", "-") || String(row.team_id),
          stadium: row.team_stadium || null,
          manager: row.team_manager || null,
          country: primaryCompetition?.country || null,
          league: primaryCompetition?.name || null,
          competitions: teamCompetitions.map((item) => item.name),
          logo: row.team_logo,
          affiliationLabel:
            hasInternationalCompetition && !hasClubCompetition
              ? "National Team"
              : hasClubCompetition
                ? "Club Affiliation"
                : "Team Affiliation",
        }
      : null;

    let matchesList = [];
    if (row.team_id) {
      const matchRes = await pool.query(
        `SELECT
           m.match_id AS id,
           m.status,
           m.match_date AS "matchDate",
           m.home_score AS "homeScore",
           m.away_score AS "awayScore",
           ht.name AS "homeTeam",
           at.name AS "awayTeam",
           COALESCE(l.name, 'Competition unavailable') AS league
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

    return { player: formattedPlayer, team: formattedTeam, matches: matchesList };
  } catch (err) {
    console.error("Error querying player from DB:", err);
    return null;
  }
}

export default async function PlayerPage({ params }) {
  const { player } = await params;
  const dbData = await getPlayerDataFromDb(player);

  if (!dbData?.player) {
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
            <Icon name="arrowLeft" /> Browse Teams
          </Link>
        </div>
      </main>
    );
  }

  const playerData = dbData.player;
  const headerDetails = [playerData.position, playerData.team].filter(Boolean);

  return (
    <main className="player-page">
      <div className="player-header">
        <div className="player-photo">
          {playerData.photo ? (
            <img
              src={playerData.photo}
              alt={playerData.name}
              style={{ width: "96px", height: "96px", borderRadius: "50%", objectFit: "cover" }}
            />
          ) : (
            <div className="player-photo-placeholder">
              <Icon name="player" />
            </div>
          )}
        </div>

        <div className="player-info">
          <h1>{playerData.name}</h1>
          {headerDetails.length > 0 && <p>{headerDetails.join(" · ")}</p>}
          <div className="player-meta-badges">
            {playerData.nationality && (
              <span className="player-meta-badge"><Icon name="globe" /> {playerData.nationality}</span>
            )}
            {playerData.age !== null && (
              <span className="player-meta-badge"><Icon name="cake" /> {playerData.age} yrs</span>
            )}
            {playerData.value && (
              <span className="player-meta-badge"><Icon name="coins" /> {playerData.value}</span>
            )}
          </div>
        </div>

        <FavoriteButton type="players" id={playerData.slug || String(playerData.id)} />
      </div>

      <PlayerTabs player={playerData} team={dbData.team} matches={dbData.matches || []} />
    </main>
  );
}
