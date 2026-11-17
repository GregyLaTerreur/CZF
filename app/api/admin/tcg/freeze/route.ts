import { NextResponse } from 'next/server';
import { requireTcgAdmin } from '@/lib/tcg/access';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { hasGrant } from '@/lib/grants';

const fail = (message: string, status: number) => NextResponse.json({ success: false, message }, { status });

// Fige la numérotation d'une saison. Une seule fois, sauf pour les admins qui ont le droit
// tcg.refiger_numeros (force : les numéros de la saison sont recalculés et refigés).
export async function POST(request: Request) {
  const auth = await requireTcgAdmin(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const seasonId = Number(body.season_id);
  if (!Number.isInteger(seasonId) || seasonId < 1) return fail('Saison invalide.', 400);

  const force = body.force === true;
  if (force && !(await hasGrant(auth.user.id, 'tcg.refiger_numeros'))) return fail('Tu n’as pas le droit de refiger les numéros.', 403);

  const { data, error } = await supabaseAdmin.rpc('czf_tcg_freeze_numbers', { p_season_id: seasonId, p_profile_id: auth.user.id, p_force: force });

  if (error) {
    if (error.message?.includes('DEJA_FIGE')) return fail('Les numéros de cette saison sont déjà figés.', 409);
    if (error.message?.includes('SAISON_VIDE')) return fail('Aucune carte dans cette saison.', 400);
    if (error.message?.includes('Could not find the function')) return fail('Base pas à jour : lancer czf-import/tcg-8-numero-fige.sql.', 500);
    return fail('Impossible de figer les numéros.', 500);
  }

  return NextResponse.json({ success: true, total: data });
}
