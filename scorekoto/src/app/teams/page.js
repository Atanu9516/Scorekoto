"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import FavoriteButton from "@/components/FavoriteButton";

export default function TeamsPage() {
  const [teams, setTeams] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTeams() {
      try {
        setLoading(true);
        const res = await fetch("/api/teams?limit=500");
        if (res.ok) {
          const data = await res.json();
          if (data.teams_data) {
            setTeams(data.teams_data);
          }
        }
      } catch (err) {
        console.error("Failed to load teams:", err);
      } finally {
        setLoading(false);
      }
    }
    loadTeams();
  }, []);

  const filteredTeams = teams.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      (t.short_name && t.short_name.toLowerCase().includes(q))
    );
  });

  return (
    <main className="teams-directory-page">
      <section className="page-title">
        <h1>⚽ Football Teams</h1>
        <p>Explore all {teams.length > 0 ? teams.length : "400+"} clubs in our database</p>

        <div className="teams-search-bar">
          <input
            type="text"
            placeholder="Search teams (e.g. Liverpool, Real Madrid, Arsenal)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </section>

      {loading ? (
        <div className="teams-loading">
          <p>Loading clubs from database...</p>
        </div>
      ) : filteredTeams.length === 0 ? (
        <p className="empty-message">No teams found matching "{search}".</p>
      ) : (
        <div className="teams-grid">
          {filteredTeams.map((team) => (
            <div key={team.team_id} className="team-directory-card">
              <Link
                href={`/teams/${team.slug || team.name.toLowerCase().replaceAll(" ", "-")}`}
                className="team-card-link"
              >
                {team.logo_url ? (
                  <img
                    src={team.logo_url}
                    alt={`${team.name} badge`}
                    className="team-card-logo"
                  />
                ) : (
                  <div className="team-card-placeholder">
                    {team.short_name || team.name.charAt(0)}
                  </div>
                )}

                <div className="team-card-info">
                  <strong>{team.name}</strong>
                  <span>{team.stadium_name || "Stadium"}</span>
                </div>
              </Link>

              <div className="team-card-action">
                <FavoriteButton
                  type="teams"
                  id={team.slug || team.name.toLowerCase().replaceAll(" ", "-")}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
