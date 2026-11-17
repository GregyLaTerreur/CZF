import { NextResponse } from 'next/server';
import { requireTcgBeta } from '@/lib/tcg/access';
import { loadCardOwners } from '@/lib/tcg/collection';

export const dynamic = 'force-dynamic';

// Top 20 des détenteurs d'une carte (lecture seule, bêta-testeurs connectés).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTcgBeta(request);
  if (auth.error) return auth.error;

  const cardId = Number((await params).id);
  if (!Number.isInteger(cardId) || cardId < 1) return NextResponse.json({ success: false, message: 'Carte invalide.' }, { status: 400 });

  try {
    return NextResponse.json({ success: true, ...(await loadCardOwners(cardId, 20)) });
  } catch {
    return NextResponse.json({ success: false, message: 'Impossible de charger les détenteurs.' }, { status: 500 });
  }
}
