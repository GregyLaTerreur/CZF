import type { NextRequest } from 'next/server';
import { computePlayerChampions, getChampions } from '@/lib/results/core';
import { jsonError, jsonNoStore, loadResultsDataset } from '@/lib/results/load';

export const dynamic = 'force-dynamic';

// Champions joués en CZF par un joueur (games, winrate, KDA), toutes divisions.
// Lu dans le cache partagé des résultats : aucune requête en base s'il est chaud.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const playerId = Number((await params).id);

  if (!Number.isInteger(playerId) || playerId <= 0) {
    return jsonNoStore({ success: false, error: 'Joueur invalide.' }, 400);
  }

  try {
    const [dataset, champions] = await Promise.all([loadResultsDataset(), getChampions()]);

    return jsonNoStore({
      success: true,
      champions: computePlayerChampions(playerId, {
        games: dataset.games,
        stats: dataset.stats,
        championMap: new Map(champions.map((champion) => [champion.id, champion])),
      }),
    });
  } catch (error) {
    return jsonError('STATS JOUEUR API', error, 'Impossible de charger les champions du joueur.');
  }
}
