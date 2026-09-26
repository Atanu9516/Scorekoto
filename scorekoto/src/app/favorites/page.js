"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/context/FavoritesContext";
import Icon from "@/components/Icon";

export default function FavoritesPage() {
  const { user } = useAuth();
  const { favorites: localFavorites, loaded: localLoaded } = useFavorites();

  const [dbTeams, setDbTeams] = useState([]);
  const [dbPlayers, setDbPlayers] = useState([]);
  const [dbLeagues, setDbLeagues] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localLoaded) return;

    let mounted = true;
    async function loadFavorites() {
      try {
        setLoading(true);

        const tUrl = user
          ? "/api/favorites/teams"
          : (localFavorites?.teams?.length > 0
              ? `/api/favorites/teams?identifiers=${encodeURIComponent(localFavorites.teams.join(","))}`
              : null);

        const pUrl = user
          ? "/api/favorites/players"
          : (localFavorites?.players?.length > 0
              ? `/api/favorites/players?identifiers=${encodeURIComponent(localFavorites.players.join(","))}`
              : null);

        const lUrl = user
          ? "/api/favorites/leagues"
          : (localFavorites?.leagues?.length > 0
              ? `/api/favorites/leagues?identifiers=${encodeURIComponent(localFavorites.leagues.join(","))}`
              : null);

        const [tRes, pRes, lRes] = await Promise.all([
          tUrl ? fetch(tUrl, { cache: "no-store" }) : Promise.resolve(null),
          pUrl ? fetch(pUrl, { cache: "no-store" }) : Promise.resolve(null),
          lUrl ? fetch(lUrl, { cache: "no-store" }) : Promise.resolve(null),
        ]);

        if (tRes && tRes.ok) {
          const td = await tRes.json();
          if (mounted) setDbTeams(td.favorites || []);
        } else if (mounted && !user) {
          setDbTeams([]);
        }

        if (pRes && pRes.ok) {
          const pd = await pRes.json();
          if (mounted) setDbPlayers(pd.favorites || []);
        } else if (mounted && !user) {
          setDbPlayers([]);
        }

        if (lRes && lRes.ok) {
          const ld = await lRes.json();
          if (mounted) setDbLeagues(ld.favorites || []);
        } else if (mounted && !user) {
          setDbLeagues([]);
        }
      } catch (err) {
        console.error("Error loading favorites:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadFavorites();

    return () => {
      mounted = false;
    };
  }, [user, localLoaded, localFavorites]);

  if (!localLoaded && loading) {
    return (
      <main className="favorites-page">
        <p>Loading favorites...</p>
      </main>
    );
  }

  const favoriteTeams = dbTeams;
  const favoritePlayers = dbPlayers;
  const favoriteLeagues = dbLeagues;

  return (
    <main className="favorites-page">
      <section
        className="page-title"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <h1><Icon name="star" /> Favorites</h1>
          <p>Your followed teams, players, and competitions</p>
        </div>

        {user ? (
          <Link
            href="/profile"
            style={{
              padding: "10px 20px",
              background: "var(--mint)",
              color: "var(--black)",
              fontWeight: "800",
              borderRadius: "999px",
              textDecoration: "none",
              fontSize: "13.5px",
            }}
          >
            + Manage & Add Favorites
          </Link>
        ) : (
          <Link
            href="/login"
            style={{
              padding: "9px 18px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
              fontWeight: "750",
              borderRadius: "999px",
              textDecoration: "none",
              fontSize: "13px",
            }}
          >
            Log in to Sync Favorites Across Devices
          </Link>
        )}
      </section>

      <FavoriteSection title="Teams">
        {loading ? (
          <p className="empty-message">Loading followed teams...</p>
        ) : favoriteTeams.length === 0 ? (
          <EmptyState />
        ) : (
          favoriteTeams.map((team) => (
            <Link
              key={team.team_id || team.id}
              href={`/teams/${team.slug || team.name?.toLowerCase().replaceAll(" ", "-")}`}
              className="favorite-card"
            >
              {team.logo_url || team.logo ? (
                <img
                  src={team.logo_url || team.logo}
                  alt={`${team.name} logo`}
                  className="favorite-card-logo"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div className="favorite-card-placeholder">
                  {team.short_name || team.name?.charAt(0) || "T"}
                </div>
              )}

              <div className="favorite-card-content">
                <strong>{team.name}</strong>
                <span>{team.stadium_name || team.league || "Club"}</span>
              </div>
            </Link>
          ))
        )}
      </FavoriteSection>

      <FavoriteSection title="Players">
        {loading ? (
          <p className="empty-message">Loading followed players...</p>
        ) : favoritePlayers.length === 0 ? (
          <EmptyState />
        ) : (
          favoritePlayers.map((player) => (
            <Link
              key={player.player_id || player.id}
              href={`/players/${player.player_id || player.id}`}
              className="favorite-card"
            >
              {player.photo || player.photo_url ? (
                <img
                  src={player.photo || player.photo_url}
                  alt={player.name}
                  className="favorite-card-logo"
                  style={{ borderRadius: "50%", objectFit: "cover" }}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div className="favorite-card-placeholder">
                  {player.name ? player.name.charAt(0) : "P"}
                </div>
              )}
              <div className="favorite-card-content">
                <strong>{player.name}</strong>
                <span>
                  {player.team_name ? `${player.team_name} · ` : ""}
                  {player.position || "Player"}
                </span>
              </div>
            </Link>
          ))
        )}
      </FavoriteSection>

      <FavoriteSection title="Leagues">
        {loading ? (
          <p className="empty-message">Loading followed leagues...</p>
        ) : favoriteLeagues.length === 0 ? (
          <EmptyState />
        ) : (
          favoriteLeagues.map((league) => (
            <Link
              key={league.league_id || league.slug || league.name}
              href={`/leagues/${league.slug || league.name?.toLowerCase().replaceAll(" ", "-")}`}
              className="favorite-card"
            >
              {league.logo_url ? (
                <img
                  src={league.logo_url}
                  alt={league.name}
                  className="favorite-card-logo"
                  style={{ objectFit: "contain" }}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div className="favorite-card-placeholder"><Icon name="trophy" /></div>
              )}
              <div className="favorite-card-content">
                <strong>{league.name}</strong>
                <span>{league.country || "Country unavailable"}</span>
              </div>
            </Link>
          ))
        )}
      </FavoriteSection>
    </main>
  );
}

function FavoriteSection({ title, children }) {
  return (
    <section className="favorites-section">
      <h2>{title}</h2>
      <div className="favorites-grid">{children}</div>
    </section>
  );
}

function EmptyState() {
  return <p className="empty-message">Nothing added yet.</p>;
}
