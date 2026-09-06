"use client";

import { useState } from "react";
import Link from "next/link";

export default function TeamTabs({
    team,
    teamMatches,
    teamStats,
    teamPlayers,
}) {
    const [activeTab, setActiveTab] = useState("overview");

    const finishedMatches = teamMatches.filter(
        (match) => match.status !== "UPCOMING"
    );

    const upcomingMatches = teamMatches.filter(
        (match) => match.status === "UPCOMING"
    );

    const goalkeepers = teamPlayers.filter(
        (player) => player.position === "Goalkeeper"
    );

    const defenders = teamPlayers.filter(
        (player) => player.position === "Defender"
    );

    const midfielders = teamPlayers.filter(
        (player) => player.position === "Midfielder"
    );

    const forwards = teamPlayers.filter(
        (player) => player.position === "Forward"
    );

    return (
        <>
            {/* TABS */}
            <div className="team-tabs">
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
                    className={activeTab === "squad" ? "active-tab" : ""}
                    onClick={() => setActiveTab("squad")}
                >
                    Squad
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
                    <section className="team-section">
                        <h2>Team Information</h2>

                        <div className="team-info">
                            <div>
                                <span>Stadium</span>
                                <strong>{team.stadium}</strong>
                            </div>

                            <div>
                                <span>Founded</span>
                                <strong>{team.founded}</strong>
                            </div>

                            <div>
                                <span>Country</span>
                                <strong>{team.country}</strong>
                            </div>

                            <div>
                                <span>League</span>
                                <strong>{team.league}</strong>
                            </div>
                        </div>
                    </section>

                    <section className="team-section">
                        <h2>Recent Matches</h2>

                        {finishedMatches.length === 0 ? (
                            <p>No recent matches found.</p>
                        ) : (
                            finishedMatches.slice(0, 5).map((match) => (
                                <TeamMatch
                                    key={match.id}
                                    match={match}
                                />
                            ))
                        )}
                    </section>

                    <section className="team-section">
                        <h2>Upcoming Matches</h2>

                        {upcomingMatches.length === 0 ? (
                            <p>No upcoming matches found.</p>
                        ) : (
                            upcomingMatches.slice(0, 5).map((match) => (
                                <TeamMatch
                                    key={match.id}
                                    match={match}
                                />
                            ))
                        )}
                    </section>
                </>
            )}

            {/* MATCHES */}
            {activeTab === "matches" && (
                <section className="team-section">
                    <h2>All Matches</h2>

                    {teamMatches.length === 0 ? (
                        <p>No matches found.</p>
                    ) : (
                        teamMatches.map((match) => (
                            <TeamMatch
                                key={match.id}
                                match={match}
                            />
                        ))
                    )}
                </section>
            )}

            {/* SQUAD */}
            {activeTab === "squad" && (
                <section className="team-section">
                    <h2>Squad</h2>

                    {teamPlayers.length === 0 ? (
                        <p>No squad data available yet.</p>
                    ) : (
                        <div className="squad-list">
                            <SquadSection
                                title="Goalkeepers"
                                players={goalkeepers}
                            />

                            <SquadSection
                                title="Defenders"
                                players={defenders}
                            />

                            <SquadSection
                                title="Midfielders"
                                players={midfielders}
                            />

                            <SquadSection
                                title="Forwards"
                                players={forwards}
                            />
                        </div>
                    )}
                </section>
            )}

            {/* STATISTICS */}
            {activeTab === "statistics" && (
                <section className="team-section">
                    <h2>Team Statistics</h2>

                    <div className="team-info">
                        <div>
                            <span>Matches Played</span>
                            <strong>{teamStats.played}</strong>
                        </div>

                        <div>
                            <span>Wins</span>
                            <strong>{teamStats.wins}</strong>
                        </div>

                        <div>
                            <span>Draws</span>
                            <strong>{teamStats.draws}</strong>
                        </div>

                        <div>
                            <span>Losses</span>
                            <strong>{teamStats.losses}</strong>
                        </div>

                        <div>
                            <span>Goals Scored</span>
                            <strong>{teamStats.goalsFor}</strong>
                        </div>

                        <div>
                            <span>Goals Conceded</span>
                            <strong>{teamStats.goalsAgainst}</strong>
                        </div>
                    </div>
                </section>
            )}
        </>
    );
}

function TeamMatch({ match }) {
    return (
        <Link
            href={`/matches/${match.id}`}
            className="team-match"
        >
            <span>{match.homeTeam}</span>

            <strong>
                {match.status === "UPCOMING"
                    ? match.minute
                    : `${match.homeScore ?? "-"} - ${match.awayScore ?? "-"}`}
            </strong>

            <span>{match.awayTeam}</span>
        </Link>
    );
}

function SquadSection({ title, players }) {
    if (players.length === 0) {
        return null;
    }

    return (
        <div className="squad-section">
            <h3>{title}</h3>

            {players.map((player) => (
                <Link
                    key={player.id}
                    href={`/players/${player.slug}`}
                    className="squad-player"
                >
                    <span className="player-number">
                        {player.number}
                    </span>

                    <div className="player-details">
                        <strong>{player.name}</strong>

                        <span>
                            {player.nationality} · {player.position}
                        </span>
                    </div>

                    <span className="player-arrow">›</span>
                </Link>
            ))}
        </div>
    );
}