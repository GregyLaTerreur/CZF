import type { NextRequest } from 'next/server';
import { computeTeamChampions, getChampions } from '@/lib/results/core';
import { jsonError, jsonNoStore, loadResultsDataset } from '@/lib/results/load';

export const dynamic = 'force-dynamic';

// Champions joués en CZF par une équipe et par chacun de ses joueurs (games, winrate, KDA).
// Lu dans le cache partagé des résultats : aucune requête en base s'il est chaud.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const teamId = Number((await params).id);

  if (!Number.isInteger(teamId) || teamId <= 0) {
    return jsonNoStore({ success: false, error: 'Équipe invalide.' }, 400);
  }

  try {
    const [dataset, champions] = await Promise.all([loadResultsDataset(), getChampions()]);

    return jsonNoStore({
      success: true,
      ...computeTeamChampions(teamId, {
        games: dataset.games,
        stats: dataset.stats,
        championMap: new Map(champions.map((champion) => [champion.id, champion])),
      }),
    });
  } catch (error) {
    return jsonError('STATS EQUIPE API', error, 'Impossible de charger les champions de l’équipe.');
  }
}
