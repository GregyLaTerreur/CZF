import { NextResponse } from 'next/server';
import { requireTcgPlayer } from '@/lib/tcg/access';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { rateLimit } from '@/lib/rateLimit';
import { boosterSqlError } from '@/lib/tcg/boosters';
import { decorateCards } from '@/lib/tcg/liveStats';
import type { TcgCard } from '@/lib/tcg/cards';

const fail = (message: string, status: number) => NextResponse.json({ success: false, message }, { status });

// Le joueur connecté ouvre un ou plusieurs boosters d'un même type (count, « Tout ouvrir ») :
// chaque tirage se fait en base (czf_tcg_open_booster), un booster après l'autre.
export async function POST(request: Request) {
  const auth = await requireTcgPlayer(request);
  if (auth.error) return auth.error;

  if (!rateLimit(`tcg-open:${auth.user.id}`, 20, 60_000)) return fail('Doucement : attends un peu avant d’ouvrir d’autres boosters.', 429);

  const body = await request.json().catch(() => ({}));
  const boosterId = Number(body.booster_id);
  if (!Number.isInteger(boosterId) || boosterId < 1) return fail('Booster invalide.', 400);

  const count = Math.min(50, Math.max(1, Math.floor(Number(body.count) || 1)));

  const ids: number[] = [];
  let opened = 0;
  for (let i = 0; i < count; i++) {
    const { data, error } = await supabaseAdmin.rpc('czf_tcg_open_booster', {
      p_profile_id: auth.user.id,
      p_booster_id: boosterId,
    });
    if (error) {
      // Plus de booster en cours de route : on rend ceux déjà ouverts.
      if (opened > 0) break;
      const known = boosterSqlError(error.message);
      return fail(known?.message ?? 'Impossible d’ouvrir le booster.', known?.status ?? 500);
    }
    ids.push(...(data || []).map((row: { drawn_card_id: number }) => row.drawn_card_id));
    opened += 1;
  }
  const { data: rows } = await supabaseAdmin.from('czf_tcg_cards').select('*').in('id', [...new Set(ids)]);
  const byId = new Map((await decorateCards<TcgCard>(rows || [])).map((card) => [Number(card.id), card]));

  return NextResponse.json({ success: true, opened, cards: ids.map((id) => byId.get(id)).filter(Boolean) });
}
