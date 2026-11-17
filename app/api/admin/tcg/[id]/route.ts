import { NextResponse } from 'next/server';
import { requireTcgAdmin } from '@/lib/tcg/access';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { tcgDbMessage } from '@/lib/tcg/dbError';
import { parseCardInput } from '@/lib/tcg/cards';
import { resolveSeasonId } from '@/lib/tcg/seasons';
import { shareFraming } from '@/lib/tcg/framing';

const fail = (message: string, status: number) => NextResponse.json({ success: false, message }, { status });

async function cardId(params: Promise<{ id: string }>) {
  const id = Number((await params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Un admin modifie une carte.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTcgAdmin(request);
  if (auth.error) return auth.error;

  const id = await cardId(params);
  if (!id) return fail('Carte introuvable.', 404);

  const body = await request.json().catch(() => ({}));
  const parsed = parseCardInput(body);
  if (parsed.error) return fail(parsed.error, 400);

  const seasonId = await resolveSeasonId(body.season_id);
  if (!seasonId) return fail('Aucune saison en base.', 400);

  const { data, error } = await supabaseAdmin
    .from('czf_tcg_cards')
    .update({ ...parsed.card, season_id: seasonId, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) return fail(tcgDbMessage(error, 'Impossible d’enregistrer la carte.'), 500);
  if (!data) return fail('Carte introuvable.', 404);

  return NextResponse.json({ success: true, card: data, reframed: await shareFraming(data, auth.user.id) });
}

// Un admin supprime une carte.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTcgAdmin(request);
  if (auth.error) return auth.error;

  const id = await cardId(params);
  if (!id) return fail('Carte introuvable.', 404);

  const { error } = await supabaseAdmin.from('czf_tcg_cards').delete().eq('id', id);
  if (error) return fail('Impossible de supprimer la carte.', 500);

  return NextResponse.json({ success: true });
}
