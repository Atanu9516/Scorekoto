"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import GlobalSearch from "./GlobalSearch";
import NotificationBell from "./NotificationBell";
import { useAuth } from "@/context/AuthContext";

export default function Navbar() {
  const { user, logout, loading } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("scorekoto-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldUseDarkMode = savedTheme ? savedTheme === "dark" : prefersDark;

    setIsDarkMode(shouldUseDarkMode);
    document.documentElement.dataset.theme = shouldUseDarkMode ? "dark" : "light";
  }, []);

  function toggleTheme() {
    const nextIsDarkMode = !isDarkMode;
    setIsDarkMode(nextIsDarkMode);
    document.documentElement.dataset.theme = nextIsDarkMode ? "dark" : "light";
    window.localStorage.setItem("scorekoto-theme", nextIsDarkMode ? "dark" : "light");
  }

  return (
    <nav className="navbar">
      <Link href="/" className="navbar-logo">
        Scoreকত?
      </Link>

      <div className="nav-links">
        <GlobalSearch />

        <NotificationBell />

        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
          title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          <span aria-hidden="true">{isDarkMode ? "☀" : "☾"}</span>
          <span className="theme-toggle-label">{isDarkMode ? "Light" : "Dark"}</span>
        </button>

        <Link href="/">
          Matches
        </Link>

        <Link href="/teams">
          Teams
        </Link>

        <Link href="/leagues">
          Leagues
        </Link>

        <Link href="/favorites">
          Favorites
        </Link>

        {user && (
          <Link href="/profile" className="nav-profile-link">
            👤 Profile
          </Link>
        )}

        {user?.role === "admin" && (
          <Link href="/admin" className="nav-admin-link">
            🛡️ Admin Panel
          </Link>
        )}

        <div className="nav-auth-section">
          {!loading && (
            user ? (
              <div className="nav-user-info">
                <Link href="/profile" className="nav-user-badge" title="Go to My Profile">
                  {user.role === "admin" ? "🛡️" : "👤"} {user.username}
                </Link>
                <button
                  onClick={logout}
                  className="nav-logout-btn"
                  title="Log out"
                >
                  Log out
                </button>
              </div>
            ) : (
              <div className="nav-auth-actions">
                <Link href="/login" className="nav-login-link">
                  Log in
                </Link>
                <Link href="/register" className="nav-register-btn">
                  Sign up
                </Link>
              </div>
            )
          )}
        </div>
      </div>
    </nav>
  );
}