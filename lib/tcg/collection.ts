// Collections TCG côté serveur : la collection d'un profil et le classement des collectionneurs.
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { loadSeasons } from '@/lib/tcg/seasons';
import { decorateCards } from '@/lib/tcg/liveStats';
import type { TcgCard } from '@/lib/tcg/cards';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isProfileId = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

// Nom affiché d'un profil : pseudo Riot du joueur lié, sinon pseudo Discord.
export async function loadProfileNames(profileIds: string[]): Promise<Map<string, { name: string; playerId: number | null }>> {
  const names = new Map<string, { name: string; playerId: number | null }>();
  if (!profileIds.length) return names;

  const [profiles, players] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, discord_name').in('id', profileIds),
    supabaseAdmin.from('players').select('id, riot_id, profile_id').in('profile_id', profileIds),
  ]);

  for (const p of profiles.data || []) names.set(p.id, { name: p.discord_name || 'Joueur', playerId: null });
  for (const p of players.data || []) {
    if (p.profile_id && p.riot_id) names.set(p.profile_id, { name: String(p.riot_id).split('#')[0], playerId: Number(p.id) });
  }
  return names;
}

// Collection d'un profil : tout le catalogue avec le nombre d'exemplaires possédés.
export async function loadCollection(profileId: string) {
  const [owned, all, seasons] = await Promise.all([
    supabaseAdmin.from('czf_tcg_user_cards').select('card_id').eq('profile_id', profileId).limit(20000),
    supabaseAdmin.from('czf_tcg_cards').select('*').limit(10000),
    loadSeasons(),
  ]);

  if (owned.error || all.error) throw new Error('Impossible de charger la collection.');

  const counts = new Map<number, number>();
  for (const row of owned.data) counts.set(row.card_id, (counts.get(row.card_id) || 0) + 1);

  const allCards = await decorateCards<TcgCard>((all.data || []) as TcgCard[]);
  const catalog = allCards.map((card) => ({ card, count: counts.get(Number(card.id)) || 0 }));

  return {
    catalog,
    cards: catalog.filter((item) => item.count > 0),
    totalCards: catalog.length,
    // Nombre de cartes existantes par rareté (tuile Légendaires : 1 / 2).
    totalsByRarity: allCards.reduce<Record<string, number>>((acc, card) => ({ ...acc, [card.rarity]: (acc[card.rarity] || 0) + 1 }), {}),
    seasons,
  };
}

export type LeaderboardEntry = { profileId: string; name: string; playerId: number | null; cards: number; boosters: number };

// Classement : cartes différentes possédées, puis boosters acquis (ouverts + pas encore ouverts).
// Les cartes d'une même ouverture partagent leur obtained_at (même transaction) : une date = un booster ouvert.
export async function loadLeaderboard(limit = 30): Promise<LeaderboardEntry[]> {
  const [owned, unopened] = await Promise.all([
    supabaseAdmin.from('czf_tcg_user_cards').select('profile_id, card_id, obtained_at').limit(100000),
    supabaseAdmin.from('czf_tcg_user_boosters').select('profile_id, quantity').gt('quantity', 0).limit(50000),
  ]);

  const stats = new Map<string, { cards: Set<number>; openings: Set<string>; unopened: number }>();
  const get = (id: string) => {
    if (!stats.has(id)) stats.set(id, { cards: new Set(), openings: new Set(), unopened: 0 });
    return stats.get(id)!;
  };

  for (const row of owned.data || []) {
    const s = get(row.profile_id);
    s.cards.add(Number(row.card_id));
    s.openings.add(String(row.obtained_at));
  }
  for (const row of unopened.data || []) get(row.profile_id).unopened += row.quantity;

  const ranked = [...stats.entries()]
    .map(([profileId, s]) => ({ profileId, cards: s.cards.size, boosters: s.openings.size + s.unopened }))
    .filter((e) => e.cards > 0 || e.boosters > 0)
    .sort((a, b) => b.cards - a.cards || b.boosters - a.boosters)
    .slice(0, limit);

  const names = await loadProfileNames(ranked.map((e) => e.profileId));
  return ranked.map((e) => ({ ...e, name: names.get(e.profileId)?.name ?? 'Joueur', playerId: names.get(e.profileId)?.playerId ?? null }));
}
