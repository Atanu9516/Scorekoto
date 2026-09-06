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
            favorites.teams.includes(team.slug)
    );


    const favoritePlayers = players.filter(
        (player) =>
            favorites.players.includes(player.slug)
    );


    const favoriteLeagues = leagues.filter(
        (league) =>
            favorites.leagues.includes(league.slug)
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

                            <strong>
                                {team.name}
                            </strong>

                            <span>
                                {team.league}
                            </span>

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

                            <strong>
                                {player.name}
                            </strong>

                            <span>
                                {player.team}
                            </span>

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

                            <strong>
                                {league.name}
                            </strong>

                            <span>
                                {league.country}
                            </span>

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