import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { loadSeasons } from '@/lib/tcg/seasons';
import { decorateCards } from '@/lib/tcg/liveStats';
import type { TcgCard } from '@/lib/tcg/cards';

export const dynamic = 'force-dynamic';

// Collection du joueur connecté : ses boosters non ouverts et ses cartes (avec le nombre d'exemplaires).
export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  const [boosters, owned, total, seasons] = await Promise.all([
    supabaseAdmin
      .from('czf_tcg_user_boosters')
      .select('quantity, booster:czf_tcg_boosters(*)')
      .eq('profile_id', auth.user.id)
      .gt('quantity', 0),
    supabaseAdmin.from('czf_tcg_user_cards').select('card_id, obtained_at').eq('profile_id', auth.user.id).limit(10000),
    supabaseAdmin.from('czf_tcg_cards').select('*').limit(10000),
    loadSeasons(),
  ]);

  if (boosters.error || owned.error) {
    return NextResponse.json({ success: false, message: 'Impossible de charger ta collection.' }, { status: 500 });
  }

  const counts = new Map<number, number>();
  for (const row of owned.data) counts.set(row.card_id, (counts.get(row.card_id) || 0) + 1);

  // Tout le catalogue : la collection montre aussi, en grisé, les cartes pas encore obtenues.
  const allCards = await decorateCards<TcgCard>((total.data || []) as TcgCard[]);
  const catalog = allCards.map((card) => ({ card, count: counts.get(Number(card.id)) || 0 }));

  return NextResponse.json({
    success: true,
    boosters: boosters.data.filter((row) => row.booster),
    catalog,
    cards: catalog.filter((item) => item.count > 0),
    totalCards: catalog.length,
    // Nombre de cartes existantes par rareté (tuile Légendaires : 1 / 2).
    totalsByRarity: allCards.reduce<Record<string, number>>((acc, card) => ({ ...acc, [card.rarity]: (acc[card.rarity] || 0) + 1 }), {}),
    seasons,
  });
}
