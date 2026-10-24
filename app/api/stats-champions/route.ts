import type { NextRequest } from 'next/server';
import {
  DIVISIONS,
  computeChampionStats,
  getChampions,
} from '@/lib/results/core';
import {
  invalidDivision,
  jsonError,
  jsonNoStore,
  loadFinishedMatches,
  loadGames,
  loadStats,
  readDivisionParam,
} from '@/lib/results/load';

export const dynamic = 'force-dynamic';

// Top 10 champions par rôle : ?division=Ixtal ou toutes les divisions.
export async function GET(request: NextRequest) {
  const { division, invalid } = readDivisionParam(request);

  if (invalid) return invalidDivision();

  try {
    const [matches, champions] = await Promise.all([
      loadFinishedMatches({ division }),
      getChampions(),
    ]);

    const games = await loadGames(
      matches.map((match) => Number(match.id)),
      'id, match_id, winner_team_id'
    );

    const stats = await loadStats(
      'czf_game_player_stats',
      games.map((game) => Number(game.id))
    );

    const data = {
      matches,
      games,
      stats,
      championMap: new Map(champions.map((champion) => [champion.id, champion])),
    };

    if (division) {
      return jsonNoStore({
        success: true,
        division,
        roles: computeChampionStats(division, data),
      });
    }

    return jsonNoStore({
      success: true,
      divisions: Object.fromEntries(
        DIVISIONS.map((item) => [item, computeChampionStats(item, data)])
      ),
    });
  } catch (error) {
    return jsonError('STATS CHAMPIONS API', error, 'Impossible de charger les stats champions.');
  }
}
