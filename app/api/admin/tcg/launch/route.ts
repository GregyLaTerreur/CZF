import { NextResponse } from 'next/server';
import { requireTcgAdmin } from '@/lib/tcg/access';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const fail = (message: string, status: number) => NextResponse.json({ success: false, message }, { status });

// « Lancer la collection » d'une saison : fige les numéros (si besoin), donne le champion le plus
// maîtrisé aux joueurs sans choix, puis verrouille les choix. Une seule fois (débloquer en base, cf. tcg-11).
export async function POST(request: Request) {
  const auth = await requireTcgAdmin(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const seasonId = Number(body.season_id);
  if (!Number.isInteger(seasonId) || seasonId < 1) return fail('Saison invalide.', 400);

  const { data, error } = await supabaseAdmin.rpc('czf_tcg_launch_season', { p_season_id: seasonId, p_profile_id: auth.user.id });

  if (error) {
    if (error.message?.includes('DEJA_LANCE')) return fail('La collection de cette saison est déjà lancée.', 409);
    if (error.message?.includes('SAISON_VIDE')) return fail('Aucune carte dans cette saison.', 400);
    if (error.message?.includes('Could not find the function')) return fail('Base pas à jour : lancer czf-import/tcg-11-choix-skin-lancement.sql.', 500);
    return fail('Impossible de lancer la collection.', 500);
  }

  return NextResponse.json({ success: true, defaults: data });
}
