import type { NextRequest } from 'next/server';
import {
  computeStandings,
  groupBy,
  lastResultUpdate,
  splitByDivision,
} from '@/lib/results/core';
import {
  invalidDivision,
  jsonError,
  jsonNoStore,
  loadFinishedMatches,
  loadGames,
  loadValidatedTeams,
  readDivisionParam,
} from '@/lib/results/load';

export const dynamic = 'force-dynamic';

// Classement des équipes (poules) : ?division=Ixtal ou toutes les divisions.
export async function GET(request: NextRequest) {
  const { division, invalid } = readDivisionParam(request);

  if (invalid) return invalidDivision();

  try {
    const [teams, allMatches] = await Promise.all([loadValidatedTeams(), loadFinishedMatches()]);
    const matches = allMatches.filter((match) => match.stage === 'pool');

    // Dernier résultat ajouté par division (poules et playoffs).
    const byDivision = splitByDivision(allMatches, (match) => match.division);
    const lastUpdates = {
      Yordle: lastResultUpdate(byDivision.Yordle),
      Ixtal: lastResultUpdate(byDivision.Ixtal),
      Targon: lastResultUpdate(byDivision.Targon),
    };

    const games = await loadGames(
      matches.map((match) => Number(match.id)),
      'id, match_id, winner_team_id'
    );

    const standings = computeStandings(
      teams.map((team) => ({ ...team, wins: 0, losses: 0, gameDiff: 0 })),
      matches,
      groupBy(games, (game) => Number(game.match_id))
    );

    if (division) {
      return jsonNoStore({
        success: true,
        division,
        teams: standings.filter((team) => team.division === division),
        lastUpdate: lastUpdates[division],
      });
    }

    return jsonNoStore({
      success: true,
      totalTeams: standings.length,
      lastUpdates,
      divisions: splitByDivision(standings, (team) => team.division),
    });
  } catch (error) {
    return jsonError('CLASSEMENT API', error, 'Impossible de charger le classement.');
  }
}
