import type { NextRequest } from 'next/server';
import { type AnyObject, groupBy, normalizeRole, roleOrder } from '@/lib/results/core';
import {
  fetchAll,
  invalidDivision,
  jsonError,
  jsonNoStore,
  loadResultsDataset,
  readDivisionParam,
} from '@/lib/results/load';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkPartnerKey } from '@/lib/partenaires/auth';

export const dynamic = 'force-dynamic';

type TeamRef = { id: number; name: string | null };

const num = (value: any) => Number(value) || 0;

// Toutes les équipes, validées ou non : un BO ancien peut référencer une équipe dissoute.
async function loadTeamNames(): Promise<Map<number, string | null>> {
  const rows = await fetchAll((from, to) =>
    supabaseAdmin.from('teams').select('id, name').order('id', { ascending: true }).range(from, to)
  );

  return new Map(rows.map((row) => [Number(row.id), row.name ?? null]));
}

function formatDuration(seconds: number | null): string | null {
  if (!seconds) return null;

  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

// BO joués avec leurs games et les stats de chaque joueur, pour les collaborateurs.
// ?api_key= obligatoire ; ?division=Ixtal pour filtrer.
export async function GET(request: NextRequest) {
  const denied = checkPartnerKey(request);
  if (denied) return denied;

  const { division, invalid } = readDivisionParam(request);
  if (invalid) return invalidDivision();

  try {
    const [dataset, teamNames] = await Promise.all([loadResultsDataset(), loadTeamNames()]);
    const playerNames = new Map(dataset.playerNames);

    const team = (id: any): TeamRef | null =>
      id == null ? null : { id: Number(id), name: teamNames.get(Number(id)) ?? null };

    const matches = division
      ? dataset.matches.filter((match) => match.division === division)
      : dataset.matches;

    const gamesByMatch = groupBy(dataset.games, (game) => Number(game.match_id));
    const statsByGame = groupBy(dataset.stats, (stat) => Number(stat.game_id));

    const buildGame = (game: AnyObject) => {
      const official = (statsByGame.get(Number(game.id)) || []).map((stat) => ({
        playerId: Number(stat.player_id),
        riotId: playerNames.get(Number(stat.player_id)) ?? null,
        isSub: false,
        teamId: Number(stat.team_id),
        teamName: teamNames.get(Number(stat.team_id)) ?? null,
        role: normalizeRole(stat.role),
        champion: stat.champion_id ?? null,
        kills: num(stat.kills),
        deaths: num(stat.deaths),
        assists: num(stat.assists),
        cs: num(stat.cs),
        gold: num(stat.gold),
        damage: num(stat.damage),
        visionScore: num(stat.vision_score),
      }));

      // Les remplaçants n'ont ni compte CZF ni dégâts/vision enregistrés.
      const subs = (Array.isArray(game.substitute_stats) ? game.substitute_stats : []).map(
        (sub: AnyObject) => ({
          playerId: null,
          riotId: null,
          isSub: true,
          teamId: Number(sub.teamId ?? sub.team_id),
          teamName: teamNames.get(Number(sub.teamId ?? sub.team_id)) ?? null,
          role: normalizeRole(sub.role),
          champion: sub.championId ?? sub.champion_id ?? null,
          kills: num(sub.kills),
          deaths: num(sub.deaths),
          assists: num(sub.assists),
          cs: null,
          gold: null,
          damage: null,
          visionScore: null,
        })
      );

      const players = [...official, ...subs];

      // KP = (kills + assists) / kills de l'équipe sur la game.
      const teamKills = new Map<number, number>();
      for (const player of players) {
        teamKills.set(player.teamId, (teamKills.get(player.teamId) ?? 0) + player.kills);
      }

      const teamIds = [...teamKills.keys()].sort((a, b) => a - b);

      return {
        id: Number(game.id),
        gameNumber: Number(game.game_number),
        durationSeconds: game.duration_seconds != null ? Number(game.duration_seconds) : null,
        duration: formatDuration(game.duration_seconds != null ? Number(game.duration_seconds) : null),
        teams: teamIds.map((id) => ({ ...team(id)!, kills: teamKills.get(id) ?? 0 })),
        winner: team(game.winner_team_id),
        players: players
          .sort((a, b) => a.teamId - b.teamId || roleOrder(a.role) - roleOrder(b.role))
          .map((player) => {
            const kills = teamKills.get(player.teamId) ?? 0;

            return {
              ...player,
              killParticipation: kills
                ? Math.round(((player.kills + player.assists) / kills) * 1000) / 10
                : 0,
            };
          }),
      };
    };

    const bo = matches.map((match) => {
      const games = [...(gamesByMatch.get(Number(match.id)) || [])].sort(
        (a, b) => Number(a.game_number) - Number(b.game_number)
      );
      const wins = (teamId: any) =>
        games.filter((game) => Number(game.winner_team_id) === Number(teamId)).length;

      return {
        id: Number(match.id),
        division: match.division,
        stage: match.stage,
        bracket: match.bracket ?? null,
        round: match.round ?? null,
        bestOf: Number(match.best_of),
        playedAt: match.played_at,
        team1: { ...team(match.team1_id), score: wins(match.team1_id) },
        team2: { ...team(match.team2_id), score: wins(match.team2_id) },
        // null en poules sur un 1-1.
        winner: team(match.winner_team_id),
        games: games.map(buildGame),
      };
    });

    return jsonNoStore({ success: true, total: bo.length, bo });
  } catch (error) {
    return jsonError('PARTENAIRES BO API', error, 'Impossible de charger les BO.');
  }
}
