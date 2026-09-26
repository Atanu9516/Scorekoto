"use client";

import { useState } from "react";
import Link from "next/link";
import Icon from "./Icon";
import LocalKickoffTime from "./LocalKickoffTime";

export default function PlayerTabs({
    player = {},
    team = null,
    playerMatches = [],
    matches = [],
}) {
    const statSeasons = Array.isArray(player?.statSeasons) ? player.statSeasons : [];
    const [activeTab, setActiveTab] = useState("overview");
    const [selectedSeason, setSelectedSeason] = useState(statSeasons[0]?.season || "");

    const matchItems = Array.isArray(playerMatches) && playerMatches.length > 0
        ? playerMatches
        : (Array.isArray(matches) ? matches : []);
    const latestStats = player?.stats || statSeasons[0] || null;
    const selectedStats = statSeasons.find((item) => item.season === selectedSeason)
        || latestStats;
    const appearances = Number(selectedStats?.appearances ?? 0);
    const goals = Number(selectedStats?.goals ?? 0);
    const assists = Number(selectedStats?.assists ?? 0);
    const minutesPlayed = Number(selectedStats?.minutesPlayed ?? 0);
    const playerHeadlineStats = selectedStats ? [
        { label: "Appearances", value: appearances, icon: "flag", detail: "Recorded fixtures" },
        {
            label: "Goals",
            value: goals,
            icon: "target",
            detail: appearances > 0 ? `${(goals / appearances).toFixed(2)} per appearance` : "Season total",
        },
        {
            label: "Assists",
            value: assists,
            icon: "player",
            detail: appearances > 0 ? `${(assists / appearances).toFixed(2)} per appearance` : "Season total",
        },
        {
            label: "Minutes played",
            value: minutesPlayed,
            icon: "clock",
            detail: appearances > 0 ? `${Math.round(minutesPlayed / appearances)} per appearance` : "Season total",
        },
        { label: "Yellow cards", value: Number(selectedStats.yellowCards ?? 0), icon: "yellowCard", detail: "Disciplinary record" },
        { label: "Red cards", value: Number(selectedStats.redCards ?? 0), icon: "redCard", detail: "Disciplinary record" },
    ] : [];
    const playerInfoItems = [
        { label: "Nationality", value: player.nationality || "Not recorded", icon: "globe" },
        { label: "Date of birth", value: formatStoredDate(player.birthDate) || "Not recorded", icon: "cake" },
        {
            label: "Age",
            value: player.age !== null && player.age !== undefined ? `${player.age} years` : "Not recorded",
            icon: "user",
        },
        { label: "Position", value: player.position || "Not recorded", icon: "player" },
        { label: "Weight", value: player.weight || "Not recorded", icon: "ruler" },
        { label: "Market value", value: player.value || "Not recorded", icon: "coins" },
    ];
    const snapshotStats = latestStats ? [
        { label: "Appearances", value: Number(latestStats.appearances ?? 0), icon: "flag", detail: "Recorded fixtures" },
        { label: "Goals", value: Number(latestStats.goals ?? 0), icon: "target", detail: "Season total" },
        { label: "Assists", value: Number(latestStats.assists ?? 0), icon: "player", detail: "Season total" },
        { label: "Minutes played", value: Number(latestStats.minutesPlayed ?? 0), icon: "clock", detail: "Season total" },
    ] : [];

    return (
        <>
            <div className="player-tabs">
                <button
                    className={activeTab === "overview" ? "active-tab" : ""}
                    onClick={() => setActiveTab("overview")}
                >
                    Overview
                </button>

                <button
                    className={activeTab === "matches" ? "active-tab" : ""}
                    onClick={() => setActiveTab("matches")}
                >
                    Matches
                </button>

                <button
                    className={activeTab === "statistics" ? "active-tab" : ""}
                    onClick={() => setActiveTab("statistics")}
                >
                    Statistics
                </button>
            </div>

            {activeTab === "overview" && (
                <>
                    <section className="player-section">
                        <PlayerSectionHeading
                            title="Player Information"
                            description="Personal and physical details stored for this player."
                        />

                        <div className="team-info">
                            {playerInfoItems.map((item) => (
                                <article className="team-info-card" key={item.label}>
                                    <span className="team-info-icon"><Icon name={item.icon} /></span>
                                    <div>
                                        <span>{item.label}</span>
                                        <strong>{item.value}</strong>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </section>

                    {Array.isArray(player.injuries) && player.injuries.length > 0 && (
                        <section className="player-section">
                            <PlayerSectionHeading
                                title="Injury Record"
                                description={`${player.injuries.length} stored injury record${player.injuries.length === 1 ? "" : "s"}.`}
                            />
                            <div className="player-injury-list">
                                {player.injuries.map((injury, index) => (
                                    <article
                                        className="player-injury-card"
                                        key={injury.injury_id || `${injury.start_date || "unknown"}-${index}`}
                                    >
                                        <span className="team-info-icon"><Icon name="alert" /></span>
                                        <div className="player-injury-copy">
                                            <strong>{injury.description || "Injury details unavailable"}</strong>
                                            <span>{formatStoredDate(injury.start_date) || "Date unavailable"}</span>
                                        </div>
                                        <div className="player-injury-status">
                                            <span>{injury.status || "Status unavailable"}</span>
                                            {injury.expected_return_date && (
                                                <small>Expected return {formatStoredDate(injury.expected_return_date)}</small>
                                            )}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </section>
                    )}

                    {Array.isArray(player.transferHistory) && player.transferHistory.length > 0 && (
                        <section className="player-section">
                            <PlayerSectionHeading
                                title="Transfer History"
                                description={`${player.transferHistory.length} stored club move${player.transferHistory.length === 1 ? "" : "s"}.`}
                            />
                            <div className="player-record-grid">
                                {player.transferHistory.map((transfer, index) => (
                                    <article className="team-stat-card player-history-card" key={transfer.id || index}>
                                        <span className="team-stat-card-icon"><Icon name="refresh" /></span>
                                        <div>
                                            <span>{transfer.date || transfer.season || "Date unavailable"}</span>
                                            <strong>{transfer.from || "Unknown club"} → {transfer.to || "Unknown club"}</strong>
                                            <small>Club transfer</small>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </section>
                    )}

                    <section className="player-section">
                        <PlayerSectionHeading
                            title={team?.affiliationLabel || "Team Affiliation"}
                            description="Current stored club and competition details."
                        />

                        {team ? (
                            <Link href={`/teams/${team.id || team.slug}`} className="player-club-card">
                                {team.logo ? (
                                    <img src={team.logo} alt={`${team.name} logo`} className="player-club-logo" />
                                ) : (
                                    <div className="player-club-placeholder">
                                        <Icon name="football" />
                                    </div>
                                )}

                                <div className="player-club-content">
                                    <strong>{team.name}</strong>
                                    {(team.country || team.league) && (
                                        <span>{[team.country, team.league].filter(Boolean).join(" · ")}</span>
                                    )}
                                    <div className="player-club-details">
                                        {team.shortName && <small>Code: {team.shortName}</small>}
                                        {team.manager && <small>Manager: {team.manager}</small>}
                                        {team.stadium && <small>Venue: {team.stadium}</small>}
                                    </div>
                                </div>
                            </Link>
                        ) : (
                            <p className="player-empty-copy">No team affiliation is stored for this player.</p>
                        )}
                    </section>

                    <section className="player-section">
                        <PlayerSectionHeading
                            title={latestStats ? `${formatSeason(latestStats.season)} Snapshot` : "Season Snapshot"}
                            description={latestStats?.competitionLabel
                                ? `Latest performance across ${latestStats.competitionLabel}.`
                                : "Latest stored season performance."}
                        />

                        {!latestStats ? (
                            <p className="player-empty-copy">No recorded season statistics are available for this player.</p>
                        ) : (
                            <div className="team-stats-grid player-snapshot-grid">
                                {snapshotStats.map((stat) => <PlayerMetricCard key={stat.label} stat={stat} />)}
                            </div>
                        )}
                    </section>
                </>
            )}

            {activeTab === "matches" && (
                <section className="player-section">
                    <PlayerSectionHeading
                        title={team?.name ? `${team.name} Matches` : "Team Matches"}
                        description={`${matchItems.length} fixture${matchItems.length === 1 ? "" : "s"} available for the stored team affiliation.`}
                    />

                    {matchItems.length === 0 ? (
                        <p className="player-empty-copy">No matches found for the stored team affiliation.</p>
                    ) : (
                        matchItems.map((match) => (
                            <PlayerMatch key={match.id} match={match} />
                        ))
                    )}
                </section>
            )}

            {activeTab === "statistics" && (
                <section className="player-section team-statistics-section">
                    <div className="player-section-heading">
                        <header className="team-section-heading">
                            <h2>{selectedStats ? `${formatSeason(selectedStats.season)} Statistics` : "Season Statistics"}</h2>
                            <p>
                                {selectedStats?.competitionLabel
                                    ? `Performance recorded across ${selectedStats.competitionLabel}.`
                                    : "Stored season performance for this player."}
                            </p>
                        </header>
                        {statSeasons.length > 1 && (
                            <label className="player-season-control">
                                <span>Season</span>
                                <select
                                    className="season-select"
                                    value={selectedStats?.season || ""}
                                    onChange={(event) => setSelectedSeason(event.target.value)}
                                >
                                    {statSeasons.map((item) => (
                                        <option key={item.season} value={item.season}>
                                            {formatSeason(item.season)}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        )}
                    </div>

                    {!selectedStats ? (
                        <p className="player-empty-copy">No recorded season statistics are available for this player.</p>
                    ) : (
                        <>
                            <div className="team-stats-grid">
                                {playerHeadlineStats.map((stat) => <PlayerMetricCard key={stat.label} stat={stat} />)}
                            </div>

                            {selectedStats.competitions?.length > 0 && (
                                <div className="player-competition-breakdown">
                                    <h3>Competition Breakdown</h3>
                                    {selectedStats.competitions.map((competition) => (
                                        <CompetitionStats
                                            key={`${competition.seasonId}-${competition.leagueId}`}
                                            competition={competition}
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </section>
            )}
        </>
    );
}

function PlayerSectionHeading({ title, description }) {
    return (
        <header className="team-section-heading">
            <h2>{title}</h2>
            <p>{description}</p>
        </header>
    );
}

function PlayerMetricCard({ stat }) {
    return (
        <article className="team-stat-card">
            <span className="team-stat-card-icon"><Icon name={stat.icon} /></span>
            <div>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
                <small>{stat.detail}</small>
            </div>
        </article>
    );
}

function PlayerMatch({ match }) {
    const isUpcoming = ["UPCOMING", "NS", "TBD", "TIMED", "PST"].includes(match.status);

    return (
        <Link href={`/matches/${match.id}`} className="team-match">
            <span className="team-match-team home-team">
                {match.homeLogo && <img src={match.homeLogo} alt="" className="player-match-logo" />}
                {match.homeTeam}
            </span>

            <span className="team-match-result">
                <strong>
                    {isUpcoming
                        ? <LocalKickoffTime matchDate={match.matchDate} status={match.providerStatus || match.status} />
                        : `${match.homeScore ?? "-"} - ${match.awayScore ?? "-"}`}
                </strong>
                <small>{isUpcoming ? "Upcoming" : match.status === "FT" ? "Full time" : match.status}</small>
            </span>

            <span className="team-match-team away-team">
                {match.awayTeam}
                {match.awayLogo && <img src={match.awayLogo} alt="" className="player-match-logo" />}
            </span>
        </Link>
    );
}

function CompetitionStats({ competition }) {
    return (
        <article className="player-competition-card">
            <div className="player-competition-heading">
                {competition.logo && <img src={competition.logo} alt="" />}
                <div>
                    <strong>{competition.name}</strong>
                    <span>
                        {[competition.teamName, competition.country].filter(Boolean).join(" · ")}
                    </span>
                </div>
            </div>
            <div className="player-competition-numbers">
                <small><strong>{competition.appearances}</strong> Apps</small>
                <small><strong>{competition.goals}</strong> Goals</small>
                <small><strong>{competition.assists}</strong> Assists</small>
                <small><strong>{competition.minutesPlayed}</strong> Min</small>
            </div>
        </article>
    );
}

function formatSeason(season) {
    return season ? season.replace(/(\d{4})-(\d{4})/, "$1/$2") : "Recorded Season";
}

function formatStoredDate(value) {
    if (!value) return null;

    const dateOnly = String(value).slice(0, 10);
    const [year, month, day] = dateOnly.split("-").map(Number);
    if (!year || !month || !day) return null;

    return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
    }).format(new Date(Date.UTC(year, month - 1, day)));
}
