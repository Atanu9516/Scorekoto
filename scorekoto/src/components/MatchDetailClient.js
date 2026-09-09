"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import fallbackTeams from "@/data/teams";
import MatchTabs from "@/components/MatchTabs";
import MatchReactions from "@/components/MatchReactions";

export default function MatchDetailClient({ initialMatch, initialLineup }) {
  const [match, setMatch] = useState(initialMatch);
  const [lineup, setLineup] = useState(initialLineup);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(() => {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  });
  const [feedbackMsg, setFeedbackMsg] = useState("");

  const matchId = match?.id;
  const isLive = match?.status === "LIVE";
  const isFinished = match?.status === "FT" || match?.status === "AET" || match?.status === "PEN";
  const isUpcoming = match?.status === "UPCOMING";

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
          setFeedbackMsg("Live data updated!");
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

  // Optional background sync every 30s for live matches
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      refreshMatchData(false);
    }, 30000);
    return () => clearInterval(interval);
  }, [isLive, refreshMatchData]);

  const homeFound = fallbackTeams.find((t) => t.name === match.homeTeam || t.slug === match.homeSlug);
  const awayFound = fallbackTeams.find((t) => t.name === match.awayTeam || t.slug === match.awaySlug);
  const homeLogo = match.homeLogo || homeFound?.logo;
  const awayLogo = match.awayLogo || awayFound?.logo;

  return (
    <main className="match-page">
      {/* MATCH HEADER */}
      <div className="match-header">
        {/* Navigation & Live Control Bar */}
        <div className="match-top-bar">
          <Link href="/" className="match-back-link">
            ← Back to Matches
          </Link>

          <div className="match-refresh-controls">
            {feedbackMsg && (
              <span className="match-refresh-feedback">
                ✅ {feedbackMsg}
              </span>
            )}
            <span className="match-last-updated">
              🕒 Updated: {lastUpdated}
            </span>
            <button
              className={`match-refresh-btn ${isRefreshing ? "refreshing" : ""}`}
              onClick={() => refreshMatchData(true)}
              disabled={isRefreshing}
              title="Click to fetch the latest live score, minute, and match events"
            >
              <span className="refresh-icon-spin">{isRefreshing ? "⏳" : "🔄"}</span>
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
          {match.minute && <span> • {match.minute}</span>}
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
              />
            ) : (
              <div className="match-scoreboard-placeholder">
                {match.homeTeam?.charAt(0) || "H"}
              </div>
            )}
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
              />
            ) : (
              <div className="match-scoreboard-placeholder">
                {match.awayTeam?.charAt(0) || "A"}
              </div>
            )}
            <h2>{match.awayTeam}</h2>
            <strong>{match.awayScore ?? "-"}</strong>
          </div>
        </div>

        {/* MATCH INFORMATION */}
        <div className="match-info">
          {isLive && <span className="live-label">LIVE MATCH</span>}
          {isFinished && <span>Full Time</span>}
          {isUpcoming && <span>Kick-off at {match.minute || "TBD"}</span>}
          {match.venue && <span className="match-venue-tag"> 📍 {match.venue}</span>}
        </div>
      </div>

      {/* MATCH TABS */}
      <MatchTabs match={match} lineup={lineup} />

      {/* MATCH FAN REACTIONS & DISCUSSION */}
      <MatchReactions matchId={match.id} />
    </main>
  );
}
