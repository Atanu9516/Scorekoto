"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import Icon from "./Icon";

const emptySidebarData = {
  topTeams: [],
  topLeagues: [],
  favorites: {
    teams: [],
    leagues: [],
    players: [],
  },
};

function CollapseIcon({ isCollapsed }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6h16M4 12h10M4 18h16" />
      <path d={isCollapsed ? "m16 9 3 3-3 3" : "m17 9-3 3 3 3"} />
    </svg>
  );
}

function SidebarImage({ src, label, type }) {
  const fallbackIcon = type === "league" ? "trophy" : type === "player" ? "player" : "shield";

  return (
    <span className={`sidebar-entity-image ${type === "player" ? "player-image" : ""}`}>
      {src && (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = "none";
            const fallback = event.currentTarget.nextElementSibling;
            if (fallback) fallback.style.display = "grid";
          }}
        />
      )}
      <span
        className="sidebar-image-fallback"
        style={{ display: src ? "none" : "grid" }}
        aria-hidden="true"
      >
        <Icon name={fallbackIcon} />
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

function SidebarEntry({ href, label, image, type, meta, isCollapsed }) {
  return (
    <Link href={href} title={isCollapsed ? label : undefined}>
      <SidebarImage src={image} label={label} type={type} />
      <span className="sidebar-link-copy">
        <span className="sidebar-link-label">{label}</span>
        {meta && <small>{meta}</small>}
      </span>
    </Link>
  );
}

function SidebarGroup({ title, items, isCollapsed, emptyState }) {
  return (
    <div className="sidebar-group">
      <h3>{title}</h3>
      {items.map((item) => (
        <SidebarEntry {...item} isCollapsed={isCollapsed} key={item.key} />
      ))}
      {items.length === 0 && emptyState}
    </div>
  );
}

function SidebarLoading() {
  return (
    <div className="sidebar-loading" aria-label="Loading sidebar links">
      {[0, 1, 2].map((item) => (
        <span key={item}>
          <i />
          <b />
        </span>
      ))}
    </div>
  );
}

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sidebarData, setSidebarData] = useState(emptySidebarData);
  const [isLoading, setIsLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;

    let isActive = true;

    async function loadSidebar() {
      try {
        const response = await fetch("/api/sidebar", { cache: "no-store" });
        if (!response.ok) throw new Error("Sidebar request failed");

        const data = await response.json();
        if (isActive) {
          setSidebarData({
            topTeams: data.topTeams || [],
            topLeagues: data.topLeagues || [],
            favorites: data.favorites || emptySidebarData.favorites,
          });
        }
      } catch (error) {
        console.error("Failed to load sidebar:", error);
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    loadSidebar();
    window.addEventListener("scorekoto:favorites-updated", loadSidebar);

    return () => {
      isActive = false;
      window.removeEventListener("scorekoto:favorites-updated", loadSidebar);
    };
  }, [authLoading, user?.user_id]);

  const topTeams = sidebarData.topTeams.map((team) => ({
    key: `top-team-${team.team_id}`,
    href: `/teams/${team.slug || team.team_id}`,
    label: team.name,
    image: team.logo_url,
    type: "team",
    meta: team.short_name || "Team",
  }));

  const topLeagues = sidebarData.topLeagues.map((league) => ({
    key: `top-league-${league.league_id}`,
    href: `/leagues/${league.slug || league.league_id}`,
    label: league.name,
    image: league.logo_url,
    type: "league",
    meta: league.country || "Competition",
  }));

  const favoriteItems = [
    ...(sidebarData.favorites.teams || []).map((team) => ({
      key: `favorite-team-${team.team_id}`,
      href: `/teams/${team.slug || team.team_id}`,
      label: team.name,
      image: team.logo_url,
      type: "team",
      meta: "Team",
    })),
    ...(sidebarData.favorites.leagues || []).map((league) => ({
      key: `favorite-league-${league.league_id}`,
      href: `/leagues/${league.slug || league.league_id}`,
      label: league.name,
      image: league.logo_url,
      type: "league",
      meta: "League",
    })),
    ...(sidebarData.favorites.players || []).map((player) => ({
      key: `favorite-player-${player.player_id}`,
      href: `/players/${player.player_id}`,
      label: player.name,
      image: player.photo_url,
      type: "player",
      meta: "Player",
    })),
  ];

  const favoritesEmptyState = user ? (
    <Link
      href="/favorites"
      className="sidebar-empty-link"
      title={isCollapsed ? "Add favourites" : undefined}
    >
      <span className="sidebar-empty-icon"><Icon name="star" /></span>
      <span className="sidebar-link-copy">
        <span className="sidebar-link-label">Add favourites</span>
        <small>Your saved items appear here</small>
      </span>
    </Link>
  ) : (
    <Link
      href="/login"
      className="sidebar-empty-link"
      title={isCollapsed ? "Sign in for favourites" : undefined}
    >
      <span className="sidebar-empty-icon"><Icon name="user" /></span>
      <span className="sidebar-link-copy">
        <span className="sidebar-link-label">Sign in for favourites</span>
        <small>Teams, leagues and players</small>
      </span>
    </Link>
  );

  return (
    <aside
      className={`sidebar${isCollapsed ? " sidebar-collapsed" : ""}`}
      aria-busy={isLoading}
    >
      <div className="sidebar-controls">
        <span className="sidebar-controls-label">Explore</span>
        <button
          className="sidebar-toggle"
          type="button"
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setIsCollapsed((collapsed) => !collapsed)}
        >
          <CollapseIcon isCollapsed={isCollapsed} />
        </button>
      </div>

      <nav className="sidebar-navigation" aria-label="Football navigation">
        {isLoading ? (
          <SidebarLoading />
        ) : (
          <>
            <SidebarGroup title="Top Teams" items={topTeams} isCollapsed={isCollapsed} />
            <SidebarGroup title="Top Leagues" items={topLeagues} isCollapsed={isCollapsed} />
            <SidebarGroup
              title="Favourites"
              items={favoriteItems}
              isCollapsed={isCollapsed}
              emptyState={favoritesEmptyState}
            />
          </>
        )}
      </nav>
    </aside>
  );
}
