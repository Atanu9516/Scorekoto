"use client";

import { useState } from "react";
import Link from "next/link";

export default function TeamTabs({
  team = {},
  teamMatches = [],
  matches = [],
  teamStats = {},
  stats = {},
  teamPlayers = [],
  players = [],
}) {
  const [activeTab, setActiveTab] = useState("overview");

  const matchItems = Array.isArray(teamMatches) && teamMatches.length > 0 ? teamMatches : (Array.isArray(matches) ? matches : []);
  const playerItems = Array.isArray(teamPlayers) && teamPlayers.length > 0 ? teamPlayers : (Array.isArray(players) ? players : []);
  const statItems = teamStats && Object.keys(teamStats).length > 0 ? teamStats : (stats || { played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 });

  const finishedMatches = matchItems.filter(
    (match) => match.status !== "UPCOMING" && match.status !== "NS"
  );

  const upcomingMatches = matchItems.filter(
    (match) => match.status === "UPCOMING" || match.status === "NS"
  );

  const goalkeepers = playerItems.filter(
    (player) => player.position === "Goalkeeper"
  );

  const defenders = playerItems.filter(
    (player) => player.position === "Defender"
  );

  const midfielders = playerItems.filter(
    (player) => player.position === "Midfielder"
  );

  const forwards = playerItems.filter(
    (player) => player.position === "Forward" || player.position === "Attacker"
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
                <strong>{team.stadium || team.stadium_name || "Stadium"}</strong>
              </div>

              <div>
                <span>Country</span>
                <strong>{team.country || "Global"}</strong>
              </div>

              <div>
                <span>Manager</span>
                <strong>{team.manager_name || team.manager || "Head Coach"}</strong>
              </div>

              <div>
                <span>League</span>
                <strong>{team.league || "Official Football League"}</strong>
              </div>
            </div>
          </section>

          <section className="team-section">
            <h2>Recent Matches</h2>

            {finishedMatches.length === 0 ? (
              <p>No recent matches found.</p>
            ) : (
              finishedMatches.slice(0, 5).map((match) => (
                <TeamMatch key={match.id} match={match} />
              ))
            )}
          </section>

          <section className="team-section">
            <h2>Upcoming Matches</h2>

            {upcomingMatches.length === 0 ? (
              <p>No upcoming matches found.</p>
            ) : (
              upcomingMatches.slice(0, 5).map((match) => (
                <TeamMatch key={match.id} match={match} />
              ))
            )}
          </section>
        </>
      )}

      {/* MATCHES */}
      {activeTab === "matches" && (
        <section className="team-section">
          <h2>All Matches</h2>

          {matchItems.length === 0 ? (
            <p>No matches available.</p>
          ) : (
            matchItems.map((match) => (
              <TeamMatch key={match.id} match={match} />
            ))
          )}
        </section>
      )}

      {/* SQUAD */}
      {activeTab === "squad" && (
        <section className="team-section">
          <h2>Squad</h2>

          {playerItems.length === 0 ? (
            <p>No players listed for this team.</p>
          ) : (
            <>
              <SquadSection title="Goalkeepers" players={goalkeepers} />
              <SquadSection title="Defenders" players={defenders} />
              <SquadSection title="Midfielders" players={midfielders} />
              <SquadSection title="Forwards" players={forwards} />
            </>
          )}
        </section>
      )}

      {/* STATISTICS */}
      {activeTab === "statistics" && (
        <section className="team-section">
          <h2>Team Statistics</h2>

          <div className="team-stats-grid">
            <div>
              <span>Matches Played</span>
              <strong>{statItems.played ?? 0}</strong>
            </div>

            <div>
              <span>Wins</span>
              <strong>{statItems.wins ?? 0}</strong>
            </div>

            <div>
              <span>Draws</span>
              <strong>{statItems.draws ?? 0}</strong>
            </div>

            <div>
              <span>Losses</span>
              <strong>{statItems.losses ?? 0}</strong>
            </div>

            <div>
              <span>Goals Scored</span>
              <strong>{statItems.goalsFor ?? statItems.goals_for ?? 0}</strong>
            </div>

            <div>
              <span>Goals Conceded</span>
              <strong>{statItems.goalsAgainst ?? statItems.goals_against ?? 0}</strong>
            </div>
          </div>
        </section>
      )}
    </>
  );
}

function TeamMatch({ match }) {
  return (
    <Link href={`/matches/${match.id}`} className="team-match">
      <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {match.homeLogo && (
          <img
            src={match.homeLogo}
            alt=""
            style={{ width: "20px", height: "20px", objectFit: "contain" }}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        )}
        {match.homeTeam}
      </span>

      <strong>
        {match.status === "UPCOMING" || match.status === "NS"
          ? (match.minute || "VS")
          : `${match.homeScore ?? 0} - ${match.awayScore ?? 0}`}
      </strong>

      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          justifyContent: "flex-end",
        }}
      >
        {match.awayTeam}
        {match.awayLogo && (
          <img
            src={match.awayLogo}
            alt=""
            style={{ width: "20px", height: "20px", objectFit: "contain" }}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        )}
      </span>
    </Link>
  );
}

function SquadSection({ title, players }) {
  if (!players || players.length === 0) {
    return null;
  }

  return (
    <div className="squad-section">
      <h3>{title}</h3>

      {players.map((player) => (
        <Link
          key={player.id}
          href={`/players/${player.slug || player.id}`}
          className="squad-player"
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {player.photo ? (
              <img
                src={player.photo}
                alt=""
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "50%",
                  objectFit: "cover",
                }}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <span className="player-number">{player.number || "•"}</span>
            )}

            <div className="player-details">
              <strong>{player.name}</strong>
              <span>
                {player.nationality ? `${player.nationality} · ` : ""}
                {player.position}
              </span>
            </div>
          </div>

          <span className="player-arrow">›</span>
        </Link>
      ))}
    </div>
  );
}