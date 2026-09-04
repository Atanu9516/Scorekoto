import Link from "next/link";
import GlobalSearch from "./GlobalSearch";
import NotificationBell from "./NotificationBell";

export default function Navbar() {
  return (
    <nav className="navbar">

      <Link href="/" className="navbar-logo">
        Scoreকত?
      </Link>

      <div className="nav-links">

        <GlobalSearch />

        <NotificationBell />
        <Link href="/">
          Matches
        </Link>

        <Link href="/teams/liverpool">
          Teams
        </Link>

        <Link href="/leagues">
          Leagues
        </Link>

        <Link href="/favorites">
          Favorites
        </Link>

      </div>

    </nav>
  );
}