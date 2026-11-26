import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { resolveSeasonId } from '@/lib/tcg/seasons';
import { isSeasonLaunched } from '@/lib/tcg/choices';
import { updateRatings } from '@/lib/ratings/compute';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Recalcul nocturne des notes des joueurs (IPI) de la saison active, appelé par le cron Vercel (vercel.json).
// Rien à faire une fois la collection de la saison lancée : les notes sont figées.
export async function GET(request: Request) {
  // Vercel envoie « Authorization: Bearer <CRON_SECRET> » ; sans CRON_SECRET, la route reste fermée.
  const secret = process.env.CRON_SECRET || '';
  const received = Buffer.from(request.headers.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return NextResponse.json({ success: false, message: 'Non autorisé.' }, { status: 401 });
  }

  const seasonId = await resolveSeasonId(null);
  if (!seasonId) return NextResponse.json({ success: false, message: 'Aucune saison.' }, { status: 404 });
  if (await isSeasonLaunched(seasonId)) return NextResponse.json({ success: true, skipped: 'Collection lancée : notes figées.' });

  try {
    const { updated, skipped } = await updateRatings(seasonId);
    return NextResponse.json({ success: true, season_id: seasonId, updated, not_rated: skipped.length });
  } catch (err) {
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : 'Calcul impossible.' }, { status: 500 });
  }
}
