"use client";

import { useState } from "react";
import Link from "next/link";
import Icon from "./Icon";
import LocalKickoffTime from "./LocalKickoffTime";

export default function TeamTabs({
  team = {},
  teamMatches = [],
  matches = [],
  teamStats = {},
  stats = {},
  teamPlayers = [],
  players = [],
  teamTrophies = [],
  squadMeta = {},
}) {
  const [activeTab, setActiveTab] = useState("overview");

  const matchItems = Array.isArray(teamMatches) && teamMatches.length > 0 ? teamMatches : (Array.isArray(matches) ? matches : []);
  const playerItems = Array.isArray(teamPlayers) && teamPlayers.length > 0 ? teamPlayers : (Array.isArray(players) ? players : []);
  const statItems = teamStats && Object.keys(teamStats).length > 0 ? teamStats : (stats || { played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 });

  const played = Number(statItems.played ?? 0);
  const wins = Number(statItems.wins ?? 0);
  const draws = Number(statItems.draws ?? 0);
  const losses = Number(statItems.losses ?? 0);
  const goalsFor = Number(statItems.goalsFor ?? statItems.goals_for ?? 0);
  const goalsAgainst = Number(statItems.goalsAgainst ?? statItems.goals_against ?? 0);
  const winRate = played > 0 ? Math.round((wins / played) * 100) : 0;
  const goalDifference = goalsFor - goalsAgainst;
  const goalsPerMatch = played > 0 ? (goalsFor / played).toFixed(1) : "0.0";

  const headlineStats = [
    { label: "Matches played", value: played, icon: "flag", detail: "Completed fixtures" },
    { label: "Wins", value: wins, icon: "trophy", detail: `${winRate}% win rate` },
    { label: "Draws", value: draws, icon: "equal", detail: `${played > 0 ? Math.round((draws / played) * 100) : 0}% of matches` },
    { label: "Losses", value: losses, icon: "trendDown", detail: `${played > 0 ? Math.round((losses / played) * 100) : 0}% of matches` },
    { label: "Goals scored", value: goalsFor, icon: "target", detail: `${goalsPerMatch} per match` },
    { label: "Goals conceded", value: goalsAgainst, icon: "shield", detail: `${goalDifference > 0 ? "+" : ""}${goalDifference} goal difference` },
  ];

  const teamInfoItems = [
    { label: "Short Name", value: team.shortName || team.short_name || "Not recorded", icon: "info" },
    { label: "Stadium", value: team.stadium || team.stadium_name || "Venue unavailable", icon: "mapPin" },
    { label: "Country", value: team.country || "Country unavailable", icon: "globe" },
    { label: "Manager", value: team.manager_name || team.manager || "Manager unavailable", icon: "user" },
    { label: "League", value: team.league || "Competition unavailable", icon: "trophy" },
  ];

  const completedStatuses = new Set(["FT", "AET", "PEN"]);
  const scheduledStatuses = new Set(["UPCOMING", "NS", "TBD", "TIMED", "PST"]);
  const finishedMatches = matchItems.filter((match) => completedStatuses.has(match.status));

  const upcomingMatches = matchItems.filter((match) => scheduledStatuses.has(match.status));

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

  const knownPositions = new Set(["Goalkeeper", "Defender", "Midfielder", "Forward", "Attacker"]);
  const otherPlayers = playerItems.filter((player) => !knownPositions.has(player.position));
  const hasVerifiedSquad = squadMeta.status === "success";
  const hasProvisionalSquad = squadMeta.status === "provisional";
  const squadSyncedLabel = squadMeta.syncedAt
    ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(squadMeta.syncedAt))
    : null;
  const squadDescription = hasVerifiedSquad
    ? `${playerItems.length} current player${playerItems.length === 1 ? "" : "s"} from the official squad feed${squadSyncedLabel ? `, synced ${squadSyncedLabel}` : ""}.`
    : hasProvisionalSquad
      ? `${playerItems.length} stored player${playerItems.length === 1 ? "" : "s"}; this provisional roster will be replaced by the official squad after synchronization.`
      : "The official current squad has not been synchronized yet.";

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
            <TeamSectionHeading
              title="Team Information"
              description="Club details and competition information."
            />

            <div className="team-info">
              {teamInfoItems.map((item) => (
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

          {team.history && (
            <section className="team-section">
              <TeamSectionHeading title="Club History" description="Stored club profile." />
              <p>{team.history}</p>
            </section>
          )}

          {teamTrophies.length > 0 && (
            <section className="team-section">
              <TeamSectionHeading title="Honours" description={`${teamTrophies.length} stored trophy record${teamTrophies.length === 1 ? "" : "s"}.`} />
              <div className="player-stat-list">
                {teamTrophies.map((trophy, index) => (
                  <div className="player-stat-row" key={`${trophy.name}-${trophy.season_won}-${index}`}>
                    <span>{trophy.season_won || "Season unavailable"}</span>
                    <strong>{trophy.name}{trophy.type ? ` · ${trophy.type}` : ""}</strong>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="team-section">
            <TeamSectionHeading
              title="Recent Matches"
              description="The latest completed fixtures and results."
            />

            {finishedMatches.length === 0 ? (
              <p>No recent matches found.</p>
            ) : (
              finishedMatches.slice(0, 5).map((match) => (
                <TeamMatch key={match.id} match={match} />
              ))
            )}
          </section>

          <section className="team-section">
            <TeamSectionHeading
              title="Upcoming Matches"
              description="The next scheduled fixtures for the club."
            />

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
          <TeamSectionHeading
            title="All Matches"
            description={`${matchItems.length} fixture${matchItems.length === 1 ? "" : "s"} available.`}
          />

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
          <TeamSectionHeading
            title="Squad"
            description={squadDescription}
          />

          {playerItems.length === 0 ? (
            <p>
              {hasVerifiedSquad
                ? "The provider returned no current squad members for this team."
                : "No stored players or synchronized current squad are available for this team yet."}
            </p>
          ) : (
            <div className="squad-list">
              <SquadSection title="Goalkeepers" players={goalkeepers} />
              <SquadSection title="Defenders" players={defenders} />
              <SquadSection title="Midfielders" players={midfielders} />
              <SquadSection title="Forwards" players={forwards} />
              <SquadSection title="Other" players={otherPlayers} />
            </div>
          )}
        </section>
      )}

      {/* STATISTICS */}
      {activeTab === "statistics" && (
        <section className="team-section team-statistics-section">
          <TeamSectionHeading
            title="Team Statistics"
            description={`Performance across all ${played} completed match${played === 1 ? "" : "es"} stored for this club.`}
          />

          <div className="team-stats-grid">
            {headlineStats.map((stat) => (
              <article className="team-stat-card" key={stat.label}>
                <span className="team-stat-card-icon"><Icon name={stat.icon} /></span>
                <div>
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                  <small>{stat.detail}</small>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function TeamMatch({ match }) {
  const isUpcoming = ["UPCOMING", "NS", "TBD", "TIMED", "PST"].includes(match.status);

  return (
    <Link href={`/matches/${match.id}`} className="team-match">
      <span className="team-match-team home-team">
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

      <span className="team-match-result">
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
        <small>{isUpcoming ? "Upcoming" : match.status === "FT" ? "Full time" : match.status}</small>
      </span>

      <span className="team-match-team away-team">
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
      <h3><span>{title}</span><small>{players.length}</small></h3>

      {players.map((player) => (
        <Link
          key={player.id}
          href={`/players/${player.id}`}
          className="squad-player"
        >
          <div className="squad-player-main">
            {player.photo ? (
              <img
                src={player.photo}
                alt=""
                className="squad-player-photo"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <span className="player-number">{player.name?.charAt(0) || "P"}</span>
            )}

            <div className="player-details">
              <strong>{player.name}</strong>
              <span>
                {player.nationality ? `${player.nationality} · ` : ""}
                {player.position || "Position unavailable"}
                {player.number != null ? ` · #${player.number}` : ""}
              </span>
            </div>
          </div>

          <Icon name="chevronRight" className="player-arrow" />
        </Link>
      ))}
    </div>
  );
}

function TeamSectionHeading({ title, description }) {
  return (
    <header className="team-section-heading">
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
  );
}
