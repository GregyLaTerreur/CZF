import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { resolveSeasonId } from '@/lib/tcg/seasons';
import { isSeasonLaunched } from '@/lib/tcg/choices';
import { computeRatings, updateRatings } from '@/lib/ratings/compute';

export const dynamic = 'force-dynamic';

const fail = (message: string, status: number) => NextResponse.json({ success: false, message }, { status });

// Aperçu des notes (IPI) de la saison, sans rien enregistrer. ?season=<id>, active par défaut.
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const seasonId = await resolveSeasonId(new URL(request.url).searchParams.get('season'));
  if (!seasonId) return fail('Aucune saison.', 404);

  try {
    return NextResponse.json({ success: true, season_id: seasonId, ratings: await computeRatings(seasonId) });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Calcul impossible.', 500);
  }
}

// Recalcule et enregistre les notes de la saison (czf_player_rating). Bloqué une fois la collection lancée.
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const seasonId = await resolveSeasonId(body.season_id);
  if (!seasonId) return fail('Aucune saison.', 404);
  if (await isSeasonLaunched(seasonId)) return fail('La collection de cette saison est lancée : les notes sont figées.', 409);

  try {
    const { updated, skipped } = await updateRatings(seasonId);
    return NextResponse.json({ success: true, season_id: seasonId, updated, skipped: skipped.map((r) => ({ player_id: r.playerId, riot_id: r.riotId, reason: r.reason })) });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Calcul impossible.', 500);
  }
}
