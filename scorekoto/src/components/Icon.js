const paths = {
  alert: <><path d="M12 3 2.8 20h18.4L12 3Z" /><path d="M12 9v4M12 17h.01" /></>,
  arrowLeft: <path d="m15 18-6-6 6-6M9 12h10" />,
  arrowUp: <path d="M12 20V5M6 11l6-6 6 6" />,
  arrowDown: <path d="M12 4v15M6 13l6 6 6-6" />,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  bolt: <path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z" />,
  cake: <><path d="M4 11h16v9H4zM4 15h16M8 11V8M12 11V8M16 11V8" /><path d="M8 5v.01M12 5v.01M16 5v.01" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  close: <path d="m7 7 10 10M17 7 7 17" />,
  coins: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v5c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 11v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" /></>,
  database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></>,
  flag: <><path d="M5 21V4" /><path d="M5 5h11l-2 3 2 3H5" /></>,
  football: <><circle cx="12" cy="12" r="9" /><path d="m12 8-3 2 1 3.5h4L15 10l-3-2ZM9 10 6.5 8M15 10l2.5-2M10 13.5 8.5 17M14 13.5l1.5 3.5M8.5 17H5M15.5 17H19M12 8V4" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>,
  heartBroken: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l2.2-2.2-2.7-2.7 3-3-2.5-2.5 2.2-2.2 2.6 2.6 4-4.6a5.5 5.5 0 0 0 0-7.8Z" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
  loader: <><path d="M21 12a9 9 0 0 1-9 9" /><path d="M3 12a9 9 0 0 1 9-9" /></>,
  mapPin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  message: <path d="M21 12a8 8 0 0 1-9 8 9 9 0 0 1-4-.9L3 21l1.7-4.3A8 8 0 1 1 21 12Z" />,
  moon: <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z" />,
  equal: <path d="M5 9h14M5 15h14" />,
  pencil: <><path d="m4 20 4.5-1 10-10-3.5-3.5-10 10L4 20Z" /><path d="m13.5 7 3.5 3.5" /></>,
  player: <><circle cx="12" cy="5" r="2" /><path d="m9 22 1-6-3-3 3-5 4 1 3 3M10 16l4 2 3 4M14 9l-1 5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  refresh: <><path d="M20 7v5h-5" /><path d="M19 12a7 7 0 1 0-2 5" /></>,
  ruler: <><path d="m4 16 12-12 4 4L8 20l-4-4Z" /><path d="m13 7 2 2M10 10l2 2M7 13l2 2" /></>,
  save: <><path d="M5 3h12l3 3v15H4V3h1Z" /><path d="M8 3v6h8V3M8 21v-7h8v7" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m16 16 5 5" /></>,
  shield: <><path d="M12 3 5 6v5c0 4.8 3 8 7 10 4-2 7-5.2 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-5" /></>,
  sparkles: <><path d="m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3L12 3Z" /><path d="m18 14 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14ZM5 13l.7 2.3L8 16l-2.3.7L5 19l-.7-2.3L2 16l2.3-.7L5 13Z" /></>,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  trendDown: <path d="m4 7 6 6 4-4 6 6M15 15h5v-5" />,
  redCard: <path d="M7 3h10v18H7z" fill="currentColor" stroke="none" />,
  thumbsUp: <path d="M7 10v11H3V10h4Zm0 9c3 2 8 2 10 1l3-8c.3-1.1-.5-2-1.6-2H14l1-4c.3-1.3-.7-2.5-2-2l-1 1-5 6" />,
  trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" /></>,
  trophy: <><path d="M8 4h8v3.5a4 4 0 0 1-8 0V4Z" /><path d="M8 6H5v1.5A3.5 3.5 0 0 0 8.5 11M16 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 12v4M8.5 20h7M10 16h4v4h-4z" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  yellowCard: <path d="M7 3h10v18H7z" fill="currentColor" stroke="none" />,
};

export default function Icon({ name, className = "", label, filled = false }) {
  return (
    <svg
      className={`ui-icon${className ? ` ${className}` : ""}`}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : "true"}
      aria-label={label}
      role={label ? "img" : undefined}
    >
      {paths[name] || paths.info}
    </svg>
  );
}

export function ReactionIcon({ reaction, className = "" }) {
  const iconByReaction = {
    "🔥": "bolt",
    "⚽": "football",
    "👏": "thumbsUp",
    "⚡": "bolt",
    "💔": "heartBroken",
    "😡": "alert",
  };

  return <Icon name={iconByReaction[reaction] || "football"} className={className} />;
}
