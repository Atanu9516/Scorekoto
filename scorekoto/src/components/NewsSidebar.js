"use client";

import { useState, useEffect } from "react";

export default function NewsSidebar() {
  const [newsList, setNewsList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function fetchNews() {
      try {
        const res = await fetch("/api/news?limit=6");
        if (res.ok) {
          const data = await res.json();
          if (mounted && data.news) {
            setNewsList(data.news);
          }
        }
      } catch (err) {
        console.error("Failed to load news sidebar:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchNews();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <aside className="news-sidebar">
      <h2>Latest News</h2>

      <div className="news-list">
        {loading && (
          <p style={{ color: "var(--muted)", fontSize: "13px", padding: "8px 0" }}>
            Loading football news...
          </p>
        )}

        {!loading && newsList.length === 0 && (
          <p style={{ color: "var(--muted)", fontSize: "13px", padding: "8px 0" }}>
            No recent football headlines.
          </p>
        )}

        {newsList.map((item) => (
          <article key={item.id} className="news-item">
            {item.teamLogo ? (
              <img
                src={item.teamLogo}
                alt=""
                className="news-image"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <div
                className="news-image news-image-fallback"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--surface-light)",
                  borderRadius: "8px",
                  fontSize: "18px",
                  color: "var(--foreground)",
                }}
              >
                ⚽
              </div>
            )}

            <div className="news-content">
              <h3>{item.title}</h3>
              <p>
                {item.category}
                {" · "}
                {item.time}
              </p>
            </div>
          </article>
        ))}
      </div>
    </aside>
  );
}