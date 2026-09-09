"use client";

import Link from "next/link";

import { useFavorites } from "@/context/FavoritesContext";

import teams from "@/data/teams";
import players from "@/data/players";
import leagues from "@/data/leagues";
import matches from "@/data/matches";


export default function FavoritesPage() {

    const {
        favorites,
        loaded,
    } = useFavorites();


    if (!loaded) {
        return (
            <main className="favorites-page">
                <p>Loading favorites...</p>
            </main>
        );
    }


    const favoriteTeams = teams.filter(
        (team) =>
            favorites.teams.some(
                (fav) =>
                    String(fav).toLowerCase() === String(team.slug).toLowerCase() ||
                    String(fav) === String(team.id) ||
                    String(fav).toLowerCase() === String(team.name).toLowerCase()
            )
    );


    const favoritePlayers = players.filter(
        (player) =>
            favorites.players.some(
                (fav) =>
                    String(fav).toLowerCase() === String(player.slug).toLowerCase() ||
                    String(fav) === String(player.id)
            )
    );


    const favoriteLeagues = leagues.filter(
        (league) =>
            favorites.leagues.some(
                (fav) =>
                    String(fav).toLowerCase() === String(league.slug).toLowerCase() ||
                    String(fav) === String(league.name).toLowerCase()
            )
    );


    return (
        <main className="favorites-page">


            <section className="page-title">

                <h1>
                    ⭐ Favorites
                </h1>

                <p>
                    Your followed teams, players and matches
                </p>

            </section>



            <FavoriteSection title="Teams">
                {favoriteTeams.length === 0 ? (
                    <EmptyState />
                ) : (
                    favoriteTeams.map((team) => (
                        <Link
                            key={team.id}
                            href={`/teams/${team.slug}`}
                            className="favorite-card"
                        >
                            {team.logo ? (
                                <img
                                    src={team.logo}
                                    alt={`${team.name} logo`}
                                    className="favorite-card-logo"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                            ) : (
                                <div className="favorite-card-placeholder">
                                    {team.shortName || team.name.charAt(0)}
                                </div>
                            )}
                            <div className="favorite-card-content">
                                <strong>{team.name}</strong>
                                <span>{team.league}</span>
                            </div>
                        </Link>
                    ))
                )}
            </FavoriteSection>

            <FavoriteSection title="Players">
                {favoritePlayers.length === 0 ? (
                    <EmptyState />
                ) : (
                    favoritePlayers.map((player) => (
                        <Link
                            key={player.id}
                            href={`/players/${player.slug}`}
                            className="favorite-card"
                        >
                            <div className="favorite-card-placeholder">
                                {player.number || "⚽"}
                            </div>
                            <div className="favorite-card-content">
                                <strong>{player.name}</strong>
                                <span>{player.team} · {player.position}</span>
                            </div>
                        </Link>
                    ))
                )}
            </FavoriteSection>

            <FavoriteSection title="Leagues">
                {favoriteLeagues.length === 0 ? (
                    <EmptyState />
                ) : (
                    favoriteLeagues.map((league) => (
                        <Link
                            key={league.slug}
                            href={`/leagues/${league.slug}`}
                            className="favorite-card"
                        >
                            <div className="favorite-card-placeholder">
                                🏆
                            </div>
                            <div className="favorite-card-content">
                                <strong>{league.name}</strong>
                                <span>{league.country}</span>
                            </div>
                        </Link>
                    ))
                )}
            </FavoriteSection>

        </main>
    );
}



function FavoriteSection({
    title,
    children,
}) {

    return (

        <section className="favorites-section">

            <h2>
                {title}
            </h2>

            <div className="favorites-grid">
                {children}
            </div>

        </section>

    );
}



function EmptyState() {

    return (

        <p className="empty-message">
            Nothing added yet.
        </p>

    );

}