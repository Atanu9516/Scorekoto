"use client";

import { useState } from "react";
import Link from "next/link";

import players from "@/data/players";
import teams from "@/data/teams";
import leagues from "@/data/leagues";
import matches from "@/data/matches";


export default function GlobalSearch() {
  const [query, setQuery] = useState("");

  const searchText = query.trim().toLowerCase();


  const matchedPlayers = players
    .filter((player) =>
      player.name.toLowerCase().includes(searchText)
    )
    .slice(0, 5);


  const matchedTeams = teams
    .filter((team) =>
      team.name.toLowerCase().includes(searchText)
    )
    .slice(0, 5);


  const matchedLeagues = leagues
    .filter((league) =>
      league.name.toLowerCase().includes(searchText)
    )
    .slice(0, 5);


  const matchedMatches = matches
    .filter((match) => {
      const matchName =
        `${match.homeTeam} ${match.awayTeam} ${match.league}`.toLowerCase();

      return matchName.includes(searchText);
    })
    .slice(0, 5);


  const hasResults =
    matchedPlayers.length > 0 ||
    matchedTeams.length > 0 ||
    matchedLeagues.length > 0 ||
    matchedMatches.length > 0;


  function clearSearch() {
    setQuery("");
  }


  return (
    <div className="global-search">

      <div className="search-input-wrapper">

        <span className="search-icon">
          🔍︎
        </span>

        <input
          type="text"
          placeholder="Search teams, players, leagues..."
          value={query}
          onChange={(event) =>
            setQuery(event.target.value)
          }
        />

        {query && (
          <button
            type="button"
            className="search-clear"
            onClick={clearSearch}
          >
            ×
          </button>
        )}

      </div>


      {searchText && (
        <div className="search-results">

          {!hasResults && (
            <div className="search-empty">
              No results found for "{query}"
            </div>
          )}


          {matchedPlayers.length > 0 && (
            <SearchSection title="Players">

              {matchedPlayers.map((player) => (
                <Link
                  key={player.id}
                  href={`/players/${player.slug}`}
                  className="search-result-item"
                  onClick={clearSearch}
                >

                  <div className="search-result-icon">
                    {player.number}
                  </div>

                  <div className="search-result-details">
                    <strong>{player.name}</strong>

                    <span>
                      {player.team} · {player.position}
                    </span>
                  </div>

                  <span className="search-result-arrow">
                    ›
                  </span>

                </Link>
              ))}

            </SearchSection>
          )}


          {matchedTeams.length > 0 && (
            <SearchSection title="Teams">

              {matchedTeams.map((team) => (
                <Link
                  key={team.id}
                  href={`/teams/${team.slug}`}
                  className="search-result-item"
                  onClick={clearSearch}
                >

                  <div className="search-result-icon">
                    {team.logo ? (
                      <img
                        src={team.logo}
                        alt=""
                      />
                    ) : (
                      team.name.charAt(0)
                    )}
                  </div>

                  <div className="search-result-details">
                    <strong>{team.name}</strong>

                    <span>
                      {team.country} · {team.league}
                    </span>
                  </div>

                  <span className="search-result-arrow">
                    ›
                  </span>

                </Link>
              ))}

            </SearchSection>
          )}


          {matchedLeagues.length > 0 && (
            <SearchSection title="Competitions">

              {matchedLeagues.map((league) => (
                <Link
                  key={league.slug}
                  href={`/leagues/${league.slug}`}
                  className="search-result-item"
                  onClick={clearSearch}
                >

                  <div className="search-result-icon">
                    🏆
                  </div>

                  <div className="search-result-details">
                    <strong>{league.name}</strong>

                    <span>
                      {league.country} · {league.season}
                    </span>
                  </div>

                  <span className="search-result-arrow">
                    ›
                  </span>

                </Link>
              ))}

            </SearchSection>
          )}


          {matchedMatches.length > 0 && (
            <SearchSection title="Matches">

              {matchedMatches.map((match) => (
                <Link
                  key={match.id}
                  href={`/matches/${match.id}`}
                  className="search-result-item"
                  onClick={clearSearch}
                >

                  <div className="search-result-icon">
                    ⚽
                  </div>

                  <div className="search-result-details">
                    <strong>
                      {match.homeTeam} vs {match.awayTeam}
                    </strong>

                    <span>
                      {match.league} ·{" "}
                      {getMatchStatus(match)}
                    </span>
                  </div>

                  <span className="search-result-arrow">
                    ›
                  </span>

                </Link>
              ))}

            </SearchSection>
          )}

        </div>
      )}

    </div>
  );
}


function SearchSection({ title, children }) {
  return (
    <div className="search-section">

      <div className="search-section-title">
        {title}
      </div>

      {children}

    </div>
  );
}


function getMatchStatus(match) {
  if (match.status === "LIVE") {
    return `Live ${match.minute}`;
  }

  if (match.status === "FT") {
    return `${match.homeScore} - ${match.awayScore}`;
  }

  return match.minute;
}