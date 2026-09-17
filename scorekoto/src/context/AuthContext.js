"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check current session from /api/auth/me
  const checkAuth = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/auth/me", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user || null);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error("Auth check failed:", err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function initAuth() {
      try {
        const res = await fetch("/api/auth/me", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setUser(data.user || null);
        } else {
          if (isMounted) setUser(null);
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    initAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  // Login handler
  const login = async (identifier, password) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Login failed" };
      }

      setUser(data.user);
      return { success: true, user: data.user };
    } catch (err) {
      console.error("Login request error:", err);
      return { success: false, error: "Network error. Please try again." };
    }
  };

  // Register handler
  const register = async (username, email, password) => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Registration failed" };
      }

      setUser(data.user);
      return { success: true, user: data.user };
    } catch (err) {
      console.error("Register request error:", err);
      return { success: false, error: "Network error. Please try again." };
    }
  };

  // Logout handler
  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      setUser(null);
      return { success: true };
    } catch (err) {
      console.error("Logout request error:", err);
      setUser(null);
      return { success: true };
    }
  };

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        loading,
        login,
        register,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
