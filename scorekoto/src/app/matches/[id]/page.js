import matches from "@/data/matches";
import lineups from "@/data/lineups";
import MatchTabs from "@/components/MatchTabs";

export default async function MatchPage({ params }) {
  const { id } = await params;

  const match = matches.find(
    (item) => item.id === Number(id)
  );

  const lineupData = lineups.find(
    (lineup) => lineup.matchId === match.id
  );

  if (!match) {
    return <h1>Match not found</h1>;
  }

  const isLive = match.status === "LIVE";
  const isFinished = match.status === "FT";
  const isUpcoming = match.status === "UPCOMING";

  return (
    <main className="match-page">

      {/* MATCH HEADER */}
      <div className="match-header">

        <p className="match-league">
          {match.league}
        </p>

        <div className="match-status-large">

          {isLive && (
            <span className="live-dot"></span>
          )}

          <span>
            {isFinished
              ? "Finished"
              : isUpcoming
                ? "Upcoming"
                : "Live"}
          </span>

          {match.minute && (
            <span> • {match.minute}</span>
          )}

        </div>

        {/* SCOREBOARD */}
        <div className="scoreboard">

          {/* HOME TEAM */}
          <div className="team">

            <h2>{match.homeTeam}</h2>

            <strong>
              {match.homeScore ?? "-"}
            </strong>

          </div>

          <div className="score-separator">
            -
          </div>

          {/* AWAY TEAM */}
          <div className="team">

            <h2>{match.awayTeam}</h2>

            <strong>
              {match.awayScore ?? "-"}
            </strong>

          </div>

        </div>

        {/* MATCH INFORMATION */}
        <div className="match-info">

          {isLive && (
            <span className="live-label">
              LIVE
            </span>
          )}

          {isFinished && (
            <span>
              Full Time
            </span>
          )}

          {isUpcoming && (
            <span>
              Kick-off at {match.minute}
            </span>
          )}

        </div>

      </div>

      {/* MATCH TABS */}
      <MatchTabs
        match={match}
        lineup={lineupData ?? null}
      />

    </main>
  );
}