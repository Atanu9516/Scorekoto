"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import GlobalSearch from "./GlobalSearch";
import NotificationBell from "./NotificationBell";
import Icon from "./Icon";
import BrandLogo from "./BrandLogo";
import { useAuth } from "@/context/AuthContext";

export default function Navbar() {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();
  const [isDarkMode, setIsDarkMode] = useState(false);

  const primaryLinks = [
    { href: "/", label: "Matches" },
    { href: "/teams", label: "Teams" },
    { href: "/leagues", label: "Leagues" },
    { href: "/favorites", label: "Favorites" },
  ];

  const isActiveLink = (href) => href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);

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
        <BrandLogo />
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
          <Icon name={isDarkMode ? "sun" : "moon"} />
          <span className="theme-toggle-label">{isDarkMode ? "Light" : "Dark"}</span>
        </button>

        <div className="nav-primary-links">
          {primaryLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={isActiveLink(item.href) ? "nav-link-active" : undefined}
              aria-current={isActiveLink(item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {user && (
          <Link href="/profile" className="nav-profile-link">
            <Icon name="user" /> Profile
          </Link>
        )}

        {user?.role === "admin" && (
          <Link href="/admin" className="nav-admin-link">
            <Icon name="shield" /> Admin Panel
          </Link>
        )}

        <div className="nav-auth-section">
          {!loading && (
            user ? (
              <div className="nav-user-info">
                <Link href="/profile" className="nav-user-badge" title="Go to My Profile">
                  <Icon name={user.role === "admin" ? "shield" : "user"} /> {user.username}
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
