export default function LeagueMatch({
    homeTeam,
    awayTeam,
    time,
}) {
    return (
        <div className="league-match">
            <span>{homeTeam}</span>

            <strong>{time}</strong>

            <span>{awayTeam}</span>
        </div>
    );
}