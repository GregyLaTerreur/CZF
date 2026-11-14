import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { boosterSqlError } from '@/lib/tcg/boosters';

const fail = (message: string, status: number) => NextResponse.json({ success: false, message }, { status });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Un admin donne des boosters à un profil, ou à tous les profils (profile_id vide).
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const boosterId = Number(body.booster_id);
  const quantity = Number(body.quantity);
  const profileId = body.profile_id ? String(body.profile_id) : null;

  if (!Number.isInteger(boosterId) || boosterId < 1) return fail('Choisis un booster.', 400);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) return fail('Quantité invalide (1 à 100).', 400);
  if (profileId && !UUID.test(profileId)) return fail('Profil invalide.', 400);

  const { data, error } = await supabaseAdmin.rpc('czf_tcg_give_boosters', {
    p_booster_id: boosterId,
    p_quantity: quantity,
    p_profile_id: profileId,
  });

  if (error) {
    const known = boosterSqlError(error.message);
    return fail(known?.message ?? 'Impossible de donner les boosters.', known?.status ?? 500);
  }

  return NextResponse.json({ success: true, served: data });
}
