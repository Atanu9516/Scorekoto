"use client";

import Link from "next/link";
import GlobalSearch from "./GlobalSearch";
import NotificationBell from "./NotificationBell";
import { useAuth } from "@/context/AuthContext";

export default function Navbar() {
  const { user, logout, loading } = useAuth();

  return (
    <nav className="navbar">
      <Link href="/" className="navbar-logo">
        Scoreকত?
      </Link>

      <div className="nav-links">
        <GlobalSearch />

        <NotificationBell />

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

        {user?.role === "admin" && (
          <Link href="/admin" className="nav-admin-link">
            🛡️ Admin Panel
          </Link>
        )}

        <div className="nav-auth-section">
          {!loading && (
            user ? (
              <div className="nav-user-info">
                <span className="nav-user-badge">
                  {user.role === "admin" ? "🛡️" : "👤"} {user.username}
                </span>
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