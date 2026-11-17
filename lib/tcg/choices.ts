// Choix du champion et du skin de chaque joueur, par saison (SQL czf-import/tcg-11).
// Serveur uniquement. Sans choix : champion le plus maîtrisé (premier de top_champions), skin de base.
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export type ChampionChoice = { champion: string; skin_num: number; is_default: boolean };

const VALID = /^[A-Za-z]+$/;

// Champion le plus maîtrisé d'un joueur (Riot renvoie les maîtrises triées par points).
export function topChampion(topChampions: unknown): string | null {
  const first = Array.isArray(topChampions) ? (topChampions[0] as { champion_name?: string } | undefined) : undefined;
  return first?.champion_name && VALID.test(first.champion_name) ? first.champion_name : null;
}

export async function isSeasonLaunched(seasonId: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from('czf_tcg_season_launch').select('season_id').eq('season_id', seasonId).maybeSingle();
  return !error && Boolean(data);
}

// Choix de plusieurs joueurs pour une saison (player_id -> choix). Vide si le SQL tcg-11 manque.
export async function loadChoices(seasonId: number, playerIds?: number[]): Promise<Map<number, ChampionChoice>> {
  let query = supabaseAdmin.from('czf_tcg_player_choices').select('player_id, champion, skin_num, is_default').eq('season_id', seasonId);
  if (playerIds) query = query.in('player_id', playerIds);
  const { data, error } = await query;
  if (error) return new Map();
  return new Map((data || []).map((c) => [c.player_id, { champion: c.champion, skin_num: c.skin_num, is_default: c.is_default }]));
}

export const isValidChampion = (value: unknown): value is string => typeof value === 'string' && VALID.test(value) && value.length <= 40;
