"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Icon from "./Icon";

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ teams: [], players: [], leagues: [], matches: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults({ teams: [], players: [], leagues: [], matches: [] });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const handler = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || { teams: [], players: [], leagues: [], matches: [] });
        }
      } catch (err) {
        console.error("Global search error:", err);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(handler);
  }, [query]);

  // Handle clicking outside to close results dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasResults =
    (results.players?.length || 0) > 0 ||
    (results.teams?.length || 0) > 0 ||
    (results.leagues?.length || 0) > 0 ||
    (results.matches?.length || 0) > 0;

  function clearSearch() {
    setQuery("");
    setResults({ teams: [], players: [], leagues: [], matches: [] });
    setIsOpen(false);
  }

  return (
    <div className="global-search" ref={searchRef}>
      <div className="search-input-wrapper">
        <Icon name="search" className="search-icon" />
        <input
          type="text"
          placeholder="Search teams, players, leagues, matches..."
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
        />
        {query && (
          <button
            type="button"
            className="search-clear"
            onClick={clearSearch}
            aria-label="Clear search"
          >
            <Icon name="close" />
          </button>
        )}
      </div>

      {isOpen && query.trim().length > 0 && (
        <div className="search-results">
          {isLoading && (
            <div className="search-empty">Searching Scoreকত? database...</div>
          )}

          {!isLoading && !hasResults && (
            <div className="search-empty">
              No results found for &quot;{query}&quot;
            </div>
          )}

          {!isLoading && results.players?.length > 0 && (
            <SearchSection title="Players">
              {results.players.map((player) => (
                <Link
                  key={player.id}
                  href={`/players/${player.id}`}
                  className="search-result-item"
                  onClick={clearSearch}
                >
                  <div className="search-result-icon">
                    {player.photo ? (
                      <img src={player.photo} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
                    ) : (
                      <Icon name="player" />
                    )}
                  </div>
                  <div className="search-result-details">
                    <strong>{player.name}</strong>
                    <span>
                      {player.team_name || player.nationality || "Details unavailable"} · {player.position || "Position unavailable"}
                    </span>
                  </div>
                  <Icon name="chevronRight" className="search-result-arrow" />
                </Link>
              ))}
            </SearchSection>
          )}

          {!isLoading && results.teams?.length > 0 && (
            <SearchSection title="Teams">
              {results.teams.map((team) => (
                <Link
                  key={team.id}
                  href={`/teams/${team.slug || team.id}`}
                  className="search-result-item"
                  onClick={clearSearch}
                >
                  <div className="search-result-icon">
                    {team.logo_url ? (
                      <img src={team.logo_url} alt="" style={{ width: 26, height: 26, objectFit: "contain" }} />
                    ) : (
                      team.name.charAt(0)
                    )}
                  </div>
                  <div className="search-result-details">
                    <strong>{team.name}</strong>
                    <span>
                      {team.short_name || "Club"} {team.stadium_name ? `· ${team.stadium_name}` : ""}
                    </span>
                  </div>
                  <Icon name="chevronRight" className="search-result-arrow" />
                </Link>
              ))}
            </SearchSection>
          )}

          {!isLoading && results.leagues?.length > 0 && (
            <SearchSection title="Competitions">
              {results.leagues.map((league) => (
                <Link
                  key={league.id}
                  href={`/leagues/${league.slug || league.id}`}
                  className="search-result-item"
                  onClick={clearSearch}
                >
                  <div className="search-result-icon">
                    {league.logo_url ? (
                      <img src={league.logo_url} alt="" style={{ width: 24, height: 24, objectFit: "contain" }} />
                    ) : (
                      <Icon name="trophy" />
                    )}
                  </div>
                  <div className="search-result-details">
                    <strong>{league.name}</strong>
                    <span>{league.country || "Country unavailable"}</span>
                  </div>
                  <Icon name="chevronRight" className="search-result-arrow" />
                </Link>
              ))}
            </SearchSection>
          )}

          {!isLoading && results.matches?.length > 0 && (
            <SearchSection title="Matches">
              {results.matches.map((match) => (
                <Link
                  key={match.id}
                  href={`/matches/${match.id}`}
                  className="search-result-item"
                  onClick={clearSearch}
                >
                  <div className="search-result-icon"><Icon name="football" /></div>
                  <div className="search-result-details">
                    <strong>
                      {match.homeTeam} vs {match.awayTeam}
                    </strong>
                    <span>
                      {match.league || "Match"} ·{" "}
                      {match.status === "LIVE"
                        ? `LIVE ${match.homeScore} - ${match.awayScore}`
                        : match.status === "FT"
                        ? `FT ${match.homeScore} - ${match.awayScore}`
                        : match.status || "Upcoming"}
                    </span>
                  </div>
                  <Icon name="chevronRight" className="search-result-arrow" />
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
      <div className="search-section-title">{title}</div>
      {children}
    </div>
  );
}
