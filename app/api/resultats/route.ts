import type { NextRequest } from 'next/server';
import {
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

// Tout ce qu'affiche la page Résultats pour une division, en une requête :
// classement, historique, stats joueurs et champions. ?division= obligatoire.
// Les matchs, games et équipes ne sont lus qu'une fois au lieu de quatre.
export async function GET(request: NextRequest) {
  const { division } = readDivisionParam(request);

  if (!division) {
    return jsonNoStore(
      { success: false, error: 'Division requise (Yordle, Ixtal ou Targon).' },
      400
    );
  }

  try {
    const [allMatches, teams, exclusionRows, champions] = await Promise.all([
      loadFinishedMatches(),
      loadValidatedTeams(),
      loadExclusions(),
      getChampions(),
    ]);

    const games = await loadGames(
      allMatches.map((match) => Number(match.id)),
      'id, match_id, duration_seconds, winner_team_id'
    );

    const matches = allMatches.filter((match) => match.division === division);
    const matchIds = new Set(matches.map((match) => Number(match.id)));
    const divisionGameIds = games
      .filter((game) => matchIds.has(Number(game.match_id)))
      .map((game) => Number(game.id));

    const [currentStats, stats] = await Promise.all([
      loadStats('czf_current_player_stats', divisionGameIds),
      loadStats('czf_game_player_stats', divisionGameIds),
    ]);

    // Noms des joueurs classés et des MVP en une seule lecture.
    const playerNames = await loadPlayerNames([
      ...currentStats.map((stat) => Number(stat.player_id)),
      ...matches
        .filter((match) => match.mvp_player_id)
        .map((match) => Number(match.mvp_player_id)),
    ]);

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
        currentStats,
        teamMap,
        playerNames,
        exclusions: parseExclusions(exclusionRows),
      }),
      champions: computeChampionStats(division, {
        matches,
        games,
        stats,
        championMap: new Map(champions.map((champion) => [champion.id, champion])),
      }),
    });
  } catch (error) {
    return jsonError('RESULTATS API', error, 'Impossible de charger les résultats.');
  }
}
