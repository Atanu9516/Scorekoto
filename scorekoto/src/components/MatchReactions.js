"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

const REACTIONS = [
  { emoji: "🔥", label: "Fire" },
  { emoji: "⚽", label: "Goal" },
  { emoji: "👏", label: "Clap" },
  { emoji: "⚡", label: "Hype" },
  { emoji: "💔", label: "Heartbroken" },
  { emoji: "😡", label: "Furious" },
];

export default function MatchReactions({ matchId }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [selectedReaction, setSelectedReaction] = useState("⚽");
  const [guestName, setGuestName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchComments = useCallback(async () => {
    if (!matchId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/matches/${matchId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      }
    } catch (err) {
      console.error("Failed to load match comments:", err);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setError("");
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/matches/${matchId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comment_text: commentText.trim(),
          reaction: selectedReaction,
          guest_name: user ? user.username : guestName.trim() || "Football Fan",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to post reaction.");
      } else {
        setCommentText("");
        if (data.comment) {
          setComments((prev) => [data.comment, ...prev]);
        } else {
          fetchComments();
        }
      }
    } catch (err) {
      console.error("Error submitting comment:", err);
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId) => {
    if (!confirm("Are you sure you want to delete this reaction?")) return;

    try {
      const res = await fetch(`/api/matches/${matchId}/comments?comment_id=${commentId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.comment_id !== commentId));
      }
    } catch (err) {
      console.error("Error deleting comment:", err);
    }
  };

  const formatTimestamp = (dateString) => {
    if (!dateString) return "Just now";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <section className="match-reactions-container">
      <div className="reactions-header">
        <h2>💬 Match Reactions & Fan Discussion</h2>
        <span className="reactions-count-badge">
          {comments.length} {comments.length === 1 ? "reaction" : "reactions"}
        </span>
      </div>

      {/* REACTION INPUT FORM */}
      <form onSubmit={handleSubmit} className="reaction-post-box">
        <div className="reaction-picker">
          <span className="picker-label">Choose Reaction:</span>
          <div className="picker-options">
            {REACTIONS.map((r) => (
              <button
                key={r.emoji}
                type="button"
                className={`reaction-emoji-btn ${selectedReaction === r.emoji ? "selected" : ""}`}
                onClick={() => setSelectedReaction(r.emoji)}
                title={r.label}
              >
                <span>{r.emoji}</span>
              </button>
            ))}
          </div>
        </div>

        {!user && (
          <div className="guest-name-field">
            <input
              type="text"
              placeholder="Your Name (or log in to link account)"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="guest-input"
            />
          </div>
        )}

        <div className="reaction-textarea-wrap">
          <textarea
            rows="3"
            placeholder={
              user
                ? `What's your take on this match, @${user.username}?`
                : "Share your thoughts on this match..."
            }
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            required
            className="reaction-textarea"
          />
        </div>

        {error && <div className="reaction-error-msg">⚠️ {error}</div>}

        <div className="reaction-form-footer">
          {user ? (
            <span className="user-posting-tag">
              👤 Posting as <strong>@{user.username}</strong>
              {user.role === "admin" && <span className="admin-badge-mini">🛡️ Admin</span>}
            </span>
          ) : (
            <span className="guest-login-hint">
              Want to save your profile? <Link href="/login">Log in here</Link>
            </span>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !commentText.trim()}
            className="reaction-submit-btn"
          >
            {isSubmitting ? "Posting..." : `Post Reaction ${selectedReaction}`}
          </button>
        </div>
      </form>

      {/* COMMENTS LIST (Organized by Time) */}
      <div className="reactions-feed">
        {loading ? (
          <p className="reactions-loading">Loading live reactions from database...</p>
        ) : comments.length === 0 ? (
          <div className="reactions-empty">
            <span className="empty-icon">⚽</span>
            <p>No reactions yet. Be the first to share your thoughts on this match!</p>
          </div>
        ) : (
          <div className="comments-timeline">
            {comments.map((c) => {
              const canDelete =
                user && (user.user_id === c.user_id || user.role === "admin");

              return (
                <div key={c.comment_id} className="comment-bubble">
                  <div className="comment-top">
                    <div className="comment-author-info">
                      <span className="comment-reaction-emoji">{c.reaction || "⚽"}</span>
                      <strong className="comment-username">
                        {c.username}
                      </strong>
                    </div>

                    <div className="comment-meta">
                      <span className="comment-timestamp">
                        🕒 {formatTimestamp(c.created_at)}
                      </span>

                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDelete(c.comment_id)}
                          className="comment-delete-btn"
                          title="Delete reaction"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="comment-body">{c.comment_text}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
