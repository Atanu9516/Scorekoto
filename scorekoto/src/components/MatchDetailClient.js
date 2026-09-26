"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import MatchTabs from "@/components/MatchTabs";
import MatchReactions from "@/components/MatchReactions";
import Icon from "@/components/Icon";
import LocalKickoffTime from "@/components/LocalKickoffTime";
import { getEventsForMatch, isGenericOrMissingPlayer } from "@/app/lib/events";

const SCOREBOARD_EVENT_TYPES = new Set([
  "goal",
  "penalty-goal",
  "own-goal",
  "red-card",
]);

export default function MatchDetailClient({ initialMatch, initialLineup }) {
  const [match, setMatch] = useState(initialMatch);
  const [lineup, setLineup] = useState(initialLineup);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(() => {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  });
  const [feedbackMsg, setFeedbackMsg] = useState("");

  const matchId = match?.id;
  const matchStatus = (match?.status || "").toUpperCase();
  const isLive = ["LIVE", "1H", "2H", "HT", "ET", "BT", "P", "IN_PLAY"].includes(matchStatus);
  const isFinished = ["FT", "AET", "PEN"].includes(matchStatus);
  const isUpcoming = ["NS", "TBD", "TIMED", "UPCOMING"].includes(matchStatus);

  const refreshMatchData = useCallback(async (manual = true) => {
    if (!matchId) return;
    try {
      if (manual) setIsRefreshing(true);
      const res = await fetch(`/api/matches/${matchId}?forceRefresh=true&t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.match) {
          setMatch((prev) => ({
            ...prev,
            ...data.match,
            // Retain logos if already present
            homeLogo: data.match.homeLogo || prev.homeLogo,
            awayLogo: data.match.awayLogo || prev.awayLogo,
          }));
        }
        if (data.lineup) {
          setLineup(data.lineup);
        }
        const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        setLastUpdated(timeStr);
        if (manual) {
          setFeedbackMsg(data.providerMessage || "Live data updated!");
          setTimeout(() => setFeedbackMsg(""), 3500);
        }
      }
    } catch (err) {
      console.error("Failed to refresh match data:", err);
      if (manual) {
        setFeedbackMsg("Failed to refresh. Please retry.");
        setTimeout(() => setFeedbackMsg(""), 3500);
      }
    } finally {
      if (manual) setIsRefreshing(false);
    }
  }, [matchId]);

  // Background live sync every 20s for live matches
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      refreshMatchData(false);
    }, 20000);
    return () => clearInterval(interval);
  }, [isLive, refreshMatchData]);

  // Local live minute increment ticker every 60s for in-play matches
  useEffect(() => {
    if (!isLive) return;
    const minuteStr = match?.minute || "";
    if (minuteStr.includes("HT") || minuteStr.includes("FT") || minuteStr.includes("TBD")) return;

    const currentMin = parseInt(minuteStr.replace(/[^0-9]/g, ""), 10);
    if (!currentMin || isNaN(currentMin)) return;

    const ticker = setInterval(() => {
      setMatch((prev) => {
        const cur = parseInt((prev?.minute || "").replace(/[^0-9]/g, ""), 10);
        if (!cur || isNaN(cur) || cur >= 120) return prev;
        return {
          ...prev,
          minute: `${cur + 1}'`,
        };
      });
    }, 60000);

    return () => clearInterval(ticker);
  }, [isLive, match?.status]);

  const homeLogo = match.homeLogo;
  const awayLogo = match.awayLogo;
  const scoreboardEvents = getEventsForMatch(match, match.events, lineup)
    .filter((event) => SCOREBOARD_EVENT_TYPES.has(event.type));
  const homeIncidents = groupScoreboardIncidents(
    scoreboardEvents.filter((event) => isSameTeam(event.team, match.homeTeam))
  );
  const awayIncidents = groupScoreboardIncidents(
    scoreboardEvents.filter((event) => isSameTeam(event.team, match.awayTeam))
  );
  const hasScoreboardIncidents = homeIncidents.length > 0 || awayIncidents.length > 0;

  return (
    <main className="match-page">
      {/* MATCH HEADER */}
      <div className="match-header">
        {/* Navigation & Live Control Bar */}
        <div className="match-top-bar">
          <Link href="/" className="match-back-link">
            <Icon name="arrowLeft" /> Back to Matches
          </Link>

          <div className="match-refresh-controls">
            {feedbackMsg && (
              <span className="match-refresh-feedback">
                <Icon name="check" /> {feedbackMsg}
              </span>
            )}
            <span className="match-last-updated">
              <Icon name="clock" /> Updated: {lastUpdated}
            </span>
            <button
              className={`match-refresh-btn ${isRefreshing ? "refreshing" : ""}`}
              onClick={() => refreshMatchData(true)}
              disabled={isRefreshing}
              title="Click to fetch the latest live score, minute, and match events"
            >
              <Icon name={isRefreshing ? "loader" : "refresh"} className="refresh-icon-spin" />
              <span>{isRefreshing ? "Refreshing..." : "Refresh Live Data"}</span>
            </button>
          </div>
        </div>

        <p className="match-league">{match.league}</p>

        <div className="match-status-large">
          {isLive && <span className="live-dot pulse-animation"></span>}
          <span>
            {isFinished ? "Finished" : isUpcoming ? "Upcoming" : "Live"}
          </span>
          {(match.minute || isUpcoming) && (
            isUpcoming ? (
              <LocalKickoffTime
                prefix=" • "
                matchDate={match.matchDate}
                status={match.providerStatus || matchStatus}
              />
            ) : <span> • {match.minute}</span>
          )}
        </div>

        {/* SCOREBOARD */}
        <div className="scoreboard">
          {/* HOME TEAM */}
          <div className="team">
            {homeLogo ? (
              <img
                src={homeLogo}
                alt={`${match.homeTeam} logo`}
                className="match-scoreboard-logo"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  const fallback = e.currentTarget.parentElement?.querySelector(".match-scoreboard-placeholder");
                  if (fallback) fallback.style.display = "flex";
                }}
              />
            ) : null}
            <div
              className="match-scoreboard-placeholder"
              style={{ display: homeLogo ? "none" : "flex" }}
            >
              {match.homeTeam?.charAt(0) || "H"}
            </div>
            <h2>{match.homeTeam}</h2>
            <strong>{match.homeScore ?? "-"}</strong>
          </div>

          <div className="score-separator">-</div>

          {/* AWAY TEAM */}
          <div className="team">
            {awayLogo ? (
              <img
                src={awayLogo}
                alt={`${match.awayTeam} logo`}
                className="match-scoreboard-logo"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  const fallback = e.currentTarget.parentElement?.querySelector(".match-scoreboard-placeholder");
                  if (fallback) fallback.style.display = "flex";
                }}
              />
            ) : null}
            <div
              className="match-scoreboard-placeholder"
              style={{ display: awayLogo ? "none" : "flex" }}
            >
              {match.awayTeam?.charAt(0) || "A"}
            </div>
            <h2>{match.awayTeam}</h2>
            <strong>{match.awayScore ?? "-"}</strong>
          </div>
        </div>

        {hasScoreboardIncidents && (
          <div className="scoreboard-incidents">
            <ScoreboardIncidentList
              incidents={homeIncidents}
              team={match.homeTeam}
            />
            <ScoreboardIncidentList
              incidents={awayIncidents}
              team={match.awayTeam}
            />
          </div>
        )}

        {/* MATCH INFORMATION */}
        <div className="match-info">
          {isLive && <span className="live-label">LIVE MATCH</span>}
          {isFinished && <span>Full Time</span>}
          {isUpcoming && (
            <span>
              Kick-off at{" "}
              <LocalKickoffTime
                matchDate={match.matchDate}
                status={match.providerStatus || matchStatus}
              />
            </span>
          )}
          {match.venue && <span className="match-venue-tag"><Icon name="mapPin" /> {match.venue}</span>}
        </div>
      </div>

      {/* MATCH TABS */}
      <MatchTabs match={match} lineup={lineup} />

      {/* MATCH FAN REACTIONS & DISCUSSION */}
      <MatchReactions matchId={match.id} />
    </main>
  );
}

function ScoreboardIncidentList({ incidents, team }) {
  if (incidents.length === 0) {
    return <span aria-hidden="true" />;
  }

  return (
    <ul className="scoreboard-incident-list" aria-label={`${team} match incidents`}>
      {incidents.map((incident) => {
        const isRedCard = incident.type === "red-card";
        const qualifier = incident.type === "own-goal"
          ? "OG"
          : incident.type === "penalty-goal"
          ? "P"
          : null;
        const incidentName = isGenericOrMissingPlayer(incident.player)
          ? getIncidentFallback(incident.type)
          : incident.player;
        const minutes = incident.minutes.filter(Boolean).join(", ");
        const incidentDescription = `${getIncidentFallback(incident.type)}: ${incidentName}${minutes ? `, ${minutes}` : ""}`;

        return (
          <li
            className={`scoreboard-incident scoreboard-incident-${incident.type}`}
            key={`${incident.type}-${incidentName}-${minutes}`}
            aria-label={incidentDescription}
            title={incidentDescription}
          >
            <Icon name={isRedCard ? "redCard" : "football"} />
            <span className="scoreboard-incident-name">{incidentName}</span>
            {qualifier && (
              <span className="scoreboard-incident-qualifier">({qualifier})</span>
            )}
            {minutes && <time>{minutes}</time>}
          </li>
        );
      })}
    </ul>
  );
}

function groupScoreboardIncidents(events) {
  const grouped = new Map();

  events.forEach((event) => {
    const player = isGenericOrMissingPlayer(event.player) ? "" : event.player.trim();
    const key = `${event.type}:${player.toLocaleLowerCase()}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.minutes.push(event.minute);
      return;
    }

    grouped.set(key, {
      type: event.type,
      player,
      minutes: [event.minute],
    });
  });

  return Array.from(grouped.values());
}

function isSameTeam(eventTeam, matchTeam) {
  return String(eventTeam || "").trim().toLocaleLowerCase() ===
    String(matchTeam || "").trim().toLocaleLowerCase();
}

function getIncidentFallback(type) {
  switch (type) {
    case "own-goal":
      return "Own goal";
    case "penalty-goal":
      return "Penalty goal";
    case "red-card":
      return "Red card";
    default:
      return "Goal";
  }
}
