"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadNotifications() {
      try {
        const res = await fetch("/api/notifications?limit=6");
        if (res.ok) {
          const data = await res.json();
          if (mounted && data.notifications) {
            setNotifications(data.notifications);
          }
        }
      } catch (err) {
        console.error("Failed to load notifications:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadNotifications();
    return () => {
      mounted = false;
    };
  }, []);

  const unreadCount = notifications.filter((item) => !item.read).length;

  return (
    <div className="notification-wrapper">
      <button
        className="notification-button"
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span className="notification-count">{unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notification-panel">
          <div className="notification-header">Match Alerts</div>

          {loading && (
            <p style={{ padding: "16px", color: "var(--muted)", fontSize: "13px" }}>
              Loading match updates...
            </p>
          )}

          {!loading && notifications.length === 0 && (
            <p style={{ padding: "16px", color: "var(--muted)", fontSize: "13px" }}>
              No recent notifications.
            </p>
          )}

          {notifications.map((notification) => (
            <Link
              key={notification.id}
              href={`/matches/${notification.matchId}`}
              className={
                notification.read
                  ? "notification-item"
                  : "notification-item unread"
              }
              onClick={() => setOpen(false)}
            >
              <div className="notification-icon">
                {getIcon(notification.type)}
              </div>

              <div className="notification-content">
                <strong>{notification.title}</strong>
                <p>{notification.message}</p>
                <span>{notification.time}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function getIcon(type) {
  if (type === "goal") return "⚽";
  if (type === "live") return "🔴";
  if (type === "upcoming") return "⏰";
  return "🏁";
}