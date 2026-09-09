"use client";

import { useState } from "react";
import Link from "next/link";
import players from "@/data/players";
import { getEventsForMatch } from "@/app/lib/events";

export default function MatchTabs({
  match,
  lineup,
}) {
  const [activeTab, setActiveTab] = useState("summary");

  const events = getEventsForMatch(match, match.events, lineup);
  const stats = match.stats;

  return (
    <>
      {/* TABS */}
      <div className="match-tabs">
        <button
          className={activeTab === "summary" ? "active-tab" : ""}
          onClick={() => setActiveTab("summary")}
        >
          Summary
        </button>

        <button
          className={activeTab === "commentary" ? "active-tab" : ""}
          onClick={() => setActiveTab("commentary")}
        >
          Commentary
        </button>

        <button
          className={activeTab === "stats" ? "active-tab" : ""}
          onClick={() => setActiveTab("stats")}
        >
          Stats
        </button>

        <button
          className={activeTab === "lineups" ? "active-tab" : ""}
          onClick={() => setActiveTab("lineups")}
        >
          Lineups
        </button>

        <button
          className={activeTab === "h2h" ? "active-tab" : ""}
          onClick={() => setActiveTab("h2h")}
        >
          H2H
        </button>
      </div>

      {/* =========================
          SUMMARY
      ========================= */}
      {activeTab === "summary" && (
        <section className="match-section">
          <h2>Match Events</h2>

          {events.length === 0 ? (
            <p>No events recorded for this match yet.</p>
          ) : (
            <div className="match-timeline">
              {events.map((event, index) => (
                <MatchEvent
                  key={index}
                  event={event}
                  match={match}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* =========================
          COMMENTARY
      ========================= */}
      {activeTab === "commentary" && (
        <section className="match-section">
          <h2>Commentary</h2>

          {events.length === 0 ? (
            <p>No commentary available for this match yet.</p>
          ) : (
            <div className="commentary-list">
              {events.map((event, index) => (
                <div
                  key={index}
                  className="commentary-item"
                >
                  <strong>
                    {event.minute}
                  </strong>

                  <span>
                    {getCommentary(event)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* =========================
          STATS
      ========================= */}
      {activeTab === "stats" && (
        <section className="match-section">
          <h2>Match Statistics</h2>

          {!stats ? (
            <p>Statistics are not available yet.</p>
          ) : (
            <>
              <StatRow
                label="Possession"
                home={`${stats.possession[0]}%`}
                away={`${stats.possession[1]}%`}
              />

              <StatRow
                label="Shots"
                home={stats.shots[0]}
                away={stats.shots[1]}
              />

              <StatRow
                label="Shots on Target"
                home={stats.shotsOnTarget[0]}
                away={stats.shotsOnTarget[1]}
              />

              <StatRow
                label="Corners"
                home={stats.corners[0]}
                away={stats.corners[1]}
              />

              <StatRow
                label="Fouls"
                home={stats.fouls[0]}
                away={stats.fouls[1]}
              />

              <StatRow
                label="Offsides"
                home={stats.offsides[0]}
                away={stats.offsides[1]}
              />

              <StatRow
                label="Yellow Cards"
                home={stats.yellowCards[0]}
                away={stats.yellowCards[1]}
              />

              <StatRow
                label="Red Cards"
                home={stats.redCards[0]}
                away={stats.redCards[1]}
              />
            </>
          )}
        </section>
      )}

      {/* =========================
          LINEUPS
      ========================= */}
      {activeTab === "lineups" && (
        <section className="match-section">
          <h2>Lineups</h2>

          {!lineup ? (
            <p>Lineups are not available for this match yet.</p>
          ) : (
            <MatchLineupPitch
              home={lineup.home}
              away={lineup.away}
            />
          )}
        </section>
      )}

      {/* =========================
          H2H
      ========================= */}
      {activeTab === "h2h" && (
        <section className="match-section">
          <h2>Head to Head</h2>

          <div className="h2h-match">
            <span>15 Aug 2026</span>

            <strong>
              {match.homeTeam} 2 - 1 {match.awayTeam}
            </strong>
          </div>

          <div className="h2h-match">
            <span>10 May 2026</span>

            <strong>
              {match.awayTeam} 1 - 1 {match.homeTeam}
            </strong>
          </div>

          <div className="h2h-match">
            <span>22 Dec 2025</span>

            <strong>
              {match.homeTeam} 3 - 0 {match.awayTeam}
            </strong>
          </div>
        </section>
      )}
    </>
  );
}


/* =========================================================
   MATCH EVENT
========================================================= */

function MatchEvent({ event, match }) {
  const isHomeTeam =
    event.team === match.homeTeam;

  return (
    <div
      className={`timeline-event ${isHomeTeam
        ? "home-event"
        : "away-event"
        }`}
    >
      <span className="event-minute">
        {event.minute}
      </span>

      <span className="event-icon">
        {getEventIcon(event.type)}
      </span>

      <div className="event-details">
        <strong>
          {getEventTitle(event)}
        </strong>

        <span>
          {event.team}
        </span>

        {event.assist && (
          <small>
            Assist: {event.assist}
          </small>
        )}

        {event.playerIn && (
          <small className="sub-player-in">
            In: {event.playerIn}
          </small>
        )}

        {event.playerOut && (
          <small className="sub-player-out">
            Out: {event.playerOut}
          </small>
        )}
      </div>
    </div>
  );
}


/* =========================================================
   STAT ROW
========================================================= */

function StatRow({
  label,
  home,
  away,
}) {
  return (
    <div className="stat-row stat-row-detailed">

      <strong>
        {home}
      </strong>

      <span>
        {label}
      </span>

      <strong>
        {away}
      </strong>

    </div>
  );
}


/* =========================================================
   EVENT HELPERS
========================================================= */

function getEventIcon(type) {
  switch (type) {
    case "goal":
      return "⚽";

    case "penalty-goal":
      return "🎯";

    case "own-goal":
      return "⚽";

    case "yellow-card":
      return "🟨";

    case "red-card":
      return "🟥";

    case "substitution":
      return "🔁";

    case "whistle":
      return "⏱️";

    default:
      return "•";
  }
}


function getEventTitle(event) {
  switch (event.type) {
    case "goal":
      return `${event.player} scores`;

    case "penalty-goal":
      return `${event.player} scores a penalty`;

    case "own-goal":
      return `${event.player} own goal`;

    case "yellow-card":
      return `${event.player} booked`;

    case "red-card":
      return `${event.player} sent off`;

    case "substitution":
      return "Substitution";

    case "whistle":
      return event.detail || "Match Whistle";

    default:
      return event.detail || event.player || "Match event";
  }
}


function getCommentary(event) {
  switch (event.type) {
    case "goal":
      return `GOAL! ${event.player} scores for ${event.team}.${event.assist ? ` (Assisted by ${event.assist})` : ''}`;

    case "penalty-goal":
      return `GOAL! ${event.player} converts the penalty for ${event.team}.`;

    case "own-goal":
      return `Own goal by ${event.player}.`;

    case "yellow-card":
      return `${event.player} receives a yellow card for ${event.team}.${event.detail ? ` (${event.detail})` : ''}`;

    case "red-card":
      return `${event.player} receives a red card for ${event.team}.${event.detail ? ` (${event.detail})` : ''}`;

    case "substitution":
      return `${event.team} make a substitution: ${event.playerIn || 'Substitute'} replaces ${event.playerOut || event.player}.`;

    case "whistle":
      return event.detail || `Whistle blown at ${event.minute}.`;

    default:
      return event.detail || "Match action in progress.";
  }
}

function MatchLineupPitch({ home, away }) {
  const homeRows = [
    ...new Set(
      home.startingXI.map((player) => player.row)
    ),
  ];

  const awayRows = [
    ...new Set(
      away.startingXI.map((player) => player.row)
    ),
  ];

  return (
    <div className="faceoff-lineup">

      <div className="faceoff-header">

        <div className="faceoff-team home-team-info">
          <strong>{home.team}</strong>
          <span>{home.formation}</span>
          <small>Coach: {home.coach}</small>
        </div>

        <div className="faceoff-vs">
          VS
        </div>

        <div className="faceoff-team away-team-info">
          <strong>{away.team}</strong>
          <span>{away.formation}</span>
          <small>Coach: {away.coach}</small>
        </div>

      </div>


      <div className="faceoff-pitch">

        <div className="team-half home-half">

          {homeRows.map((row) => {
            const playersInRow =
              home.startingXI.filter(
                (player) => player.row === row
              );

            return (
              <div
                key={row}
                className="formation-column"
              >
                {playersInRow.map((player) => (
                  <PitchPlayer
                    key={player.name}
                    player={player}
                  />
                ))}
              </div>
            );
          })}

        </div>


        <div className="team-half away-half">

          {awayRows.map((row) => {
            const playersInRow =
              away.startingXI.filter(
                (player) => player.row === row
              );

            return (
              <div
                key={row}
                className="formation-column"
              >
                {playersInRow.map((player) => (
                  <PitchPlayer
                    key={player.name}
                    player={player}
                  />
                ))}
              </div>
            );
          })}

        </div>

      </div>


      <div className="faceoff-substitutes">

        <SubstituteList lineup={home} />

        <SubstituteList lineup={away} />

      </div>

    </div>
  );
}

function SubstituteList({ lineup }) {
  return (
    <div className="faceoff-subs-team">
      <h3>{lineup.team} Substitutes</h3>

      {lineup.substitutes.map((player) => {
        const playerData = players.find(
          (item) => item.name === player.name
        );

        if (playerData) {
          return (
            <Link
              key={player.name}
              href={`/players/${playerData.slug}`}
              className="substitute-player substitute-player-link"
            >
              <span>#{player.number}</span>
              <strong>{player.name}</strong>
            </Link>
          );
        }

        return (
          <div
            key={player.name}
            className="substitute-player"
          >
            <span>#{player.number}</span>
            <strong>{player.name}</strong>
          </div>
        );
      })}
    </div>
  );
}

function PitchPlayer({ player }) {
  const playerData = players.find(
    (item) => item.name === player.name
  );

  const content = (
    <>
      <div className="pitch-shirt">
        {player.number}
      </div>

      <strong>
        {player.name}
      </strong>

      <span>
        {player.position}
      </span>
    </>
  );

  if (playerData) {
    return (
      <Link
        href={`/players/${playerData.slug}`}
        className="pitch-player pitch-player-link"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="pitch-player">
      {content}
    </div>
  );
}