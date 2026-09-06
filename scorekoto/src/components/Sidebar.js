import Link from "next/link";

export default function Sidebar() {
  return (
    <aside className="sidebar">

      <h3>Football</h3>

      <Link href="/">
        All Matches
      </Link>

      <Link href="/teams/liverpool">
        Liverpool
      </Link>

      <Link href="/teams/arsenal">
        Arsenal
      </Link>

      <Link href="/teams/chelsea">
        Chelsea
      </Link>

      <h3>Competitions</h3>

      <Link href="/leagues">
        Premier League
      </Link>

      <Link href="/leagues">
        La Liga
      </Link>

      <Link href="/leagues">
        Bundesliga
      </Link>

    </aside>
  );
}