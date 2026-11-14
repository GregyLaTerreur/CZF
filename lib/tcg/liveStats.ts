// Stats en direct des cartes Joueur liées à un joueur : recalculées depuis ses games CZF officielles
// (mêmes formules que /api/ext/joueurs). Les MVP et les cartes simples gardent leurs stats figées.
// Serveur uniquement (jeu de résultats en cache, invalidé à chaque publication de match).

import { groupBy, round2 } from '@/lib/results/core';
import { loadResultsDataset } from '@/lib/results/load';
import { buildGamePlayers, loadTeamNames, percent } from '@/lib/ext/games';
import type { CardStat, TcgCard } from '@/lib/tcg/cards';

// Pas encore de saison sur les matchs : toutes les games officielles comptent (une seule saison à ce jour).
async function computeStats(playerIds: Set<number>): Promise<Map<number, CardStat[]>> {
  const [dataset, teamNames] = await Promise.all([loadResultsDataset(), loadTeamNames()]);
  const playerNames = new Map(dataset.playerNames);
  const statsByGame = groupBy(dataset.stats, (stat) => Number(stat.game_id));

  type Row = { kills: number; deaths: number; assists: number; damage: number; vision: number; teamKills: number; seconds: number; won: boolean };
  const rows = new Map<number, Row[]>();

  for (const game of dataset.games) {
    const { players, teamKills } = buildGamePlayers(game, statsByGame.get(Number(game.id)) || [], playerNames, teamNames);

    for (const player of players) {
      if (player.isSub || !player.id_player || !playerIds.has(player.id_player)) continue;
      if (!rows.has(player.id_player)) rows.set(player.id_player, []);
      rows.get(player.id_player)!.push({
        kills: player.kills,
        deaths: player.deaths,
        assists: player.assists,
        damage: player.damage ?? 0,
        vision: player.visionScore ?? 0,
        teamKills: teamKills.get(player.id_team) ?? 0,
        seconds: Number(game.duration_seconds) || 0,
        won: Number(game.winner_team_id) === player.id_team,
      });
    }
  }

  const result = new Map<number, CardStat[]>();
  for (const [id, list] of rows) {
    const sum = (pick: (row: Row) => number) => list.reduce((total, row) => total + pick(row), 0);
    const games = list.length;
    const minutes = sum((row) => row.seconds) / 60;
    const perMin = (value: number) => (minutes > 0 ? value / minutes : 0);

    result.set(id, [
      { label: 'KDA', value: (round2(sum((row) => (row.kills + row.assists) / Math.max(1, row.deaths)) / games)).toFixed(1) },
      { label: 'KP%', value: String(Math.round(percent(sum((row) => row.kills + row.assists), sum((row) => row.teamKills)))) },
      { label: 'DPM', value: String(Math.round(perMin(sum((row) => row.damage)))) },
      { label: 'VIS/M', value: perMin(sum((row) => row.vision)).toFixed(1) },
      { label: 'WR%', value: String(Math.round(percent(list.filter((row) => row.won).length, games))) },
    ]);
  }

  return result;
}

// Remplace les stats des cartes Joueur liées par leurs stats du moment (sans games : stats enregistrées).
export async function withLiveStats<T extends TcgCard>(cards: T[]): Promise<T[]> {
  const ids = new Set(cards.filter((c) => c.card_type === 'joueur' && c.player_id).map((c) => Number(c.player_id)));
  if (!ids.size) return cards;

  try {
    const live = await computeStats(ids);
    return cards.map((card) => {
      const stats = card.card_type === 'joueur' && card.player_id ? live.get(Number(card.player_id)) : undefined;
      return stats ? { ...card, stats, live_stats: true } : card;
    });
  } catch (error) {
    console.error('[TCG] stats en direct indisponibles', error);
    return cards;
  }
}
