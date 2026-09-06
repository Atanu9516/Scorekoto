import Image from "next/image";

export default function TeamBadge({ team }) {
    if (!team) {
        return null;
    }

    return (
        <div className="team-badge">
            {team.logo ? (
                <img
                    src={team.logo}
                    alt={`${team.name} logo`}
                    className="team-logo"
                />
            ) : (
                <div className="team-logo-placeholder">
                    {team.name.charAt(0)}
                </div>
            )}

            <span>{team.name}</span>
        </div>
    );
}