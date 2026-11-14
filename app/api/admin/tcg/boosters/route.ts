import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { parseBoosterInput } from '@/lib/tcg/boosters';

export const dynamic = 'force-dynamic';

const fail = (message: string, status: number) => NextResponse.json({ success: false, message }, { status });

// Boosters + profils (pour la distribution) + stock total distribué par booster.
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const [boosters, profiles, stock] = await Promise.all([
    supabaseAdmin.from('czf_tcg_boosters').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('profiles').select('id, discord_name').order('discord_name').limit(5000),
    supabaseAdmin.from('czf_tcg_user_boosters').select('booster_id, quantity').gt('quantity', 0).limit(50000),
  ]);

  if (boosters.error) return fail('Impossible de charger les boosters (les tables TCG existent-elles ?).', 500);

  const unopened: Record<number, number> = {};
  for (const row of stock.data || []) unopened[row.booster_id] = (unopened[row.booster_id] || 0) + row.quantity;

  return NextResponse.json({ success: true, boosters: boosters.data, profiles: profiles.data || [], unopened });
}

// Un admin crée un booster.
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const parsed = parseBoosterInput(await request.json().catch(() => ({})));
  if (!parsed.booster) return fail(parsed.error, 400);

  const { data, error } = await supabaseAdmin.from('czf_tcg_boosters').insert(parsed.booster).select('*').single();
  if (error) return fail('Impossible de créer le booster.', 500);

  return NextResponse.json({ success: true, booster: data });
}
