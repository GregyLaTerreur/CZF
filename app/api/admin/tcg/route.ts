import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { parseCardInput } from '@/lib/tcg/cards';

export const dynamic = 'force-dynamic';

const fail = (message: string, status: number) => NextResponse.json({ success: false, message }, { status });

// Liste des cartes pour l'admin (les plus récentes d'abord).
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const { data, error } = await supabaseAdmin
    .from('czf_tcg_cards')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return fail('Impossible de charger les cartes (la table czf_tcg_cards existe-t-elle ?).', 500);

  return NextResponse.json({ success: true, cards: data });
}

// Un admin crée une carte à la main.
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const parsed = parseCardInput(await request.json().catch(() => ({})));
  if (parsed.error) return fail(parsed.error, 400);

  const { data, error } = await supabaseAdmin
    .from('czf_tcg_cards')
    .insert({ ...parsed.card, created_by: auth.user.id })
    .select('*')
    .single();

  if (error) return fail('Impossible de créer la carte.', 500);

  return NextResponse.json({ success: true, card: data });
}
