export default function StandingRow({
    position,
    team,
    points,
}) {
    return (
        <div className="standing-row">
            <span>{position}</span>

            <span>{team}</span>

            <strong>{points}</strong>
        </div>
    );
}