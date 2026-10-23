import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  buildMatchGames,
  buildMatchSummary,
  getChampions,
  groupBy,
} from '@/lib/results/core';
import {
  MATCH_COLUMNS,
  jsonError,
  jsonNoStore,
  loadGames,
  loadPlayerNames,
  loadStats,
  loadValidatedTeams,
  toTeamMap,
} from '@/lib/results/load';

export const dynamic = 'force-dynamic';

// Détail d'un BO : résumé + games avec les joueurs, chargé à l'ouverture d'un match.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const matchId = Number((await params).id);

  if (!Number.isInteger(matchId) || matchId <= 0) {
    return jsonNoStore({ success: false, error: 'Match invalide.' }, 400);
  }

  try {
    const { data: match, error } = await supabaseAdmin
      .from('czf_matches')
      .select(MATCH_COLUMNS)
      .eq('id', matchId)
      .eq('status', 'finished')
      .maybeSingle();

    if (error) throw error;

    if (!match) {
      return jsonNoStore({ success: false, error: 'Match introuvable.' }, 404);
    }

    const games = await loadGames([matchId]);

    const [stats, teams, champions] = await Promise.all([
      loadStats(
        'czf_game_player_stats',
        games.map((game) => Number(game.id))
      ),
      loadValidatedTeams(),
      getChampions(),
    ]);

    const playerNames = await loadPlayerNames([
      ...stats.map((stat) => Number(stat.player_id)),
      ...(match.mvp_player_id ? [Number(match.mvp_player_id)] : []),
    ]);

    const teamMap = toTeamMap(teams);

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
