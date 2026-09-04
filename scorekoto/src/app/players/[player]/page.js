import players from "@/data/players";
import teams from "@/data/teams";
import matches from "@/data/matches";
import FavoriteButton from "@/components/FavoriteButton";
import PlayerTabs from "@/components/PlayerTabs";

export default async function PlayerPage({ params }) {
    const { player } = await params;

    const playerData = players.find(
        (item) => item.slug === player
    );

    if (!playerData) {
        return <h1>Player not found</h1>;
    }

    const teamData = teams.find(
        (team) => team.name === playerData.team
    );

    const playerMatches = matches.filter(
        (match) =>
            match.homeTeam === playerData.team ||
            match.awayTeam === playerData.team
    );

    return (
        <main className="player-page">

            {/* PLAYER HEADER */}
            <section className="player-header">

                <div className="player-avatar">
                    {playerData.number}
                </div>

                <div>
                    <p className="player-position">
                        {playerData.position}
                    </p>

                    <h1>{playerData.name}</h1>

                    <p className="player-header-team">
                        {playerData.team}
                    </p>
                </div>

                <FavoriteButton
                    type="players"
                    id={playerData.slug}
                />

            </section>

            {/* PLAYER CONTENT */}
            <PlayerTabs
                player={playerData}
                team={teamData}
                playerMatches={playerMatches}
            />

        </main>
    );
}