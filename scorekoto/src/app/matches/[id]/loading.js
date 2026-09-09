export default function MatchLoading() {
  return (
    <main className="match-page">
      <div className="match-page-loading-wrapper">
        <div className="match-loading-card">
          <div className="match-detail-spinner"></div>
          <h2>⚡ Loading Match Details...</h2>
          <p>
            Fetching official lineups, substitutes, timeline commentary, and updating database records.
          </p>
          <div className="match-loading-shimmer-bar">
            <div className="shimmer-pulse"></div>
          </div>
        </div>
      </div>
    </main>
  );
}
