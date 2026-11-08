import type { NextRequest } from 'next/server';
import { type AnyObject, groupBy } from '@/lib/results/core';
import { jsonError, loadResultsDataset, readDivisionParam } from '@/lib/results/load';
import {
  buildGamePlayers,
  extJson,
  formatFrDate,
  loadTeamNames,
  normalizeText,
  readIdParam,
} from '@/lib/ext/games';

export const dynamic = 'force-dynamic';

function formatDuration(seconds: number | null): string | null {
  if (!seconds) return null;

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

// BO joués → games → joueurs, en lecture seule.
// Filtres : ?division=Ixtal, ?id_team=38, ?team=Season's (sans casse ni accents).
export async function GET(request: NextRequest) {
  const { division, invalid } = readDivisionParam(request);

  if (invalid) {
    return extJson({ success: false, error: 'Division inconnue (Yordle, Ixtal ou Targon).' }, 400);
  }

  const idTeam = readIdParam(request, 'id_team');
  if (idTeam.invalid) return extJson({ success: false, error: 'id_team invalide.' }, 400);

  const teamQuery = normalizeText(request.nextUrl.searchParams.get('team'));

  try {
    const [dataset, teamNames] = await Promise.all([loadResultsDataset(), loadTeamNames()]);
    const playerNames = new Map(dataset.playerNames);

    const team = (id: any) =>
      id == null ? null : { id_team: Number(id), name: teamNames.get(Number(id)) ?? null };

    // Nom exact d'abord, sinon toutes les équipes dont le nom le contient.
    let teamIds: Set<number> | null = null;

    if (teamQuery) {
      const named = [...teamNames].map(([id, name]) => ({ id, name: normalizeText(name) }));
      const exact = named.filter((item) => item.name === teamQuery);
      const found = exact.length ? exact : named.filter((item) => item.name.includes(teamQuery));

      if (!found.length) return extJson({ success: false, error: 'Équipe introuvable.' }, 404);

      teamIds = new Set(found.map((item) => item.id));
    }

    const plays = (match: AnyObject, ids: Set<number>) =>
      ids.has(Number(match.team1_id)) || ids.has(Number(match.team2_id));

    const matches = dataset.matches.filter(
      (match) =>
        (!division || match.division === division) &&
        (!idTeam.value || plays(match, new Set([idTeam.value]))) &&
        (!teamIds || plays(match, teamIds))
    );

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

    return extJson({ success: true, total: bo.length, matches: bo });
  } catch (error) {
    return jsonError('EXT MATCHES API', error, 'Impossible de charger les matchs.');
  }
}
