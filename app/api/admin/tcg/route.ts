import { NextResponse } from 'next/server';
import { requireTcgAdmin } from '@/lib/tcg/access';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { tcgDbMessage } from '@/lib/tcg/dbError';
import { parseCardInput } from '@/lib/tcg/cards';
import { loadSeasons, resolveSeasonId } from '@/lib/tcg/seasons';
import { decorateCards } from '@/lib/tcg/liveStats';
import { hasGrant } from '@/lib/grants';

export const dynamic = 'force-dynamic';

const fail = (message: string, status: number) => NextResponse.json({ success: false, message }, { status });

// Liste des cartes pour l'admin (les plus récentes d'abord).
export async function GET(request: Request) {
  const auth = await requireTcgAdmin(request);
  if (auth.error) return auth.error;

  const [{ data, error }, seasons, numbering, canRefreeze] = await Promise.all([
    supabaseAdmin.from('czf_tcg_cards').select('*').order('created_at', { ascending: false }),
    loadSeasons(),
    supabaseAdmin.from('czf_tcg_numbering').select('season_id, total, frozen_at'),
    hasGrant(auth.user.id, 'tcg.refiger_numeros'),
  ]);

  if (error) return fail('Impossible de charger les cartes (la table czf_tcg_cards existe-t-elle ?).', 500);

  // Saisons dont la numérotation est figée (table absente tant que le SQL tcg-8 n'est pas passé).
  return NextResponse.json({ success: true, cards: await decorateCards(data || []), seasons, numbering: numbering.error ? null : numbering.data, canRefreeze });
}

// Un admin crée une carte à la main.
export async function POST(request: Request) {
  const auth = await requireTcgAdmin(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const parsed = parseCardInput(body);
  if (parsed.error) return fail(parsed.error, 400);

  const seasonId = await resolveSeasonId(body.season_id);
  if (!seasonId) return fail('Aucune saison en base.', 400);

  const { data, error } = await supabaseAdmin
    .from('czf_tcg_cards')
    .insert({ ...parsed.card, season_id: seasonId, created_by: auth.user.id })
    .select('*')
    .single();

  if (error) return fail(tcgDbMessage(error, 'Impossible de créer la carte.'), 500);

  return NextResponse.json({ success: true, card: data });
}
