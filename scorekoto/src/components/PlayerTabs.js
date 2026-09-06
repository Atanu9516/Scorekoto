"use client";

import { useState } from "react";
import Link from "next/link";

export default function PlayerTabs({
    player,
    team,
    playerMatches,
}) {
    const [activeTab, setActiveTab] = useState("overview");

    const stats = player.stats;

    return (
        <>
            {/* TABS */}
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

            {/* OVERVIEW */}
            {activeTab === "overview" && (
                <>
                    <section className="player-section">
                        <h2>Player Information</h2>

                        <div className="player-info-grid">
                            <PlayerInfo
                                label="Nationality"
                                value={player.nationality}
                            />

                            <PlayerInfo
                                label="Age"
                                value={player.age}
                            />

                            <PlayerInfo
                                label="Position"
                                value={player.position}
                            />

                            <PlayerInfo
                                label="Shirt Number"
                                value={`#${player.number}`}
                            />

                            <PlayerInfo
                                label="Height"
                                value={player.height}
                            />

                            <PlayerInfo
                                label="Preferred Foot"
                                value={player.preferredFoot}
                            />
                        </div>
                    </section>

                    <section className="player-section">
                        <h2>Current Club</h2>

                        <Link
                            href={`/teams/${player.team
                                .toLowerCase()
                                .replaceAll(" ", "-")}`}
                            className="player-club-card"
                        >
                            {team?.logo ? (
                                <img
                                    src={team.logo}
                                    alt={`${team.name} logo`}
                                    className="player-club-logo"
                                />
                            ) : (
                                <div className="player-club-placeholder">
                                    ⚽
                                </div>
                            )}

                            <div>
                                <strong>{player.team}</strong>

                                {team && (
                                    <span>
                                        {team.country} · {team.league}
                                    </span>
                                )}
                            </div>
                        </Link>
                    </section>

                    <section className="player-section">
                        <h2>Season Snapshot</h2>

                        <div className="player-stat-highlight-grid">
                            <StatHighlight
                                label="Appearances"
                                value={stats.appearances}
                            />

                            <StatHighlight
                                label="Goals"
                                value={stats.goals}
                            />

                            <StatHighlight
                                label="Assists"
                                value={stats.assists}
                            />

                            <StatHighlight
                                label="Rating"
                                value={stats.rating}
                            />
                        </div>
                    </section>
                </>
            )}

            {/* MATCHES */}
            {activeTab === "matches" && (
                <section className="player-section">
                    <h2>Matches</h2>

                    {playerMatches.length === 0 ? (
                        <p>No matches found.</p>
                    ) : (
                        playerMatches.map((match) => (
                            <Link
                                key={match.id}
                                href={`/matches/${match.id}`}
                                className="player-match"
                            >
                                <span>{match.homeTeam}</span>

                                <strong>
                                    {match.status === "UPCOMING"
                                        ? match.minute
                                        : `${match.homeScore ?? "-"} - ${match.awayScore ?? "-"
                                        }`}
                                </strong>

                                <span>{match.awayTeam}</span>
                            </Link>
                        ))
                    )}
                </section>
            )}

            {/* STATISTICS */}
            {activeTab === "statistics" && (
                <section className="player-section">
                    <h2>Season Statistics</h2>

                    <div className="player-stat-list">
                        <StatRow
                            label="Appearances"
                            value={stats.appearances}
                        />

                        <StatRow
                            label="Starts"
                            value={stats.starts}
                        />

                        <StatRow
                            label="Goals"
                            value={stats.goals}
                        />

                        <StatRow
                            label="Assists"
                            value={stats.assists}
                        />

                        {stats.cleanSheets !== undefined && (
                            <StatRow
                                label="Clean Sheets"
                                value={stats.cleanSheets}
                            />
                        )}

                        <StatRow
                            label="Minutes Played"
                            value={stats.minutesPlayed}
                        />

                        <StatRow
                            label="Yellow Cards"
                            value={stats.yellowCards}
                        />

                        <StatRow
                            label="Red Cards"
                            value={stats.redCards}
                        />

                        <StatRow
                            label="Average Rating"
                            value={stats.rating}
                        />
                    </div>
                </section>
            )}
        </>
    );
}

function PlayerInfo({ label, value }) {
    return (
        <div>
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

function StatHighlight({ label, value }) {
    return (
        <div className="player-stat-highlight">
            <strong>{value}</strong>
            <span>{label}</span>
        </div>
    );
}

function StatRow({ label, value }) {
    return (
        <div className="player-stat-row">
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}