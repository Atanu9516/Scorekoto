import Link from "next/link";
import TeamBadge from "./TeamBadge";
import LocalKickoffTime from "./LocalKickoffTime";

export default function MatchCard({ match }) {
  const isLive = match.status === "LIVE";
  const isFinished = match.status === "FT" || match.status === "AET" || match.status === "PEN";
  const homeTeam = {
    name: match.homeTeam,
    logo: match.homeLogo,
    shortName: match.homeShortName || match.homeTeam?.slice(0, 3)?.toUpperCase(),
  };

  const awayTeam = {
    name: match.awayTeam,
    logo: match.awayLogo,
    shortName: match.awayShortName || match.awayTeam?.slice(0, 3)?.toUpperCase(),
  };

  return (
    <Link href={`/matches/${match.id}`} className="match-card">
      <div className="match-top">
        <span className="match-league">{match.league}</span>

        {isLive && <span className="match-live"><span className="status-live-dot" aria-hidden="true" /> {match.minute}</span>}

        {isFinished && <span className="match-finished">FT</span>}

        {match.status === "UPCOMING" && (
          <LocalKickoffTime
            className="match-time"
            matchDate={match.matchDate}
            status={match.providerStatus || match.status}
          />
        )}
      </div>

      <div className="match-teams">
        <div className="match-team">
          <TeamBadge team={homeTeam} />
          {match.status !== "UPCOMING" && (
            <strong>{match.homeScore}</strong>
          )}
        </div>

        <div className="match-team">
          <TeamBadge team={awayTeam} />
          {match.status !== "UPCOMING" && (
            <strong>{match.awayScore}</strong>
          )}
        </div>
      </div>
    </Link>
  );
}
