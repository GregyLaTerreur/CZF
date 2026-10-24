import type { NextRequest } from 'next/server';
import {
  buildMatchGames,
  buildMatchSummary,
  getChampions,
  groupBy,
} from '@/lib/results/core';
import {
  jsonError,
  jsonNoStore,
  loadResultsDataset,
  toTeamMap,
} from '@/lib/results/load';

export const dynamic = 'force-dynamic';

// Détail d'un BO : résumé + games avec les joueurs, chargé à l'ouverture d'un match.
// Lu dans le cache partagé des résultats : aucune requête en base s'il est chaud.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const matchId = Number((await params).id);

  if (!Number.isInteger(matchId) || matchId <= 0) {
    return jsonNoStore({ success: false, error: 'Match invalide.' }, 400);
  }

  try {
    const [dataset, champions] = await Promise.all([loadResultsDataset(), getChampions()]);
    const match = dataset.matches.find((item) => Number(item.id) === matchId);

    if (!match) {
      return jsonNoStore({ success: false, error: 'Match introuvable.' }, 404);
    }

    const games = dataset.games
      .filter((game) => Number(game.match_id) === matchId)
      .sort((a, b) => Number(a.id) - Number(b.id));
    const gameIds = new Set(games.map((game) => Number(game.id)));
    const stats = dataset.stats.filter((stat) => gameIds.has(Number(stat.game_id)));

    const playerNames = new Map(dataset.playerNames);
    const teamMap = toTeamMap(dataset.teams);

    return jsonNoStore({
      success: true,
      match: {
        ...buildMatchSummary(match, teamMap, games, playerNames),
        games: buildMatchGames(
          games,
          groupBy(stats, (stat) => Number(stat.game_id)),
          teamMap,
          playerNames,
          new Map(champions.map((champion) => [champion.id, champion]))
        ),
      },
    });
  } catch (error) {
    return jsonError('HISTORIQUE MATCH API', error, 'Impossible de charger le match.');
  }
}
