"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import MatchCard from "@/components/MatchCard";
import DateSelector from "@/components/DateSelector";
import matches from "@/data/matches";
import LeagueMatchGroup from "@/components/LeagueMatchGroup";
import NewsSidebar from "@/components/NewsSidebar";

export default function Home() {

  const [selectedDate, setSelectedDate] = useState("today");

  const dateMatches = matches.filter(
    (match) => match.date === selectedDate
  );

  const liveMatches = dateMatches.filter(
    (match) => match.status === "LIVE"
  );

  const upcomingMatches = dateMatches.filter(
    (match) => match.status === "UPCOMING"
  );

  const finishedMatches = dateMatches.filter(
    (match) => match.status === "FT"
  );

  const groupByLeague = (matchList) => {
    return matchList.reduce((groups, match) => {
      const league = match.league;

      if (!groups[league]) {
        groups[league] = [];
      }

      groups[league].push(match);

      return groups;
    }, {});
  };

  const liveByLeague = groupByLeague(liveMatches);

  const upcomingByLeague = groupByLeague(upcomingMatches);

  const finishedByLeague = groupByLeague(finishedMatches);

  return (
    <main className="home-layout">

      <section className="matches-column">

        <section className="match-section">
          <h2>Matches</h2>

          <DateSelector
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
          />

          <h2>🔴 Live</h2>
          {Object.entries(liveByLeague).map(
            ([league, leagueMatches]) => (
              <LeagueMatchGroup
                key={league}
                league={league}
                matches={leagueMatches}
              />
            )
          )}

          {liveMatches.length === 0 && (
            <p className="empty-message">
              No live matches
            </p>
          )}

          <h2>Finished</h2>

          {Object.entries(finishedByLeague).map(
            ([league, leagueMatches]) => (
              <LeagueMatchGroup
                key={league}
                league={league}
                matches={leagueMatches}
              />
            )
          )}

          {finishedMatches.length === 0 && (
            <p className="empty-message">
              No finished matches
            </p>
          )}

          <h2>Upcoming</h2>

          {Object.entries(upcomingByLeague).map(
            ([league, leagueMatches]) => (
              <LeagueMatchGroup
                key={league}
                league={league}
                matches={leagueMatches}
              />
            )
          )}

          {upcomingMatches.length === 0 && (
            <p className="empty-message">
              No upcoming matches
            </p>
          )}
        </section>
      </section>



      <NewsSidebar />


    </main>
  );
}