import { NextResponse } from 'next/server';
import { loadCatalog } from '@/lib/tcg/collection';

export const dynamic = 'force-dynamic';

// Catalogue public (visiteur non connecté) : toutes les cartes, aucune possédée.
export async function GET() {
  try {
    return NextResponse.json({ success: true, linked: false, boosters: [], ...(await loadCatalog()) });
  } catch {
    return NextResponse.json({ success: false, message: 'Impossible de charger les cartes.' }, { status: 500 });
  }
}
