import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { parseCardInput } from '@/lib/tcg/cards';

const fail = (message: string, status: number) => NextResponse.json({ success: false, message }, { status });

async function cardId(params: Promise<{ id: string }>) {
  const id = Number((await params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Un admin modifie une carte.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const id = await cardId(params);
  if (!id) return fail('Carte introuvable.', 404);

  const parsed = parseCardInput(await request.json().catch(() => ({})));
  if (parsed.error) return fail(parsed.error, 400);

  const { data, error } = await supabaseAdmin
    .from('czf_tcg_cards')
    .update({ ...parsed.card, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) return fail('Impossible d’enregistrer la carte.', 500);
  if (!data) return fail('Carte introuvable.', 404);

  return NextResponse.json({ success: true, card: data });
}

// Un admin supprime une carte.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const id = await cardId(params);
  if (!id) return fail('Carte introuvable.', 404);

  const { error } = await supabaseAdmin.from('czf_tcg_cards').delete().eq('id', id);
  if (error) return fail('Impossible de supprimer la carte.', 500);

  return NextResponse.json({ success: true });
}
