import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { rateLimit } from '@/lib/rateLimit';
import { boosterSqlError } from '@/lib/tcg/boosters';
import { decorateCards } from '@/lib/tcg/liveStats';
import type { TcgCard } from '@/lib/tcg/cards';

const fail = (message: string, status: number) => NextResponse.json({ success: false, message }, { status });

// Le joueur connecté ouvre un de ses boosters : le tirage se fait en base (czf_tcg_open_booster).
export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  if (!rateLimit(`tcg-open:${auth.user.id}`, 20, 60_000)) return fail('Doucement : attends un peu avant d’ouvrir d’autres boosters.', 429);

  const body = await request.json().catch(() => ({}));
  const boosterId = Number(body.booster_id);
  if (!Number.isInteger(boosterId) || boosterId < 1) return fail('Booster invalide.', 400);

  const { data, error } = await supabaseAdmin.rpc('czf_tcg_open_booster', {
    p_profile_id: auth.user.id,
    p_booster_id: boosterId,
  });

  if (error) {
    const known = boosterSqlError(error.message);
    return fail(known?.message ?? 'Impossible d’ouvrir le booster.', known?.status ?? 500);
  }

  const ids: number[] = (data || []).map((row: { drawn_card_id: number }) => row.drawn_card_id);
  const { data: rows } = await supabaseAdmin.from('czf_tcg_cards').select('*').in('id', ids);
  const byId = new Map((await decorateCards<TcgCard>(rows || [])).map((card) => [Number(card.id), card]));

  return NextResponse.json({ success: true, cards: ids.map((id) => byId.get(id)).filter(Boolean) });
}
