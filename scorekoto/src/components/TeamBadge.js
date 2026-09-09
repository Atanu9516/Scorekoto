"use client";

import { useState } from "react";

export default function TeamBadge({ team }) {
    const [imgError, setImgError] = useState(false);

    if (!team) {
        return null;
    }

    const logoUrl = team.logo || team.logo_url;
    const initial = team.short_name || team.shortName || (team.name ? team.name.charAt(0) : "?");

    return (
        <div className="team-badge">
            {logoUrl && !imgError ? (
                <img
                    src={logoUrl}
                    alt={`${team.name || "Team"} logo`}
                    className="team-logo"
                    onError={() => setImgError(true)}
                    loading="lazy"
                />
            ) : (
                <div className="team-logo-placeholder">
                    {initial}
                </div>
            )}

            <span>{team.name}</span>
        </div>
    );
}