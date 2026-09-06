"use client";

import { useFavorites } from "@/context/FavoritesContext";

export default function FavoriteButton({
    type,
    id,
}) {
    const {
        isFavorite,
        toggleFavorite,
        loaded,
    } = useFavorites();

    if (!loaded) {
        return (
            <button
                className="favorite-button"
                disabled
            >
                ☆
            </button>
        );
    }

    const active = isFavorite(type, id);

    return (
        <button
            type="button"
            className={
                active
                    ? "favorite-button favorite-active"
                    : "favorite-button"
            }
            onClick={() =>
                toggleFavorite(type, id)
            }
            aria-label={
                active
                    ? "Remove from favorites"
                    : "Add to favorites"
            }
        >
            {active ? "★" : "☆"}
        </button>
    );
}