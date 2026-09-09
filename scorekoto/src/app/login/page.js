"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { login, user } = useAuth();

  const [loginRole, setLoginRole] = useState("user"); // "user" | "admin"
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already logged in, redirect inside useEffect
  useEffect(() => {
    if (user) {
      if (user.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/");
      }
    }
  }, [user, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!identifier.trim() || !password) {
      setError("Please enter your username/email and password.");
      return;
    }

    setIsSubmitting(true);
    const result = await login(identifier, password, loginRole);
    setIsSubmitting(false);

    if (result.success) {
      if (result.user?.role === "admin" || loginRole === "admin") {
        router.push("/admin");
      } else {
        router.push("/");
      }
      router.refresh();
    } else {
      setError(result.error || "Invalid username/email or password.");
    }
  };

  return (
    <main className="auth-page-container">
      <div className="auth-card">
        {/* Role Selector Tabs */}
        <div className="auth-role-tabs">
          <button
            type="button"
            className={`auth-role-tab ${loginRole === "user" ? "active" : ""}`}
            onClick={() => {
              setLoginRole("user");
              setError("");
            }}
          >
            👤 User Login
          </button>
          <button
            type="button"
            className={`auth-role-tab ${loginRole === "admin" ? "active" : ""}`}
            onClick={() => {
              setLoginRole("admin");
              setError("");
            }}
          >
            🛡️ Admin Login
          </button>
        </div>

        <div className="auth-header">
          <div className="auth-logo-badge">
            {loginRole === "admin" ? "🛡️" : "⚽"}
          </div>
          <h1>{loginRole === "admin" ? "Admin Database Portal" : "Welcome Back"}</h1>
          <p>
            {loginRole === "admin"
              ? "Sign in with administrator credentials to manage matches, teams, and players in PostgreSQL."
              : "Log in to access your favorite teams, post reactions, and follow live matches."}
          </p>
        </div>

        {error && (
          <div className="auth-error-banner">
            <span>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label htmlFor="identifier">
              {loginRole === "admin" ? "Admin Username / Email" : "Username or Email"}
            </label>
            <input
              id="identifier"
              type="text"
              placeholder={loginRole === "admin" ? "Enter admin username or email" : "Enter your username or email"}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`auth-submit-btn ${loginRole === "admin" ? "admin-btn" : ""}`}
          >
            {isSubmitting
              ? "Authenticating..."
              : loginRole === "admin"
              ? "🛡️ Sign In to Admin Panel"
              : "Log In"}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Don't have an account?{" "}
            <Link href="/register" className="auth-switch-link">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
