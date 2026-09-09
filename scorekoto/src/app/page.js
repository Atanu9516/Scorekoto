"use client";

import { useState, useEffect, useCallback } from "react";
import DateSelector from "@/components/DateSelector";
import fallbackMatches from "@/data/matches";
import LeagueMatchGroup from "@/components/LeagueMatchGroup";
import NewsSidebar from "@/components/NewsSidebar";

export default function Home() {
  const [selectedDate, setSelectedDate] = useState("today");
  const [liveMatches, setLiveMatches] = useState([]);
  const [finishedMatches, setFinishedMatches] = useState([]);
  const [upcomingMatches, setUpcomingMatches] = useState([]);
  const [apiLimitHit, setApiLimitHit] = useState(false);
  const [apiMessage, setApiMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");

  const loadMatches = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }

      const queryUrl = isManualRefresh
        ? `/api/matches?date=${selectedDate}&forceRefresh=true&t=${Date.now()}`
        : `/api/matches?date=${selectedDate}`;

      const res = await fetch(queryUrl);
      if (res.ok) {
        const data = await res.json();
        setLiveMatches(data.liveMatches || []);
        setFinishedMatches(data.finishedMatches || []);
        setUpcomingMatches(data.upcomingMatches || []);
        setApiLimitHit(data.apiLimitHit || false);
        setApiMessage(data.apiMessage || "");
        setLastUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      }
    } catch (err) {
      console.error("Failed to fetch matches:", err);
      // Fallback to local data
      const dateMatches = fallbackMatches.filter(
        (match) => match.date === selectedDate
      );
      setLiveMatches(dateMatches.filter((m) => m.status === "LIVE"));
      setFinishedMatches(dateMatches.filter((m) => m.status === "FT"));
      setUpcomingMatches(dateMatches.filter((m) => m.status === "UPCOMING"));
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadMatches(false);
  }, [loadMatches]);

  const groupByLeague = (matchList) => {
    return matchList.reduce((groups, match) => {
      const league = match.league || "Other Matches";
      if (!groups[league]) {
        groups[league] = [];
      }
      groups[league].push(match);
      return groups;
    }, {});
  };

  const liveByLeague = groupByLeague(liveMatches);
  const finishedByLeague = groupByLeague(finishedMatches);
  const upcomingByLeague = groupByLeague(upcomingMatches);

  return (
    <main className="home-layout">
      <section className="matches-column">
        <section className="match-section">
          {/* Header with Title and Refresh Action */}
          <div className="matches-header-row">
            <div className="matches-title-group">
              <h2>Matches</h2>
              {lastUpdated && !loading && (
                <span className="matches-last-updated-tag">
                  🕒 Updated: {lastUpdated}
                </span>
              )}
            </div>

            <button
              className={`matches-refresh-btn ${isRefreshing ? "refreshing" : ""}`}
              onClick={() => loadMatches(true)}
              disabled={loading || isRefreshing}
              title="Refresh live fixtures, minutes, and scores"
            >
              <span className="refresh-icon-spin">{isRefreshing ? "⏳" : "🔄"}</span>
              <span>{isRefreshing ? "Updating..." : "Refresh Scores"}</span>
            </button>
          </div>

          <DateSelector
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
          />

          {/* API Notification / Status Message */}
          {apiLimitHit && (
            <div className="live-api-banner">
              <span className="banner-icon">ℹ️</span>
              <p>
                {apiMessage ||
                  "Live match API quota limit reached. Please browse previous matches from our database below."}
              </p>
            </div>
          )}

          {/* ALL MATCHES LOADING STATE - Ensures all live matches are completely ready before display */}
          {loading ? (
            <div className="matches-loading-container">
              <div className="matches-loading-spinner"></div>
              <h3>⚡ Loading Live Matches & Database Fixtures...</h3>
              <p>Retrieving real-time match events, minutes, and league standings</p>
            </div>
          ) : (
            <>
              {/* LIVE MATCHES */}
              <h2>🔴 Live</h2>
              {Object.entries(liveByLeague).map(([league, leagueMatches]) => (
                <LeagueMatchGroup
                  key={league}
                  league={league}
                  matches={leagueMatches}
                />
              ))}

              {liveMatches.length === 0 && (
                <p className="empty-message">No live matches at the moment</p>
              )}

              {/* FINISHED MATCHES */}
              <h2>Finished Matches</h2>
              {Object.entries(finishedByLeague).map(([league, leagueMatches]) => (
                <LeagueMatchGroup
                  key={league}
                  league={league}
                  matches={leagueMatches}
                />
              ))}

              {finishedMatches.length === 0 && (
                <p className="empty-message">No finished matches</p>
              )}

              {/* UPCOMING MATCHES */}
              {upcomingMatches.length > 0 && (
                <>
                  <h2>Upcoming Matches</h2>
                  {Object.entries(upcomingByLeague).map(([league, leagueMatches]) => (
                    <LeagueMatchGroup
                      key={league}
                      league={league}
                      matches={leagueMatches}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </section>
      </section>

      <NewsSidebar />
    </main>
  );
}