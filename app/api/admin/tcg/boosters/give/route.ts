import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { boosterSqlError } from '@/lib/tcg/boosters';

const fail = (message: string, status: number) => NextResponse.json({ success: false, message }, { status });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Un admin donne des boosters à une liste de profils (profile_ids), ou à tous (all: true).
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const boosterId = Number(body.booster_id);
  const quantity = Number(body.quantity);
  const all = body.all === true;
  const profileIds: string[] = Array.isArray(body.profile_ids) ? [...new Set(body.profile_ids.map(String))] as string[] : [];

  if (!Number.isInteger(boosterId) || boosterId < 1) return fail('Choisis un booster.', 400);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) return fail('Quantité invalide (1 à 100).', 400);
  if (!all && !profileIds.length) return fail('Choisis au moins un joueur.', 400);
  if (profileIds.length > 5000 || profileIds.some((id) => !UUID.test(id))) return fail('Liste de joueurs invalide.', 400);

  const { data, error } = await supabaseAdmin.rpc('czf_tcg_give_boosters', {
    p_booster_id: boosterId,
    p_quantity: quantity,
    p_profile_ids: all ? null : profileIds,
  });

  if (error) {
    const known = boosterSqlError(error.message);
    return fail(known?.message ?? 'Impossible de donner les boosters.', known?.status ?? 500);
  }

  return NextResponse.json({ success: true, served: data });
}
