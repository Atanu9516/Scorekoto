import leagues from "@/data/leagues";
import matches from "@/data/matches";
import teams from "@/data/teams";
import FavoriteButton from "@/components/FavoriteButton";
import LeagueTabs from "@/components/LeagueTabs";

export default async function LeaguePage({ params }) {
    const { league } = await params;

    const leagueData = leagues.find(
        (item) =>
            item.name
                .toLowerCase()
                .replaceAll(" ", "-") === league
    );

    if (!leagueData) {
        return <h1>League not found</h1>;
    }

    const leagueMatches = matches.filter(
        (match) => match.league === leagueData.name
    );

    const leagueTeams = teams.filter(
        (team) => team.league === leagueData.name
    );

    const finishedMatches = leagueMatches.filter(
        (match) => match.status === "FT"
    );

    const standingsMap = {};

    leagueTeams.forEach((team) => {
        standingsMap[team.name] = {
            team: team.name,
            played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDifference: 0,
            points: 0,
        };
    });

    finishedMatches.forEach((match) => {
        const home = standingsMap[match.homeTeam];
        const away = standingsMap[match.awayTeam];

        if (!home || !away) {
            return;
        }

        home.played += 1;
        away.played += 1;

        home.goalsFor += match.homeScore ?? 0;
        home.goalsAgainst += match.awayScore ?? 0;

        away.goalsFor += match.awayScore ?? 0;
        away.goalsAgainst += match.homeScore ?? 0;

        if (match.homeScore > match.awayScore) {
            home.wins += 1;
            away.losses += 1;

            home.points += 3;
        } else if (match.homeScore < match.awayScore) {
            away.wins += 1;
            home.losses += 1;

            away.points += 3;
        } else {
            home.draws += 1;
            away.draws += 1;

            home.points += 1;
            away.points += 1;
        }
    });

    const standings = Object.values(standingsMap)
        .map((team) => ({
            ...team,
            goalDifference:
                team.goalsFor - team.goalsAgainst,
        }))
        .sort((a, b) => {
            if (b.points !== a.points) {
                return b.points - a.points;
            }

            if (b.goalDifference !== a.goalDifference) {
                return b.goalDifference - a.goalDifference;
            }

            return b.goalsFor - a.goalsFor;
        })
        .map((team, index) => ({
            ...team,
            position: index + 1,
        }));

    const scorerMap = {};

    leagueMatches.forEach((match) => {
        match.events.forEach((event) => {
            if (event.type !== "goal") {
                return;
            }

            if (!scorerMap[event.player]) {
                scorerMap[event.player] = {
                    player: event.player,
                    team: event.team,
                    goals: 0,
                };
            }

            scorerMap[event.player].goals += 1;
        });
    });

    const topScorers = Object.values(scorerMap)
        .sort((a, b) => b.goals - a.goals)
        .slice(0, 10);

    const leagueStats = {
        totalMatches: leagueMatches.length,

        finishedMatches: leagueMatches.filter(
            (match) => match.status === "FT"
        ).length,

        liveMatches: leagueMatches.filter(
            (match) => match.status === "LIVE"
        ).length,

        upcomingMatches: leagueMatches.filter(
            (match) => match.status === "UPCOMING"
        ).length,

        goals: leagueMatches.reduce(
            (total, match) =>
                total +
                (match.homeScore ?? 0) +
                (match.awayScore ?? 0),
            0
        ),
    };

    return (
        <main className="league-page">

            {/* LEAGUE HEADER */}
            <div className="league-header">
                <div className="league-logo">
                    🏆
                </div>

                <div>
                    <h1>{leagueData.name}</h1>

                    <p>
                        {leagueData.country} · {leagueData.season}
                    </p>
                </div>
                <FavoriteButton
                    type="leagues"
                    id={leagueData.slug}
                />
            </div>

            <LeagueTabs
                league={leagueData}
                leagueMatches={leagueMatches}
                leagueTeams={leagueTeams}
                standings={standings}
                topScorers={topScorers}
                leagueStats={leagueStats}
            />

        </main>
    );
}

function getScorerTeam(playerName, match) {
    const homeScorers = match.events.filter(
        (event) =>
            event.type === "goal" &&
            event.player === playerName
    );

    if (homeScorers.length === 0) {
        return "";
    }

    /*
      Our current mock event objects do not yet contain
      which team the scorer belongs to.
  
      Until we improve events.js/matches.js, this uses
      a temporary fallback.
    */

    return `${match.homeTeam} / ${match.awayTeam}`;
}