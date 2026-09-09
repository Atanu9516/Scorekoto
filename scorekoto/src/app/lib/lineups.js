import pool from './db';
import fallbackLineups from '@/data/lineups';

// Helper to build a starting XI and substitutes from player rows
function buildFormationFromPlayers(teamName, managerName, players) {
  const goalkeepers = players.filter((p) => p.primary_position === 'Goalkeeper');
  const defenders = players.filter((p) => p.primary_position === 'Defender');
  const midfielders = players.filter((p) => p.primary_position === 'Midfielder');
  const attackers = players.filter(
    (p) => p.primary_position === 'Attacker' || p.primary_position === 'Forward'
  );

  const startingXI = [];
  const usedIds = new Set();
  let num = 1;

  // 1. Goalkeeper (Row 1)
  if (goalkeepers.length > 0) {
    startingXI.push({
      name: goalkeepers[0].name,
      number: num++,
      position: 'GK',
      row: 1,
    });
    usedIds.add(goalkeepers[0].id || goalkeepers[0].name);
  } else {
    startingXI.push({ name: `${teamName} GK`, number: 1, position: 'GK', row: 1 });
  }

  // 2. Defenders (Row 2) - Up to 4
  const defPositions = ['RB', 'CB', 'CB', 'LB'];
  for (let i = 0; i < 4; i++) {
    if (i < defenders.length) {
      startingXI.push({
        name: defenders[i].name,
        number: num++,
        position: defPositions[i],
        row: 2,
      });
      usedIds.add(defenders[i].id || defenders[i].name);
    } else {
      startingXI.push({
        name: `${teamName} Def ${i + 1}`,
        number: num++,
        position: defPositions[i],
        row: 2,
      });
    }
  }

  // 3. Midfielders (Row 3) - Up to 3
  const midPositions = ['CM', 'DM', 'AM'];
  for (let i = 0; i < 3; i++) {
    if (i < midfielders.length) {
      startingXI.push({
        name: midfielders[i].name,
        number: num++,
        position: midPositions[i],
        row: 3,
      });
      usedIds.add(midfielders[i].id || midfielders[i].name);
    } else {
      startingXI.push({
        name: `${teamName} Mid ${i + 1}`,
        number: num++,
        position: midPositions[i],
        row: 3,
      });
    }
  }

  // 4. Attackers (Row 4) - Up to 3
  const fwdPositions = ['RW', 'ST', 'LW'];
  for (let i = 0; i < 3; i++) {
    if (i < attackers.length) {
      startingXI.push({
        name: attackers[i].name,
        number: num++,
        position: fwdPositions[i],
        row: 4,
      });
      usedIds.add(attackers[i].id || attackers[i].name);
    } else {
      startingXI.push({
        name: `${teamName} Fwd ${i + 1}`,
        number: num++,
        position: fwdPositions[i],
        row: 4,
      });
    }
  }

  // Remaining players become substitutes
  const substitutes = players
    .filter((p) => !usedIds.has(p.id || p.name))
    .slice(0, 7)
    .map((p, idx) => ({
      name: p.name,
      number: num + idx,
    }));

  if (substitutes.length === 0) {
    substitutes.push(
      { name: `${teamName} Sub 1`, number: 12 },
      { name: `${teamName} Sub 2`, number: 14 },
      { name: `${teamName} Sub 3`, number: 17 }
    );
  }

  return {
    team: teamName,
    formation: '4-3-3',
    coach: managerName || 'Head Coach',
    startingXI,
    substitutes,
  };
}

// Fetch team squad from PostgreSQL
async function getTeamSquadFromDb(teamName) {
  if (!teamName) return null;
  try {
    const teamRes = await pool.query(
      `SELECT team_id, name, manager_name FROM team 
       WHERE LOWER(name) = LOWER($1) 
          OR LOWER(REPLACE(name, ' ', '-')) = LOWER($1) 
          OR LOWER(short_name) = LOWER($1)
       LIMIT 1`,
      [teamName.trim()]
    );

    if (teamRes.rows.length === 0) {
      return null;
    }

    const team = teamRes.rows[0];

    const playersRes = await pool.query(
      `SELECT 
         player_id as id,
         CONCAT(first_name, ' ', last_name) as name,
         primary_position,
         nationality
       FROM player 
       WHERE team_id = $1
       ORDER BY 
         CASE 
           WHEN primary_position = 'Goalkeeper' THEN 1
           WHEN primary_position = 'Defender' THEN 2
           WHEN primary_position = 'Midfielder' THEN 3
           WHEN primary_position IN ('Attacker', 'Forward') THEN 4
           ELSE 5
         END,
         last_name ASC`,
      [team.team_id]
    );

    return {
      teamName: team.name,
      managerName: team.manager_name,
      players: playersRes.rows,
    };
  } catch (err) {
    console.error('Error fetching squad for lineup:', err);
    return null;
  }
}

// Maps API-Sports lineup object to Scorekoto structure
export function mapApiSportsLineup(apiLineups, homeTeamName, awayTeamName) {
  if (!apiLineups || !Array.isArray(apiLineups) || apiLineups.length < 2) {
    return null;
  }

  function mapSingleTeam(item, defaultTeam) {
    const startingXI = (item.startXI || []).map((p) => {
      let row = 1;
      if (p.player?.grid) {
        const parts = p.player.grid.split(':');
        row = parseInt(parts[0], 10) || 1;
      } else {
        const pos = p.player?.pos || '';
        if (pos === 'G') row = 1;
        else if (pos === 'D') row = 2;
        else if (pos === 'M') row = 3;
        else if (pos === 'F') row = 4;
      }
      return {
        name: p.player?.name || 'Player',
        number: p.player?.number || 1,
        position: p.player?.pos || 'P',
        row: row,
      };
    });

    const substitutes = (item.substitutes || []).map((p) => ({
      name: p.player?.name || 'Sub',
      number: p.player?.number || 12,
    }));

    return {
      team: item.team?.name || defaultTeam,
      formation: item.formation || '4-3-3',
      coach: item.coach?.name || 'Head Coach',
      startingXI,
      substitutes,
    };
  }

  return {
    home: mapSingleTeam(apiLineups[0], homeTeamName),
    away: mapSingleTeam(apiLineups[1], awayTeamName),
  };
}

// Master function to guarantee a complete lineup for any match
export async function getLineupForMatch(match, apiLineups = null) {
  if (!match) return null;

  // 1. If API-Sports provided lineups
  if (apiLineups && Array.isArray(apiLineups) && apiLineups.length >= 2) {
    const mapped = mapApiSportsLineup(apiLineups, match.homeTeam, match.awayTeam);
    if (mapped) return mapped;
  }

  // 2. Check static fallback lineups
  const staticLineup = fallbackLineups.find((l) => l.matchId === match.id);
  if (staticLineup) {
    return staticLineup;
  }

  // 3. Build dynamic lineup from PostgreSQL squad records
  const homeSquad = await getTeamSquadFromDb(match.homeTeam);
  const awaySquad = await getTeamSquadFromDb(match.awayTeam);

  const homeLineup = homeSquad
    ? buildFormationFromPlayers(match.homeTeam, homeSquad.managerName, homeSquad.players)
    : buildFormationFromPlayers(match.homeTeam, 'Head Coach', []);

  const awayLineup = awaySquad
    ? buildFormationFromPlayers(match.awayTeam, awaySquad.managerName, awaySquad.players)
    : buildFormationFromPlayers(match.awayTeam, 'Head Coach', []);

  return {
    matchId: match.id,
    home: homeLineup,
    away: awayLineup,
  };
}
