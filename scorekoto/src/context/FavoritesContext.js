"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useAuth } from "./AuthContext";

const FavoritesContext = createContext(null);

export function FavoritesProvider({ children }) {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState({
    teams: [],
    players: [],
    leagues: [],
  });
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const savedFavorites = localStorage.getItem("scorekoto-favorites");
    if (savedFavorites) {
      try {
        setFavorites(JSON.parse(savedFavorites));
      } catch (e) {
        console.error("Failed to parse saved favorites:", e);
      }
    }
    setLoaded(true);
  }, []);

  // Fetch favorite teams from database when user is logged in
  const fetchDbFavorites = useCallback(async () => {
    if (!user) return;

    try {
      const res = await fetch("/api/favorites/teams", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.slugs) {
          setFavorites((prev) => {
            // Merge slugs and numeric IDs so lookups by slug or ID both work
            const dbTeamIdentifiers = Array.from(
              new Set([
                ...data.slugs,
                ...data.teamIds.map(String),
                ...data.teamIds,
              ])
            );

            // Also keep any non-team favorites
            return {
              ...prev,
              teams: dbTeamIdentifiers,
            };
          });
        }
      }
    } catch (err) {
      console.error("Failed to fetch database favorites:", err);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchDbFavorites();
    }
  }, [user, fetchDbFavorites]);

  // Sync to localStorage
  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem("scorekoto-favorites", JSON.stringify(favorites));
  }, [favorites, loaded]);

  function isFavorite(type, id) {
    if (!favorites[type]) return false;
    const strId = String(id).toLowerCase();
    return favorites[type].some(
      (item) => String(item).toLowerCase() === strId || item === id
    );
  }

  async function toggleFavorite(type, id) {
    const alreadyFavorite = isFavorite(type, id);

    // Optimistically update local state
    setFavorites((currentFavorites) => {
      const currentList = currentFavorites[type] || [];
      const strId = String(id).toLowerCase();

      if (alreadyFavorite) {
        return {
          ...currentFavorites,
          [type]: currentList.filter(
            (item) => String(item).toLowerCase() !== strId && item !== id
          ),
        };
      }

      return {
        ...currentFavorites,
        [type]: [...currentList, id],
      };
    });

    // If logged in and the type is teams, persist directly to PostgreSQL database
    if (user && type === "teams") {
      try {
        if (alreadyFavorite) {
          // DELETE from database
          await fetch(`/api/favorites/teams?teamId=${encodeURIComponent(id)}`, {
            method: "DELETE",
          });
        } else {
          // POST to database
          await fetch("/api/favorites/teams", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ teamSlug: id, teamId: id }),
          });
        }
      } catch (err) {
        console.error("Failed to update favorite in database:", err);
      }
    }
  }

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        isFavorite,
        toggleFavorite,
        loaded,
        refreshFavorites: fetchDbFavorites,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error("useFavorites must be used within a FavoritesProvider");
  }
  return context;
}