import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { loadCatalog, loadCollection } from '@/lib/tcg/collection';
import { hasRiotAccount } from '@/lib/tcg/access';

export const dynamic = 'force-dynamic';

// Collection du joueur connecté : ses boosters non ouverts et ses cartes (avec le nombre d'exemplaires).
export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  try {
    // Pas de compte Riot lié : on montre le catalogue (tout grisé), sans boosters ni cartes.
    if (!(await hasRiotAccount(auth.user.id))) {
      const catalog = await loadCatalog();
      return NextResponse.json({ success: true, profileId: auth.user.id, linked: false, boosters: [], ...catalog });
    }

    const [boosters, collection] = await Promise.all([
      supabaseAdmin
        .from('czf_tcg_user_boosters')
        .select('quantity, booster:czf_tcg_boosters(*)')
        .eq('profile_id', auth.user.id)
        .gt('quantity', 0),
      loadCollection(auth.user.id),
    ]);

    if (boosters.error) throw boosters.error;

    return NextResponse.json({
      success: true,
      profileId: auth.user.id,
      linked: true,
      boosters: boosters.data.filter((row) => row.booster),
      ...collection,
    });
  } catch {
    return NextResponse.json({ success: false, message: 'Impossible de charger ta collection.' }, { status: 500 });
  }
}
