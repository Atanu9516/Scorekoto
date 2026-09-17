"use client";

import { useState } from "react";
import Link from "next/link";

export default function LeagueTabs({
    league,
    leagueMatches,
    leagueTeams,
    standings,
    topScorers,
    leagueStats,
}) {
    const [activeTab, setActiveTab] = useState("overview");

    const upcomingMatches = leagueMatches.filter(
        (match) => match.status === "UPCOMING"
    );

    const finishedMatches = leagueMatches.filter(
        (match) => match.status === "FT"
    );

    const liveMatches = leagueMatches.filter(
        (match) => match.status === "LIVE"
    );

    return (
        <>
            {/* TABS */}
            <div className="league-tabs">
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
                    className={activeTab === "standings" ? "active-tab" : ""}
                    onClick={() => setActiveTab("standings")}
                >
                    Standings
                </button>

                <button
                    className={activeTab === "teams" ? "active-tab" : ""}
                    onClick={() => setActiveTab("teams")}
                >
                    Teams
                </button>

                <button
                    className={activeTab === "scorers" ? "active-tab" : ""}
                    onClick={() => setActiveTab("scorers")}
                >
                    Top Scorers
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
                    <section className="league-section">
                        <h2>Competition</h2>

                        <div className="league-overview-grid">
                            <LeagueInfo
                                label="Country"
                                value={league.country}
                            />

                            <LeagueInfo
                                label="Season"
                                value={league.season}
                            />

                            <LeagueInfo
                                label="Teams"
                                value={leagueTeams.length}
                            />

                            <LeagueInfo
                                label="Matches"
                                value={leagueMatches.length}
                            />
                        </div>
                    </section>

                    {liveMatches.length > 0 && (
                        <section className="league-section">
                            <h2>Live Matches</h2>

                            {liveMatches.map((match) => (
                                <LeagueMatchRow
                                    key={match.id}
                                    match={match}
                                />
                            ))}
                        </section>
                    )}

                    <section className="league-section">
                        <h2>Upcoming Matches</h2>

                        {upcomingMatches.length === 0 ? (
                            <p>No upcoming matches.</p>
                        ) : (
                            upcomingMatches.slice(0, 5).map((match) => (
                                <LeagueMatchRow
                                    key={match.id}
                                    match={match}
                                />
                            ))
                        )}
                    </section>

                    <section className="league-section">
                        <h2>Top Teams</h2>

                        {standings.length === 0 ? (
                            <p>No standings available yet.</p>
                        ) : (
                            <StandingsTable
                                standings={standings.slice(0, 5)}
                            />
                        )}
                    </section>
                </>
            )}

            {/* MATCHES */}
            {activeTab === "matches" && (
                <>
                    {liveMatches.length > 0 && (
                        <section className="league-section">
                            <h2>Live</h2>

                            {liveMatches.map((match) => (
                                <LeagueMatchRow
                                    key={match.id}
                                    match={match}
                                />
                            ))}
                        </section>
                    )}

                    <section className="league-section">
                        <h2>Upcoming</h2>

                        {upcomingMatches.length === 0 ? (
                            <p>No upcoming matches.</p>
                        ) : (
                            upcomingMatches.map((match) => (
                                <LeagueMatchRow
                                    key={match.id}
                                    match={match}
                                />
                            ))
                        )}
                    </section>

                    <section className="league-section">
                        <h2>Results</h2>

                        {finishedMatches.length === 0 ? (
                            <p>No finished matches.</p>
                        ) : (
                            finishedMatches.map((match) => (
                                <LeagueMatchRow
                                    key={match.id}
                                    match={match}
                                />
                            ))
                        )}
                    </section>
                </>
            )}

            {/* STANDINGS */}
            {activeTab === "standings" && (
                <section className="league-section">
                    <h2>Standings</h2>

                    {standings.length === 0 ? (
                        <p>No standings available yet.</p>
                    ) : (
                        <StandingsTable standings={standings} />
                    )}
                </section>
            )}

            {/* TEAMS */}
            {activeTab === "teams" && (
                <section className="league-section">
                    <h2>Teams</h2>

                    <div className="league-team-grid">
                        {leagueTeams.map((team) => (
                            <Link
                                key={team.id}
                                href={`/teams/${team.name
                                    .toLowerCase()
                                    .replaceAll(" ", "-")}`}
                                className="league-team-card"
                            >
                                {team.logo ? (
                                    <img
                                        src={team.logo}
                                        alt={`${team.name} logo`}
                                        className="league-team-logo"
                                    />
                                ) : (
                                    <div className="league-team-placeholder">
                                        {team.name.charAt(0)}
                                    </div>
                                )}

                                <div>
                                    <strong>{team.name}</strong>
                                    <span>{team.country}</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* TOP SCORERS */}
            {activeTab === "scorers" && (
                <section className="league-section">
                    <h2>Top Scorers</h2>

                    {topScorers.length === 0 ? (
                        <p>No goals recorded yet.</p>
                    ) : (
                        <div className="top-scorer-list">
                            {topScorers.map((scorer, index) => (
                                <div
                                    key={scorer.player}
                                    className="top-scorer-row"
                                >
                                    <span className="scorer-position">
                                        {index + 1}
                                    </span>

                                    <div className="scorer-player">
                                        <strong>{scorer.player}</strong>
                                        <span>
                                            {scorer.team}
                                            {scorer.appearances ? ` · ${scorer.appearances} apps` : ""}
                                            {scorer.assists ? ` · ${scorer.assists} assists` : ""}
                                        </span>
                                    </div>

                                    <strong className="scorer-goals">
                                        {scorer.goals} {scorer.goals === 1 ? "goal" : "goals"}
                                    </strong>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {/* STATISTICS */}
            {activeTab === "statistics" && (
                <section className="league-section">
                    <h2>Competition Statistics</h2>

                    <div className="league-stat-grid">
                        <LeagueInfo
                            label="Total Matches"
                            value={leagueStats.totalMatches}
                        />

                        <LeagueInfo
                            label="Finished"
                            value={leagueStats.finishedMatches}
                        />

                        <LeagueInfo
                            label="Live"
                            value={leagueStats.liveMatches}
                        />

                        <LeagueInfo
                            label="Upcoming"
                            value={leagueStats.upcomingMatches}
                        />

                        <LeagueInfo
                            label="Goals"
                            value={leagueStats.goals}
                        />

                        <LeagueInfo
                            label="Teams"
                            value={leagueTeams.length}
                        />
                    </div>
                </section>
            )}
        </>
    );
}

function LeagueInfo({ label, value }) {
    return (
        <div className="league-info-card">
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

function LeagueMatchRow({ match }) {
    return (
        <Link
            href={`/matches/${match.id}`}
            className="league-match"
        >
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {match.homeLogo && (
                    <img
                        src={match.homeLogo}
                        alt=""
                        style={{ width: "22px", height: "22px", objectFit: "contain" }}
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                )}
                {match.homeTeam}
            </span>

            <strong>
                {match.status === "UPCOMING" || match.status === "NS"
                    ? (match.minute || "VS")
                    : `${match.homeScore ?? 0} - ${match.awayScore ?? 0}`}
            </strong>

            <span style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "flex-end" }}>
                {match.awayTeam}
                {match.awayLogo && (
                    <img
                        src={match.awayLogo}
                        alt=""
                        style={{ width: "22px", height: "22px", objectFit: "contain" }}
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                )}
            </span>
        </Link>
    );
}

function StandingsTable({ standings }) {
    return (
        <div className="standings-table">
            <div className="standing-row standing-header">
                <span>#</span>
                <span>Team</span>
                <span>P</span>
                <span>GD</span>
                <span>Pts</span>
            </div>

            {standings.map((team) => (
                <div
                    key={team.team}
                    className="standing-row league-standing-row"
                >
                    <span>{team.position}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {team.logo && (
                            <img
                                src={team.logo}
                                alt=""
                                style={{ width: "22px", height: "22px", objectFit: "contain" }}
                                onError={(e) => { e.currentTarget.style.display = "none"; }}
                            />
                        )}
                        <strong>{team.team}</strong>
                    </span>
                    <span>{team.played}</span>
                    <span>{team.goalDifference > 0 ? `+${team.goalDifference}` : team.goalDifference}</span>
                    <strong>{team.points}</strong>
                </div>
            ))}
        </div>
    );
}