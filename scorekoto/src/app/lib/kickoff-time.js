const unknownKickoffStatuses = new Set(["TBD", "PST"]);

export function hasKnownKickoffTime(matchDate, status) {
  const normalizedStatus = String(status || "").toUpperCase();

  if (unknownKickoffStatuses.has(normalizedStatus) || !matchDate) {
    return false;
  }

  const kickoff = new Date(matchDate);
  return !Number.isNaN(kickoff.getTime());
}

export function formatKickoffTime(matchDate, status) {
  if (!hasKnownKickoffTime(matchDate, status)) {
    return "TBD";
  }

  const kickoff = new Date(matchDate);
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(kickoff);
}
