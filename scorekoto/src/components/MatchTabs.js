"use client";

import { useState } from "react";
import Link from "next/link";
import { getEventsForMatch, isGenericOrMissingPlayer } from "@/app/lib/events";

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

        {event.team && (
          <span>
            {event.team}
          </span>
        )}

        {event.assist && !isGenericOrMissingPlayer(event.assist) && (
          <small>
            Assist: {event.assist}
          </small>
        )}

        {event.playerIn && !isGenericOrMissingPlayer(event.playerIn) && (
          <small className="sub-player-in">
            In: {event.playerIn}
          </small>
        )}

        {event.playerOut && !isGenericOrMissingPlayer(event.playerOut) && (
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
  const hasRealPlayer = !isGenericOrMissingPlayer(event.player);
  const teamLabel = event.team ? `for ${event.team}` : "";

  switch (event.type) {
    case "goal":
      return hasRealPlayer ? `${event.player} scores` : `Goal ${teamLabel}`.trim();

    case "penalty-goal":
      return hasRealPlayer ? `${event.player} scores a penalty` : `Penalty scored ${teamLabel}`.trim();

    case "own-goal":
      return hasRealPlayer ? `${event.player} own goal` : `Own Goal ${teamLabel}`.trim();

    case "yellow-card":
      return hasRealPlayer ? `${event.player} booked` : `Yellow Card ${teamLabel}`.trim();

    case "red-card":
      return hasRealPlayer ? `${event.player} sent off` : `Red Card ${teamLabel}`.trim();

    case "substitution":
      if (
        event.playerIn &&
        event.playerOut &&
        !isGenericOrMissingPlayer(event.playerIn) &&
        !isGenericOrMissingPlayer(event.playerOut)
      ) {
        return `Sub: ${event.playerIn} in for ${event.playerOut}`;
      }
      return `Substitution ${teamLabel}`.trim();

    case "whistle":
      return event.detail || "Match Whistle";

    default:
      return event.detail || (hasRealPlayer ? event.player : `Match event ${teamLabel}`.trim());
  }
}


function getCommentary(event) {
  const hasRealPlayer = !isGenericOrMissingPlayer(event.player);
  const hasRealAssist = !isGenericOrMissingPlayer(event.assist);
  const teamName = event.team || "Team";

  switch (event.type) {
    case "goal":
      if (hasRealPlayer) {
        return `GOAL! ${event.player} scores for ${teamName}.${
          hasRealAssist ? ` (Assisted by ${event.assist})` : ""
        }`;
      }
      return `GOAL! ${teamName} finds the back of the net! A crucial strike to alter the scoreline.`;

    case "penalty-goal":
      if (hasRealPlayer) {
        return `GOAL! ${event.player} converts the penalty for ${teamName}.`;
      }
      return `GOAL! Penalty converted for ${teamName}.`;

    case "own-goal":
      if (hasRealPlayer) {
        return `Own goal by ${event.player}. Unfortunate deflection for ${teamName}.`;
      }
      return `Own goal scored! Unfortunate deflection into the net.`;

    case "yellow-card":
      if (hasRealPlayer) {
        return `${event.player} receives a yellow card for ${teamName}.${
          event.detail ? ` (${event.detail})` : ""
        }`;
      }
      return `Yellow card issued to a ${teamName} player.${
        event.detail ? ` (${event.detail})` : ""
      }`;

    case "red-card":
      if (hasRealPlayer) {
        return `RED CARD! ${event.player} is sent off for ${teamName}.${
          event.detail ? ` (${event.detail})` : ""
        }`;
      }
      return `RED CARD! ${teamName} are reduced to ten men.${
        event.detail ? ` (${event.detail})` : ""
      }`;

    case "substitution":
      if (
        event.playerIn &&
        event.playerOut &&
        !isGenericOrMissingPlayer(event.playerIn) &&
        !isGenericOrMissingPlayer(event.playerOut)
      ) {
        return `${teamName} substitution: ${event.playerIn} replaces ${event.playerOut}.`;
      }
      return `${teamName} make a substitution.`;

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
        const playerSlug = player.id || encodeURIComponent(player.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));

        return (
          <Link
            key={player.name}
            href={`/players/${playerSlug}`}
            className="substitute-player substitute-player-link"
          >
            <span>#{player.number}</span>
            <strong>{player.name}</strong>
          </Link>
        );
      })}
    </div>
  );
}

function PitchPlayer({ player }) {
  const playerSlug = player.id || encodeURIComponent(player.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));

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

  return (
    <Link
      href={`/players/${playerSlug}`}
      className="pitch-player pitch-player-link"
    >
      {content}
    </Link>
  );
}