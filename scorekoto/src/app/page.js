"use client";

import { useState, useEffect, useCallback } from "react";
import DateSelector from "@/components/DateSelector";
import MatchTypeSelector from "@/components/MatchTypeSelector";
import LeagueMatchGroup from "@/components/LeagueMatchGroup";
import NewsSidebar from "@/components/NewsSidebar";
import Icon from "@/components/Icon";

export default function Home() {
  const [selectedDate, setSelectedDate] = useState("today");
  const [selectedType, setSelectedType] = useState("live");
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
      setLiveMatches([]);
      setFinishedMatches([]);
      setUpcomingMatches([]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadMatches(false);
  }, [loadMatches]);

  // Live match polling every 25s when viewing today
  useEffect(() => {
    if (selectedDate !== "today") return;
    const interval = setInterval(() => {
      // Quiet background refresh without full-page spinner
      fetch(`/api/matches?date=today&t=${Date.now()}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.liveMatches) setLiveMatches(data.liveMatches);
          if (data.finishedMatches) setFinishedMatches(data.finishedMatches);
          if (data.upcomingMatches) setUpcomingMatches(data.upcomingMatches);
          setLastUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
        })
        .catch(() => {});
    }, 25000);
    return () => clearInterval(interval);
  }, [selectedDate]);

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
                  <Icon name="clock" /> Updated: {lastUpdated}
                </span>
              )}
            </div>

            <button
              className={`matches-refresh-btn ${isRefreshing ? "refreshing" : ""}`}
              onClick={() => loadMatches(true)}
              disabled={loading || isRefreshing}
              title="Refresh live fixtures, minutes, and scores"
            >
              <Icon name={isRefreshing ? "loader" : "refresh"} className="refresh-icon-spin" />
              <span>{isRefreshing ? "Updating..." : "Refresh Scores"}</span>
            </button>
          </div>

          <DateSelector
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
          />

          <MatchTypeSelector
            selectedType={selectedType}
            setSelectedType={setSelectedType}
          />

          {/* API Notification / Status Message */}
          {apiLimitHit && (
            <div className="live-api-banner">
              <Icon name="info" className="banner-icon" />
              <p>
                {apiMessage ||
                  "Live match API quota limit reached. Displaying fixtures and matches from our PostgreSQL database."}
              </p>
            </div>
          )}

          {/* ALL MATCHES LOADING STATE */}
          {loading ? (
            <div className="matches-loading-container">
              <div className="matches-loading-spinner"></div>
              <h3><Icon name="bolt" /> Loading Matches & Fixtures...</h3>
              <p>Retrieving real-time match events, minutes, and league standings</p>
            </div>
          ) : (
            <>
              {(() => {
                const matchViews = {
                  live: {
                    title: "Live Matches",
                    matches: liveMatches,
                    groupedMatches: liveByLeague,
                    emptyMessage: "No live matches for this date",
                  },
                  upcoming: {
                    title: "Upcoming Matches",
                    matches: upcomingMatches,
                    groupedMatches: upcomingByLeague,
                    emptyMessage: "No upcoming matches for this date",
                  },
                  finished: {
                    title: "Finished Matches",
                    matches: finishedMatches,
                    groupedMatches: finishedByLeague,
                    emptyMessage: "No finished matches for this date",
                  },
                };
                const selectedView = matchViews[selectedType];

                return (
                  <>
                    <div className="matches-view-heading">
                      <h2>{selectedView.title}</h2>
                      <span>{selectedView.matches.length}</span>
                    </div>
                    {Object.entries(selectedView.groupedMatches).map(([league, leagueMatches]) => (
                      <LeagueMatchGroup
                        key={league}
                        league={league}
                        matches={leagueMatches}
                      />
                    ))}
                    {selectedView.matches.length === 0 && (
                      <p className="empty-message">{selectedView.emptyMessage}</p>
                    )}
                  </>
                );
              })()}
            </>
          )}
        </section>
      </section>

      <NewsSidebar />
    </main>
  );
}
