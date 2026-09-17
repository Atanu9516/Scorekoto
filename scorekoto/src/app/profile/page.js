"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const { user, loading: authLoading, checkAuth } = useAuth();
  const router = useRouter();

  // Profile Form
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState({ type: "", text: "" });

  // Favorites
  const [favoriteTeams, setFavoriteTeams] = useState([]);
  const [favoritePlayers, setFavoritePlayers] = useState([]);
  const [favoriteLeagues, setFavoriteLeagues] = useState([]);
  const [recentReactions, setRecentReactions] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Modal State for "+" Add Favorite
  const [modalType, setModalType] = useState(null); // 'teams' | 'players' | 'leagues' | null
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Load User Profile & Data
  const loadUserData = useCallback(async () => {
    if (!user) return;
    try {
      setLoadingData(true);

      const [profileRes, teamsRes, playersRes, leaguesRes] = await Promise.all([
        fetch("/api/user/profile", { cache: "no-store" }),
        fetch("/api/favorites/teams", { cache: "no-store" }),
        fetch("/api/favorites/players", { cache: "no-store" }),
        fetch("/api/favorites/leagues", { cache: "no-store" }),
      ]);

      if (profileRes.ok) {
        const pData = await profileRes.json();
        setUsername(pData.user?.username || user.username);
        setEmail(pData.user?.email || user.email);
        setRecentReactions(pData.recentReactions || []);
      }

      if (teamsRes.ok) {
        const tData = await teamsRes.json();
        setFavoriteTeams(tData.favorites || []);
      }

      if (playersRes.ok) {
        const plData = await playersRes.json();
        setFavoritePlayers(plData.favorites || []);
      }

      if (leaguesRes.ok) {
        const lData = await leaguesRes.json();
        setFavoriteLeagues(lData.favorites || []);
      }
    } catch (err) {
      console.error("Error loading profile data:", err);
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user, loadUserData]);

  // Save Profile Changes
  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMessage({ type: "", text: "" });

    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email }),
      });

      const data = await res.json();
      if (!res.ok) {
        setProfileMessage({ type: "error", text: data.error || "Failed to update profile." });
      } else {
        setProfileMessage({ type: "success", text: "✓ Profile updated successfully!" });
        checkAuth();
      }
    } catch (err) {
      console.error("Profile save error:", err);
      setProfileMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setProfileSaving(false);
    }
  };

  // Search when modal query changes
  useEffect(() => {
    if (!modalType) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const res = await fetch(`/api/search?type=${modalType}&q=${encodeURIComponent(searchQuery)}&limit=10`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results?.[modalType] || []);
        }
      } catch (err) {
        console.error("Search error in profile modal:", err);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [modalType, searchQuery]);

  // Add Item to Favorites
  const handleAddFavorite = async (item) => {
    if (!modalType) return;
    setActionLoadingId(item.id);

    try {
      const endpoint =
        modalType === "teams"
          ? "/api/favorites/teams"
          : modalType === "players"
          ? "/api/favorites/players"
          : "/api/favorites/leagues";

      const payload =
        modalType === "teams"
          ? { teamId: item.id }
          : modalType === "players"
          ? { playerId: item.id }
          : { leagueId: item.id };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        if (modalType === "teams") {
          setFavoriteTeams((prev) => (prev.some((t) => t.team_id === item.id) ? prev : [...prev, item]));
        } else if (modalType === "players") {
          setFavoritePlayers((prev) => (prev.some((p) => p.player_id === item.id) ? prev : [...prev, item]));
        } else if (modalType === "leagues") {
          setFavoriteLeagues((prev) => (prev.some((l) => l.league_id === item.id) ? prev : [...prev, item]));
        }
        setModalType(null);
        setSearchQuery("");
      }
    } catch (err) {
      console.error("Error adding favorite:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Remove Favorite
  const handleRemoveFavorite = async (type, id) => {
    try {
      if (type === "teams") {
        await fetch(`/api/favorites/teams?teamId=${id}`, { method: "DELETE" });
        setFavoriteTeams((prev) => prev.filter((t) => t.team_id !== id));
      } else if (type === "players") {
        await fetch(`/api/favorites/players?playerId=${id}`, { method: "DELETE" });
        setFavoritePlayers((prev) => prev.filter((p) => p.player_id !== id));
      } else if (type === "leagues") {
        await fetch(`/api/favorites/leagues?leagueId=${id}`, { method: "DELETE" });
        setFavoriteLeagues((prev) => prev.filter((l) => l.league_id !== id));
      }
    } catch (err) {
      console.error("Error removing favorite:", err);
    }
  };

  // Delete Comment / Reaction
  const handleDeleteReaction = async (commentId, matchId) => {
    if (!confirm("Are you sure you want to delete this reaction?")) return;
    try {
      const res = await fetch(`/api/matches/${matchId}/comments?comment_id=${commentId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setRecentReactions((prev) => prev.filter((c) => c.comment_id !== commentId));
      }
    } catch (err) {
      console.error("Error deleting reaction:", err);
    }
  };

  if (authLoading || (!user && !authLoading)) {
    return (
      <main className="user-profile-page">
        <p className="profile-loading">Loading account dashboard...</p>
      </main>
    );
  }

  return (
    <main className="user-profile-page">
      {/* USER HEADER BANNER */}
      <section className="profile-header-card">
        <div className="profile-avatar-box">
          <span className="profile-avatar-emoji">👤</span>
        </div>
        <div className="profile-header-details">
          <div className="profile-name-row">
            <h1>{user.username}</h1>
            <span className={`profile-role-tag ${user.role === "admin" ? "admin" : ""}`}>
              {user.role === "admin" ? "🛡️ Administrator" : "⚽ Football Fan"}
            </span>
          </div>
          <p className="profile-email-text">{user.email}</p>
          <span className="profile-joined-text">
            Member since: {user.created_at ? new Date(user.created_at).toLocaleDateString() : "2026"}
          </span>
        </div>

        {user.role === "admin" && (
          <div className="profile-admin-shortcut">
            <Link href="/admin" className="admin-shortcut-btn">
              🛡️ Go to Admin Console
            </Link>
          </div>
        )}
      </section>

      {/* STATS OVERVIEW */}
      <section className="profile-stats-grid">
        <div className="profile-stat-box">
          <span className="stat-label">Favorite Teams</span>
          <strong className="stat-num">{favoriteTeams.length}</strong>
        </div>
        <div className="profile-stat-box">
          <span className="stat-label">Favorite Players</span>
          <strong className="stat-num">{favoritePlayers.length}</strong>
        </div>
        <div className="profile-stat-box">
          <span className="stat-label">Favorite Leagues</span>
          <strong className="stat-num">{favoriteLeagues.length}</strong>
        </div>
        <div className="profile-stat-box">
          <span className="stat-label">Match Reactions</span>
          <strong className="stat-num">{recentReactions.length}</strong>
        </div>
      </section>

      {/* MAIN TWO-COLUMN DASHBOARD */}
      <div className="profile-layout-grid">
        {/* LEFT COLUMN: EDIT DETAILS & ACTIVITY */}
        <div className="profile-col">
          {/* EDIT ACCOUNT INFORMATION */}
          <section className="profile-card">
            <h2>✏️ Edit Profile Information</h2>
            <p className="profile-card-desc">Update your display name or account email address.</p>

            {profileMessage.text && (
              <div className={`profile-status-banner ${profileMessage.type}`}>
                {profileMessage.text}
              </div>
            )}

            <form onSubmit={handleProfileSave} className="profile-form">
              <div className="profile-field">
                <label htmlFor="p-username">Display Name / Username</label>
                <input
                  id="p-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              <div className="profile-field">
                <label htmlFor="p-email">Email Address</label>
                <input
                  id="p-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <button type="submit" disabled={profileSaving} className="profile-save-btn">
                {profileSaving ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </section>

          {/* USER ACTIVITY: RECENT MATCH REACTIONS */}
          <section className="profile-card">
            <h2>💬 My Match Reactions</h2>
            <p className="profile-card-desc">Comments and reactions you posted during football matches.</p>

            {loadingData ? (
              <p className="profile-dim-text">Loading match reactions...</p>
            ) : recentReactions.length === 0 ? (
              <p className="profile-empty-text">No match reactions posted yet. Join the discussion on match pages!</p>
            ) : (
              <div className="profile-reactions-list">
                {recentReactions.map((r) => (
                  <div key={r.comment_id} className="profile-reaction-item">
                    <div className="reaction-meta-row">
                      <span className="reaction-badge">{r.reaction || "⚽"}</span>
                      <Link href={`/matches/${r.match_id}`} className="reaction-match-link">
                        {r.home_team && r.away_team ? `${r.home_team} vs ${r.away_team}` : `Match #${r.match_id}`}
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDeleteReaction(r.comment_id, r.match_id)}
                        className="reaction-delete-btn"
                        title="Delete reaction"
                      >
                        🗑️
                      </button>
                    </div>
                    <p className="reaction-text">{r.comment_text}</p>
                    <span className="reaction-date">
                      {r.created_at ? new Date(r.created_at).toLocaleString() : "Recently"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN: FAVORITES MANAGEMENT WITH + BUTTONS */}
        <div className="profile-col">
          {/* FAVORITE TEAMS */}
          <section className="profile-card">
            <div className="profile-card-header">
              <h2>⭐ Favorite Teams ({favoriteTeams.length})</h2>
              <button
                type="button"
                className="profile-add-btn"
                onClick={() => {
                  setModalType("teams");
                  setSearchQuery("");
                }}
                title="Add a new favorite team"
              >
                + Add Team
              </button>
            </div>

            {loadingData ? (
              <p className="profile-dim-text">Loading followed teams...</p>
            ) : favoriteTeams.length === 0 ? (
              <div className="profile-empty-box">
                <p>You haven&apos;t added any favorite teams yet.</p>
                <button
                  type="button"
                  className="profile-outline-btn"
                  onClick={() => {
                    setModalType("teams");
                    setSearchQuery("");
                  }}
                >
                  + Add Your Club
                </button>
              </div>
            ) : (
              <div className="profile-fav-list">
                {favoriteTeams.map((team) => (
                  <div key={team.team_id || team.id} className="profile-fav-row">
                    <Link href={`/teams/${team.slug || team.name.toLowerCase().replaceAll(" ", "-")}`} className="fav-row-link">
                      {team.logo_url || team.logo ? (
                        <img src={team.logo_url || team.logo} alt={team.name} className="fav-row-img" />
                      ) : (
                        <div className="fav-row-placeholder">{team.name?.charAt(0)}</div>
                      )}
                      <div>
                        <strong>{team.name}</strong>
                        <span>{team.stadium_name || "Stadium"}</span>
                      </div>
                    </Link>
                    <button
                      type="button"
                      className="fav-remove-btn"
                      onClick={() => handleRemoveFavorite("teams", team.team_id || team.id)}
                      title="Remove from favorites"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* FAVORITE PLAYERS */}
          <section className="profile-card">
            <div className="profile-card-header">
              <h2>🏃 Favorite Players ({favoritePlayers.length})</h2>
              <button
                type="button"
                className="profile-add-btn"
                onClick={() => {
                  setModalType("players");
                  setSearchQuery("");
                }}
                title="Add a new favorite player"
              >
                + Add Player
              </button>
            </div>

            {loadingData ? (
              <p className="profile-dim-text">Loading followed players...</p>
            ) : favoritePlayers.length === 0 ? (
              <div className="profile-empty-box">
                <p>You haven&apos;t added any favorite players yet.</p>
                <button
                  type="button"
                  className="profile-outline-btn"
                  onClick={() => {
                    setModalType("players");
                    setSearchQuery("");
                  }}
                >
                  + Add Player
                </button>
              </div>
            ) : (
              <div className="profile-fav-list">
                {favoritePlayers.map((player) => (
                  <div key={player.player_id || player.id} className="profile-fav-row">
                    <Link href={`/players/${player.slug}`} className="fav-row-link">
                      {player.photo_url || player.photo ? (
                        <img src={player.photo_url || player.photo} alt={player.name} className="fav-row-img player-avatar-img" />
                      ) : (
                        <div className="fav-row-placeholder player-avatar-ph">
                          {player.name ? player.name.charAt(0) : "P"}
                        </div>
                      )}
                      <div>
                        <strong>{player.name}</strong>
                        <span>{player.team_name ? `${player.team_name} · ` : ""}{player.position || "Player"}</span>
                      </div>
                    </Link>
                    <button
                      type="button"
                      className="fav-remove-btn"
                      onClick={() => handleRemoveFavorite("players", player.player_id || player.id)}
                      title="Remove from favorites"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* FAVORITE LEAGUES */}
          <section className="profile-card">
            <div className="profile-card-header">
              <h2>🏆 Favorite Leagues ({favoriteLeagues.length})</h2>
              <button
                type="button"
                className="profile-add-btn"
                onClick={() => {
                  setModalType("leagues");
                  setSearchQuery("");
                }}
                title="Add a new favorite league"
              >
                + Add League
              </button>
            </div>

            {loadingData ? (
              <p className="profile-dim-text">Loading followed leagues...</p>
            ) : favoriteLeagues.length === 0 ? (
              <div className="profile-empty-box">
                <p>You haven&apos;t added any favorite leagues yet.</p>
                <button
                  type="button"
                  className="profile-outline-btn"
                  onClick={() => {
                    setModalType("leagues");
                    setSearchQuery("");
                  }}
                >
                  + Add League
                </button>
              </div>
            ) : (
              <div className="profile-fav-list">
                {favoriteLeagues.map((league) => (
                  <div key={league.league_id || league.id} className="profile-fav-row">
                    <Link href={`/leagues/${league.slug || league.name.toLowerCase().replaceAll(" ", "-")}`} className="fav-row-link">
                      <div className="fav-row-placeholder">🏆</div>
                      <div>
                        <strong>{league.name}</strong>
                        <span>{league.country || "Global Competition"}</span>
                      </div>
                    </Link>
                    <button
                      type="button"
                      className="fav-remove-btn"
                      onClick={() => handleRemoveFavorite("leagues", league.league_id || league.id)}
                      title="Remove from favorites"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* INTERACTIVE SEARCH & ADD MODAL */}
      {modalType && (
        <div className="profile-modal-overlay" onClick={() => setModalType(null)}>
          <div className="profile-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-header">
              <h3>
                + Add Favorite {modalType === "teams" ? "Team" : modalType === "players" ? "Player" : "League"}
              </h3>
              <button type="button" className="modal-close-btn" onClick={() => setModalType(null)}>
                ×
              </button>
            </div>

            <div className="profile-modal-search">
              <input
                type="text"
                autoFocus
                placeholder={`Search ${modalType} from database (e.g. ${
                  modalType === "teams" ? "Arsenal, Liverpool, Barcelona" : modalType === "players" ? "Salah, Messi, Bellingham" : "Premier League, La Liga"
                })...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="profile-modal-results">
              {searching ? (
                <p className="modal-status">Searching database...</p>
              ) : searchResults.length === 0 ? (
                <p className="modal-status">
                  {searchQuery.trim() ? `No ${modalType} found matching "${searchQuery}".` : `Start typing to search ${modalType}...`}
                </p>
              ) : (
                searchResults.map((item) => (
                  <div key={item.id} className="modal-result-item">
                    <div className="result-info">
                      <strong>{item.name}</strong>
                      <span>
                        {modalType === "teams"
                          ? item.stadium_name || item.short_name || "Club"
                          : modalType === "players"
                          ? `${item.position || "Player"} · ${item.nationality || item.team_name || "Football"}`
                          : item.country || "Competition"}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={actionLoadingId === item.id}
                      onClick={() => handleAddFavorite(item)}
                      className="modal-add-action-btn"
                    >
                      {actionLoadingId === item.id ? "Adding..." : "+ Add"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

