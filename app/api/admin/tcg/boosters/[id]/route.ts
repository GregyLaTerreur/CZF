import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { parseBoosterInput } from '@/lib/tcg/boosters';

const fail = (message: string, status: number) => NextResponse.json({ success: false, message }, { status });

async function boosterId(params: Promise<{ id: string }>) {
  const id = Number((await params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Un admin modifie un booster (les chances s'appliquent aux prochaines ouvertures).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const id = await boosterId(params);
  if (!id) return fail('Booster introuvable.', 404);

  const parsed = parseBoosterInput(await request.json().catch(() => ({})));
  if (!parsed.booster) return fail(parsed.error, 400);

  const { data, error } = await supabaseAdmin.from('czf_tcg_boosters').update(parsed.booster).eq('id', id).select('*').maybeSingle();
  if (error) return fail('Impossible d’enregistrer le booster.', 500);
  if (!data) return fail('Booster introuvable.', 404);

  return NextResponse.json({ success: true, booster: data });
}

// Un admin supprime un booster : les exemplaires non ouverts disparaissent, les cartes déjà tirées restent.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const id = await boosterId(params);
  if (!id) return fail('Booster introuvable.', 404);

  const { error } = await supabaseAdmin.from('czf_tcg_boosters').delete().eq('id', id);
  if (error) return fail('Impossible de supprimer le booster.', 500);

  return NextResponse.json({ success: true });
}
