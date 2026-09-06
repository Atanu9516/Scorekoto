"use client";

import {
    createContext,
    useContext,
    useEffect,
    useState,
} from "react";

const FavoritesContext = createContext(null);

export function FavoritesProvider({ children }) {
    const [favorites, setFavorites] = useState({
        teams: [],
        players: [],
        leagues: [],
    });

    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        const savedFavorites =
            localStorage.getItem("scorekoto-favorites");

        if (savedFavorites) {
            setFavorites(JSON.parse(savedFavorites));
        }

        setLoaded(true);
    }, []);

    useEffect(() => {
        if (!loaded) return;

        localStorage.setItem(
            "scorekoto-favorites",
            JSON.stringify(favorites)
        );
    }, [favorites, loaded]);

    function isFavorite(type, id) {
        return favorites[type].includes(id);
    }

    function toggleFavorite(type, id) {
        setFavorites((currentFavorites) => {
            const alreadyFavorite =
                currentFavorites[type].includes(id);

            if (alreadyFavorite) {
                return {
                    ...currentFavorites,

                    [type]: currentFavorites[type].filter(
                        (item) => item !== id
                    ),
                };
            }

            return {
                ...currentFavorites,

                [type]: [
                    ...currentFavorites[type],
                    id,
                ],
            };
        });
    }

    return (
        <FavoritesContext.Provider
            value={{
                favorites,
                isFavorite,
                toggleFavorite,
                loaded,
            }}
        >
            {children}
        </FavoritesContext.Provider>
    );
}

export function useFavorites() {
    return useContext(FavoritesContext);
}