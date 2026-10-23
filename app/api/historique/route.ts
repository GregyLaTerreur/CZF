import type { NextRequest } from 'next/server';
import { buildMatchSummary, groupBy } from '@/lib/results/core';
import {
  invalidDivision,
  jsonError,
  jsonNoStore,
  loadFinishedMatches,
  loadGames,
  loadPlayerNames,
  loadValidatedTeams,
  readDivisionParam,
  toTeamMap,
} from '@/lib/results/load';

export const dynamic = 'force-dynamic';

// Liste des BO joués, sans le détail des games (voir /api/historique/[id]).
// ?division=Ixtal pour filtrer, ?limit=6 pour les plus récents.
export async function GET(request: NextRequest) {
  const { division, invalid } = readDivisionParam(request);

  if (invalid) return invalidDivision();

  const limit = Number(request.nextUrl.searchParams.get('limit'));

  try {
    const matches = await loadFinishedMatches({ division });

    const selected =
      Number.isInteger(limit) && limit > 0 ? matches.slice(0, limit) : matches;

    const [teams, games, playerNames] = await Promise.all([
      loadValidatedTeams(),
      loadGames(
        selected.map((match) => Number(match.id)),
        'id, match_id, winner_team_id'
      ),
      loadPlayerNames(
        selected
          .filter((match) => match.mvp_player_id)
          .map((match) => Number(match.mvp_player_id))
      ),
    ]);

    const teamMap = toTeamMap(teams);
    const gamesByMatch = groupBy(games, (game) => Number(game.match_id));

    return jsonNoStore({
      success: true,
      total: matches.length,
      matches: selected.map((match) =>
        buildMatchSummary(
          match,
          teamMap,
          gamesByMatch.get(Number(match.id)) || [],
          playerNames
        )
      ),
    });
  } catch (error) {
    return jsonError('HISTORIQUE API', error, "Impossible de charger l'historique.");
  }
}
