"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState("matches"); // "matches" | "teams" | "players"
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: "", text: "" });

  // Form State for editing
  const [formData, setFormData] = useState({});

  // Fetch items based on activeTab and search
  const fetchItems = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setLoadingItems(true);
      const res = await fetch(`/api/admin/search?type=${activeTab}&q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.results || []);
        if (data.results && data.results.length > 0) {
          // Select first item by default if none selected or tab changed
          if (!selectedItem || !data.results.some(r => getItemId(r, activeTab) === getItemId(selectedItem, activeTab))) {
            selectItem(data.results[0]);
          }
        } else {
          setSelectedItem(null);
          setFormData({});
        }
      }
    } catch (err) {
      console.error("Failed to load admin items:", err);
    } finally {
      setLoadingItems(false);
    }
  }, [activeTab, searchQuery, isAdmin]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const getItemId = (item, tab) => {
    if (!item) return null;
    if (tab === "matches") return item.match_id;
    if (tab === "teams") return item.team_id;
    if (tab === "players") return item.player_id;
    return null;
  };

  const selectItem = (item) => {
    setSelectedItem(item);
    setStatusMessage({ type: "", text: "" });
    if (activeTab === "matches") {
      setFormData({
        home_score: item.home_score ?? 0,
        away_score: item.away_score ?? 0,
        status: item.status || "FT",
        venue: item.venue || "",
        match_date: item.match_date ? new Date(item.match_date).toISOString().slice(0, 16) : "",
        home_possession: item.home_possession ?? 50,
        away_possession: item.away_possession ?? 50,
      });
    } else if (activeTab === "teams") {
      setFormData({
        name: item.name || "",
        short_name: item.short_name || "",
        stadium_name: item.stadium_name || "",
        manager_name: item.manager_name || "",
        history: item.history || "",
        logo_url: item.logo_url || "",
      });
    } else if (activeTab === "players") {
      setFormData({
        first_name: item.first_name || "",
        last_name: item.last_name || "",
        primary_position: item.primary_position || "Midfielder",
        nationality: item.nationality || "",
        date_of_birth: item.date_of_birth ? new Date(item.date_of_birth).toISOString().slice(0, 10) : "",
        market_value_euros: item.market_value_euros ?? 0,
        weight_cm: item.weight_cm ?? 0,
        photo_url: item.photo_url || "",
        team_id: item.team_id ?? 1,
      });
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;

    const id = getItemId(selectedItem, activeTab);
    setIsSaving(true);
    setStatusMessage({ type: "", text: "" });

    try {
      const res = await fetch(`/api/admin/${activeTab}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        setStatusMessage({ type: "error", text: data.error || "Failed to update record in PostgreSQL." });
      } else {
        setStatusMessage({
          type: "success",
          text: `✓ ${activeTab.slice(0, -1).toUpperCase()} ID #${id} successfully updated in PostgreSQL database!`,
        });
        // Update item in local list
        setItems((prev) =>
          prev.map((item) => (getItemId(item, activeTab) === id ? { ...item, ...formData } : item))
        );
      }
    } catch (err) {
      console.error("Error saving record:", err);
      setStatusMessage({ type: "error", text: "Network error while saving to database." });
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading) {
    return (
      <main className="admin-page">
        <p className="admin-loading">Checking administrator privileges...</p>
      </main>
    );
  }

  // Access Denied if not admin
  if (!user || !isAdmin) {
    return (
      <main className="admin-page">
        <div className="admin-denied-box">
          <div className="denied-icon">🛡️</div>
          <h2>Administrator Access Required</h2>
          <p>
            You must be logged in with an administrator account to view and modify the Scorekoto PostgreSQL database.
          </p>
          <div className="denied-actions">
            <Link href="/login" className="admin-login-btn">
              Go to Admin Login
            </Link>
            <Link href="/" className="admin-home-btn">
              Return to Matches
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-page">
      {/* ADMIN HEADER */}
      <section className="admin-header-section">
        <div>
          <span className="admin-badge-pill">🛡️ PostgreSQL Administrator Portal</span>
          <h1>Database Management Console</h1>
          <p>Direct SQL modification access for matches, teams, and player records</p>
        </div>

        <div className="admin-user-tag">
          <span>Logged in as:</span>
          <strong>@{user.username} (Admin)</strong>
        </div>
      </section>

      {/* ADMIN TABS */}
      <div className="admin-tabs">
        <button
          className={`admin-tab-btn ${activeTab === "matches" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("matches");
            setSearchQuery("");
            setSelectedItem(null);
          }}
        >
          ⚽ Edit Matches (10,526 in DB)
        </button>

        <button
          className={`admin-tab-btn ${activeTab === "teams" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("teams");
            setSearchQuery("");
            setSelectedItem(null);
          }}
        >
          🛡️ Edit Teams (462 in DB)
        </button>

        <button
          className={`admin-tab-btn ${activeTab === "players" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("players");
            setSearchQuery("");
            setSelectedItem(null);
          }}
        >
          🏃 Edit Players (6,993 in DB)
        </button>
      </div>

      {/* ADMIN WORKSPACE: Left List + Right Editor */}
      <div className="admin-workspace">
        {/* LEFT PANEL: SEARCH & SELECT LIST */}
        <aside className="admin-list-panel">
          <div className="admin-search-box">
            <input
              type="text"
              placeholder={
                activeTab === "matches"
                  ? "Search by club name or match ID..."
                  : activeTab === "teams"
                  ? "Search by team name or code..."
                  : "Search by player name or team..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="admin-search-input"
            />
          </div>

          <div className="admin-items-list">
            {loadingItems ? (
              <p className="admin-items-loading">Loading records from PostgreSQL...</p>
            ) : items.length === 0 ? (
              <p className="admin-items-empty">No records found matching "{searchQuery}"</p>
            ) : (
              items.map((item) => {
                const id = getItemId(item, activeTab);
                const isSelected = selectedItem && getItemId(selectedItem, activeTab) === id;

                return (
                  <div
                    key={id}
                    className={`admin-list-item ${isSelected ? "selected" : ""}`}
                    onClick={() => selectItem(item)}
                  >
                    {activeTab === "matches" && (
                      <>
                        <div className="item-title">
                          <strong>{item.home_team}</strong> vs <strong>{item.away_team}</strong>
                        </div>
                        <div className="item-sub">
                          <span className="item-id">ID: #{item.match_id}</span>
                          <span className="item-score">{item.home_score} - {item.away_score}</span>
                          <span className="item-status">{item.status}</span>
                        </div>
                      </>
                    )}

                    {activeTab === "teams" && (
                      <>
                        <div className="item-title">
                          <strong>{item.name}</strong> ({item.short_name || "---"})
                        </div>
                        <div className="item-sub">
                          <span className="item-id">ID: #{item.team_id}</span>
                          <span>{item.stadium_name || "Stadium"}</span>
                        </div>
                      </>
                    )}

                    {activeTab === "players" && (
                      <>
                        <div className="item-title">
                          <strong>{item.first_name} {item.last_name}</strong>
                        </div>
                        <div className="item-sub">
                          <span className="item-id">ID: #{item.player_id}</span>
                          <span>{item.primary_position}</span>
                          <span>{item.team_name}</span>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* RIGHT PANEL: ATTRIBUTE EDITOR FORM */}
        <section className="admin-editor-panel">
          {!selectedItem ? (
            <div className="admin-no-selection">
              <span className="icon">👈</span>
              <p>Select a record from the left panel to edit its database attributes</p>
            </div>
          ) : (
            <form onSubmit={handleSave} className="admin-edit-form">
              <div className="editor-top-bar">
                <h2>
                  Editing {activeTab.slice(0, -1).toUpperCase()} #{getItemId(selectedItem, activeTab)}
                </h2>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="admin-save-btn"
                >
                  {isSaving ? "Saving to PostgreSQL..." : "💾 Save Changes to Database"}
                </button>
              </div>

              {statusMessage.text && (
                <div className={`admin-status-banner ${statusMessage.type}`}>
                  {statusMessage.text}
                </div>
              )}

              {/* MATCH ATTRIBUTES */}
              {activeTab === "matches" && (
                <div className="form-grid">
                  <div className="form-group">
                    <label>Home Score</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.home_score ?? 0}
                      onChange={(e) => handleInputChange("home_score", e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Away Score</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.away_score ?? 0}
                      onChange={(e) => handleInputChange("away_score", e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Match Status</label>
                    <select
                      value={formData.status || "FT"}
                      onChange={(e) => handleInputChange("status", e.target.value)}
                    >
                      <option value="FT">FT (Full Time)</option>
                      <option value="LIVE">LIVE (In Play)</option>
                      <option value="UPCOMING">UPCOMING (Scheduled)</option>
                      <option value="HT">HT (Half Time)</option>
                      <option value="AET">AET (After Extra Time)</option>
                      <option value="PEN">PEN (Penalties)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Venue / Stadium</label>
                    <input
                      type="text"
                      value={formData.venue || ""}
                      onChange={(e) => handleInputChange("venue", e.target.value)}
                      placeholder="e.g. Anfield, Santiago Bernabéu"
                    />
                  </div>

                  <div className="form-group">
                    <label>Match Date & Time</label>
                    <input
                      type="datetime-local"
                      value={formData.match_date || ""}
                      onChange={(e) => handleInputChange("match_date", e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Home Possession (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.home_possession ?? 50}
                      onChange={(e) => handleInputChange("home_possession", e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Away Possession (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.away_possession ?? 50}
                      onChange={(e) => handleInputChange("away_possession", e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* TEAM ATTRIBUTES */}
              {activeTab === "teams" && (
                <div className="form-grid">
                  <div className="form-group full-width">
                    <label>Club Name</label>
                    <input
                      type="text"
                      value={formData.name || ""}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Short Name / Code</label>
                    <input
                      type="text"
                      value={formData.short_name || ""}
                      onChange={(e) => handleInputChange("short_name", e.target.value)}
                      placeholder="e.g. LIV, RMA, ARS"
                    />
                  </div>

                  <div className="form-group">
                    <label>Stadium Name</label>
                    <input
                      type="text"
                      value={formData.stadium_name || ""}
                      onChange={(e) => handleInputChange("stadium_name", e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Manager Name</label>
                    <input
                      type="text"
                      value={formData.manager_name || ""}
                      onChange={(e) => handleInputChange("manager_name", e.target.value)}
                    />
                  </div>

                  <div className="form-group full-width">
                    <label>Logo CDN URL</label>
                    <input
                      type="url"
                      value={formData.logo_url || ""}
                      onChange={(e) => handleInputChange("logo_url", e.target.value)}
                      placeholder="https://media.api-sports.io/football/teams/40.png"
                    />
                  </div>

                  <div className="form-group full-width">
                    <label>Club History</label>
                    <textarea
                      rows="4"
                      value={formData.history || ""}
                      onChange={(e) => handleInputChange("history", e.target.value)}
                      placeholder="Enter history and background of the club..."
                    />
                  </div>
                </div>
              )}

              {/* PLAYER ATTRIBUTES */}
              {activeTab === "players" && (
                <div className="form-grid">
                  <div className="form-group">
                    <label>First Name</label>
                    <input
                      type="text"
                      value={formData.first_name || ""}
                      onChange={(e) => handleInputChange("first_name", e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Last Name</label>
                    <input
                      type="text"
                      value={formData.last_name || ""}
                      onChange={(e) => handleInputChange("last_name", e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Primary Position</label>
                    <select
                      value={formData.primary_position || "Midfielder"}
                      onChange={(e) => handleInputChange("primary_position", e.target.value)}
                    >
                      <option value="Goalkeeper">Goalkeeper</option>
                      <option value="Defender">Defender</option>
                      <option value="Midfielder">Midfielder</option>
                      <option value="Attacker">Attacker</option>
                      <option value="Forward">Forward</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Nationality</label>
                    <input
                      type="text"
                      value={formData.nationality || ""}
                      onChange={(e) => handleInputChange("nationality", e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Date of Birth</label>
                    <input
                      type="date"
                      value={formData.date_of_birth || ""}
                      onChange={(e) => handleInputChange("date_of_birth", e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Market Value (€)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.market_value_euros ?? 0}
                      onChange={(e) => handleInputChange("market_value_euros", e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Weight / Height (cm)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.weight_cm ?? 0}
                      onChange={(e) => handleInputChange("weight_cm", e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Assigned Team ID</label>
                    <input
                      type="number"
                      value={formData.team_id ?? 1}
                      onChange={(e) => handleInputChange("team_id", e.target.value)}
                    />
                  </div>

                  <div className="form-group full-width">
                    <label>Photo URL</label>
                    <input
                      type="url"
                      value={formData.photo_url || ""}
                      onChange={(e) => handleInputChange("photo_url", e.target.value)}
                      placeholder="https://media.api-sports.io/football/players/306.png"
                    />
                  </div>
                </div>
              )}
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
