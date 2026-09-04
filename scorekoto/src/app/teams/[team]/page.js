import teams from "@/data/teams";
import matches from "@/data/matches";
import TeamTabs from "@/components/TeamTabs";
import players from "@/data/players";
import FavoriteButton from "@/components/FavoriteButton";

export default async function TeamPage({ params }) {
  const { team } = await params;

  const teamData = teams.find(
    (item) =>
      item.name.toLowerCase().replaceAll(" ", "-") === team
  );

  if (!teamData) {
    return <h1>Team not found</h1>;
  }

  const teamMatches = matches.filter(
    (match) =>
      match.homeTeam === teamData.name ||
      match.awayTeam === teamData.name
  );

  const completedMatches = teamMatches.filter(
    (match) => match.status !== "UPCOMING"
  );

  const teamPlayers = players.filter(
    (player) => player.team === teamData.name
  );

  const teamStats = completedMatches.reduce(
    (stats, match) => {
      const isHomeTeam =
        match.homeTeam === teamData.name;

      const goalsFor = isHomeTeam
        ? match.homeScore
        : match.awayScore;

      const goalsAgainst = isHomeTeam
        ? match.awayScore
        : match.homeScore;

      stats.played += 1;
      stats.goalsFor += goalsFor ?? 0;
      stats.goalsAgainst += goalsAgainst ?? 0;

      if (goalsFor > goalsAgainst) {
        stats.wins += 1;
      } else if (goalsFor === goalsAgainst) {
        stats.draws += 1;
      } else {
        stats.losses += 1;
      }

      return stats;
    },
    {
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
    }
  );

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
          <div className="team-logo">
            ⚽
          </div>
        )}

        <div>
          <h1>{teamData.name}</h1>

          <p>
            {teamData.country} · {teamData.league}
          </p>
        </div>

        <FavoriteButton
          type="teams"
          id={teamData.slug}
        />

      </section>

      {/* TEAM CONTENT */}
      <TeamTabs
        team={teamData}
        teamMatches={teamMatches}
        teamStats={teamStats}
        teamPlayers={teamPlayers}
      />

    </main>
  );
}