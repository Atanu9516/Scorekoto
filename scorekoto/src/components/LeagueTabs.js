"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import LocalKickoffTime from "./LocalKickoffTime";

export default function LeagueTabs({
    league,
    leagueMatches,
    leagueTeams,
    standings,
    topScorers,
    leagueStats,
    availableSeasons = [],
    selectedSeason = "",
}) {
    const router = useRouter();
    const pathname = usePathname();
    const [activeTab, setActiveTab] = useState("overview");

    const handleSeasonChange = (newSeason) => {
        router.push(`${pathname}?season=${newSeason}`);
    };

    const upcomingMatches = leagueMatches.filter((match) =>
        ["UPCOMING", "NS", "TBD", "TIMED", "PST"].includes(match.status)
    );

    const finishedMatches = leagueMatches.filter((match) =>
        ["FT", "AET", "PEN"].includes(match.status)
    );

    const liveMatches = leagueMatches.filter((match) =>
        ["LIVE", "1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT"].includes(match.status)
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
                                label="Competition Type"
                                value={league.type || "Type unavailable"}
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
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                        <h2>Standings</h2>
                        <SeasonSelector
                            availableSeasons={availableSeasons}
                            selectedSeason={selectedSeason}
                            onChange={handleSeasonChange}
                        />
                    </div>

                    {standings.length === 0 ? (
                        <p>No standings available yet for season {selectedSeason ? (selectedSeason.includes('-') ? selectedSeason.replace('-', '/') : selectedSeason) : ''}.</p>
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
                                href={`/teams/${team.id || team.name.toLowerCase().replaceAll(" ", "-")}`}
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
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                        <h2>Top Scorers</h2>
                        <SeasonSelector
                            availableSeasons={availableSeasons}
                            selectedSeason={selectedSeason}
                            onChange={handleSeasonChange}
                        />
                    </div>

                    {topScorers.length === 0 ? (
                        <p>No top-scorer data is available for this season.</p>
                    ) : (
                        <div className="top-scorer-list">
                            {topScorers.map((scorer, index) => (
                                <div
                                    key={`${scorer.player}-${scorer.team}`}
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
    const isUpcoming = ["UPCOMING", "NS", "TBD", "TIMED", "PST"].includes(match.status);

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
                {isUpcoming
                    ? (
                        <LocalKickoffTime
                            matchDate={match.matchDate}
                            status={match.providerStatus || match.status}
                        />
                    )
                    : `${match.homeScore ?? "-"} - ${match.awayScore ?? "-"}`}
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
                        <span style={{ display: "grid", gap: "1px" }}>
                            <strong>{team.team}</strong>
                            {team.group && (
                                <small style={{ color: "var(--muted)", fontSize: "10px" }}>
                                    {team.group}
                                </small>
                            )}
                        </span>
                    </span>
                    <span>{team.played}</span>
                    <span>{team.goalDifference > 0 ? `+${team.goalDifference}` : team.goalDifference}</span>
                    <strong>{team.points}</strong>
                </div>
            ))}
        </div>
    );
}

function SeasonSelector({ availableSeasons, selectedSeason, onChange }) {
    if (!availableSeasons || availableSeasons.length === 0) return null;

    return (
        <div className="season-selector">
            <label htmlFor="league-season-select">
                Season:
            </label>
            <select
                id="league-season-select"
                className="season-select"
                value={selectedSeason}
                onChange={(event) => onChange(event.target.value)}
            >
                {availableSeasons.map((season) => (
                    <option key={season.id || season.year} value={season.year}>
                        {season.year.includes("-") ? season.year.replace("-", "/") : season.year}
                    </option>
                ))}
            </select>
        </div>
    );
}
