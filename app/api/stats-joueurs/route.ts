import type { NextRequest } from 'next/server';
import {
  DIVISIONS,
  computePlayerStats,
  parseExclusions,
} from '@/lib/results/core';
import {
  invalidDivision,
  jsonError,
  jsonNoStore,
  loadExclusions,
  loadFinishedMatches,
  loadGames,
  loadPlayerNames,
  loadStats,
  loadValidatedTeams,
  readDivisionParam,
  toTeamMap,
} from '@/lib/results/load';

export const dynamic = 'force-dynamic';

// Stats individuelles par rôle : ?division=Ixtal ou toutes les divisions.
export async function GET(request: NextRequest) {
  const { division, invalid } = readDivisionParam(request);

  if (invalid) return invalidDivision();

  try {
    const matches = await loadFinishedMatches({ division });

    const games = await loadGames(
      matches.map((match) => Number(match.id)),
      'id, match_id, duration_seconds, winner_team_id'
    );

    const [currentStats, teams, exclusionRows] = await Promise.all([
      loadStats(
        'czf_current_player_stats',
        games.map((game) => Number(game.id))
      ),
      loadValidatedTeams(),
      loadExclusions(),
    ]);

    const playerNames = await loadPlayerNames(
      currentStats.map((stat) => Number(stat.player_id))
    );

    const data = {
      matches,
      games,
      currentStats,
      teamMap: toTeamMap(teams),
      playerNames,
      exclusions: parseExclusions(exclusionRows),
    };

    if (division) {
      return jsonNoStore({
        success: true,
        division,
        roles: computePlayerStats(division, data),
      });
    }

    return jsonNoStore({
      success: true,
      divisions: Object.fromEntries(
        DIVISIONS.map((item) => [item, computePlayerStats(item, data)])
      ),
    });
  } catch (error) {
    return jsonError('STATS JOUEURS API', error, 'Impossible de charger les stats joueurs.');
  }
}
