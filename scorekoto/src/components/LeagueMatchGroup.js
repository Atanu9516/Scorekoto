import MatchCard from "./MatchCard";
import Icon from "./Icon";

export default function LeagueMatchGroup({ league, matches }) {
    return (
        <div className="league-group">
            <div className="league-group-header">
                <span><Icon name="trophy" /> {league}</span>
                <small>{matches.length} {matches.length === 1 ? "match" : "matches"}</small>
            </div>

            {matches.map((match) => (
                <MatchCard
                    key={match.id}
                    match={match}
                />
            ))}

        </div>
    );
}
