import "server-only";

import pool from "./db";

const MANAGER_CACHE_SECONDS = 24 * 60 * 60;

function cleanManagerName(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function getTeamManagerName(teamId, storedManagerName) {
  const existingManager = cleanManagerName(storedManagerName);
  const numericTeamId = Number(teamId);
  const apiKey = process.env.API_SPORTS_KEY;

  if (!Number.isInteger(numericTeamId) || numericTeamId <= 0 || !apiKey) {
    return existingManager;
  }

  try {
    const response = await fetch(
      `https://v3.football.api-sports.io/coachs?team=${numericTeamId}`,
      {
        headers: {
          "x-apisports-key": apiKey,
          Accept: "application/json",
        },
        next: { revalidate: MANAGER_CACHE_SECONDS },
      }
    );

    if (!response.ok) {
      console.warn(
        `Manager lookup failed for team ${numericTeamId}: ${response.status}`
      );
      return existingManager;
    }

    const data = await response.json();
    const coaches = Array.isArray(data.response) ? data.response : [];
    const today = new Date().toISOString().slice(0, 10);
    const currentCoach = coaches
      .map((coach) => {
        const currentRole = Array.isArray(coach?.career)
          ? coach.career
              .filter(
                (role) =>
                  Number(role?.team?.id) === numericTeamId &&
                  !cleanManagerName(role.end) &&
                  (!cleanManagerName(role.start) || role.start <= today)
              )
              .sort((a, b) => String(b.start || "").localeCompare(String(a.start || "")))[0]
          : null;

        return { coach, currentRole };
      })
      .filter(({ coach, currentRole }) =>
        Number(coach?.team?.id) === numericTeamId && currentRole
      )
      .sort((a, b) =>
        String(b.currentRole.start || "").localeCompare(String(a.currentRole.start || ""))
      )[0]?.coach;
    const managerName = cleanManagerName(currentCoach?.name);

    if (!managerName) {
      return existingManager;
    }

    if (managerName !== existingManager) {
      await pool.query(
        `UPDATE team
         SET manager_name = $1
         WHERE team_id = $2`,
        [managerName, numericTeamId]
      );
    }

    return managerName;
  } catch (error) {
    console.warn(
      `Manager lookup failed for team ${numericTeamId}:`,
      error instanceof Error ? error.message : error
    );
    return existingManager;
  }
}
