// Stats en direct des cartes Joueur liées à un joueur : recalculées depuis ses games CZF officielles
// (mêmes formules que /api/ext/joueurs). Les MVP et les cartes simples gardent leurs stats figées.
// Serveur uniquement (jeu de résultats en cache, invalidé à chaque publication de match).

import { groupBy, round2 } from '@/lib/results/core';
import { loadResultsDataset } from '@/lib/results/load';
import { buildGamePlayers, loadTeamNames, percent } from '@/lib/ext/games';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { RARITIES, type CardStat, type Rarity, type TcgCard } from '@/lib/tcg/cards';

// Clé joueur + saison : une carte ne compte que les games des matchs de sa saison (czf_matches.season_id).
const key = (playerId: number, seasonId: number | null | undefined) => `${playerId}:${seasonId ?? ''}`;

async function computeStats(playerIds: Set<number>): Promise<Map<string, CardStat[]>> {
  const [dataset, teamNames] = await Promise.all([loadResultsDataset(), loadTeamNames()]);
  const playerNames = new Map(dataset.playerNames);
  const statsByGame = groupBy(dataset.stats, (stat) => Number(stat.game_id));
  const seasonByMatch = new Map(dataset.matches.map((match) => [Number(match.id), match.season_id == null ? null : Number(match.season_id)]));

  type Row = { kills: number; deaths: number; assists: number; damage: number; vision: number; teamKills: number; seconds: number; won: boolean };
  const rows = new Map<string, Row[]>();

  for (const game of dataset.games) {
    const season = seasonByMatch.get(Number(game.match_id)) ?? null;
    const { players, teamKills } = buildGamePlayers(game, statsByGame.get(Number(game.id)) || [], playerNames, teamNames);

    for (const player of players) {
      if (player.isSub || !player.id_player || !playerIds.has(player.id_player)) continue;
      const k = key(player.id_player, season);
      if (!rows.has(k)) rows.set(k, []);
      rows.get(k)!.push({
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

  const result = new Map<string, CardStat[]>();
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
      const stats = card.card_type === 'joueur' && card.player_id ? live.get(key(Number(card.player_id), card.season_id)) : undefined;
      return stats ? { ...card, stats, live_stats: true } : card;
    });
  } catch (error) {
    console.error('[TCG] stats en direct indisponibles', error);
    return cards;
  }
}

// Numéro de la carte dans sa saison (« 12 / 90 »).
// Saison pas encore figée : calculé (communes, rares, épiques, légendaires, puis par création), total = nombre de cartes.
// Saison figée (czf_tcg_numbering, bouton de l'admin) : numéro enregistré et total figé ; une carte ajoutée
// ensuite prend le numéro suivant (91/90). Sans les tables du SQL tcg-8, toujours le calcul.
export async function withNumbers<T extends TcgCard>(cards: T[]): Promise<T[]> {
  if (!cards.length) return cards;

  const [stored, numbering] = await Promise.all([
    supabaseAdmin.from('czf_tcg_cards').select('id, season_id, rarity, number').limit(10000),
    supabaseAdmin.from('czf_tcg_numbering').select('season_id, total'),
  ]);
  const rows: { id: number; season_id: number | null; rarity: Rarity; number: number | null }[] = stored.error
    ? ((await supabaseAdmin.from('czf_tcg_cards').select('id, season_id, rarity').limit(10000)).data || []).map((r) => ({ ...r, number: null }))
    : stored.data || [];
  const frozen = new Map((numbering.error ? [] : numbering.data || []).map((n) => [String(n.season_id), Number(n.total)]));

  const bySeason = new Map<string, typeof rows>();
  for (const row of rows) {
    const season = String(row.season_id ?? '');
    if (!bySeason.has(season)) bySeason.set(season, []);
    bySeason.get(season)!.push(row);
  }

  const numbers = new Map<number, { number: number; total: number }>();
  for (const [season, list] of bySeason) {
    const total = frozen.get(season);
    if (total !== undefined) {
      for (const card of list) if (card.number != null) numbers.set(Number(card.id), { number: Number(card.number), total });
      continue;
    }
    list.sort((a, b) => RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity) || a.id - b.id);
    list.forEach((card, index) => numbers.set(Number(card.id), { number: index + 1, total: list.length }));
  }

  return cards.map((card) => {
    const n = numbers.get(Number(card.id));
    return n ? { ...card, number: n.number, season_total: n.total } : card;
  });
}

// Stats en direct + numérotation, pour tout ce qui affiche des cartes aux joueurs ou à l'admin.
// Note des cartes rares et épiques liées à un joueur : celle du joueur pour la saison de la carte
// (table czf_player_rating, SQL czf-import/joueur-note-1-player-rating.sql). Sans note du joueur, celle de la carte.
const RATED_RARITIES = ['rare', 'epique'];

export async function withRatings<T extends TcgCard>(cards: T[]): Promise<T[]> {
  const rated = cards.filter((c) => c.player_id && c.season_id && RATED_RARITIES.includes(c.rarity));
  if (!rated.length) return cards;
  const { data, error } = await supabaseAdmin
    .from('czf_player_rating')
    .select('season_id, player_id, note')
    .in('player_id', [...new Set(rated.map((c) => c.player_id as number))]);
  if (error || !data) return cards;
  const notes = new Map(data.map((r) => [`${r.season_id}:${r.player_id}`, r.note as number]));
  return cards.map((card) => {
    if (!card.player_id || !card.season_id || !RATED_RARITIES.includes(card.rarity)) return card;
    const note = notes.get(`${card.season_id}:${card.player_id}`);
    return note === undefined ? card : { ...card, note };
  });
}

export async function decorateCards<T extends TcgCard>(cards: T[]): Promise<T[]> {
  return withNumbers(await withRatings(await withLiveStats(cards)));
}
