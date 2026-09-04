import MatchCard from "./MatchCard";

export default function LeagueMatchGroup({ league, matches }) {
    return (
        <div className="league-group">

            {matches.map((match) => (
                <MatchCard
                    key={match.id}
                    match={match}
                />
            ))}

        </div>
    );
}