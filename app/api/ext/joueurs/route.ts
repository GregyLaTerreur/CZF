import type { NextRequest } from 'next/server';
import { type AnyObject, type Role, groupBy, round2 } from '@/lib/results/core';
import { jsonError, loadResultsDataset, readDivisionParam } from '@/lib/results/load';
import {
  buildGamePlayers,
  extJson,
  formatFrDate,
  loadTeamNames,
  normalizeText,
  percent,
  readIdParam,
} from '@/lib/ext/games';

export const dynamic = 'force-dynamic';

type Line = ReturnType<typeof buildGamePlayers>['players'][number] & {
  teamKills: number;
  seconds: number;
  won: boolean;
  playedAt: string | null;
  division: string;
};

// Stats de chaque joueur calculées à la volée sur toutes ses games officielles.
// ?division=Ixtal : seulement les games de cette division ; ?id_player=133 : un seul joueur ;
// ?riot_id=Pseudo-TAG, Pseudo%23TAG (# encodé) ou Pseudo sans le tag.
export async function GET(request: NextRequest) {
  const { division, invalid } = readDivisionParam(request);

  if (invalid) {
    return extJson({ success: false, error: 'Division inconnue (Yordle, Ixtal ou Targon).' }, 400);
  }

  const { value: onlyPlayer, invalid: invalidPlayer } = readIdParam(request, 'id_player');
  if (invalidPlayer) return extJson({ success: false, error: 'id_player invalide.' }, 400);

  const riotQuery = normalizeText(request.nextUrl.searchParams.get('riot_id'));

  // Le # n'arrive pas au serveur s'il n'est pas encodé : Pseudo-TAG est accepté à la place.
  const dashed = riotQuery.replace(/-([^-]*)$/, '#$1');

  // Avec le tag : Riot ID complet ; sans : seulement le pseudo.
  const matchesRiotId = (riotId: string | null) => {
    const value = normalizeText(riotId);

    if (riotQuery.includes('#')) return value === riotQuery;
    return value === dashed || value.split('#')[0] === riotQuery;
  };

  try {
    const [dataset, teamNames] = await Promise.all([loadResultsDataset(), loadTeamNames()]);
    const playerNames = new Map(dataset.playerNames);
    const matchMap = new Map(dataset.matches.map((match) => [Number(match.id), match]));
    const statsByGame = groupBy(dataset.stats, (stat) => Number(stat.game_id));

    // Une ligne par joueur officiel et par game, avec le contexte de la game.
    const lines: Line[] = [];

    for (const game of dataset.games) {
      const match = matchMap.get(Number(game.match_id));

      if (!match || (division && match.division !== division)) continue;

      const { players, teamKills } = buildGamePlayers(
        game,
        statsByGame.get(Number(game.id)) || [],
        playerNames,
        teamNames
      );

      for (const player of players) {
        if (player.isSub || (onlyPlayer && player.id_player !== onlyPlayer)) continue;
        if (riotQuery && !matchesRiotId(player.riotId)) continue;

        lines.push({
          ...player,
          teamKills: teamKills.get(player.id_team) ?? 0,
          seconds: Number(game.duration_seconds) || 0,
          won: Number(game.winner_team_id) === player.id_team,
          playedAt: match.played_at ?? null,
          division: match.division,
        });
      }
    }

    const mvpCount = new Map<number, number>();

    for (const match of dataset.matches) {
      if (!match.mvp_player_id || (division && match.division !== division)) continue;

      const id = Number(match.mvp_player_id);
      mvpCount.set(id, (mvpCount.get(id) ?? 0) + 1);
    }

    const joueurs = [...groupBy(lines, (line) => line.id_player!)].map(([id, rows]) => {
      const sum = (pick: (row: Line) => number) => rows.reduce((total, row) => total + pick(row), 0);

      const games = rows.length;
      const minutes = sum((row) => row.seconds) / 60;
      const kills = sum((row) => row.kills);
      const deaths = sum((row) => row.deaths);
      const assists = sum((row) => row.assists);
      const damage = sum((row) => row.damage ?? 0);
      const vision = sum((row) => row.visionScore ?? 0);
      const cs = sum((row) => row.cs ?? 0);
      const gold = sum((row) => row.gold ?? 0);
      const wins = rows.filter((row) => row.won).length;
      const perMin = (value: number) => (minutes > 0 ? round2(value / minutes) : 0);

      // Équipe et division de la game la plus récente.
      const last = rows.reduce((a, b) => (String(b.playedAt) > String(a.playedAt) ? b : a));

      const roles: Partial<Record<Role, number>> = {};
      for (const row of rows) {
        if (row.role) roles[row.role] = (roles[row.role] ?? 0) + 1;
      }
      const mainRole = (Object.entries(roles) as [Role, number][])
        .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      return {
        id_player: id,
        riotId: last.riotId,
        id_team: last.id_team,
        teamName: last.teamName,
        division: last.division,
        mainRole,
        roles,
        games,
        wins,
        losses: games - wins,
        winrate: percent(wins, games),
        kills: round2(kills / games),
        deaths: round2(deaths / games),
        assists: round2(assists / games),
        // Même calcul que le site : (K + A) / max(1, D) moyenné par game.
        kda: round2(sum((row) => (row.kills + row.assists) / Math.max(1, row.deaths)) / games),
        killParticipation: percent(kills + assists, sum((row) => row.teamKills)),
        damage: Math.round(damage / games),
        dpm: perMin(damage),
        visionScore: round2(vision / games),
        visionPerMin: perMin(vision),
        cs: round2(cs / games),
        csPerMin: perMin(cs),
        gold: Math.round(gold / games),
        goldPerMin: perMin(gold),
        mvp: mvpCount.get(id) ?? 0,
        totalDurationSeconds: Math.round(minutes * 60),
        lastPlayedAt: formatFrDate(last.playedAt),
      };
    });

    joueurs.sort((a, b) => b.games - a.games || b.kda - a.kda);

    if ((onlyPlayer || riotQuery) && !joueurs.length) {
      return extJson({ success: false, error: 'Aucune game pour ce joueur.' }, 404);
    }

    return extJson({ success: true, total: joueurs.length, joueurs });
  } catch (error) {
    return jsonError('EXT JOUEURS API', error, 'Impossible de charger les joueurs.');
  }
}
