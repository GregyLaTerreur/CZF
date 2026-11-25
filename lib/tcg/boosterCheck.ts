// Vérifie qu'un booster peut être rempli sans doublon avec les cartes de sa saison. Serveur uniquement.
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { RARITY_LABELS, type Rarity } from '@/lib/tcg/cards';
import type { TcgBooster } from '@/lib/tcg/boosters';

// Avertissements (pas bloquants : on peut créer les cartes après le booster).
export async function boosterWarnings(seasonId: number, booster: TcgBooster): Promise<string[]> {
  let query = supabaseAdmin.from('czf_tcg_cards').select('rarity').eq('season_id', seasonId);
  if (booster.card_type !== 'tout') query = query.eq('card_type', booster.card_type);
  const { data, error } = await query;
  if (error) return [];

  const byRarity = (data || []).reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.rarity]: (acc[c.rarity] || 0) + 1 }), {});
  const total = data?.length ?? 0;
  const warnings: string[] = [];

  if (total < booster.cards_per_pack) {
    warnings.push(`Seulement ${total} carte${total > 1 ? 's' : ''} différente${total > 1 ? 's' : ''} pour ce booster : sans doublon, un paquet en contiendra ${total} au lieu de ${booster.cards_per_pack}.`);
  }
  for (const rarity of ['rare', 'epique', 'legendaire'] as Rarity[]) {
    const wanted = booster[`min_${rarity}` as 'min_rare' | 'min_epique' | 'min_legendaire'] ?? 0;
    const available = byRarity[rarity] || 0;
    if (wanted > available) {
      warnings.push(`Minimum ${RARITY_LABELS[rarity].toLowerCase()} : ${wanted} demandé${wanted > 1 ? 's' : ''}, mais ${available} carte${available > 1 ? 's' : ''} de cette rareté : le paquet en aura ${available}.`);
    }
  }
  return warnings;
}
