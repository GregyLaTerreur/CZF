import type { NextRequest } from 'next/server';
import {
  type AnyObject,
  buildMatchSummary,
  computeChampionStats,
  computePlayerStats,
  computeStandings,
  getChampions,
  groupBy,
  parseExclusions,
} from '@/lib/results/core';
import {
  jsonError,
  jsonNoStore,
  loadResultsDataset,
  readDivisionParam,
  toTeamMap,
} from '@/lib/results/load';

export const dynamic = 'force-dynamic';

// Tout ce qu'affichent les pages Résultats et Stats pour une division, en une requête :
// classement, historique, stats joueurs et champions. ?division= obligatoire.
// Les données viennent du cache partagé (cf. loadResultsDataset).
export async function GET(request: NextRequest) {
  const { division } = readDivisionParam(request);

  if (!division) {
    return jsonNoStore(
      { success: false, error: 'Division requise (Yordle, Ixtal ou Targon).' },
      400
    );
  }

  try {
    const [dataset, champions] = await Promise.all([loadResultsDataset(), getChampions()]);
    const { matches: allMatches, teams, games, exclusions } = dataset;

    const matches = allMatches.filter((match) => match.division === division);
    const matchIds = new Set(matches.map((match) => Number(match.id)));
    const divisionGameIds = new Set(
      games.filter((game) => matchIds.has(Number(game.match_id))).map((game) => Number(game.id))
    );
    const inDivision = (stat: AnyObject) => divisionGameIds.has(Number(stat.game_id));

    const currentIds = new Set(dataset.currentStatIds);
    const playerNames = new Map(dataset.playerNames);
    const teamMap = toTeamMap(teams);
    const gamesByMatch = groupBy(games, (game) => Number(game.match_id));

    // Classement calculé comme /api/classement : poules, toutes divisions.
    const standings = computeStandings(
      teams.map((team) => ({ ...team, wins: 0, losses: 0, gameDiff: 0 })),
      allMatches,
      gamesByMatch
    ).filter((team) => team.division === division);

    return jsonNoStore({
      success: true,
      division,
      teams: standings,
      history: matches.map((match) =>
        buildMatchSummary(
          match,
          teamMap,
          gamesByMatch.get(Number(match.id)) || [],
          playerNames
        )
      ),
      playerStats: computePlayerStats(division, {
        matches,
        games,
        currentStats: dataset.stats.filter((stat) => inDivision(stat) && currentIds.has(Number(stat.id))),
        teamMap,
        playerNames,
        exclusions: parseExclusions(exclusions),
      }),
      champions: computeChampionStats(division, {
        matches,
        games,
        stats: dataset.stats.filter(inDivision),
        championMap: new Map(champions.map((champion) => [champion.id, champion])),
        playerNames,
        teamMap,
      }),
    });
  } catch (error) {
    return jsonError('RESULTATS API', error, 'Impossible de charger les résultats.');
  }
}
