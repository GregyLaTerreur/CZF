import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// Collection du joueur connecté : ses boosters non ouverts et ses cartes (avec le nombre d'exemplaires).
export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  const [boosters, owned, total] = await Promise.all([
    supabaseAdmin
      .from('czf_tcg_user_boosters')
      .select('quantity, booster:czf_tcg_boosters(*)')
      .eq('profile_id', auth.user.id)
      .gt('quantity', 0),
    supabaseAdmin.from('czf_tcg_user_cards').select('card_id, obtained_at').eq('profile_id', auth.user.id).limit(10000),
    supabaseAdmin.from('czf_tcg_cards').select('id', { count: 'exact', head: true }),
  ]);

  if (boosters.error || owned.error) {
    return NextResponse.json({ success: false, message: 'Impossible de charger ta collection.' }, { status: 500 });
  }

  const counts = new Map<number, number>();
  for (const row of owned.data) counts.set(row.card_id, (counts.get(row.card_id) || 0) + 1);

  const cardIds = [...counts.keys()];
  const cards = cardIds.length
    ? (await supabaseAdmin.from('czf_tcg_cards').select('*').in('id', cardIds)).data || []
    : [];

  return NextResponse.json({
    success: true,
    boosters: boosters.data.filter((row) => row.booster),
    cards: cards.map((card) => ({ card, count: counts.get(card.id) || 0 })),
    totalCards: total.count || 0,
  });
}
