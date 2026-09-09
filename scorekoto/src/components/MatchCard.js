import Link from "next/link";
import teams from "@/data/teams";
import TeamBadge from "./TeamBadge";

export default function MatchCard({ match }) {
    const isLive = match.status === "LIVE";
    const isFinished = match.status === "FT" || match.status === "AET" || match.status === "PEN";

    const homeFound = teams.find((t) => t.name === match.homeTeam || t.slug === match.homeSlug);
    const awayFound = teams.find((t) => t.name === match.awayTeam || t.slug === match.awaySlug);

    const homeTeam = {
        name: match.homeTeam,
        logo: match.homeLogo || homeFound?.logo,
        shortName: homeFound?.shortName,
    };

    const awayTeam = {
        name: match.awayTeam,
        logo: match.awayLogo || awayFound?.logo,
        shortName: awayFound?.shortName,
    };

    return (
        <Link
            href={`/matches/${match.id}`}
            className="match-card"
        >
            <div className="match-top">

                <span className="match-league">
                    {match.league}
                </span>

                {isLive && (
                    <span className="match-live">
                        🔴 {match.minute}
                    </span>
                )}

                {isFinished && (
                    <span className="match-finished">
                        FT
                    </span>
                )}

                {match.status === "UPCOMING" && (
                    <span className="match-time">
                        {match.minute || "TBD"}
                    </span>
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