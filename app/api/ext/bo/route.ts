import type { NextRequest } from 'next/server';
import { type AnyObject, groupBy } from '@/lib/results/core';
import { jsonError, loadResultsDataset, readDivisionParam } from '@/lib/results/load';
import { buildGamePlayers, extJson, formatFrDate, loadTeamNames } from '@/lib/ext/games';

export const dynamic = 'force-dynamic';

function formatDuration(seconds: number | null): string | null {
  if (!seconds) return null;

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

// BO joués → games → joueurs, en lecture seule. ?division=Ixtal pour filtrer.
export async function GET(request: NextRequest) {
  const { division, invalid } = readDivisionParam(request);

  if (invalid) {
    return extJson({ success: false, error: 'Division inconnue (Yordle, Ixtal ou Targon).' }, 400);
  }

  try {
    const [dataset, teamNames] = await Promise.all([loadResultsDataset(), loadTeamNames()]);
    const playerNames = new Map(dataset.playerNames);

    const team = (id: any) =>
      id == null ? null : { id_team: Number(id), name: teamNames.get(Number(id)) ?? null };

    const matches = division
      ? dataset.matches.filter((match) => match.division === division)
      : dataset.matches;

    const gamesByMatch = groupBy(dataset.games, (game) => Number(game.match_id));
    const statsByGame = groupBy(dataset.stats, (stat) => Number(stat.game_id));

    const buildGame = (game: AnyObject) => {
      const { players, teamKills } = buildGamePlayers(
        game,
        statsByGame.get(Number(game.id)) || [],
        playerNames,
        teamNames
      );
      const seconds = game.duration_seconds != null ? Number(game.duration_seconds) : null;

      return {
        id_game: Number(game.id),
        gameNumber: Number(game.game_number),
        durationSeconds: seconds,
        duration: formatDuration(seconds),
        teams: [...teamKills.keys()]
          .sort((a, b) => a - b)
          .map((id) => ({ ...team(id)!, kills: teamKills.get(id) ?? 0 })),
        winner: team(game.winner_team_id),
        players,
      };
    };

    const bo = matches.map((match) => {
      const games = [...(gamesByMatch.get(Number(match.id)) || [])].sort(
        (a, b) => Number(a.game_number) - Number(b.game_number)
      );
      const wins = (teamId: any) =>
        games.filter((game) => Number(game.winner_team_id) === Number(teamId)).length;

      return {
        id_bo: Number(match.id),
        division: match.division,
        stage: match.stage,
        bracket: match.bracket ?? null,
        round: match.round ?? null,
        bestOf: Number(match.best_of),
        playedAt: formatFrDate(match.played_at),
        team1: { ...team(match.team1_id), score: wins(match.team1_id) },
        team2: { ...team(match.team2_id), score: wins(match.team2_id) },
        // null en poules sur un 1-1.
        winner: team(match.winner_team_id),
        games: games.map(buildGame),
      };
    });

    return extJson({ success: true, total: bo.length, bo });
  } catch (error) {
    return jsonError('EXT BO API', error, 'Impossible de charger les BO.');
  }
}
