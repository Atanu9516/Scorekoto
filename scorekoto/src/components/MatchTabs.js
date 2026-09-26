"use client";

import { useState } from "react";
import Link from "next/link";
import { getEventsForMatch, isGenericOrMissingPlayer } from "@/app/lib/events";
import Icon from "@/components/Icon";

export default function MatchTabs({
  match,
  lineup,
}) {
  const [activeTab, setActiveTab] = useState("lineups");

  const events = getEventsForMatch(match, match.events, lineup);
  const stats = match.stats;
  const h2h = Array.isArray(match.h2h) ? match.h2h : [];
  const formatStat = (value, suffix = "") =>
    value === null || value === undefined ? "—" : `${value}${suffix}`;
  const statisticRows = [
    { label: "Possession", values: stats?.possession, suffix: "%" },
    { label: "Team Rating", values: stats?.ratings },
    { label: "Shots", values: stats?.shots },
    { label: "Shots on Target", values: stats?.shotsOnTarget },
    { label: "Shots off Target", values: stats?.shotsOffTarget },
    { label: "Blocked Shots", values: stats?.blockedShots },
    { label: "Shots inside Box", values: stats?.shotsInsideBox },
    { label: "Shots outside Box", values: stats?.shotsOutsideBox },
    { label: "Corners", values: stats?.corners },
    { label: "Fouls", values: stats?.fouls },
    { label: "Offsides", values: stats?.offsides },
    { label: "Yellow Cards", values: stats?.yellowCards },
    { label: "Red Cards", values: stats?.redCards },
    { label: "Goalkeeper Saves", values: stats?.goalkeeperSaves },
    { label: "Total Passes", values: stats?.totalPasses },
    { label: "Accurate Passes", values: stats?.accuratePasses },
    { label: "Pass Accuracy", values: stats?.passAccuracy, suffix: "%" },
  ].filter((row) => row.values?.some((value) => value !== null && value !== undefined));

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
            <p>No official event feed has been saved for this match.</p>
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
            <p>No official event commentary has been saved for this match.</p>
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
        <section className="match-section match-statistics-section">
          <h2>Match Statistics</h2>

          {statisticRows.length === 0 ? (
            <p>No official statistics have been saved for this match.</p>
          ) : (
            <div className="match-stats-card">
              <div className="match-stats-teams" aria-hidden="true">
                <span className="match-stats-team match-stats-team-home">
                  <i />
                  {match.homeTeam}
                </span>
                <span className="match-stats-team match-stats-team-away">
                  {match.awayTeam}
                  <i />
                </span>
              </div>

              <div className="match-stats-list">
                {statisticRows.map((row) => (
                  <StatRow
                    key={row.label}
                    label={row.label}
                    home={row.values?.[0]}
                    away={row.values?.[1]}
                    suffix={row.suffix}
                    homeTeam={match.homeTeam}
                    awayTeam={match.awayTeam}
                    formatStat={formatStat}
                  />
                ))}
              </div>
            </div>
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
            <p>No official lineup has been saved for this match.</p>
          ) : (
            <MatchLineupPitch
              home={lineup.home}
              away={lineup.away}
              events={events}
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
          {h2h.length === 0 ? (
            <p>No previous head-to-head matches are stored.</p>
          ) : (
            <HeadToHead matches={h2h} currentMatch={match} />
          )}
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
        <Icon name={getEventIcon(event.type)} className={`event-icon-${event.type}`} />
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
  suffix = "",
  homeTeam,
  awayTeam,
  formatStat,
}) {
  const homeValue = toStatNumber(home);
  const awayValue = toStatNumber(away);
  const total = Math.max(0, homeValue) + Math.max(0, awayValue);
  const homePercentage = total > 0 ? (Math.max(0, homeValue) / total) * 100 : 50;
  const awayPercentage = 100 - homePercentage;
  const homeDisplay = formatStat(home, suffix);
  const awayDisplay = formatStat(away, suffix);

  return (
    <div
      className="stat-row stat-row-detailed"
      aria-label={`${label}: ${homeTeam} ${homeDisplay}, ${awayTeam} ${awayDisplay}`}
    >
      <div className="stat-row-heading">
        <strong className={homeValue > awayValue ? "stat-value-leading" : undefined}>
          {homeDisplay}
        </strong>
        <span>{label}</span>
        <strong className={awayValue > homeValue ? "stat-value-leading" : undefined}>
          {awayDisplay}
        </strong>
      </div>

      <div className="stat-comparison" aria-hidden="true">
        <div className="stat-track stat-track-home">
          <span style={{ width: `${homePercentage}%` }} />
        </div>
        <div className="stat-track stat-track-away">
          <span style={{ width: `${awayPercentage}%` }} />
        </div>
      </div>
    </div>
  );
}

function toStatNumber(value) {
  if (value === null || value === undefined) return 0;

  const parsed = Number(String(value).replace("%", "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}


/* =========================================================
   EVENT HELPERS
========================================================= */

function getEventIcon(type) {
  switch (type) {
    case "goal":
      return "football";

    case "penalty-goal":
      return "target";

    case "missed-penalty":
      return "target";

    case "own-goal":
      return "football";

    case "yellow-card":
      return "yellowCard";

    case "red-card":
      return "redCard";

    case "substitution":
      return "refresh";

    case "whistle":
      return "clock";

    default:
      return "info";
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

    case "missed-penalty":
      return hasRealPlayer ? `${event.player} misses a penalty` : `Penalty missed ${teamLabel}`.trim();

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

    case "var":
      return event.detail ? `VAR: ${event.detail}` : `VAR review ${teamLabel}`.trim();

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
      return `Goal for ${teamName}.`;

    case "penalty-goal":
      if (hasRealPlayer) {
        return `GOAL! ${event.player} converts the penalty for ${teamName}.`;
      }
      return `GOAL! Penalty converted for ${teamName}.`;

    case "missed-penalty":
      return hasRealPlayer
        ? `${event.player} misses a penalty for ${teamName}.`
        : `Penalty missed by ${teamName}.`;

    case "own-goal":
      if (hasRealPlayer) {
        return `Own goal recorded for ${event.player} (${teamName}).`;
      }
      return `Own goal recorded for ${teamName}.`;

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

    case "var":
      return event.detail ? `VAR review: ${event.detail}.` : `VAR review for ${teamName}.`;

    default:
      return event.detail || "Match action in progress.";
  }
}

function MatchLineupPitch({ home, away, events }) {
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
          {home.formation && <span>{home.formation}</span>}
          {home.coach && <small>Coach: {home.coach}</small>}
        </div>

        <div className="faceoff-vs">
          VS
        </div>

        <div className="faceoff-team away-team-info">
          <strong>{away.team}</strong>
          {away.formation && <span>{away.formation}</span>}
          {away.coach && <small>Coach: {away.coach}</small>}
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
                    team={home.team}
                    events={events}
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
                    team={away.team}
                    events={events}
                  />
                ))}
              </div>
            );
          })}

        </div>

      </div>


      <div className="faceoff-substitutes">

        <SubstituteList lineup={home} events={events} />

        <SubstituteList lineup={away} events={events} />

      </div>

    </div>
  );
}

function SubstituteList({ lineup, events }) {
  return (
    <div className="faceoff-subs-team">
      <h3>{lineup.team} Substitutes</h3>

      {lineup.substitutes.length === 0 && <p>No substitutes recorded.</p>}

      {lineup.substitutes.map((player) => {
        const playerSlug = player.id || encodeURIComponent(player.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
        const indicators = getPlayerMatchIndicators(player, lineup.team, events);

        return (
          <Link
            key={player.name}
            href={`/players/${playerSlug}`}
            className="substitute-player substitute-player-link"
          >
            <span>{player.number ? `#${player.number}` : "Sub"}</span>
            <div className="substitute-player-details">
              <strong>{player.name}</strong>
              <PlayerMatchBadges indicators={indicators} />
            </div>
            <PlayerRating rating={player.rating} compact />
          </Link>
        );
      })}
    </div>
  );
}

function PitchPlayer({ player, team, events }) {
  const playerSlug = player.id || encodeURIComponent(player.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
  const indicators = getPlayerMatchIndicators(player, team, events);

  const content = (
    <>
      <div className="pitch-player-visual">
        <div className="pitch-shirt">
        {player.number ?? "—"}
        </div>
        <PlayerRating rating={player.rating} />
      </div>

      <strong>
        {player.name}
      </strong>

      <PlayerMatchBadges indicators={indicators} />

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

function PlayerRating({ rating, compact = false }) {
  if (rating === null || rating === undefined || rating === "") return null;

  const numericRating = Number(rating);
  if (!Number.isFinite(numericRating)) return null;

  const tone = numericRating >= 8
    ? "excellent"
    : numericRating >= 7
    ? "good"
    : numericRating >= 6
    ? "average"
    : "low";

  return (
    <span
      className={`player-match-rating player-match-rating-${tone}${compact ? " player-match-rating-compact" : ""}`}
      title={`Match rating: ${numericRating.toFixed(1)}`}
      aria-label={`Match rating ${numericRating.toFixed(1)}`}
    >
      {numericRating.toFixed(1)}
    </span>
  );
}

function PlayerMatchBadges({ indicators }) {
  if (indicators.length === 0) return null;

  return (
    <span className="player-event-badges">
      {indicators.map((indicator, index) => (
        <span
          className={`player-event-badge player-event-badge-${indicator.type}`}
          key={`${indicator.type}-${indicator.minute}-${index}`}
          title={`${indicator.label}${indicator.minute ? ` at ${indicator.minute}` : ""}`}
          aria-label={`${indicator.label}${indicator.minute ? ` at ${indicator.minute}` : ""}`}
        >
          {indicator.type === "goal" && <Icon name="football" />}
          {indicator.type === "penalty-goal" && <Icon name="target" />}
          {indicator.type === "assist" && <b>A</b>}
          {indicator.type === "own-goal" && <b>OG</b>}
          {indicator.type === "yellow-card" && <Icon name="yellowCard" />}
          {indicator.type === "red-card" && <Icon name="redCard" />}
          {indicator.type === "sub-in" && <Icon name="arrowUp" />}
          {indicator.type === "sub-out" && <Icon name="arrowDown" />}
          {indicator.minute && <small>{indicator.minute}</small>}
        </span>
      ))}
    </span>
  );
}

function getPlayerMatchIndicators(player, team, events) {
  const indicators = [];

  for (const event of Array.isArray(events) ? events : []) {
    const eventMatchesTeam = sameTeamName(event.team, team);
    const isEventPlayer = playerNameMatches(player.name, event.player);

    if (["goal", "penalty-goal"].includes(event.type) && eventMatchesTeam && isEventPlayer) {
      indicators.push({
        type: event.type,
        label: event.type === "penalty-goal" ? "Penalty goal" : "Goal",
        minute: event.minute,
      });
    }

    // The provider assigns own-goal events to the benefiting team, while the
    // named player belongs to the opponent. Match that player across both sides.
    if (event.type === "own-goal" && isEventPlayer) {
      indicators.push({ type: "own-goal", label: "Own goal", minute: event.minute });
    }

    if (["goal", "penalty-goal"].includes(event.type) && eventMatchesTeam && playerNameMatches(player.name, event.assist)) {
      indicators.push({ type: "assist", label: "Assist", minute: event.minute });
    }

    if (["yellow-card", "red-card"].includes(event.type) && eventMatchesTeam && isEventPlayer) {
      indicators.push({
        type: event.type,
        label: event.type === "red-card" ? "Red card" : "Yellow card",
        minute: event.minute,
      });
    }

    if (event.type === "substitution" && eventMatchesTeam) {
      if (playerNameMatches(player.name, event.playerIn)) {
        indicators.push({ type: "sub-in", label: "Substituted on", minute: event.minute });
      }
      if (playerNameMatches(player.name, event.playerOut)) {
        indicators.push({ type: "sub-out", label: "Substituted off", minute: event.minute });
      }
    }
  }

  return indicators;
}

function playerNameMatches(lineupName, eventName) {
  const lineupTokens = normalizePlayerName(lineupName).split(" ").filter(Boolean);
  const eventTokens = normalizePlayerName(eventName).split(" ").filter(Boolean);
  if (lineupTokens.length === 0 || eventTokens.length === 0) return false;

  const lineupNormalized = lineupTokens.join(" ");
  const eventNormalized = eventTokens.join(" ");
  if (lineupNormalized === eventNormalized) return true;

  const sameSurname = lineupTokens.at(-1) === eventTokens.at(-1);
  const sameInitial = lineupTokens[0]?.[0] === eventTokens[0]?.[0];
  return sameSurname && sameInitial;
}

function normalizePlayerName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLocaleLowerCase();
}

function sameTeamName(first, second) {
  return normalizePlayerName(first) === normalizePlayerName(second);
}

function HeadToHead({ matches, currentMatch }) {
  const summary = matches.reduce((result, item) => {
    if (item.homeScore === item.awayScore) {
      result.draws += 1;
      return result;
    }

    const winnerId = item.homeScore > item.awayScore ? item.homeTeamId : item.awayTeamId;
    if (Number(winnerId) === Number(currentMatch.homeTeamId)) result.homeWins += 1;
    if (Number(winnerId) === Number(currentMatch.awayTeamId)) result.awayWins += 1;
    return result;
  }, { homeWins: 0, draws: 0, awayWins: 0 });

  return (
    <div className="h2h-content">
      <div className="h2h-summary">
        <div><strong>{summary.homeWins}</strong><span>{currentMatch.homeTeam} wins</span></div>
        <div><strong>{summary.draws}</strong><span>Draws</span></div>
        <div><strong>{summary.awayWins}</strong><span>{currentMatch.awayTeam} wins</span></div>
      </div>

      <div className="h2h-list">
        {matches.map((item) => (
          <Link href={`/matches/${item.id}`} className="h2h-row" key={item.id}>
            <div>
              <small>{new Date(item.matchDate).toLocaleDateString()} · {item.league}</small>
              <span>{item.homeTeam}</span>
            </div>
            <strong>{item.homeScore} - {item.awayScore}</strong>
            <span>{item.awayTeam}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
