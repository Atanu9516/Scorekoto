import Link from "next/link";
import leagues from "@/data/leagues";

export default function LeaguesPage() {
    return (
        <main className="leagues-page">
            <h1>Leagues</h1>

            <div className="league-grid">
                {leagues.map((league) => (
                    <Link
                        key={league.id}
                        href={`/leagues/${league.name
                            .toLowerCase()
                            .replaceAll(" ", "-")}`}
                        className="league-card"
                    >
                        <div className="league-icon">🏆</div>

                        <div>
                            <h2>{league.name}</h2>
                            <p>{league.country}</p>
                        </div>
                    </Link>
                ))}
            </div>
        </main>
    );
}