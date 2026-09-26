"use client";

import { useSyncExternalStore } from "react";
import {
  formatKickoffTime,
  hasKnownKickoffTime,
} from "@/app/lib/kickoff-time";

const subscribe = () => () => {};

export default function LocalKickoffTime({
  matchDate,
  status,
  className,
  prefix = "",
}) {
  const isHydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
  const isKnown = hasKnownKickoffTime(matchDate, status);
  const label = isKnown
    ? isHydrated
      ? formatKickoffTime(matchDate, status)
      : "—"
    : "TBD";

  return (
    <span className={className}>
      {prefix}{label}
    </span>
  );
}
