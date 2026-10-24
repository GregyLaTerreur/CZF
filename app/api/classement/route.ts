import type { NextRequest } from 'next/server';
import {
  computeStandings,
  groupBy,
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
    const [teams, matches] = await Promise.all([
      loadValidatedTeams(),
      loadFinishedMatches({ stage: 'pool' }),
    ]);

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
      });
    }

    return jsonNoStore({
      success: true,
      totalTeams: standings.length,
      divisions: splitByDivision(standings, (team) => team.division),
    });
  } catch (error) {
    return jsonError('CLASSEMENT API', error, 'Impossible de charger le classement.');
  }
}
